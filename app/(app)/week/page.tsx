import WeekClient from "@/components/week/WeekClient";
import SupabaseOffline from "@/components/ui/SupabaseOffline";
import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import { createServiceClient } from "@/lib/supabase/service";
import { getWeekStart } from "@/lib/utils";
import { unstable_noStore as noStore } from "next/cache";

export default async function WeekPage() {
  noStore();
  const supabase = createServiceClient();
  const userId = await getAppUserId();

  const weekStart = getWeekStart();

  if (isOfflineAppUserId(userId)) {
    return <SupabaseOffline />;
  }

  const { data: pillars } = await supabase
    .from("pillars")
    .select("*, behavioral_indicators(*)")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("priority_rank");

  const { data: logs } = await supabase
    .from("daily_logs")
    .select("*, behavioral_indicators(pillar_id)")
    .eq("user_id", userId)
    .gte("log_date", weekStart);

  const { data: summary } = await supabase
    .from("weekly_summaries")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  return (
    <WeekClient
      pillars={pillars ?? []}
      logs={logs ?? []}
      summary={summary}
      weekStart={weekStart}
    />
  );
}
