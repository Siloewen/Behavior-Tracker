import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import { createServiceClient } from "@/lib/supabase/service";
import { APP_TIME_ZONE, today } from "@/lib/utils";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type VoiceCallRow = {
  id: string;
  status: string;
  vapi_call_id: string | null;
};

function localMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return hour * 60 + minute;
}

function isCheckinWindow(date = new Date()) {
  const target = (19 * 60) + 50;
  const current = localMinutes(date);
  return current >= target - 5 && current <= target + 20;
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function parseBody(req: Request) {
  try {
    return await req.json() as { force?: boolean };
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  const cronSecret = process.env.VOICE_CRON_SECRET ?? process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await parseBody(req);
  if (!body.force && !isCheckinWindow()) {
    return NextResponse.json({ skipped: true, reason: "Outside the daily check-in window" });
  }

  const userId = await getAppUserId();
  if (isOfflineAppUserId(userId)) {
    return NextResponse.json({ error: "Supabase is unavailable" }, { status: 503 });
  }

  let appBaseUrl: string;
  let vapiApiKey: string;
  let assistantId: string;
  let phoneNumberId: string;
  let customerNumber: string;

  try {
    appBaseUrl = requiredEnv("APP_BASE_URL");
    vapiApiKey = requiredEnv("VAPI_API_KEY");
    assistantId = requiredEnv("VAPI_DAILY_CHECKIN_ASSISTANT_ID");
    phoneNumberId = requiredEnv("VAPI_PHONE_NUMBER_ID");
    customerNumber = requiredEnv("DAILY_CHECKIN_PHONE_NUMBER");
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Missing env" }, { status: 500 });
  }

  const supabase = createServiceClient();
  const callDate = today();
  const { data: existingRaw, error: existingError } = await supabase
    .from("voice_checkin_calls")
    .select("id, status, vapi_call_id")
    .eq("user_id", userId)
    .eq("call_date", callDate)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const existing = existingRaw as VoiceCallRow | null;
  if (existing && existing.status !== "failed") {
    return NextResponse.json({
      skipped: true,
      reason: "Daily voice check-in already started",
      callId: existing.vapi_call_id,
      status: existing.status,
    });
  }

  const callRecord = existing
    ? await supabase
      .from("voice_checkin_calls")
      .update({ status: "creating", error: null, phone_number: customerNumber })
      .eq("id", existing.id)
      .select("id")
      .single()
    : await supabase
      .from("voice_checkin_calls")
      .insert({
        user_id: userId,
        call_date: callDate,
        phone_number: customerNumber,
        status: "creating",
      })
      .select("id")
      .single();

  if (callRecord.error) {
    return NextResponse.json({ error: callRecord.error.message }, { status: 500 });
  }

  const callBody = {
    assistantId,
    phoneNumberId,
    customer: { number: customerNumber },
    assistantOverrides: {
      variableValues: {
        appBaseUrl,
        logDate: callDate,
        timeZone: APP_TIME_ZONE,
      },
    },
  };

  const response = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vapiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(callBody),
  });

  const responseJson = await response.json().catch(() => null) as { id?: string } | null;

  if (!response.ok) {
    const message = responseJson ? JSON.stringify(responseJson) : response.statusText;
    await supabase
      .from("voice_checkin_calls")
      .update({ status: "failed", error: message, response_json: responseJson })
      .eq("id", callRecord.data.id);

    return NextResponse.json({ error: "Could not start Vapi call", details: responseJson }, { status: 502 });
  }

  await supabase
    .from("voice_checkin_calls")
    .update({
      status: "created",
      vapi_call_id: responseJson?.id ?? null,
      response_json: responseJson,
      error: null,
    })
    .eq("id", callRecord.data.id);

  return NextResponse.json({
    ok: true,
    callDate,
    callId: responseJson?.id ?? null,
  });
}
