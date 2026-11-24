
import { NextResponse } from "next/server";
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

export async function getStaffApiDenial() {
  try {
    await requireStaffUser();
    return null;
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "STAFF_ACCESS_DENIED") {
      return NextResponse.json({ error: "Staff access is required." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unable to verify staff access." }, { status: 500 });
  }
}
