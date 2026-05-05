import { createServiceClient } from "@/lib/supabase/service";
import { today } from "@/lib/utils";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

type PillarRow = {
  label: string;
  behavioral_indicators: Array<{
    id: string;
    label: string;
    cadence: string;
  }>;
};

type JournalIndicator = {
  id: string;
  label: string;
  cadence: string;
  pillar: string;
};

export type JournalScore = {
  indicator_id: string;
  score: number;
  reasoning: string;
};

export class DailyJournalError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "DailyJournalError";
    this.status = status;
  }
}

async function loadJournalIndicators(userId: string): Promise<JournalIndicator[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pillars")
    .select("label, behavioral_indicators(id, label, cadence)")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("priority_rank");

  if (error) throw new DailyJournalError(error.message);

  const pillars = data as PillarRow[] | null;
  return (pillars ?? []).flatMap((pillar) =>
    pillar.behavioral_indicators.map((indicator) => ({
      ...indicator,
      pillar: pillar.label,
    }))
  );
}

function parseScores(rawText: string): JournalScore[] {
  const jsonText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const parsed = JSON.parse(jsonText) as { scores?: JournalScore[] };

  if (!Array.isArray(parsed.scores)) {
    throw new DailyJournalError("AI response did not include scores");
  }

  return parsed.scores;
}

function validateScores(scores: JournalScore[], indicators: JournalIndicator[]) {
  const indicatorIds = new Set(indicators.map((indicator) => indicator.id));

  for (const score of scores) {
    if (!indicatorIds.has(score.indicator_id)) {
      throw new DailyJournalError("AI response included an unknown indicator");
    }

    if (!Number.isInteger(score.score * 2) || score.score < 1 || score.score > 5) {
      throw new DailyJournalError("AI response included an invalid score");
    }
  }
}

export async function logDailyJournal(userId: string, text: string) {
  const journalText = text.trim();
  if (!journalText) {
    throw new DailyJournalError("Journal text is required", 400);
  }

  const indicators = await loadJournalIndicators(userId);
  if (!indicators.length) {
    throw new DailyJournalError("No pillars configured", 400);
  }

  const indicatorList = indicators
    .map((indicator) => `ID:${indicator.id}  [${indicator.pillar}]  "${indicator.label}"`)
    .join("\n");

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Score this daily journal entry against these behavioral indicators.

INDICATORS:
${indicatorList}

SCORING (1-5, half-point increments allowed):
5 = Clearly did it / clearly stayed clean
4 = Mostly present
3 = Mixed or partial
2 = Barely present or minor slip
1 = Did not happen / bad behavior occurred

RULES:
- Scores must be one of: 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5.
- Avoidance indicators (no cannabis, no alcohol, no gambling): default to 5 unless journal mentions using them. "Had a beer" = 2. "Couple drinks" = 1-2.
- Positive practice indicators (exercise, AI work, connection): default to 1 if not mentioned. Score higher only if mentioned.
- Be direct. Don't inflate.

JOURNAL:
${journalText}

Return ONLY a JSON object - no markdown, no explanation:
{"scores":[{"indicator_id":"<id>","score":<1-5 by 0.5>,"reasoning":"<one short sentence>"}]}`,
      },
    ],
  });

  const raw = message.content[0];
  if (raw.type !== "text") {
    throw new DailyJournalError("Unexpected AI response");
  }

  let scores: JournalScore[];
  try {
    scores = parseScores(raw.text);
    validateScores(scores, indicators);
  } catch (error) {
    if (error instanceof DailyJournalError) throw error;
    throw new DailyJournalError("Could not parse AI response");
  }

  const supabase = createServiceClient();
  const logDate = today();
  const { error } = await supabase.from("daily_logs").upsert(
    scores.map((score) => ({
      user_id: userId,
      log_date: logDate,
      indicator_id: score.indicator_id,
      score: score.score,
      note: score.reasoning,
    })),
    { onConflict: "user_id,log_date,indicator_id" }
  );

  if (error) throw new DailyJournalError(error.message);

  return { logDate, scores };
}
