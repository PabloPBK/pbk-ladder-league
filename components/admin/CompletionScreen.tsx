"use client";

import Link from "next/link";

type CompletionScreenProps = {
  completedEventName: string;
  onStartNewLeagueNight: () => void;
};

export function CompletionScreen({
  completedEventName,
  onStartNewLeagueNight,
}: CompletionScreenProps) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-green-500/40 bg-green-500/10 p-7 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20 text-3xl font-bold text-green-300">
        ✓
      </div>

      <h2 className="mt-5 text-3xl font-bold text-white">
        {completedEventName || "League night"} saved
      </h2>

      <p className="mt-3 text-zinc-300">
        Courts, pairings, scores, standings, and
        check-ins have been cleared from the active
        session. The completed results remain available
        in History.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onStartNewLeagueNight}
          className="min-h-14 rounded-xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-500"
        >
          Start New League Night
        </button>

        <Link
          href="/history"
          className="flex min-h-14 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-6 py-4 font-bold text-white transition hover:bg-zinc-800"
        >
          View History
        </Link>
      </div>
    </div>
  );
}