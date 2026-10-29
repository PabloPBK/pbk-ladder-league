
import { AppLayout } from "@/components/layout/AppLayout";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import AttendanceForm from "./AttendanceForm";

export const dynamic = "force-dynamic";

export default async function PB101AttendancePage() {
  await requireStaffUser();

  const today = new Date().toISOString().slice(0, 10);

  const [guestsResult, attendanceResult] = await Promise.all([
    supabaseAdmin
      .from("pb101_guests")
      .select(
        "id, first_name, last_name, email, coach_name, trial_start_date, trial_end_date, status, membership_decision"
      )
      .lte("trial_start_date", today)
      .gte("trial_end_date", today)
      .in("status", ["active", "expired"])
      .order("first_name", { ascending: true })
      .limit(1000),

    supabaseAdmin
      .from("pb101_attendance")
      .select(
        "id, guest_id, attendance_date, program, activity_name, attendance_status, is_included, charge_amount, payment_status, payment_notes"
      )
      .order("attendance_date", { ascending: false })
      .limit(5000),
  ]);

  if (guestsResult.error) {
    console.error(
      "PB101 guest loading error:",
      guestsResult.error
    );
    throw new Error("Unable to load PB101 guests.");
  }

  if (attendanceResult.error) {
    console.error(
      "PB101 attendance loading error:",
      attendanceResult.error
    );
    throw new Error("Unable to load PB101 attendance.");
  }

  const guests = (guestsResult.data ?? [])
    .filter(
      (guest) =>
        guest.membership_decision !== "converted" &&
        guest.membership_decision !== "declined"
    )
    .map((guest) => ({
      id: guest.id,
      name: `${guest.first_name ?? ""} ${
        guest.last_name ?? ""
      }`.trim(),
      email: guest.email ?? "",
      coach: guest.coach_name ?? "",
      trialStart: guest.trial_start_date,
      trialEnd: guest.trial_end_date,
      status: guest.status,
    }));

  const attendanceHistory = (attendanceResult.data ?? []).map(
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
      description="Track activities for guests currently participating in their seven-day PB101+ experience."
    >
      <div className="mx-auto max-w-6xl">
        <AttendanceForm
          guests={guests}
          attendanceHistory={attendanceHistory}
        />
      </div>
    </AppLayout>
  );
}
