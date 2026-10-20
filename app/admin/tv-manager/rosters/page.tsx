import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

export default function LiveRostersPage() {
  return (
    <AppLayout
      title="Live Event Rosters"
      description="Manage players, teams, free agents, and DUPR rankings."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-2xl font-black text-yellow-400">
            Event Roster Manager
          </h2>

          <p className="mt-2 text-zinc-400">
            Create event rosters, import registrations,
            assign partners, and manage DUPR rankings.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-5">
              <h3 className="text-lg font-bold text-white">
                📋 Event Rosters
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Create events and manage registered players.
              </p>
              <p className="mt-4 text-sm font-semibold text-yellow-400">
                Coming next
              </p>
            </div>

            <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-5">
              <h3 className="text-lg font-bold text-white">
                📤 CSV Import
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Upload player registrations from CSV files.
              </p>
              <p className="mt-4 text-sm font-semibold text-yellow-400">
                Coming next
              </p>
            </div>

            <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-5">
              <h3 className="text-lg font-bold text-white">
                🤝 Partner Assignment
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Pair players and automatically calculate
                combined doubles DUPR.
              </p>
              <p className="mt-4 text-sm font-semibold text-yellow-400">
                Coming next
              </p>
            </div>

            <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-5">
              <h3 className="text-lg font-bold text-white">
                🏆 Teams & Free Agents
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                View ranked teams and unpaired players.
              </p>
              <p className="mt-4 text-sm font-semibold text-yellow-400">
                Coming next
              </p>
            </div>
          </div>

          <Link
            href="/admin/tv-manager"
            className="mt-6 inline-block rounded-lg bg-yellow-400 px-5 py-3 font-bold text-black hover:bg-yellow-300"
          >
            Back to TV Manager
          </Link>
        </section>
      </div>
    </AppLayout>
  );
}
