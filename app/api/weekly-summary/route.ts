import { createServiceClient } from "@/lib/supabase/service";
import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import type { PillarWithIndicators, DailyLog, BehavioralIndicator } from "@/lib/types";
import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const supabase = createServiceClient();
  const userId = await getAppUserId();

  if (isOfflineAppUserId(userId)) {
    return NextResponse.json({ error: "Supabase is unavailable" }, { status: 503 });
  }

  const { weekStart } = await req.json();

  const { data: pillarsRaw } = await supabase
    .from("pillars")
    .select("*, behavioral_indicators(*)")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("priority_rank");

  const pillars = pillarsRaw as PillarWithIndicators[] | null;

  const { data: logsRaw } = await supabase
    .from("daily_logs")
    .select("*, behavioral_indicators(label, pillar_id)")
    .eq("user_id", userId)
    .gte("log_date", weekStart);

  type LogWithMeta = DailyLog & { behavioral_indicators: { label: string; pillar_id: string } };
  const logs = logsRaw as LogWithMeta[] | null;

  if (!pillars?.length) {
    return NextResponse.json({ error: "No pillars" }, { status: 400 });
  }

  const pillarSummaries: Record<string, number[]> = {};
  const indicatorSummaries: Record<string, { label: string; scores: number[] }> = {};

  for (const log of logs ?? []) {
    const pid = log.behavioral_indicators?.pillar_id;
    const iLabel = log.behavioral_indicators?.label;
    if (!pid) continue;
    if (!pillarSummaries[pid]) pillarSummaries[pid] = [];
    pillarSummaries[pid].push(log.score);
    if (!indicatorSummaries[log.indicator_id]) {
      indicatorSummaries[log.indicator_id] = { label: iLabel, scores: [] };
    }
    indicatorSummaries[log.indicator_id].scores.push(log.score);
  }

  const dataLines = pillars.map(p => {
    const scores = pillarSummaries[p.id] ?? [];
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "no data";
    const inds = p.behavioral_indicators.map(i => {
      const iData = indicatorSummaries[i.id];
      const iAvg = iData?.scores.length
        ? (iData.scores.reduce((a, b) => a + b, 0) / iData.scores.length).toFixed(1)
        : "no data";
      return `    - ${i.label}: ${iAvg}/5`;
    });
    return `${p.label} (priority #${p.priority_rank}): avg ${avg}/5\n${inds.join("\n")}`;
  }).join("\n\n");

  const prompt = `You are writing a brief, honest weekly character report for Simon (38 years old, building a career in AI and agriculture, focused on family and financial discipline). He has a history of strong starts that fall off after a few weeks — which is why this app exists.

Context he holds: we are on the verge of AGI and a potential explosion in human healthspan. The compounding value of the person he becomes NOW — his health, his skills, his financial discipline, his relationships — is dramatically higher than in any prior generation. He may have decades more productive life ahead than he expects. The character he builds in the next 2-5 years may shape the next 50. This is not a reason to be cheerful — it's a reason to be precise about drift.

Here is his behavioral data for the week of ${weekStart}. Each metric is scored 1-5 in half-point increments (1=absent, 5=strong):

${dataLines}

Write 3-5 sentences. Be honest and direct, not motivational. Name what's working and what isn't, using specific pillar names. If there are gaps between his stated priorities (lower number = higher priority) and his actual scores, call that out plainly. No cheerleading. End with one concrete observation about what his behavior this week says about who he is currently becoming — and whether that person is positioned for the world he believes is coming.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const narrativeText = completion.choices[0]?.message?.content ?? "";

  const pillarScores: Record<string, number> = {};
  for (const [id, scores] of Object.entries(pillarSummaries)) {
    pillarScores[id] = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  const { data: summary } = await supabase
    .from("weekly_summaries")
    .upsert(
      { user_id: userId, week_start: weekStart, pillar_scores: pillarScores, narrative_text: narrativeText },
      { onConflict: "user_id,week_start" }
    )
    .select()
    .single();

  return NextResponse.json({ summary });
}
