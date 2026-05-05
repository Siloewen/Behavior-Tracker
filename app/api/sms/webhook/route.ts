import { createServiceClient } from "@/lib/supabase/service";
import { scoreLabel } from "@/lib/utils";
import { NextResponse } from "next/server";
import type { SmsPendingReply } from "@/lib/types";

function isValidScore(score: number) {
  return score >= 1 && score <= 5 && Number.isInteger(score * 2);
}

export async function POST(req: Request) {
  const body = await req.text();
  const params = new URLSearchParams(body);

  const from = params.get("From");
  const messageBody = params.get("Body")?.trim() ?? "";
  const score = Number(messageBody);

  function twiml(msg: string) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg}</Message></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  if (!from) return twiml("Could not identify sender.");

  if (!isValidScore(score)) {
    return twiml("Reply with a number 1-5, including halves like 3.5, to log your score.");
  }

  const supabase = createServiceClient();

  const { data: pendingRaw } = await supabase
    .from("sms_pending_replies")
    .select("*")
    .eq("phone_number", from)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const pending = pendingRaw as SmsPendingReply | null;

  if (!pending) {
    return twiml("No pending check-in found. Open the Mirror app to log manually.");
  }

  const logRows = (pending.indicator_ids as string[]).map((indicatorId: string) => ({
    user_id: pending.user_id,
    log_date: pending.log_date,
    indicator_id: indicatorId,
    score,
    note: "via SMS",
  }));

  await supabase
    .from("daily_logs")
    .upsert(logRows, { onConflict: "user_id,log_date,indicator_id" });

  await supabase.from("sms_pending_replies").delete().eq("id", pending.id);

  return twiml(`Logged: ${score}/5 - ${scoreLabel(score)}. Check the Mirror for your trends.`);
}
