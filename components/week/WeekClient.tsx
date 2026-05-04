"use client";

import { useState } from "react";
import type { PillarWithIndicators, DailyLog, WeeklySummary } from "@/lib/types";
import { scoreColor, scoreLabel, formatDate } from "@/lib/utils";

interface LogWithPillar extends DailyLog {
  behavioral_indicators: { pillar_id: string };
}

interface Props {
  pillars: PillarWithIndicators[];
  logs: LogWithPillar[];
  summary: WeeklySummary | null;
  weekStart: string;
}

export default function WeekClient({ pillars, logs, summary: initialSummary, weekStart }: Props) {
  const [summary, setSummary] = useState(initialSummary);
  const [generating, setGenerating] = useState(false);

  // Compute per-pillar avg score this week
  const pillarScores: Record<string, number[]> = {};
  for (const log of logs) {
    const pid = log.behavioral_indicators?.pillar_id;
    if (!pid) continue;
    if (!pillarScores[pid]) pillarScores[pid] = [];
    pillarScores[pid].push(log.score);
  }

  async function generateNarrative() {
    setGenerating(true);
    const res = await fetch("/api/weekly-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart }),
    });
    const data = await res.json();
    if (data.summary) setSummary(data.summary);
    setGenerating(false);
  }

  const weekLabel = formatDate(weekStart);

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs text-white/30 uppercase tracking-widest">Week of {weekLabel}</p>
        <h1 className="text-xl font-semibold mt-1">This week</h1>
      </div>

      {/* Pillar scores */}
      <div className="glass rounded-2xl p-4 mb-4">
        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Pillar scores</p>
        {pillars.length === 0 ? (
          <p className="text-sm text-white/30">No pillars set up yet.</p>
        ) : (
          <div className="space-y-3">
            {pillars.map(p => {
              const scores = pillarScores[p.id] ?? [];
              const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-sm text-white/70 flex-1 truncate">{p.label}</span>
                  <div className="flex items-center gap-2">
                    {avg !== null ? (
                      <>
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${(avg / 5) * 100}%`, backgroundColor: p.color }}
                          />
                        </div>
                        <span className={`text-xs font-mono w-6 text-right ${scoreColor(avg)}`}>
                          {avg.toFixed(1)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-white/20">no data</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Claude narrative */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-white/40">The honest take</p>
          <button
            onClick={generateNarrative}
            disabled={generating}
            className="text-xs text-accent hover:text-white disabled:opacity-50 transition-colors"
          >
            {generating ? "Generating…" : summary ? "Regenerate" : "Generate →"}
          </button>
        </div>

        {summary?.narrative_text ? (
          <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">
            {summary.narrative_text}
          </p>
        ) : (
          <p className="text-sm text-white/25 italic">
            {generating
              ? "Thinking honestly about your week…"
              : "Hit generate to get an honest read on your week from Claude."}
          </p>
        )}
      </div>
    </div>
  );
}
