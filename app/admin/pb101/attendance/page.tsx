
import { AppLayout } from "@/components/layout/AppLayout";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import AttendanceForm from "./AttendanceForm";

export const dynamic = "force-dynamic";

type GuestRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  coach_name: string | null;
  trial_start_date: string;
  trial_end_date: string;
  status: string;
  membership_decision: string | null;
};

type AttendanceRow = {
  id: string;
  guest_id: string;
  attendance_date: string;
  program: string;
  activity_name: string | null;
  attendance_status: string;
  is_included: boolean | null;
  charge_amount: number | null;
  payment_status: string | null;
  payment_notes: string | null;
};

export default async function PB101AttendancePage() {
  await requireStaffUser();

  // Compare trial dates using the club's Pacific time.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // Fetch guests in batches so we do not silently lose
  // historical guests when the database grows.
  const allGuests: GuestRow[] = [];
  const batchSize = 500;

  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await supabaseAdmin
      .from("pb101_guests")
      .select(
        "id, first_name, last_name, email, coach_name, trial_start_date, trial_end_date, status, membership_decision"
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error("PB101 guest loading error:", error);
      throw new Error("Unable to load PB101 guests.");
    }

    const batch = (data ?? []) as GuestRow[];
    allGuests.push(...batch);

    if (batch.length < batchSize) break;
  }

  const activeGuests = allGuests
    .filter(
      (guest) =>
        guest.trial_start_date <= today &&
        guest.trial_end_date > today &&
        guest.status !== "converted" &&
        guest.status !== "declined" &&
        guest.status !== "paused" &&
        guest.membership_decision !== "converted" &&
        guest.membership_decision !== "declined"
    )
    .sort((a, b) =>
      `${a.first_name} ${a.last_name}`.localeCompare(
        `${b.first_name} ${b.last_name}`
      )
    );

  const historicalGuests = allGuests.filter(
    (guest) =>
      !activeGuests.some((active) => active.id === guest.id)
  );

  function formatGuest(guest: GuestRow) {
    return {
      id: guest.id,
      name: `${guest.first_name ?? ""} ${
        guest.last_name ?? ""
      }`.trim(),
      email: guest.email ?? "",
      coach: guest.coach_name ?? "",
      trialStart: guest.trial_start_date,
      trialEnd: guest.trial_end_date,
      status: guest.status,
    };
  }

  // Preserve attendance and payment history.
  const attendanceRecords: AttendanceRow[] = [];

  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await supabaseAdmin
      .from("pb101_attendance")
      .select(
        "id, guest_id, attendance_date, program, activity_name, attendance_status, is_included, charge_amount, payment_status, payment_notes"
      )
      .order("attendance_date", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error("PB101 attendance loading error:", error);
      throw new Error("Unable to load PB101 attendance.");
    }

    const batch = (data ?? []) as AttendanceRow[];
    attendanceRecords.push(...batch);

    if (batch.length < batchSize) break;
  }

  const attendanceHistory = attendanceRecords.map(
    (record) => ({
      id: record.id,
      guestId: record.guest_id,
      date: record.attendance_date,
      program: record.program,
      activityName: record.activity_name,
      attendanceStatus: record.attendance_status,
      isIncluded: record.is_included,
      chargeAmount: Number(record.charge_amount ?? 0),
      paymentStatus: record.payment_status,
      paymentNotes: record.payment_notes,
    })
  );

  return (
    <AppLayout
      title="PB101+ Attendance"
      description="Record active trial attendance and review historical guest activity."
    >
      <div className="mx-auto max-w-6xl">
        <AttendanceForm
          guests={activeGuests.map(formatGuest)}
          historicalGuests={historicalGuests.map(formatGuest)}
          attendanceHistory={attendanceHistory}
        />
      </div>
    </AppLayout>
  );
}
