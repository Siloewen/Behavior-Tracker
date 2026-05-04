import PathClient from "@/components/path/PathClient";
import SupabaseOffline from "@/components/ui/SupabaseOffline";
import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import { createServiceClient } from "@/lib/supabase/service";
import { dateKey } from "@/lib/utils";
import { unstable_noStore as noStore } from "next/cache";

const NUM_WEEKS = 16;

export default async function PathPage() {
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

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NUM_WEEKS * 7);

  const { data: logs } = await supabase
    .from("daily_logs")
    .select("*, behavioral_indicators(pillar_id)")
    .eq("user_id", userId)
    .gte("log_date", dateKey(cutoff))
    .order("log_date");

  return <PathClient pillars={pillars ?? []} logs={logs ?? []} />;
}
