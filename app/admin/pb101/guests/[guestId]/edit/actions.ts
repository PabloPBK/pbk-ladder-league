"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/data/league-listings";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

function validDate(value: string) {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function editPB101Guest(
  guestId: string,
  updatedAt: string,
  _previousMessage: string,
  formData: FormData
): Promise<string> {
  try {
    await requireStaffUser();
  } catch {
    return "Staff access is required. Sign in again to save changes.";
  }

  if (!isUuid(guestId) || !Number.isFinite(Date.parse(updatedAt))) {
    return "This guest record could not be identified.";
  }

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const completedAt = String(formData.get("pb101_completed_at") ?? "");
  const trialStart = String(formData.get("trial_start_date") ?? "");

  if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100) {
    return "Enter a first and last name, each up to 100 characters.";
  }
  if (!validDate(completedAt) || !validDate(trialStart)) {
    return "Enter a valid class completion date and trial start date.";
  }

  const { data, error } = await supabaseAdmin.rpc("edit_pb101_guest_details", {
    p_guest_id: guestId,
    p_expected_updated_at: updatedAt,
    p_first_name: firstName,
    p_last_name: lastName,
    p_completed_at: completedAt,
    p_trial_start_date: trialStart,
  });

  if (error) {
    console.error("Unable to update PB101 guest details:", error.code);
    return "Unable to save guest details. Please try again.";
  }
  if (data === "stale") {
    return "Someone updated this guest while you were editing. Reload the page and try again.";
  }
  if (data === "email_processing") {
    return "A follow-up email is being processed. Wait for it to finish before changing the trial start date.";
  }
  if (data === "missing") return "This guest record is no longer available.";
  if (data !== "saved") return "Unable to save guest details. Check the names and dates.";

  revalidatePath("/admin/pb101");
  revalidatePath("/admin/pb101/guests");
  revalidatePath("/admin/pb101/attendance");
  revalidatePath("/admin/pb101/emails");
  revalidatePath("/admin/pb101/reports");
  redirect(`/admin/pb101/guests?edited=${guestId}#guest-${guestId}`);
}
