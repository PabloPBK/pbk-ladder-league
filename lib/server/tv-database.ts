import { createClient } from "@supabase/supabase-js";

export function getTVDatabase() {
  const url = process.env.TV_SUPABASE_URL;
  const key = process.env.TV_SUPABASE_SECRET_KEY;

  if (!url || !key) throw new Error("TV_DATABASE_NOT_CONFIGURED");

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
