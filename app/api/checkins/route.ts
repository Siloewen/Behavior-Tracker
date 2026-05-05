import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import { createServiceClient } from "@/lib/supabase/service";
import { today } from "@/lib/utils";
import { NextResponse } from "next/server";

function isValidScore(score: unknown): score is number {
  return typeof score === "number" && score >= 1 && score <= 5 && Number.isInteger(score * 2);
}

export async function POST(req: Request) {
  const { indicatorId, score } = await req.json();

  if (!indicatorId || !isValidScore(score)) {
    return NextResponse.json({ error: "Invalid check-in" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const userId = await getAppUserId();

  if (isOfflineAppUserId(userId)) {
    return NextResponse.json({ error: "Supabase is unavailable" }, { status: 503 });
  }

  const { data: indicator } = await supabase
    .from("behavioral_indicators")
    .select("id, pillar_id")
    .eq("id", indicatorId)
    .maybeSingle();

  if (!indicator) {
    return NextResponse.json({ error: "Indicator not found" }, { status: 404 });
  }

  const { data: pillar } = await supabase
    .from("pillars")
    .select("id")
    .eq("id", indicator.pillar_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!pillar) {
    return NextResponse.json({ error: "Indicator not found" }, { status: 404 });
  }

  const { error } = await supabase.from("daily_logs").upsert(
    {
      user_id: userId,
      log_date: today(),
      indicator_id: indicatorId,
      score,
      note: null,
    },
    { onConflict: "user_id,log_date,indicator_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
