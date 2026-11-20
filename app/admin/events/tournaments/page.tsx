
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

export default function TournamentManagementPage() {
  return (
    <AppLayout
      title="Tournament Management"
      description="Create and manage tournaments across multiple facilities."
    >
      <div className="space-y-6">
        <Link
          href="/admin/events"
          className="inline-block text-sm font-semibold text-yellow-400 hover:underline"
        >
          ← Back to Event Types
        </Link>

        <section className="rounded-2xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-transparent p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
            PBK NORTHWEST · ZZ2 PICKLEBALL
          </p>

          <h2 className="mt-3 text-3xl font-black text-white">
            Tournament Management
          </h2>

          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Create tournaments, manage multiple facilities,
            and publish events to ZZ2 Pickleball and PBK Northwest.
          </p>

          <Link
            href="/admin/events/tournaments/new"
            className="mt-5 inline-flex rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-zinc-950 transition hover:bg-yellow-300"
          >
            + Create Tournament
          </Link>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Upcoming Tournaments", value: "0" },
            { label: "Published Tournaments", value: "0" },
            { label: "Past Tournaments", value: "0" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-5"
            >
              <p className="text-sm text-zinc-400">
                {item.label}
              </p>
              <p className="mt-2 text-3xl font-black text-white">
                {item.value}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-5">
          <h3 className="text-lg font-bold text-white">
            Upcoming Tournaments
          </h3>
          <p className="mt-2 text-sm text-zinc-400">
            No tournaments have been created yet.
            Your upcoming tournaments will appear here.
          </p>
        </section>

        <section className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-5">
          <h3 className="text-lg font-bold text-white">
            Past Tournaments
          </h3>
          <p className="mt-2 text-sm text-zinc-400">
            Completed tournaments will appear here.
          </p>
        </section>
      </div>
    </AppLayout>
  );
}
