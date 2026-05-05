import PathClient from "@/components/path/PathClient";
import SupabaseOffline from "@/components/ui/SupabaseOffline";
import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import { createServiceClient } from "@/lib/supabase/service";
import { unstable_noStore as noStore } from "next/cache";

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

  const { data: logs } = await supabase
    .from("daily_logs")
    .select("*, behavioral_indicators(pillar_id)")
    .eq("user_id", userId)
    .order("log_date");

  return <PathClient pillars={pillars ?? []} logs={logs ?? []} />;
}
