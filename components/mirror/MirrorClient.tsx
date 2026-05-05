"use client";

import { useMemo } from "react";
import type { PillarWithIndicators, DailyLog } from "@/lib/types";
import { scoreColor, scoreLabel, getWeekStart } from "@/lib/utils";

interface LogWithPillar extends DailyLog {
  behavioral_indicators: { pillar_id: string };
}

interface Props {
  pillars: PillarWithIndicators[];
  logs: LogWithPillar[];
}

function getWeeks(n: number): string[] {
  const weeks: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weeks.push(getWeekStart(d));
  }
  return weeks;
}

export default function MirrorClient({ pillars, logs }: Props) {
  const weeks = useMemo(() => getWeeks(12), []);

  // Build map: pillarId -> weekStart -> avg score
  const pillarWeekScores = useMemo(() => {
    const map: Record<string, Record<string, number[]>> = {};
    for (const log of logs) {
      const pillarId = log.behavioral_indicators?.pillar_id;
      if (!pillarId) continue;
      const week = getWeekStart(log.log_date);
      if (!map[pillarId]) map[pillarId] = {};
      if (!map[pillarId][week]) map[pillarId][week] = [];
      map[pillarId][week].push(log.score);
    }
    return map;
  }, [logs]);

  function weekAvg(pillarId: string, week: string): number | null {
    const scores = pillarWeekScores[pillarId]?.[week];
    if (!scores?.length) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  // Behavioral rank: sort pillars by their recent 4-week average (desc)
  const recentWeeks = weeks.slice(-4);
  const behavioralRanks = useMemo(() => {
    return [...pillars]
      .map(p => {
        const scores = recentWeeks.flatMap(w => {
          const avg = weekAvg(p.id, w);
          return avg !== null ? [avg] : [];
        });
        const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        return { id: p.id, avg };
      })
      .sort((a, b) => b.avg - a.avg)
      .map((p, i) => ({ [p.id]: i + 1 }))
      .reduce((acc, cur) => ({ ...acc, ...cur }), {} as Record<string, number>);
  }, [pillars, logs]);

  if (pillars.length === 0) {
    return (
      <div className="text-center pt-16">
        <h1 className="text-xl font-semibold">Mirror</h1>
        <p className="text-white/40 text-sm mt-2">Set up pillars and start checking in to see your data.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Mirror</h1>
        <p className="text-xs text-white/30 mt-0.5">Who you're actually becoming — last 12 weeks</p>
      </div>

      {/* Gap analysis: stated rank vs behavioral rank */}
      <div className="glass rounded-2xl p-4 mb-5">
        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Priority gap</p>
        <div className="grid grid-cols-3 text-[10px] uppercase tracking-widest text-white/25 mb-2">
          <span>Pillar</span>
          <span className="text-center">You say</span>
          <span className="text-center">You do</span>
        </div>
        {pillars.map(p => {
          const stated = p.priority_rank;
          const actual = behavioralRanks[p.id] ?? "—";
          const gap = typeof actual === "number" ? actual - stated : 0;
          return (
            <div key={p.id} className="grid grid-cols-3 items-center py-1.5 border-t border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-xs text-white/70 truncate">{p.label}</span>
              </div>
              <span className="text-center text-sm font-mono">#{stated}</span>
              <div className="flex items-center justify-center gap-1">
                <span className="text-sm font-mono">#{actual}</span>
                {gap > 1 && <span className="text-[10px] text-red-400">↓{gap}</span>}
                {gap < -1 && <span className="text-[10px] text-emerald-400">↑{Math.abs(gap)}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-pillar sparklines */}
      <div className="space-y-3">
        {pillars.map(p => {
          const recentAvgs = recentWeeks.map(w => weekAvg(p.id, w));
          const latestScore = recentAvgs.filter(s => s !== null).at(-1) ?? 0;

          return (
            <div key={p.id} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-sm font-medium">{p.label}</span>
                </div>
                <span className={`text-xs font-mono ${scoreColor(latestScore)}`}>
                  {latestScore > 0 ? latestScore.toFixed(1) : "—"}
                </span>
              </div>

              {/* 12-week bar chart */}
              <div className="flex items-end gap-1 h-10">
                {weeks.map(w => {
                  const avg = weekAvg(p.id, w);
                  const height = avg !== null ? (avg / 5) * 100 : 0;
                  return (
                    <div
                      key={w}
                      className="flex-1 rounded-sm transition-all"
                      style={{
                        height: avg !== null ? `${Math.max(4, height)}%` : "4%",
                        backgroundColor: avg !== null ? p.color : "rgba(255,255,255,0.06)",
                        opacity: avg !== null ? 0.3 + (avg / 5) * 0.7 : 1,
                      }}
                      title={avg !== null ? `${w}: ${avg.toFixed(1)}` : `${w}: no data`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-1 text-[9px] text-white/15">
                <span>12w ago</span>
                <span>now</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
