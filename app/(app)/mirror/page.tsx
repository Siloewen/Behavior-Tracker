import MirrorClient from "@/components/mirror/MirrorClient";
import SupabaseOffline from "@/components/ui/SupabaseOffline";
import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import { createServiceClient } from "@/lib/supabase/service";
import { dateKey } from "@/lib/utils";
import { unstable_noStore as noStore } from "next/cache";

export default async function MirrorPage() {
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

  // Last 12 weeks of logs
  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

  const { data: logs } = await supabase
    .from("daily_logs")
    .select("*, behavioral_indicators(pillar_id)")
    .eq("user_id", userId)
    .gte("log_date", dateKey(twelveWeeksAgo))
    .order("log_date");

  return <MirrorClient pillars={pillars ?? []} logs={logs ?? []} />;
}
