
"use server";

import { revalidatePath } from "next/cache";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type MembershipDecision =
  | "converted"
  | "declined"
  | "considering";

type MembershipType =
  | "Ace Select"
  | "Ace"
  | "Team"
  | "Royal Family";

type ConversionReason =
  | "community"
  | "coaching"
  | "fitness"
  | "competition"
  | "schedule"
  | "pricing"
  | "location"
  | "not_ready"
  | "other";

type SaveDecisionRequest = {
  guestId: string;
  decision: MembershipDecision;
  membershipType?: string | null;
  reason: ConversionReason;
  notes?: string;
  followUpDate?: string | null;
};

type ActionResult = {
  success: boolean;
  message: string;
};

const REASONS: ConversionReason[] = [
  "community",
  "coaching",
  "fitness",
  "competition",
  "schedule",
  "pricing",
  "location",
  "not_ready",
  "other",
];

const MEMBERSHIP_TYPES: MembershipType[] = [
  "Ace Select",
  "Ace",
  "Team",
  "Royal Family",
];

function validUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export async function savePB101MembershipDecision(
  request: SaveDecisionRequest
): Promise<ActionResult> {
  await requireStaffUser();

  if (!validUUID(request.guestId)) {
    return {
      success: false,
      message: "Select a valid guest.",
    };
  }

  if (
    !["converted", "declined", "considering"].includes(
      request.decision
    )
  ) {
    return {
      success: false,
      message: "Select a valid membership decision.",
    };
  }

  if (!REASONS.includes(request.reason)) {
    return {
      success: false,
      message: "Select a valid decision reason.",
    };
  }

  const membershipType = request.membershipType?.trim() || null;

  if (request.decision === "converted") {
    if (
      !membershipType ||
      !MEMBERSHIP_TYPES.includes(
        membershipType as MembershipType
      )
    ) {
      return {
        success: false,
        message:
          "Please select a valid membership type: Ace Select, Ace, Team, or Royal Family.",
      };
    }
  }

  const notes = request.notes?.trim() ?? "";

  if (notes.length > 2000) {
    return {
      success: false,
      message: "Notes must be under 2,000 characters.",
    };
  }

  const followUpDate = request.followUpDate?.trim() || null;

  if (followUpDate && !validDate(followUpDate)) {
    return {
      success: false,
      message: "Select a valid follow-up date.",
    };
  }

  const { data: guest, error: lookupError } =
    await supabaseAdmin
      .from("pb101_guests")
      .select("id, status, converted_at, trial_end_date")
      .eq("id", request.guestId)
      .maybeSingle();

  if (lookupError || !guest) {
    return {
      success: false,
      message: "Guest not found.",
    };
  }

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  let databaseStatus: string;

  if (request.decision === "converted") {
    databaseStatus = "converted";
  } else if (request.decision === "declined") {
    databaseStatus = "declined";
  } else {
    databaseStatus =
      guest.trial_end_date < today ? "expired" : "active";
  }

  const { error: updateError } = await supabaseAdmin
    .from("pb101_guests")
    .update({
      status: databaseStatus,
      membership_decision: request.decision,
      membership_type:
        request.decision === "converted"
          ? membershipType
          : null,
      conversion_reason: request.reason,
      conversion_notes: notes || null,
      decision_recorded_at: now,
      follow_up_date: followUpDate,
      converted_at:
        request.decision === "converted"
          ? guest.converted_at || now
          : null,
      updated_at: now,
    })
    .eq("id", request.guestId);

  if (updateError) {
    console.error(
      "PB101 membership decision error:",
      updateError
    );

    return {
      success: false,
      message: "Unable to save membership decision.",
    };
  }

  // Cancel pending follow-up emails when a guest
  // converts or declines membership.
  // Already-sent emails remain unchanged.
  if (
    request.decision === "converted" ||
    request.decision === "declined"
  ) {
    const { error: cancelError } = await supabaseAdmin
      .from("pb101_email_log")
      .update({
        status: "cancelled",
        error_message:
          request.decision === "converted"
            ? "Guest converted to membership."
            : "Guest declined membership.",
      })
      .eq("guest_id", request.guestId)
      .eq("status", "pending");

    if (cancelError) {
      console.error(
        "PB101 pending email cancellation error:",
        cancelError
      );

      return {
        success: false,
        message:
          "Membership decision was saved, but pending email cancellation failed. Please contact an administrator.",
      };
    }
  }

  revalidatePath("/admin/pb101");
  revalidatePath("/admin/pb101/guests");
  revalidatePath("/admin/pb101/reports");
  revalidatePath("/admin/pb101/attendance");

  return {
    success: true,
    message:
      request.decision === "converted"
        ? `Guest converted to ${membershipType} membership.`
        : request.decision === "declined"
      
type CompleteFollowUpRequest = {
  guestId: string;
  contactMethod: "phone" | "email" | "text" | "in_person" | "other";
  notes?: string;
  outcome?: string;
  nextFollowUpDate?: string | null;
};

export async function completePB101FollowUp(
  request: CompleteFollowUpRequest
): Promise<ActionResult> {
  await requireStaffUser();

  if (!validUUID(request.guestId)) {
    return { success: false, message: "Invalid guest." };
  }

  const methods = ["phone", "email", "text", "in_person", "other"];

  if (!methods.includes(request.contactMethod)) {
    return { success: false, message: "Select a contact method." };
  }

  const notes = request.notes?.trim() || "";
  const outcome = request.outcome?.trim() || "";
  const nextDate = request.nextFollowUpDate?.trim() || null;

  if (notes.length > 2000 || outcome.length > 500) {
    return { success: false, message: "Follow-up notes are too long." };
  }

  if (nextDate && !validDate(nextDate)) {
    return { success: false, message: "Invalid next follow-up date." };
  }

  const { data: guest, error: lookupError } = await supabaseAdmin
    .from("pb101_guests")
    .select("id, follow_up_date, follow_up_completed_at")
    .eq("id", request.guestId)
    .maybeSingle();

  if (lookupError || !guest) {
    return { success: false, message: "Guest not found." };
  }

  if (!guest.follow_up_date) {
    return { success: false, message: "No scheduled follow-up exists." };
  }

  if (guest.follow_up_completed_at) {
    return {
      success: false,
      message: "This follow-up is already completed.",
    };
  }

  const now = new Date().toISOString();

  const { error: historyError } = await supabaseAdmin
    .from("pb101_follow_up_history")
    .insert({
      guest_id: request.guestId,
      contact_date: now,
      contact_method: request.contactMethod,
      notes: notes || null,
      outcome: outcome || null,
      next_follow_up_date: nextDate,
    });

  if (historyError) {
    console.error("PB101 follow-up history error:", historyError);
    return {
      success: false,
      message: "Unable to save follow-up history.",
    };
  }

  const { error: updateError } = await supabaseAdmin
    .from("pb101_guests")
    .update({
      follow_up_completed_at: nextDate ? null : now,
      follow_up_date: nextDate || guest.follow_up_date,
      updated_at: now,
    })
    .eq("id", request.guestId)
    .eq("follow_up_date", guest.follow_up_date)
    .is("follow_up_completed_at", null);

  if (updateError) {
    console.error("PB101 follow-up completion error:", updateError);
    return {
      success: false,
      message:
        "Contact history was saved, but the follow-up could not be completed. Contact an administrator.",
    };
  }

  revalidatePath("/admin/pb101");
  revalidatePath("/admin/pb101/guests");
  revalidatePath("/admin/pb101/reports");

  return {
    success: true,
    message: nextDate
      ? "Follow-up recorded and next contact scheduled."
      : "Follow-up completed. Guest history preserved.",
  };
}

          ? "Guest marked as declined."
          : "Guest marked as still considering membership.",
  };
}
