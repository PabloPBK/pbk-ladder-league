
"use server";

import { revalidatePath } from "next/cache";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const PROGRAMS = [
  "beginner_pathway_open_play",
  "guided_pb101_open_play",
  "pb101_skills_drills",
  "other",
] as const;

type Program = (typeof PROGRAMS)[number];

type AttendanceRequest = {
  date: string;
  program: Program;
  guestIds: string[];
};

type IndividualActivityRequest = {
  guestId: string;
  date: string;
  program: Program;
  activityName?: string;
  chargeAmount?: number;
  paymentNotes?: string;
};

type ActionResult = {
  success: boolean;
  saved: number;
  message: string;
};

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function validUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function validProgram(value: string): value is Program {
  return PROGRAMS.some((program) => program === value);
}

async function verifyGuests(
  guestIds: string[],
  date: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("pb101_guests")
    .select("id, trial_start_date, trial_end_date")
    .in("id", guestIds);

  if (error || !data || data.length !== guestIds.length) {
    return false;
  }

  return data.every(
    (guest) =>
      guest.trial_start_date <= date &&
      date < guest.trial_end_date
  );
}

// -----------------------------------------------------
// BULK ATTENDANCE
// Complimentary PB101+ activities only.
// -----------------------------------------------------

export async function savePB101Attendance(
  request: AttendanceRequest
): Promise<ActionResult> {
  const user = await requireStaffUser();

  if (!validDate(request.date)) {
    return {
      success: false,
      saved: 0,
      message: "Select a valid attendance date.",
    };
  }

  if (
    !validProgram(request.program) ||
    request.program === "other"
  ) {
    return {
      success: false,
      saved: 0,
      message:
        "Bulk attendance is only available for complimentary PB101+ activities.",
    };
  }

  if (
    !Array.isArray(request.guestIds) ||
    request.guestIds.length === 0
  ) {
    return {
      success: false,
      saved: 0,
      message: "Select at least one guest.",
    };
  }

  const guestIds = [...new Set(request.guestIds)];

  if (
    guestIds.length > 200 ||
    guestIds.some((id) => !validUUID(id))
  ) {
    return {
      success: false,
      saved: 0,
      message: "Invalid guest selection.",
    };
  }

  if (!(await verifyGuests(guestIds, request.date))) {
    return {
      success: false,
      saved: 0,
      message:
        "One or more guests are outside their seven-day trial.",
    };
  }

  // Insert new records only. Do not overwrite
  // attendance records that already exist.
  const records = guestIds.map((guestId) => ({
    guest_id: guestId,
    attendance_date: request.date,
    program: request.program,
    activity_name: null,
    attendance_status: "attended",
    is_included: true,
    charge_amount: 0,
    payment_status: "not_required",
    recorded_by: user.id,
  }));

  const { data: existing, error: lookupError } =
  await supabaseAdmin
    .from("pb101_attendance")
    .select("guest_id")
    .eq("attendance_date", request.date)
    .eq("program", request.program)
    .in("guest_id", guestIds);

if (lookupError) {
  console.error("PB101 bulk lookup error:", lookupError);

  return {
    success: false,
    saved: 0,
    message: "Unable to check existing attendance.",
  };
}

const existingIds = new Set(
  (existing ?? []).map((row) => row.guest_id)
);

const newRecords = records.filter(
  (record) => !existingIds.has(record.guest_id)
);

if (newRecords.length === 0) {
  return {
    success: true,
    saved: 0,
    message: "All selected guests already have attendance recorded.",
  };
}

const { data, error } = await supabaseAdmin
  .from("pb101_attendance")
  .insert(newRecords)
  .select("id");

  if (error) {
    console.error("PB101 bulk attendance error:", error);

    return {
      success: false,
      saved: 0,
      message: "Unable to save bulk attendance.",
    };
  }

  revalidatePath("/admin/pb101/attendance");
  revalidatePath("/admin/pb101/reports");

  const saved = data?.length ?? 0;

  return {
    success: true,
    saved,
    message: `Saved ${saved} new attendance record(s).`,
  };
}

// -----------------------------------------------------
// INDIVIDUAL ACTIVITY
// Supports complimentary and paid activities.
// -----------------------------------------------------

export async function savePB101IndividualActivity(
  request: IndividualActivityRequest
): Promise<ActionResult> {
  const user = await requireStaffUser();

  if (!validUUID(request.guestId)) {
    return {
      success: false,
      saved: 0,
      message: "Select a valid guest.",
    };
  }

  if (!validDate(request.date)) {
    return {
      success: false,
      saved: 0,
      message: "Select a valid activity date.",
    };
  }

  if (!validProgram(request.program)) {
    return {
      success: false,
      saved: 0,
      message: "Select a valid activity.",
    };
  }

  if (!(await verifyGuests([request.guestId], request.date))) {
    return {
      success: false,
      saved: 0,
      message:
        "The activity date must be within the guest's seven-day trial.",
    };
  }

  const isIncluded = request.program !== "other";

  const activityName = isIncluded
    ? null
    : request.activityName?.trim();

  if (!isIncluded && !activityName) {
    return {
      success: false,
      saved: 0,
      message: "Enter the name of the other activity.",
    };
  }

  const chargeAmount = isIncluded
    ? 0
    : request.chargeAmount;

  if (
    !isIncluded &&
    (typeof chargeAmount !== "number" ||
      !Number.isFinite(chargeAmount) ||
      chargeAmount < 0 ||
      chargeAmount > 10000)
  ) {
    return {
      success: false,
      saved: 0,
      message: "Enter a valid charge amount.",
    };
  }

  // Look for an existing record so we don't
  // accidentally overwrite attendance or billing.
  let existingQuery = supabaseAdmin
    .from("pb101_attendance")
    .select("id")
    .eq("guest_id", request.guestId)
    .eq("attendance_date", request.date)
    .eq("program", request.program);

  if (request.program === "other") {
    existingQuery = existingQuery.ilike(
      "activity_name",
      activityName!
    );
  }

  const { data: existing, error: lookupError } =
    await existingQuery.limit(1);

  if (lookupError) {
    console.error("PB101 attendance lookup error:", lookupError);

    return {
      success: false,
      saved: 0,
      message: "Unable to check existing attendance.",
    };
  }

  if (existing && existing.length > 0) {
    return {
      success: false,
      saved: 0,
      message:
        "This activity is already recorded for this guest on this date.",
    };
  }

  const { error } = await supabaseAdmin
    .from("pb101_attendance")
    .insert({
      guest_id: request.guestId,
      attendance_date: request.date,
      program: request.program,
      activity_name: activityName,
      attendance_status: "attended",
      is_included: isIncluded,
      charge_amount: chargeAmount,
      payment_status: isIncluded
        ? "not_required"
        : "unpaid",
      payment_notes: request.paymentNotes?.trim() || null,
      recorded_by: user.id,
    });

  if (error) {
    console.error("PB101 individual activity error:", error);

    return {
      success: false,
      saved: 0,
      message:
        error.code === "23505"
          ? "This activity is already recorded for this guest on this date."
          : "Unable to save the activity.",
    };
  }

  revalidatePath("/admin/pb101/attendance");
  revalidatePath("/admin/pb101/reports");

  return {
    success: true,
    saved: 1,
    message: isIncluded
      ? "Complimentary activity recorded successfully."
      : "Activity recorded and flagged for payment.",
  };
}
