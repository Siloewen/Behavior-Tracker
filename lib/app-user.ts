import { createServiceClient } from "@/lib/supabase/service";

const DEFAULT_APP_USER_EMAIL = "simon@neweraintelligence.com";
const OFFLINE_APP_USER_ID = "00000000-0000-0000-0000-000000000001";

let cachedUserId: string | null = null;

async function findExistingUserId() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pillars")
    .select("user_id")
    .limit(1)
    .maybeSingle();

  return data?.user_id ?? null;
}

export async function getAppUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const configuredUserId = process.env.APP_USER_ID;
  if (configuredUserId) {
    cachedUserId = configuredUserId;
    return configuredUserId;
  }

  const email = process.env.APP_USER_EMAIL ?? DEFAULT_APP_USER_EMAIL;
  const supabase = createServiceClient();
  const existingDataUserId = await findExistingUserId();

  if (existingDataUserId) {
    cachedUserId = existingDataUserId;
    return existingDataUserId;
  }

  const { data: users, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });

  if (error) {
    console.warn(`Could not load app user from Supabase Auth: ${error.message}`);
    cachedUserId = OFFLINE_APP_USER_ID;
    return OFFLINE_APP_USER_ID;
  }

  const existingUser = users.users.find(
    user => user.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    cachedUserId = existingUser.id;
    return existingUser.id;
  }

  const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (createError || !createdUser.user) {
    throw new Error(`Could not create app user: ${createError?.message ?? "unknown error"}`);
  }

  cachedUserId = createdUser.user.id;
  return createdUser.user.id;
}

export function isOfflineAppUserId(userId: string) {
  return userId === OFFLINE_APP_USER_ID;
}
