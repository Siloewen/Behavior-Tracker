import CheckInClient from "@/components/checkin/CheckInClient";
import SupabaseOffline from "@/components/ui/SupabaseOffline";
import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import { createServiceClient } from "@/lib/supabase/service";
import { today, getWeekStart, utcDateKey } from "@/lib/utils";
import { unstable_noStore as noStore } from "next/cache";

export default async function DashboardPage() {
  noStore();
  const supabase = createServiceClient();
  const userId = await getAppUserId();

  if (isOfflineAppUserId(userId)) {
    return <SupabaseOffline />;
  }

  const { data: pillars } = await supabase
    .from("pillars")
    .select("*, behavioral_indicators(*)")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("priority_rank");

  const { data: todayLogs } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .in("log_date", Array.from(new Set([today(), utcDateKey()])));

  // Current week average for path score widget
  const weekStart = getWeekStart();
  const { data: weekLogs } = await supabase
    .from("daily_logs")
    .select("score")
    .eq("user_id", userId)
    .gte("log_date", weekStart);

  const weekScores = (weekLogs ?? []).map((l) => l.score as number);
  const weekAvg =
    weekScores.length > 0
      ? weekScores.reduce((a, b) => a + b, 0) / weekScores.length
      : null;

  return (
    <CheckInClient
      pillars={pillars ?? []}
      existingLogs={todayLogs ?? []}
      weekAvg={weekAvg}
    />
  );
}
