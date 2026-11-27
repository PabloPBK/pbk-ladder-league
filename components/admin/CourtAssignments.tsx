"use client";

import Link from "next/link";

import type { GeneratedCourt } from "@/types/court";

type CourtAssignmentsProps = {
  courts: GeneratedCourt[];
  currentRound: number;
  eventId: string;
};

export function CourtAssignments({
  courts,
  currentRound,
  eventId,
}: CourtAssignmentsProps) {
  if (courts.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <section className="court-assignment-print hidden print:block">
        <h1>Round {currentRound} Court Assignments</h1>
        <p>{courts.length} courts</p>
        <div className="print-court-grid">
          {courts.map((court) => (
            <div key={court.id} className="print-court-card">
              <h2>Court {court.id}</h2>
              <ol>{court.players.map((player) => <li key={player.id}><strong>{player.name}</strong></li>)}</ol>
            </div>
          ))}
        </div>
      </section>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Round {currentRound} Court Assignments
          </h2>


        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/walking"
            className="flex min-h-11 items-center justify-center rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-300"
          >
            Start Runner Mode
          </Link>

          <Link
            href="/admin/scores"
            className="flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500"
          >
            Enter Round {currentRound} Scores
          </Link>

          <button type="button" onClick={() => window.print()}
            className="min-h-11 rounded-xl border border-zinc-600 px-5 py-2.5 text-sm font-bold hover:bg-zinc-800">
            Print Court List
          </button>

          <Link
            href={`/tv/session/${eventId}?view=standings`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center rounded-xl bg-zinc-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-700"
          >
            Live Standings
          </Link>


        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {courts.map((court) => (
          <article
            key={court.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
          >
            <h3 className="font-bold text-yellow-400">
              Court {court.id}
            </h3>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {court.players.map((player, index) => (
                <div
                  key={player.id}
                  className="flex min-w-0 items-center justify-between rounded-lg bg-zinc-800 px-3 py-2"
                >
                  <span className="truncate text-sm font-medium text-white">
                    {index + 1}. {player.name}
                  </span>

                  <span className="ml-2 shrink-0 text-xs text-zinc-400">
                    {player.dupr.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}