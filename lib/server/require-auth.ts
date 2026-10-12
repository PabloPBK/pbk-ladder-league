
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function requireStaffUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("AUTH_REQUIRED");
  }

  const { data: staff, error: staffError } =
    await supabaseAdmin
      .from("staff_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

  if (staffError) {
    console.error(
      "Unable to verify staff authorization:",
      staffError
    );

    throw new Error("STAFF_CHECK_FAILED");
  }

  if (!staff) {
    throw new Error("STAFF_ACCESS_DENIED");
  }

  return user;
}
