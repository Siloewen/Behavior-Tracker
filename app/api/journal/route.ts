import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import { createServiceClient } from "@/lib/supabase/service";
import { today } from "@/lib/utils";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic();

type IndicatorRow = { id: string; label: string; cadence: string };

export async function POST(req: Request) {
  const { text } = await req.json();
  if (!text?.trim()) {
    return NextResponse.json({ error: "Journal text is required" }, { status: 400 });
  }

  const userId = await getAppUserId();
  if (isOfflineAppUserId(userId)) {
    return NextResponse.json({ error: "Supabase unavailable" }, { status: 503 });
  }

  const supabase = createServiceClient();

  const { data: pillars } = await supabase
    .from("pillars")
    .select("label, behavioral_indicators(id, label, cadence)")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("priority_rank");

  if (!pillars?.length) {
    return NextResponse.json({ error: "No pillars configured" }, { status: 400 });
  }

  const indicators = (pillars as Array<{ label: string; behavioral_indicators: IndicatorRow[] }>).flatMap(
    (p) => p.behavioral_indicators.map((ind) => ({ ...ind, pillar: p.label }))
  );

  const indicatorList = indicators
    .map((i) => `ID:${i.id}  [${i.pillar}]  "${i.label}"`)
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

SCORING (1-5):
5 = Clearly did it / clearly stayed clean
4 = Mostly present
3 = Mixed or partial
2 = Barely present or minor slip
1 = Did not happen / bad behavior occurred

RULES:
- Avoidance indicators (no cannabis, no alcohol, no gambling): default to 5 unless journal mentions using them. "Had a beer" = 2. "Couple drinks" = 1-2.
- Positive practice indicators (exercise, AI work, connection): default to 1 if not mentioned. Score higher only if mentioned.
- Be direct. Don't inflate.

JOURNAL:
${text}

Return ONLY a JSON object — no markdown, no explanation:
{"scores":[{"indicator_id":"<id>","score":<1-5>,"reasoning":"<one short sentence>"}]}`,
      },
    ],
  });

  const raw = message.content[0];
  if (raw.type !== "text") {
    return NextResponse.json({ error: "Unexpected AI response" }, { status: 500 });
  }

  let scores: Array<{ indicator_id: string; score: number; reasoning: string }>;
  try {
    const jsonText = raw.text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    scores = JSON.parse(jsonText).scores;
  } catch {
    return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
  }

  // Upsert scores and reasoning into daily_logs
  const logDate = today();
  for (const s of scores) {
    await supabase.from("daily_logs").upsert(
      {
        user_id: userId,
        log_date: logDate,
        indicator_id: s.indicator_id,
        score: s.score,
        note: s.reasoning,
      },
      { onConflict: "user_id,log_date,indicator_id" }
    );
  }

  return NextResponse.json({ scores });
}
