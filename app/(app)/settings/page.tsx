import SettingsClient from "@/components/settings/SettingsClient";
import SupabaseOffline from "@/components/ui/SupabaseOffline";
import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import { createServiceClient } from "@/lib/supabase/service";
import { unstable_noStore as noStore } from "next/cache";

export default async function SettingsPage() {
  noStore();
  const supabase = createServiceClient();
  const userId = await getAppUserId();

  if (isOfflineAppUserId(userId)) {
    return <SupabaseOffline />;
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return <SettingsClient initialSettings={settings} />;
}
