import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import type { SmsPendingReply } from "@/lib/types";

export async function POST(req: Request) {
  const body = await req.text();
  const params = new URLSearchParams(body);

  const from = params.get("From");
  const messageBody = params.get("Body")?.trim() ?? "";
  const score = parseInt(messageBody, 10);

  function twiml(msg: string) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg}</Message></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  if (!from) return twiml("Could not identify sender.");

  if (isNaN(score) || score < 1 || score > 5) {
    return twiml("Reply with a number 1–5 to log your score. (1=absent, 5=strong)");
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

  const labels: Record<number, string> = { 1: "Absent", 2: "Weak", 3: "Mixed", 4: "Good", 5: "Strong" };
  return twiml(`Logged: ${score}/5 — ${labels[score]}. Check the Mirror for your trends.`);
}
