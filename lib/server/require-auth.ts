import { createClient } from "@/lib/supabase/server";

export async function requireStaffUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("AUTH_REQUIRED");
  }

  return user;
}
