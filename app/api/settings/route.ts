import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { phone_number, alert_threshold, sms_alerts_enabled } = await req.json();
  const userId = await getAppUserId();
  if (isOfflineAppUserId(userId)) {
    return NextResponse.json({ error: "Supabase is unavailable" }, { status: 503 });
  }

  const supabase = createServiceClient();
  const phone = typeof phone_number === "string" && phone_number.trim()
    ? phone_number.trim()
    : null;

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      phone_number: phone,
      alert_threshold: typeof alert_threshold === "number" ? alert_threshold : 2.5,
      sms_alerts_enabled: Boolean(sms_alerts_enabled) && Boolean(phone),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
