
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const sections = [
  {
    title: "Guest Registration",
    description:
      "Register new PB101 guests manually or import them from PodPlay CSV files.",
    href: "/admin/pb101/guests",
    icon: "👤",
  },
  {
    title: "Daily Attendance",
    description:
      "Record which beginner programs guests attend during their seven-day trial.",
    href: "/admin/pb101/attendance",
    icon: "📅",
  },
  {
    title: "Automated Emails",
    description:
      "Manage welcome messages, reminders, and final follow-ups from Pablo.",
    href: "/admin/pb101/emails",
    icon: "✉️",
  },
  {
    title: "Reports",
    description:
      "Review participation, coach performance, and membership conversions.",
    href: "/admin/pb101/reports",
    icon: "📊",
  },
];

type GuestSummary = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  trial_end_date: string;
  status: string;
  membership_decision: string | null;
  membership_type: string | null;
  follow_up_date: string | null;
};

const membershipTypes = [
  "Ace Select",
  "Ace",
  "Team",
  "Royal Family",
] as const;

function getPacificToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default async function PB101DashboardPage() {
  await requireStaffUser();

  const { data, error } = await supabaseAdmin
    .from("pb101_guests")
    .select(
      "id, first_name, last_name, email, trial_end_date, status, membership_decision, membership_type, follow_up_date"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("PB101 dashboard guest query error:", error);
  }

  const guests = (data ?? []) as GuestSummary[];
  const today = getPacificToday();

  const decisionRequired = guests.filter(
    (guest) =>
      guest.trial_end_date <= today &&
      !["converted", "declined", "considering"].includes(
        guest.membership_decision ?? ""
      ) &&
      guest.status !== "paused"
  );

  const followUpsDue = guests.filter(
    (guest) =>
      guest.membership_decision === "considering" &&
      guest.follow_up_date !== null &&
      guest.follow_up_date <= today &&
      guest.status !== "paused"
  );

  const convertedGuests = guests.filter(
    (guest) => guest.membership_decision === "converted"
  );

  const membershipCounts = membershipTypes.map((type) => ({
    type,
    count: convertedGuests.filter(
      (guest) => guest.membership_type === type
    ).length,
  }));

  const unclassifiedConversions = convertedGuests.filter(
    (guest) =>
      !membershipTypes.some(
        (type) => type === guest.membership_type
      )
  ).length;

  return (
    <AppLayout
      title="PB101+ Guest Journey Manager"
      description="Manage seven-day guest trials, attendance, automated emails, and membership follow-ups."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-blue-800 bg-blue-950/30 p-5">
          <h2 className="text-xl font-bold text-yellow-400">
            Welcome to PB101+
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Track guests from their first PB101 class
            through their seven-day trial and membership
            decision.
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-yellow-400">
                Staff Action Center
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Membership decisions and follow-ups
                requiring staff attention.
              </p>
            </div>

            <Link
              href="/admin/pb101/guests"
              className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300"
            >
              Open Guest Management →
            </Link>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-red-800 bg-red-950 p-4 text-sm text-red-300">
              Unable to load staff alerts. Please refresh
              the dashboard.
            </p>
          ) : (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-amber-800 bg-amber-950/40 p-4">
                  <p className="text-sm font-semibold text-amber-200">
                    Decisions Required
                  </p>
                  <p className="mt-2 text-3xl font-black text-white">
                    {decisionRequired.length}
                  </p>
                </div>

                <div className="rounded-xl border border-blue-800 bg-blue-950/40 p-4">
                  <p className="text-sm font-semibold text-blue-200">
                    Follow-Ups Due
                  </p>
                  <p className="mt-2 text-3xl font-black text-white">
                    {followUpsDue.length}
                  </p>
                </div>

                <div className="rounded-xl border border-green-800 bg-green-950/40 p-4">
                  <p className="text-sm font-semibold text-green-200">
                    Converted Members
                  </p>
                  <p className="mt-2 text-3xl font-black text-white">
                    {convertedGuests.length}
                  </p>
                </div>
              </div>

              {decisionRequired.length === 0 &&
              followUpsDue.length === 0 ? (
                <div className="mt-5 rounded-xl border border-green-800 bg-green-950/20 p-4 text-sm text-green-300">
                  No membership decisions or scheduled
                  follow-ups currently require attention.
                </div>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-amber-800 bg-zinc-950 p-4">
                    <h3 className="font-bold text-amber-300">
                      Membership Decisions Required
                    </h3>

                    {decisionRequired.length === 0 ? (
                      <p className="mt-3 text-sm text-zinc-400">
                        No outstanding decisions.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {decisionRequired.map((guest) => (
                          <div
                            key={guest.id}
                            className="border-b border-zinc-800 pb-3 last:border-0 last:pb-0"
                          >
                            <p className="font-semibold text-white">
                              {guest.first_name}{" "}
                              {guest.last_name}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {guest.email}
                            </p>
                            <p className="mt-1 text-xs text-amber-300">
                              Trial ended:{" "}
                              {guest.trial_end_date}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-blue-800 bg-zinc-950 p-4">
                    <h3 className="font-bold text-blue-300">
                      Follow-Ups Due
                    </h3>

                    {followUpsDue.length === 0 ? (
                      <p className="mt-3 text-sm text-zinc-400">
                        No follow-ups due.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {followUpsDue.map((guest) => (
                          <div
                            key={guest.id}
                            className="border-b border-zinc-800 pb-3 last:border-0 last:pb-0"
                          >
                            <p className="font-semibold text-white">
                              {guest.first_name}{" "}
                              {guest.last_name}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {guest.email}
                            </p>
                            <p className="mt-1 text-xs text-blue-300">
                              Follow-up due:{" "}
                              {guest.follow_up_date}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-lg font-bold text-white">
            Membership Conversion Breakdown
          </h2>

          {error ? (
            <p className="mt-3 text-sm text-red-300">
              Membership statistics are unavailable.
            </p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {membershipCounts.map(({ type, count }) => (
                  <div
                    key={type}
                    className="rounded-xl bg-zinc-800 p-4"
                  >
                    <p className="text-sm text-zinc-400">
                      {type}
                    </p>
                    <p className="mt-2 text-2xl font-black text-yellow-400">
                      {count}
                    </p>
                  </div>
                ))}
              </div>

              {unclassifiedConversions > 0 && (
                <p className="mt-3 text-sm text-amber-300">
                  {unclassifiedConversions} converted guest
                  {unclassifiedConversions === 1 ? "" : "s"}{" "}
                  have no recognized membership type.
                </p>
              )}
            </>
          )}
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-yellow-400 hover:bg-zinc-800"
            >
              <div className="mb-4 text-3xl">
                {section.icon}
              </div>

              <h3 className="text-lg font-bold text-white">
                {section.title}
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {section.description}
              </p>

              <p className="mt-5 text-sm font-semibold text-yellow-400">
                Open section →
              </p>
            </Link>
          ))}
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-lg font-bold text-white">
            PB101+ Program Overview
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-zinc-800 p-4">
              <p className="text-sm text-zinc-400">
                Trial Duration
              </p>
              <p className="mt-2 text-2xl font-black text-yellow-400">
                7 Days
              </p>
            </div>

            <div className="rounded-xl bg-zinc-800 p-4">
              <p className="text-sm text-zinc-400">
                Attendance Tracking
              </p>
              <p className="mt-2 text-lg font-bold text-white">
                Daily Staff Review
              </p>
            </div>

            <div className="rounded-xl bg-zinc-800 p-4">
              <p className="text-sm text-zinc-400">
                Automated Messages
              </p>
              <p className="mt-2 text-lg font-bold text-white">
                Email Only
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs text-zinc-500">
            Email sender: Pablo | Pickleball Kingdom Lynnwood
          </p>
        </section>
      </div>
    </AppLayout>
  );
}
