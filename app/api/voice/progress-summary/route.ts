import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import { createServiceClient } from "@/lib/supabase/service";
import type { DailyLog, PillarWithIndicators } from "@/lib/types";
import { APP_TIME_ZONE, effectiveLogDate, getWeekStart, identityPct, today } from "@/lib/utils";
import {
  getVoiceToolArguments,
  isAuthorizedVoiceRequest,
  readVoiceToolBody,
  voiceToolJson,
  voiceUnauthorizedResponse,
} from "@/lib/voice-tools";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type LogWithMeta = DailyLog & {
  behavioral_indicators: {
    label: string;
    pillar_id: string;
  } | null;
};

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

function addDays(dateKey: string, days: number) {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().split("T")[0];
}

function buildWeeks(count: number) {
  const currentWeek = getWeekStart();
  return Array.from({ length: count }, (_, index) => addDays(currentWeek, (index - count + 1) * 7));
}

function average(scores: number[]) {
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
}

function round(value: number | null) {
  return value === null ? null : Number(value.toFixed(2));
}

function scoreDirection(delta: number | null) {
  if (delta === null) return "no comparison";
  if (delta >= 5) return "improving";
  if (delta <= -5) return "slipping";
  return "flat";
}

export async function POST(req: Request) {
  if (!isAuthorizedVoiceRequest(req)) {
    return voiceUnauthorizedResponse();
  }

  const body = await readVoiceToolBody(req);
  const args = getVoiceToolArguments(body);
  const requestedWeeks = typeof args.weeks === "number" ? Math.trunc(args.weeks) : 8;
  const weekCount = Math.min(Math.max(requestedWeeks, 4), 12);

  const userId = await getAppUserId();
  if (isOfflineAppUserId(userId)) {
    return voiceToolJson(body, { ok: false, error: "Supabase is unavailable" });
  }

  const weeks = buildWeeks(weekCount);
  const currentWeek = weeks[weeks.length - 1];
  const previousWeek = weeks[weeks.length - 2];
  const logDate = today();
  const supabase = createServiceClient();

  const { data: pillarsRaw, error: pillarsError } = await supabase
    .from("pillars")
    .select("*, behavioral_indicators(*)")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("priority_rank");

  if (pillarsError) {
    return NextResponse.json({ error: pillarsError.message }, { status: 500 });
  }

  const { data: logsRaw, error: logsError } = await supabase
    .from("daily_logs")
    .select("*, behavioral_indicators(label, pillar_id)")
    .eq("user_id", userId)
    .gte("log_date", weeks[0]);

  if (logsError) {
    return NextResponse.json({ error: logsError.message }, { status: 500 });
  }

  const pillars = (pillarsRaw ?? []) as PillarWithIndicators[];
  const logs = (logsRaw ?? []) as LogWithMeta[];
  const weekSet = new Set(weeks);
  const scoreMap: Record<string, Record<string, number[]>> = {};
  const indicatorMap: Record<string, Record<string, number[]>> = {};
  const todayLogged = new Set<string>();

  for (const log of logs) {
    if (log.log_date === logDate) todayLogged.add(log.indicator_id);

    const pillarId = log.behavioral_indicators?.pillar_id;
    if (!pillarId) continue;

    const week = getWeekStart(effectiveLogDate(log.log_date, log.created_at));
    if (!weekSet.has(week)) continue;

    scoreMap[pillarId] ??= {};
    scoreMap[pillarId][week] ??= [];
    scoreMap[pillarId][week].push(log.score);

    indicatorMap[log.indicator_id] ??= {};
    indicatorMap[log.indicator_id][week] ??= [];
    indicatorMap[log.indicator_id][week].push(log.score);
  }

  const weeklyAverages = weeks.map((week) => {
    const scores = pillars.flatMap((pillar) => scoreMap[pillar.id]?.[week] ?? []);
    const avg = average(scores);
    return {
      week,
      averageScore: round(avg),
      identityScore: avg === null ? null : identityPct(avg),
      logs: scores.length,
    };
  });

  const thisWeekAvg = weeklyAverages.find((week) => week.week === currentWeek)?.averageScore ?? null;
  const previousWeekAvg = weeklyAverages.find((week) => week.week === previousWeek)?.averageScore ?? null;
  const thisIdentity = thisWeekAvg === null ? null : identityPct(thisWeekAvg);
  const previousIdentity = previousWeekAvg === null ? null : identityPct(previousWeekAvg);
  const identityTrend = thisIdentity !== null && previousIdentity !== null ? thisIdentity - previousIdentity : null;

  const recentWeeks = weeks.slice(-4);
  const priorWeeks = weeks.slice(-8, -4);
  const pillarSummaries = pillars.map((pillar) => {
    const thisWeekScores = scoreMap[pillar.id]?.[currentWeek] ?? [];
    const previousWeekScores = scoreMap[pillar.id]?.[previousWeek] ?? [];
    const recentScores = recentWeeks.flatMap((week) => scoreMap[pillar.id]?.[week] ?? []);
    const priorScores = priorWeeks.flatMap((week) => scoreMap[pillar.id]?.[week] ?? []);
    const recentAvg = average(recentScores);
    const priorAvg = average(priorScores);
    const trendDelta = recentAvg !== null && priorAvg !== null
      ? identityPct(recentAvg) - identityPct(priorAvg)
      : null;

    return {
      id: pillar.id,
      label: pillar.label,
      priorityRank: pillar.priority_rank,
      thisWeekAverage: round(average(thisWeekScores)),
      previousWeekAverage: round(average(previousWeekScores)),
      recentFourWeekAverage: round(recentAvg),
      priorFourWeekAverage: round(priorAvg),
      identityTrendDelta: trendDelta,
      direction: scoreDirection(trendDelta),
      indicators: pillar.behavioral_indicators.map((indicator) => ({
        id: indicator.id,
        label: indicator.label,
        cadence: indicator.cadence,
        thisWeekAverage: round(average(indicatorMap[indicator.id]?.[currentWeek] ?? [])),
        alreadyLoggedToday: todayLogged.has(indicator.id),
      })),
    };
  });

  const totalDailyIndicators = pillars.flatMap((pillar) =>
    pillar.behavioral_indicators.filter((indicator) => indicator.cadence === "daily")
  ).length;
  const loggedDailyIndicators = pillars
    .flatMap((pillar) => pillar.behavioral_indicators)
    .filter((indicator) => indicator.cadence === "daily" && todayLogged.has(indicator.id)).length;

  const weakest = pillarSummaries
    .filter((pillar) => pillar.thisWeekAverage !== null)
    .sort((a, b) => (a.thisWeekAverage ?? 0) - (b.thisWeekAverage ?? 0))[0];
  const strongest = pillarSummaries
    .filter((pillar) => pillar.thisWeekAverage !== null)
    .sort((a, b) => (b.thisWeekAverage ?? 0) - (a.thisWeekAverage ?? 0))[0];
  const slipping = pillarSummaries.filter((pillar) => (pillar.identityTrendDelta ?? 0) <= -5);

  const summaryTextParts = [
    thisWeekAvg === null
      ? "There is not enough data logged this week to judge progress yet."
      : `This week's overall average is ${thisWeekAvg}/5, which maps to an identity score of ${thisIdentity}/100.`,
  ];

  if (identityTrend !== null) {
    summaryTextParts.push(
      identityTrend > 0
        ? `That is up ${identityTrend} points from last week.`
        : identityTrend < 0
          ? `That is down ${Math.abs(identityTrend)} points from last week.`
          : "That is flat compared with last week."
    );
  }

  if (strongest) summaryTextParts.push(`Strongest pillar this week: ${strongest.label} at ${strongest.thisWeekAverage}/5.`);
  if (weakest) summaryTextParts.push(`Weakest pillar this week: ${weakest.label} at ${weakest.thisWeekAverage}/5.`);
  if (slipping.length) {
    summaryTextParts.push(`Pillars slipping over the recent four-week view: ${slipping.map((pillar) => pillar.label).join(", ")}.`);
  }

  return voiceToolJson(body, {
    ok: true,
    logDate,
    timeZone: APP_TIME_ZONE,
    weekStart: currentWeek,
    todayCoverage: {
      loggedDailyIndicators,
      totalDailyIndicators,
      alreadyLoggedToday: loggedDailyIndicators > 0,
    },
    overall: {
      thisWeekAverage: thisWeekAvg,
      previousWeekAverage: previousWeekAvg,
      identityScore: thisIdentity,
      previousIdentityScore: previousIdentity,
      identityTrendDelta: identityTrend,
      direction: scoreDirection(identityTrend),
    },
    weeklyAverages,
    pillars: pillarSummaries,
    summaryText: summaryTextParts.join(" "),
  });
}
