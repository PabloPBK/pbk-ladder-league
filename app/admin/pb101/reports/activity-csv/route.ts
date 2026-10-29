
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const PROGRAM_LABELS: Record<string, string> = {
  beginner_pathway_open_play: "Beginner / Pathway Open Play",
  guided_pb101_open_play: "Guided PB101+ Open Play",
  pb101_skills_drills: "PB101+ Skills & Drills",
  other: "Other Activity",
};

function csvCell(value: unknown): string {
  const text = String(value ?? "");

  // Prevent spreadsheet applications from interpreting
  // user-provided values as formulas.
  const safeText = /^[\s]*[=+\-@]/.test(text)
    ? `'${text}`
    : text;

  return `"${safeText.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

export async function GET() {
  await requireStaffUser();

  const { data: guests, error: guestsError } =
    await supabaseAdmin
      .from("pb101_guests")
      .select(
        "id, first_name, last_name, email, coach_name, trial_start_date, trial_end_date, status"
      );

  if (guestsError) {
    console.error("PB101 CSV guest error:", guestsError);

    return new Response("Unable to load guests.", {
      status: 500,
    });
  }

  const guestMap = new Map(
    (guests ?? []).map((guest) => [guest.id, guest])
  );

  const { data: activities, error: activitiesError } =
    await supabaseAdmin
      .from("pb101_attendance")
      .select(
        "guest_id, attendance_date, program, activity_name, attendance_status, is_included, charge_amount, payment_status, payment_notes"
      )
      .order("attendance_date", { ascending: true });

  if (activitiesError) {
    console.error(
      "PB101 CSV activity error:",
      activitiesError
    );

    return new Response("Unable to load activities.", {
      status: 500,
    });
  }

  const rows: string[] = [
    csvRow([
      "Guest First Name",
      "Guest Last Name",
      "Email",
      "Coach",
      "Trial Start",
      "Trial End",
      "Membership Status",
      "Activity Date",
      "Activity",
      "Attendance Status",
      "Included in PB101+",
      "Charge Amount",
      "Payment Status",
      "Payment Notes",
    ]),
  ];

  for (const activity of activities ?? []) {
    const guest = guestMap.get(activity.guest_id);

    if (!guest) continue;

    const included =
      activity.is_included === true ||
      (activity.is_included === null &&
        activity.program !== "other");

    rows.push(
      csvRow([
        guest.first_name,
        guest.last_name,
        guest.email,
        guest.coach_name,
        guest.trial_start_date,
        guest.trial_end_date,
        guest.status,
        activity.attendance_date,
        activity.program === "other"
          ? activity.activity_name || "Other Activity"
          : PROGRAM_LABELS[activity.program] ||
            activity.program,
        activity.attendance_status,
        included ? "Yes" : "No",
        Number(activity.charge_amount ?? 0).toFixed(2),
        activity.payment_status || "not_required",
        activity.payment_notes,
      ])
    );
  }

  const csv = "\uFEFF" + rows.join("\r\n") + "\r\n";

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="PB101_Detailed_Activity_Report.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
