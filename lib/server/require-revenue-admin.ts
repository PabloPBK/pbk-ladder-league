import "server-only";

import { NextResponse } from "next/server";
import { requireStaffUser, staffApiDenial } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function requireRevenueAdmin() {
  const user = await requireStaffUser();
  const { data, error } = await supabaseAdmin.from("league_revenue_admins")
    .select("user_id").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("REVENUE_ACCESS_DENIED");
  return user;
}

export async function getRevenueApiDenial() {
  try {
    await requireRevenueAdmin();
    return null;
  } catch (error) {
    return revenueApiDenial(error);
  }
}

export function revenueApiDenial(error: unknown) {
  if (error instanceof Error && error.message === "REVENUE_ACCESS_DENIED") {
    return NextResponse.json({ error: "Revenue administrator access is required." }, { status: 403 });
  }
  return staffApiDenial(error);
}
