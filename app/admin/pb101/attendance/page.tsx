
import { AppLayout } from "@/components/layout/AppLayout";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AttendanceForm } from "./AttendanceForm";

export const dynamic = "force-dynamic";

export default async function PB101AttendancePage() {
  await requireStaffUser();

  const { data: guests, error } = await supabaseAdmin
    .from("pb101_guests")
    .select(
      "id, first_name, last_name, email, coach_name, trial_start_date, trial_end_date, status"
    )
    .order("first_name", { ascending: true })
    .limit(500);

  if (error) {
    console.error("Unable to load PB101 guests:", error);
  }

  const guestList = (guests ?? []).map((guest) => ({
    id: guest.id,
    name: `${guest.first_name} ${guest.last_name}`.trim(),
    email: guest.email,
    coach: guest.coach_name ?? "",
    trialStart: guest.trial_start_date,
    trialEnd: guest.trial_end_date,
    status: guest.status,
  }));

  return (
    <AppLayout
      title="PB101+ Daily Attendance"
      description="Record attendance for guests during their seven-day welcome experience."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        {error ? (
          <div className="rounded-xl border border-red-800 bg-red-950/30 p-5 text-red-300">
            Unable to load guest records. Please try again.
          </div>
        ) : (
          <AttendanceForm guests={guestList} />
        )}
      </div>
    </AppLayout>
  );
}
