
"use server";

import { revalidatePath } from "next/cache";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { schedulePB101Emails } from "@/lib/server/pb101-email-scheduler";

export type GuestRegistrationState = {
  success: boolean;
  message: string;
};

export async function registerPB101Guest(
  _previousState: GuestRegistrationState,
  formData: FormData
): Promise<GuestRegistrationState> {
  try {
    await requireStaffUser();

    const firstName = String(
      formData.get("first_name") ?? ""
    ).trim();

    const lastName = String(
      formData.get("last_name") ?? ""
    ).trim();

    const email = String(
      formData.get("email") ?? ""
    ).trim().toLowerCase();

    const phone = String(
      formData.get("phone") ?? ""
    ).trim();

    const coachName = String(
      formData.get("coach_name") ?? ""
    ).trim();

    const coachNotes = String(
      formData.get("coach_notes") ?? ""
    ).trim();

    const completionDate = String(
      formData.get("pb101_completed_at") ?? ""
    ).trim();

    const emailConsent =
      formData.get("email_consent") === "yes";

    if (
      !firstName ||
      !lastName ||
      !email ||
      !completionDate
    ) {
      return {
        success: false,
        message:
          "First name, last name, email, and PB101 completion date are required.",
      };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        success: false,
        message: "Please enter a valid email address.",
      };
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(completionDate) ||
      Number.isNaN(Date.parse(`${completionDate}T00:00:00Z`)) ||
      new Date(`${completionDate}T00:00:00Z`)
        .toISOString()
        .slice(0, 10) !== completionDate
    ) {
      return {
        success: false,
        message: "Please enter a valid PB101 completion date.",
      };
    }

    const { data: existingGuest, error: lookupError } =
      await supabaseAdmin
        .from("pb101_guests")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

    if (lookupError) {
      console.error(
        "PB101 guest lookup failed:",
        lookupError
      );

      return {
        success: false,
        message: "Unable to check for existing guests.",
      };
    }

    if (existingGuest) {
      return {
        success: false,
        message:
          "A guest with this email address already exists. Review their existing record before registering them again.",
      };
    }

    const { data: newGuest, error: insertError } =
      await supabaseAdmin
        .from("pb101_guests")
        .insert({
          first_name: firstName,
          last_name: lastName,
          email,
          phone: phone || null,
          coach_name: coachName || null,
          coach_notes: coachNotes || null,
          pb101_completed_at: completionDate,
          trial_start_date: completionDate,
          status: "active",
          email_opted_out: false,
          email_consent_at: emailConsent
            ? new Date().toISOString()
            : null,
        })
        .select("id")
        .single();

    if (insertError || !newGuest) {
      console.error(
        "PB101 registration failed:",
        insertError
      );

      return {
        success: false,
        message:
          "Unable to register the guest. Please try again.",
      };
    }

    let message = "Guest registered successfully.";

    if (emailConsent) {
      try {
        const scheduledCount =
          await schedulePB101Emails(newGuest.id);

        message =
          `Guest registered successfully. ` +
          `${scheduledCount} PB101+ emails scheduled.`;
      } catch (scheduleError) {
        console.error(
          "PB101 email scheduling failed:",
          scheduleError
        );

        message =
          "Guest registered successfully, but the " +
          "follow-up emails could not be scheduled. " +
          "Please notify an administrator.";
      }
    } else {
      message =
        "Guest registered successfully. No emails " +
        "scheduled because email consent was not recorded.";
    }

    revalidatePath("/admin/pb101/guests");
    revalidatePath("/admin/pb101/emails");

    return {
      success: true,
      message,
    };
  } catch (error) {
    console.error(
      "PB101 registration error:",
      error
    );

    return {
      success: false,
      message:
        "Registration failed. Please verify staff access.",
    };
  }
}
