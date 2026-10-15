
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseSecretKey =
  process.env.LEAGUE_SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL is not configured."
  );
}

if (!supabaseSecretKey) {
  throw new Error(
    "League Supabase secret key is not configured."
  );
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
