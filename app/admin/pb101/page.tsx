import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { requireStaffUser } from "@/lib/server/require-auth";

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

export default async function PB101DashboardPage() {
  await requireStaffUser();

  return (
    <AppLayout
      title="PB101+ Guest Journey Manager"
      description="Manage seven-day guest trials, attendance, automated emails, and membership follow-ups."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-blue-800 bg-blue-950/30 p-5">
          <h2 className="text-xl font-bold text-yellow-400">
            Welcome to PB101+
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Track guests from their first PB101 class through
            their seven-day trial and membership decision.
          </p>

          <p className="mt-3 text-xs text-blue-300">
            Database tables created. Dashboard features are being
            connected one step at a time.
          </p>
        </div>

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

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
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
        </div>
      </div>
    </AppLayout>
  );
}
