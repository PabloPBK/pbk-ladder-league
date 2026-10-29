
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

type AttendanceResult = {
  success: boolean;
  saved: number;
  message: string;
};

export async function savePB101Attendance(
  request: AttendanceRequest
): Promise<AttendanceResult> {
  const user = await requireStaffUser();

  const date = request.date;
  const program = request.program;

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`))
  ) {
    return {
      success: false,
      saved: 0,
      message: "Please select a valid attendance date.",
    };
  }

  if (!PROGRAMS.includes(program)) {
    return {
      success: false,
      saved: 0,
      message: "Please select a valid PB101+ activity.",
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
    guestIds.some(
      (id) =>
        typeof id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id
        )
    )
  ) {
    return {
      success: false,
      saved: 0,
      message: "Invalid guest selection.",
    };
  }

  const { data: guests, error: guestError } =
    await supabaseAdmin
      .from("pb101_guests")
      .select("id, trial_start_date, trial_end_date, status")
      .in("id", guestIds);

  if (guestError || !guests) {
    return {
      success: false,
      saved: 0,
      message: "Unable to verify selected guests.",
    };
  }

  const eligibleIds = new Set(
    guests
      .filter(
        (guest) =>
          guest.status === "active" &&
          guest.trial_start_date <= date &&
          date < guest.trial_end_date
      )
      .map((guest) => guest.id)
  );

  if (guestIds.some((id) => !eligibleIds.has(id))) {
    return {
      success: false,
      saved: 0,
      message:
        "One or more guests are outside their active seven-day trial.",
    };
  }

  const records = guestIds.map((guestId) => ({
    guest_id: guestId,
    attendance_date: date,
    program,
    attendance_status: "attended",
    recorded_by: user.id,
  }));

  const { data, error } = await supabaseAdmin
    .from("pb101_attendance")
    .upsert(records, {
      onConflict: "guest_id,attendance_date,program",
    })
    .select("id");

  if (error) {
    console.error("PB101 attendance save failed:", error);

    return {
      success: false,
      saved: 0,
      message: "Unable to save attendance. Please try again.",
    };
  }

  revalidatePath("/admin/pb101/attendance");
  revalidatePath("/admin/pb101");

  return {
    success: true,
    saved: data?.length ?? 0,
    message: `Attendance saved for ${
      data?.length ?? 0
    } guest(s).`,
  };
}
