
import { AppLayout } from "@/components/layout/AppLayout";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { GuestRegistrationForm } from "./GuestRegistrationForm";
import { PB101CSVImport } from "./PB101CSVImport";
import MembershipDecisionForm from "./MembershipDecisionForm";

export const dynamic = "force-dynamic";

type PB101Guest = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  coach_name: string | null;
  trial_start_date: string;
  trial_end_date: string;
  status: string;
  membership_decision: string | null;
  conversion_reason: string | null;
  conversion_notes: string | null;
  follow_up_date: string | null;
};

export default async function PB101GuestsPage() {
  await requireStaffUser();

  const { data, error } = await supabaseAdmin
    .from("pb101_guests")
    .select(
      "id, first_name, last_name, email, phone, coach_name, trial_start_date, trial_end_date, status, membership_decision, conversion_reason, conversion_notes, follow_up_date"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Unable to load PB101 guests:", error);
  }

  const guests = (data ?? []) as PB101Guest[];

  return (
    <AppLayout
      title="PB101+ Guest Registration"
      description="Register guests, manage seven-day trials, and track membership decisions."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <GuestRegistrationForm />

        <PB101CSVImport />

        <MembershipDecisionForm guests={guests} />

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-white">
              Registered Guests
            </h2>

            <span className="rounded-lg bg-zinc-800 px-3 py-1 text-sm text-zinc-300">
              {guests.length} shown
            </span>
          </div>

          {error ? (
            <p className="text-sm text-red-400">
              Unable to load guest records. Please try again.
            </p>
          ) : guests.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">
              No PB101+ guests have been registered yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-zinc-700 text-zinc-400">
                  <tr>
                    <th className="px-3 py-3">Guest</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">PB101 Coach</th>
                    <th className="px-3 py-3">Trial Starts</th>
                    <th className="px-3 py-3">Trial Ends</th>
                    <th className="px-3 py-3">Trial Status</th>
                    <th className="px-3 py-3">
                      Membership Decision
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {guests.map((guest) => (
                    <tr
                      key={guest.id}
                      className="border-b border-zinc-800 text-zinc-200"
                    >
                      <td className="px-3 py-3 font-semibold">
                        {guest.first_name} {guest.last_name}
                      </td>

                      <td className="px-3 py-3">
                        {guest.email}
                      </td>

                      <td className="px-3 py-3">
                        {guest.coach_name || "Not assigned"}
                      </td>

                      <td className="px-3 py-3">
                        {guest.trial_start_date}
                      </td>

                      <td className="px-3 py-3">
                        {guest.trial_end_date}
                      </td>

                      <td className="px-3 py-3">
                        <span className="rounded-full bg-blue-950 px-3 py-1 text-xs font-semibold text-blue-300">
                          {guest.status}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            guest.membership_decision ===
                            "converted"
                              ? "bg-green-950 text-green-300"
                              : guest.membership_decision ===
                                  "declined"
                                ? "bg-red-950 text-red-300"
                                : guest.membership_decision ===
                                    "considering"
                                  ? "bg-yellow-950 text-yellow-300"
                                  : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {guest.membership_decision ===
                          "converted"
                            ? "Converted"
                            : guest.membership_decision ===
                                "declined"
                              ? "Declined"
                              : guest.membership_decision ===
                                  "considering"
                                ? "Considering"
                                : "Not Recorded"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
