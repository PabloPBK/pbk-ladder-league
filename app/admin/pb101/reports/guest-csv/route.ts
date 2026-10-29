
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const text = String(value ?? "");

  // Protect Excel from interpreting user data as formulas.
  const safe = /^[\s]*[=+\-@]/.test(text)
    ? `'${text}`
    : text;

  return `"${safe.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

function amount(value: number): string {
  return value.toFixed(2);
}

export async function GET() {
  await requireStaffUser();

  const { data: guests, error: guestsError } =
    await supabaseAdmin
      .from("pb101_guests")
      .select(
        "id, first_name, last_name, email, phone, coach_name, coach_notes, assigned_staff, pb101_completed_at, trial_start_date, trial_end_date, status, converted_at"
      )
      .order("trial_start_date", { ascending: false });

  if (guestsError) {
    console.error("PB101 guest summary error:", guestsError);

    return new Response("Unable to load guests.", {
      status: 500,
    });
  }

  const { data: attendance, error: attendanceError } =
    await supabaseAdmin
      .from("pb101_attendance")
      .select(
        "guest_id, attendance_date, program, activity_name, attendance_status, is_included, charge_amount, payment_status"
      );

  if (attendanceError) {
    console.error(
      "PB101 guest summary attendance error:",
      attendanceError
    );

    return new Response("Unable to load attendance.", {
      status: 500,
    });
  }

  const attendanceByGuest = new Map<
    string,
    NonNullable<typeof attendance>
  >();

  for (const record of attendance ?? []) {
    const existing =
      attendanceByGuest.get(record.guest_id) ?? [];

    existing.push(record);
    attendanceByGuest.set(record.guest_id, existing);
  }

  const rows: string[] = [
    csvRow([
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Coach",
      "Assigned Staff",
      "PB101 Completed",
      "Trial Start",
      "Trial End",
      "Membership Status",
      "Converted At",
      "Days Visited",
      "Total Activities",
      "Beginner / Pathway Open Plays",
      "Guided PB101+ Open Plays",
      "PB101+ Skills & Drills",
      "Outside Program Activities",
      "Other Activities Attended",
      "Total Recorded Charges",
      "Paid Charges",
      "Waived Charges",
      "Outstanding Balance",
      "Coach Notes",
    ]),
  ];

  for (const guest of guests ?? []) {
    const records = (
      attendanceByGuest.get(guest.id) ?? []
    ).filter(
      (record) => record.attendance_status === "attended"
    );

    const daysVisited = new Set(
      records.map((record) => record.attendance_date)
    ).size;

    const count = (program: string) =>
      records.filter((record) => record.program === program)
        .length;

    const outsideActivities = records.filter(
      (record) => record.program === "other"
    );

    const totalCharges = records.reduce(
      (sum, record) =>
        sum + Number(record.charge_amount ?? 0),
      0
    );

    const paidCharges = records
      .filter((record) => record.payment_status === "paid")
      .reduce(
        (sum, record) =>
          sum + Number(record.charge_amount ?? 0),
        0
      );

    const waivedCharges = records
      .filter((record) => record.payment_status === "waived")
      .reduce(
        (sum, record) =>
          sum + Number(record.charge_amount ?? 0),
        0
      );

    const outstanding = records
      .filter((record) => record.payment_status === "unpaid")
      .reduce(
        (sum, record) =>
          sum + Number(record.charge_amount ?? 0),
        0
      );

    const otherActivityNames = [
      ...new Set(
        outsideActivities.map(
          (record) =>
            record.activity_name || "Other Activity"
        )
      ),
    ].join("; ");

    rows.push(
      csvRow([
        guest.first_name,
        guest.last_name,
        guest.email,
        guest.phone,
        guest.coach_name,
        guest.assigned_staff,
        guest.pb101_completed_at,
        guest.trial_start_date,
        guest.trial_end_date,
        guest.status,
        guest.converted_at,
        daysVisited,
        records.length,
        count("beginner_pathway_open_play"),
        count("guided_pb101_open_play"),
        count("pb101_skills_drills"),
        outsideActivities.length,
        otherActivityNames,
        amount(totalCharges),
        amount(paidCharges),
        amount(waivedCharges),
        amount(outstanding),
        guest.coach_notes,
      ])
    );
  }

  const csv = "\uFEFF" + rows.join("\r\n") + "\r\n";

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="PB101_Guest_Journey_Summary.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
