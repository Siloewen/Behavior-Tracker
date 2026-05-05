import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { getWeekStart, today } from "@/lib/utils";
import type { UserSettings, PillarWithIndicators, DailyLog } from "@/lib/types";
import twilio from "twilio";

// Called by a cron job (e.g. daily at 9pm). Authorization: Bearer <CRON_SECRET>
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const { data: settingsRaw } = await supabase
    .from("user_settings")
    .select("*")
    .eq("sms_alerts_enabled", true)
    .not("phone_number", "is", null);

  const settings = settingsRaw as UserSettings[] | null;
  if (!settings?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;

  for (const setting of settings) {
    const weekStart = getWeekStart();
    const twoWeeksAgo = getWeekStart(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));

    const { data: pillarsRaw } = await supabase
      .from("pillars")
      .select("*, behavioral_indicators(*)")
      .eq("user_id", setting.user_id)
      .is("archived_at", null)
      .order("priority_rank");

    const pillars = pillarsRaw as PillarWithIndicators[] | null;
    if (!pillars?.length) continue;

    const { data: logsRaw } = await supabase
      .from("daily_logs")
      .select("*, behavioral_indicators(pillar_id)")
      .eq("user_id", setting.user_id)
      .gte("log_date", twoWeeksAgo);

    type LogWithPillar = DailyLog & { behavioral_indicators: { pillar_id: string } };
    const logs = logsRaw as LogWithPillar[] | null;

    const weekScores: Record<string, Record<string, number[]>> = {};
    for (const log of logs ?? []) {
      const pid = log.behavioral_indicators?.pillar_id;
      if (!pid) continue;
      const week = getWeekStart(log.log_date);
      if (!weekScores[pid]) weekScores[pid] = {};
      if (!weekScores[pid][week]) weekScores[pid][week] = [];
      weekScores[pid][week].push(log.score);
    }

    const driftingPillars = pillars.filter(p => {
      const thisWeek = weekScores[p.id]?.[weekStart] ?? [];
      const lastWeek = weekScores[p.id]?.[twoWeeksAgo] ?? [];
      const thisAvg = thisWeek.length ? thisWeek.reduce((a, b) => a + b) / thisWeek.length : null;
      const lastAvg = lastWeek.length ? lastWeek.reduce((a, b) => a + b) / lastWeek.length : null;
      return (thisAvg === null || thisAvg < setting.alert_threshold) &&
        (lastAvg === null || lastAvg < setting.alert_threshold);
    });

    const { data: recentLogRaw } = await supabase
      .from("daily_logs")
      .select("log_date")
      .eq("user_id", setting.user_id)
      .order("log_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const recentLog = recentLogRaw as { log_date: string } | null;
    const lastLogDate = recentLog?.log_date ? new Date(recentLog.log_date + "T00:00:00") : null;
    const daysSinceLog = lastLogDate
      ? Math.floor((Date.now() - lastLogDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    if (driftingPillars.length === 0 && daysSinceLog < 10) continue;

    const targetPillar = driftingPillars[0] ?? pillars[0];
    const indicatorIds = targetPillar.behavioral_indicators.map(i => i.id);
    const indicatorList = targetPillar.behavioral_indicators.map(i => `• ${i.label}`).join("\n");

    let message = "";
    if (daysSinceLog >= 10) {
      message = `Mirror: ${daysSinceLog} days without a check-in. The person you're becoming is built in the gaps.\n\n"${targetPillar.label}":\n${indicatorList}\n\nReply 1-5, halves allowed like 3.5, to log today.`;
    } else {
      message = `Mirror: "${targetPillar.label}" has been weak for 2+ weeks. You're building in the AGI era — compound interest applies to character too.\n\n${indicatorList}\n\nReply 1-5, halves allowed like 3.5, to log today's score.`;
    }

    await supabase.from("sms_pending_replies").insert({
      user_id: setting.user_id,
      phone_number: setting.phone_number,
      pillar_id: targetPillar.id,
      indicator_ids: indicatorIds,
      log_date: today(),
    });

    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: setting.phone_number!,
    });

    sent++;
  }

  return NextResponse.json({ sent });
}
