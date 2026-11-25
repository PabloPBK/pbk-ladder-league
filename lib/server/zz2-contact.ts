import "server-only";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function canReadZz2Contact() {
  const user = await requireStaffUser();
  const { data, error } = await supabaseAdmin.from("zz2_contact_readers")
    .select("user_id").eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Unable to verify access to ZZ2 inquiries.");
  return data !== null;
}
