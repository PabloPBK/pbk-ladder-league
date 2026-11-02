
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
  membership_type: string | null;
  conversion_reason: string | null;
  conversion_notes: string | null;
  follow_up_date: string | null;
};

function pacificToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function PB101GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ guestId?: string }>;
}) {
  await requireStaffUser();

  const { data, error } = await supabaseAdmin
    .from("pb101_guests")
    .select(
      "id, first_name, last_name, email, phone, coach_name, trial_start_date, trial_end_date, status, membership_decision, membership_type, conversion_reason, conversion_notes, follow_up_date"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Unable to load PB101 guests:", error);
  }

    const guests = (data ?? []) as PB101Guest[];
  const today = pacificToday();

  const { guestId } = await searchParams;

  const selectedGuestId =
    guestId && guests.some((guest) => guest.id === guestId)
      ? guestId
      : "";

  const needsDecision = guests.filter(
    (guest) =>
      guest.trial_end_date <= today &&
      guest.membership_decision !== "converted" &&
      guest.membership_decision !== "declined" &&
      guest.membership_decision !== "considering" &&
      guest.status !== "paused"
  );

  return (
    <AppLayout
      title="PB101+ Guest Registration"
      description="Register guests, manage seven-day trials, and track membership decisions."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        {error ? (
          <section className="rounded-2xl border border-red-700 bg-red-950 p-5 text-red-200">
            Unable to load PB101 guest alerts.
          </section>
        ) : needsDecision.length > 0 ? (
          <section className="rounded-2xl border border-amber-600 bg-amber-950/40 p-5">
            <h2 className="text-xl font-black text-amber-300">
              Membership Decisions Required
            </h2>

            <p className="mt-2 text-sm text-amber-100">
              {needsDecision.length} guest
              {needsDecision.length === 1 ? "" : "s"} have
              reached the end of their seven-day trial
              without a recorded membership decision.
            </p>

            <div className="mt-4 space-y-2">
              {needsDecision.map((guest) => (
                <div
                  key={guest.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-800 bg-zinc-900 p-3"
                >
                  <div>
                    <p className="font-semibold text-white">
                      {guest.first_name} {guest.last_name}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {guest.email}
                    </p>
                  </div>

                  <div className="text-sm text-amber-300">
                    Trial ended: {guest.trial_end_date}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-3 text-sm text-amber-100">
              Use Membership Conversion Tracking below
              to record each guest's decision.
            </p>
          </section>
        ) : (
          <section className="rounded-2xl border border-green-800 bg-green-950/30 p-4 text-sm text-green-300">
            No overdue membership decisions among the
            loaded guest records.
          </section>
        )}

        <GuestRegistrationForm />

        <PB101CSVImport />

        <MembershipDecisionForm
  guests={guests}
  initialGuestId={selectedGuestId}
/>
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
                    <th className="px-3 py-3">
                      Membership Type
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {guests.map((guest) => {
                    const overdue = needsDecision.some(
                      (item) => item.id === guest.id
                    );

                    return (
                      <tr
                        key={guest.id}
                        className={`border-b border-zinc-800 ${
                          overdue
                            ? "bg-amber-950/30 text-amber-100"
                            : "text-zinc-200"
                        }`}
                      >
                        <td className="px-3 py-3 font-semibold">
                          {guest.first_name}{" "}
                          {guest.last_name}
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
                          {overdue ? (
                            <span className="rounded-full bg-amber-900 px-3 py-1 text-xs font-semibold text-amber-200">
                              Decision Required
                            </span>
                          ) : (
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
                          )}
                        </td>

                        <td className="px-3 py-3">
                          {guest.membership_type || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
