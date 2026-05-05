"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { PillarWithIndicators, DailyLog } from "@/lib/types";
import { dateKey, getWeekStart, identityPct } from "@/lib/utils";

const GOOD_PATH = 4.5;
const BAD_PATH = 1.5;
const NUM_WEEKS = 16;

interface LogWithPillar extends DailyLog {
  behavioral_indicators: { pillar_id: string };
}

interface Props {
  pillars: PillarWithIndicators[];
  logs: LogWithPillar[];
}


function buildWeeks(n: number): string[] {
  const weeks: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weeks.push(getWeekStart(d));
  }
  return weeks;
}

function buildDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(dateKey(d));
  }
  return days;
}

function addDays(dateKeyValue: string, days: number): string {
  const [year, month, day] = dateKeyValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().split("T")[0];
}

function shortLabel(w: string): string {
  return new Date(w + "T00:00:00").toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

function average(scores: number[]): number | null {
  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}

export default function PathClient({ pillars, logs }: Props) {
  const weeks = useMemo(() => buildWeeks(NUM_WEEKS), []);
  const days = useMemo(() => buildDays(NUM_WEEKS * 7), []);
  const currentDay = dateKey();
  const activePillarIds = useMemo(() => new Set(pillars.map((p) => p.id)), [pillars]);

  const dailyScoreMap = useMemo(() => {
    const scoresByDay: Record<string, number[]> = {};
    for (const log of logs) {
      const pid = log.behavioral_indicators?.pillar_id;
      if (!pid || !activePillarIds.has(pid)) continue;
      if (!scoresByDay[log.log_date]) scoresByDay[log.log_date] = [];
      scoresByDay[log.log_date].push(log.score);
    }

    return Object.fromEntries(
      Object.entries(scoresByDay).map(([day, scores]) => [day, average(scores)])
    ) as Record<string, number>;
  }, [activePillarIds, logs]);

  // pillarId → weekStr → scores[]
  const scoreMap = useMemo(() => {
    const map: Record<string, Record<string, number[]>> = {};
    for (const log of logs) {
      const pid = log.behavioral_indicators?.pillar_id;
      if (!pid) continue;
      const w = getWeekStart(log.log_date);
      if (!map[pid]) map[pid] = {};
      if (!map[pid][w]) map[pid][w] = [];
      map[pid][w].push(log.score);
    }
    return map;
  }, [logs]);

  // Daily averages give the trajectory a visible path as soon as multiple check-in days exist.
  const dailyAvg = useMemo(() => {
    return Object.fromEntries(
      days.map((day) => [day, dailyScoreMap[day] ?? null])
    ) as Record<string, number | null>;
  }, [dailyScoreMap, days]);

  const chartData = useMemo(
    () =>
      days.map((day) => ({
        label: shortLabel(day),
        actual: dailyAvg[day] !== null ? +dailyAvg[day]!.toFixed(2) : null,
      })),
    [dailyAvg, days]
  );
  const trajectoryPointCount = chartData.filter((point) => point.actual !== null).length;

  const thisWeekAvg = useMemo(() => {
    const start = addDays(currentDay, -6);
    const scores = Object.entries(dailyScoreMap)
      .filter(([day]) => day >= start && day <= currentDay)
      .map(([, score]) => score);
    return average(scores);
  }, [currentDay, dailyScoreMap]);
  const prevWeekAvg = useMemo(() => {
    const start = addDays(currentDay, -13);
    const end = addDays(currentDay, -7);
    const scores = Object.entries(dailyScoreMap)
      .filter(([day]) => day >= start && day <= end)
      .map(([, score]) => score);
    return average(scores);
  }, [currentDay, dailyScoreMap]);
  const thisScore = thisWeekAvg !== null ? identityPct(thisWeekAvg) : null;
  const prevScore = prevWeekAvg !== null ? identityPct(prevWeekAvg) : null;
  const trend = thisScore !== null && prevScore !== null ? thisScore - prevScore : null;
  const allTimeDailyScores = Object.values(dailyScoreMap);
  const allTimeAvg = average(allTimeDailyScores);
  const allTimeScore = allTimeAvg !== null ? identityPct(allTimeAvg) : null;

  // Per-pillar: 4-week avg vs prior 4-week avg
  const recentWeeks = weeks.slice(-4);
  const priorWeeks = weeks.slice(-8, -4);

  const pillarStats = useMemo(
    () =>
      pillars.map((p) => {
        const recent = recentWeeks.flatMap((w) => scoreMap[p.id]?.[w] ?? []);
        const prior = priorWeeks.flatMap((w) => scoreMap[p.id]?.[w] ?? []);
        const recentAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null;
        const priorAvg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : null;
        const score = recentAvg !== null ? identityPct(recentAvg) : null;
        const trendDelta =
          score !== null && priorAvg !== null ? score - identityPct(priorAvg) : null;
        return { ...p, score, trendDelta };
      }),
    [pillars, scoreMap]
  );

  if (pillars.length === 0) {
    return (
      <div className="text-center pt-16">
        <h1 className="text-xl font-semibold">Path</h1>
        <p className="text-white/40 text-sm mt-2">
          Set up pillars and start checking in to see your trajectory.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Path</h1>
        <p className="text-xs text-white/30 mt-0.5">Which version of you are you becoming?</p>
      </div>

      {/* Identity score */}
      <div className="glass rounded-2xl p-5 mb-4">
        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3">This week</p>
        {thisScore !== null ? (
          <>
            <div className="flex items-end justify-between mb-4">
              <div>
                <span className="text-4xl font-bold tabular-nums">{thisScore}%</span>
                <p className="text-xs text-white/30 mt-1">toward your Good Path</p>
              </div>
              <div className="text-right pb-1">
                {allTimeScore !== null && (
                  <div className="mb-2">
                    <span className="text-sm font-semibold tabular-nums text-white/70">
                      {allTimeScore}%
                    </span>
                    <p className="text-[10px] text-white/25 mt-0.5">all time</p>
                  </div>
                )}
                {trend !== null && (
                  <>
                    <span
                      className={`text-sm font-semibold ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {trend >= 0 ? `↑ +${trend}` : `↓ ${trend}`}
                    </span>
                    <p className="text-[10px] text-white/25 mt-0.5">vs last week</p>
                  </>
                )}
              </div>
            </div>
            <div
              className="relative h-2.5 rounded-full"
              style={{
                background: "linear-gradient(to right, #f87171 0%, #fbbf24 50%, #34d399 100%)",
              }}
            >
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg border-2 border-white/80"
                style={{ left: `${Math.max(4, Math.min(96, thisScore))}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[9px] text-red-400/60">Bad Path</span>
              <span className="text-[9px] text-white/20">——</span>
              <span className="text-[9px] text-emerald-400/60">Good Path</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-white/40">No check-ins logged this week yet.</p>
        )}
      </div>

      {/* 16-week trajectory chart */}
      <div className="glass rounded-2xl p-4 mb-4">
        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-4">
          Trajectory — daily scores, 16 weeks
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 10, right: 28, left: -28, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="2 6"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }}
              tickLine={false}
              axisLine={false}
              interval={27}
            />
            <YAxis
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.15)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#141414",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                fontSize: 11,
                padding: "6px 10px",
              }}
              labelStyle={{ color: "rgba(255,255,255,0.35)", marginBottom: 2 }}
              itemStyle={{ color: "#7c6af7" }}
              formatter={(v) => [typeof v === "number" ? v.toFixed(2) : "—", "Score"]}
            />
            <ReferenceLine
              y={GOOD_PATH}
              stroke="#34d399"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              strokeOpacity={0.6}
              label={{
                value: "Good",
                position: "right",
                fill: "#34d399",
                fontSize: 9,
                opacity: 0.7,
              }}
            />
            <ReferenceLine
              y={BAD_PATH}
              stroke="#f87171"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              strokeOpacity={0.6}
              label={{
                value: "Bad",
                position: "right",
                fill: "#f87171",
                fontSize: 9,
                opacity: 0.7,
              }}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#7c6af7"
              strokeWidth={2}
              dot={{ fill: "#7c6af7", r: 2.5, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: "#7c6af7", stroke: "rgba(124,106,247,0.3)", strokeWidth: 4 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
        {trajectoryPointCount < 2 && (
          <p className="text-[10px] text-center text-white/25 mt-1">
            One logged day so far. Your trajectory line appears after the next check-in day.
          </p>
        )}
        <div className="flex items-center justify-center gap-5 mt-3">
          <div className="flex items-center gap-1.5">
            <svg width="16" height="8" viewBox="0 0 16 8">
              <line
                x1="0"
                y1="4"
                x2="16"
                y2="4"
                stroke="#34d399"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                strokeOpacity="0.6"
              />
            </svg>
            <span className="text-[9px] text-white/30">Good Path</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="16" height="8" viewBox="0 0 16 8">
              <line x1="0" y1="4" x2="16" y2="4" stroke="#7c6af7" strokeWidth="2" />
              <circle cx="8" cy="4" r="2.5" fill="#7c6af7" />
            </svg>
            <span className="text-[9px] text-white/30">You</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="16" height="8" viewBox="0 0 16 8">
              <line
                x1="0"
                y1="4"
                x2="16"
                y2="4"
                stroke="#f87171"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                strokeOpacity="0.6"
              />
            </svg>
            <span className="text-[9px] text-white/30">Bad Path</span>
          </div>
        </div>
      </div>

      {/* Per-pillar breakdown */}
      <div className="glass rounded-2xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-4">
          By pillar — last 4 weeks
        </p>
        <div className="space-y-4">
          {pillarStats.map((p) => (
            <div key={p.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-xs text-white/70">{p.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {p.trendDelta !== null && (
                    <span
                      className={`text-[10px] ${
                        p.trendDelta > 0
                          ? "text-emerald-400"
                          : p.trendDelta < 0
                          ? "text-red-400"
                          : "text-white/30"
                      }`}
                    >
                      {p.trendDelta > 0 ? "↑" : p.trendDelta < 0 ? "↓" : "→"}
                    </span>
                  )}
                  <span className="text-xs font-mono text-white/50">
                    {p.score !== null ? `${p.score}%` : "—"}
                  </span>
                </div>
              </div>
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{
                  background:
                    "linear-gradient(to right, rgba(248,113,113,0.12), rgba(251,191,36,0.12), rgba(52,211,153,0.12))",
                }}
              >
                {p.score !== null && (
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${p.score}%`,
                      backgroundColor:
                        p.score >= 67 ? "#34d399" : p.score >= 33 ? "#fbbf24" : "#f87171",
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
