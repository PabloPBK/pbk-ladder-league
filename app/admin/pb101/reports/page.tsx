
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default async function PB101ReportsPage() {
  await requireStaffUser();

  const [guestsResult, attendanceResult] = await Promise.all([
    supabaseAdmin
      .from("pb101_guests")
      .select(
        "id, first_name, last_name, coach_name, status, trial_start_date, trial_end_date"
      )
      .order("trial_start_date", { ascending: false }),

    supabaseAdmin
      .from("pb101_attendance")
      .select(
        "guest_id, attendance_date, program, attendance_status, charge_amount, payment_status"
      ),
  ]);

  if (guestsResult.error || attendanceResult.error) {
    console.error("PB101 reports loading error", {
      guests: guestsResult.error,
      attendance: attendanceResult.error,
    });

    throw new Error("Unable to load PB101 reports.");
  }

  const guests = guestsResult.data ?? [];
  const attendance = attendanceResult.data ?? [];

  const attended = attendance.filter(
    (record) => record.attendance_status === "attended"
  );

  const totalCharges = attended.reduce(
    (total, record) =>
      total + Number(record.charge_amount ?? 0),
    0
  );

  const outstanding = attended
    .filter((record) => record.payment_status === "unpaid")
    .reduce(
      (total, record) =>
        total + Number(record.charge_amount ?? 0),
      0
    );

  const converted = guests.filter(
    (guest) => guest.status === "converted"
  ).length;

  const conversionRate =
    guests.length > 0
      ? ((converted / guests.length) * 100).toFixed(1)
      : "0.0";

  const activityCounts = new Map<string, number>();

  for (const record of attended) {
    activityCounts.set(
      record.guest_id,
      (activityCounts.get(record.guest_id) ?? 0) + 1
    );
  }

  return (
    <AppLayout
      title="PB101+ Reports"
      description="Analyze seven-day guest participation, membership conversion, and activity charges."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total Guests", String(guests.length)],
            ["Converted Members", String(converted)],
            ["Conversion Rate", `${conversionRate}%`],
            ["Activities Recorded", String(attended.length)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <p className="text-sm text-zinc-400">
                {label}
              </p>
              <p className="mt-3 text-3xl font-black text-yellow-400">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
              Total Recorded Charges
            </p>
            <p className="mt-3 text-3xl font-black">
              {money(totalCharges)}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
              Outstanding Charges
            </p>
            <p className="mt-3 text-3xl font-black">
              {money(outstanding)}
            </p>
          </div>
        </div>

        
<section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
  <h2 className="text-xl font-black text-yellow-400">
    Downloadable Reports
  </h2>

  <p className="text-sm text-zinc-400">
    Download guest participation and billing information
    as CSV files. Both reports can be opened in Excel.
  </p>

  <div className="grid gap-4 md:grid-cols-2">
    <div className="space-y-4 rounded-xl bg-zinc-800 p-5">
      <div>
        <h3 className="text-lg font-bold text-white">
          Guest Journey Summary
        </h3>

        <p className="mt-2 text-sm text-zinc-400">
          One row per guest, including coach, trial dates,
          activities attended, membership status,
          total charges, paid amounts, waived amounts,
          and outstanding balance.
        </p>
      </div>

      <a
        href="/admin/pb101/reports/guest-csv"
        className="inline-flex rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black hover:bg-yellow-300"
      >
        Download Guest Summary CSV
      </a>
    </div>

    <div className="space-y-4 rounded-xl bg-zinc-800 p-5">
      <div>
        <h3 className="text-lg font-bold text-white">
          Detailed Activity Report
        </h3>

        <p className="mt-2 text-sm text-zinc-400">
          One row per recorded activity, including
          guest information, activity date, activity type,
          charge amount, payment status, and notes.
        </p>
      </div>

      <a
        href="/admin/pb101/reports/activity-csv"
        className="inline-flex rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black hover:bg-yellow-300"
      >
        Download Activity Report CSV
      </a>
    </div>
  </div>
</section>

        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-black text-yellow-400">
            Guest Participation Overview
          </h2>

          <div className="overflow-x-auto rounded-xl border border-zinc-700">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-zinc-800 text-zinc-300">
                <tr>
                  <th className="p-3">Guest</th>
                  <th className="p-3">Coach</th>
                  <th className="p-3">Trial Start</th>
                  <th className="p-3">Activities</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>

              <tbody>
                {guests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-6 text-center text-zinc-400"
                    >
                      No PB101+ guests registered yet.
                    </td>
                  </tr>
                ) : (
                  guests.map((guest) => (
                    <tr
                      key={guest.id}
                      className="border-t border-zinc-800"
                    >
                      <td className="p-3 font-semibold">
                        {guest.first_name} {guest.last_name}
                      </td>
                      <td className="p-3">
                        {guest.coach_name || "Not assigned"}
                      </td>
                      <td className="p-3">
                        {guest.trial_start_date}
                      </td>
                      <td className="p-3">
                        {activityCounts.get(guest.id) ?? 0}
                      </td>
                      <td className="p-3 capitalize">
                        {guest.status}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/pb101/attendance"
            className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black"
          >
            Record Attendance
          </Link>

          <Link
            href="/admin/pb101/guests"
            className="rounded-xl bg-zinc-800 px-5 py-3 font-bold text-white"
          >
            Guest Registration
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
