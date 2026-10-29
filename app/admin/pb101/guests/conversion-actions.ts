
"use server";

import { revalidatePath } from "next/cache";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type MembershipDecision =
  | "converted"
  | "declined"
  | "considering";

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

  revalidatePath("/admin/pb101");
  revalidatePath("/admin/pb101/guests");
  revalidatePath("/admin/pb101/reports");
  revalidatePath("/admin/pb101/attendance");

  return {
    success: true,
    message:
      request.decision === "converted"
        ? "Guest marked as converted to membership."
        : request.decision === "declined"
          ? "Guest marked as declined."
          : "Guest marked as still considering membership.",
  };
}
