import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import { createServiceClient } from "@/lib/supabase/service";
import type { DailyLog, PillarWithIndicators } from "@/lib/types";
import { APP_TIME_ZONE, today } from "@/lib/utils";
import {
  isAuthorizedVoiceRequest,
  readVoiceToolBody,
  voiceToolJson,
  voiceUnauthorizedResponse,
} from "@/lib/voice-tools";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAuthorizedVoiceRequest(req)) {
    return voiceUnauthorizedResponse();
  }

  const body = await readVoiceToolBody(req);
  const userId = await getAppUserId();
  if (isOfflineAppUserId(userId)) {
    return voiceToolJson(body, { ok: false, error: "Supabase is unavailable" });
  }

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
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", logDate);

  if (logsError) {
    return NextResponse.json({ error: logsError.message }, { status: 500 });
  }

  const pillars = (pillarsRaw ?? []) as PillarWithIndicators[];
  const logs = (logsRaw ?? []) as DailyLog[];
  const loggedIndicatorIds = new Set(logs.map((log) => log.indicator_id));
  const dailyIndicators = pillars.flatMap((pillar) =>
    pillar.behavioral_indicators.filter((indicator) => indicator.cadence === "daily")
  );

  return voiceToolJson(body, {
    ok: true,
    logDate,
    timeZone: APP_TIME_ZONE,
    alreadyLoggedToday: logs.length > 0,
    loggedDailyIndicators: dailyIndicators.filter((indicator) => loggedIndicatorIds.has(indicator.id)).length,
    totalDailyIndicators: dailyIndicators.length,
    pillars: pillars.map((pillar) => ({
      id: pillar.id,
      label: pillar.label,
      description: pillar.description,
      indicators: pillar.behavioral_indicators.map((indicator) => ({
        id: indicator.id,
        label: indicator.label,
        cadence: indicator.cadence,
        alreadyLoggedToday: loggedIndicatorIds.has(indicator.id),
      })),
    })),
  });
}
