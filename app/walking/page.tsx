"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CourtCard } from "@/components/courts/CourtCard";
import { mockCourts, type Court } from "@/lib/mock/courts";

const courts = mockCourts;

function createPairings(players: Court["players"]) {
  const [playerA, playerB, playerC, playerD] = players;

  return [
    {
      team1: [playerA, playerB] as [string, string],
      team2: [playerC, playerD] as [string, string],
    },
    {
      team1: [playerA, playerC] as [string, string],
      team2: [playerB, playerD] as [string, string],
    },
    {
      team1: [playerA, playerD] as [string, string],
      team2: [playerB, playerC] as [string, string],
    },
  ];
}

export default function WalkingPage() {
  const [currentCourtIndex, setCurrentCourtIndex] = useState(0);

  const [confirmedPairings, setConfirmedPairings] = useState<
    Record<number, number>
  >({});

  const allCourtsConfirmed = currentCourtIndex >= courts.length;

  function handlePairingSelect(pairingIndex: number) {
    const currentCourt = courts[currentCourtIndex];

    setConfirmedPairings((previous) => ({
      ...previous,
      [currentCourt.id]: pairingIndex,
    }));

    window.setTimeout(() => {
      setCurrentCourtIndex((previous) => previous + 1);
    }, 600);
  }

  function restartWalkingMode() {
    setConfirmedPairings({});
    setCurrentCourtIndex(0);
  }

  if (allCourtsConfirmed) {
    return (
      <AppLayout
        title="Walking Mode"
        description="Every court has a confirmed partnership."
      >
        <div className="mx-auto max-w-md rounded-3xl border border-green-500/40 bg-green-500/10 p-8 text-center">
          <div className="text-6xl">✓</div>

          <h3 className="mt-4 text-3xl font-bold text-green-400">
            All Courts Confirmed
          </h3>

          <p className="mt-3 text-zinc-300">
            {courts.length} of {courts.length} courts are ready.
          </p>

          <button
            type="button"
            onClick={restartWalkingMode}
            className="mt-8 min-h-14 w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white transition hover:bg-blue-500"
          >
            Run Demo Again
          </button>
        </div>
      </AppLayout>
    );
  }

  const currentCourt = courts[currentCourtIndex];
  const completedCount = Object.keys(confirmedPairings).length;
  const progressPercent = (completedCount / courts.length) * 100;

  return (
    <AppLayout
      title="Walking Mode"
      description="Tap the correct partnership for each court."
    >
      <div className="mx-auto mb-6 max-w-md">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-zinc-200">
            {completedCount} of {courts.length} courts confirmed
          </span>

          <span className="text-zinc-400">
            Court {currentCourtIndex + 1} of {courts.length}
          </span>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <CourtCard
        key={currentCourt.id}
        courtNumber={currentCourt.id}
        totalCourts={courts.length}
        players={currentCourt.players}
        pairings={createPairings(currentCourt.players)}
        onSelect={handlePairingSelect}
      />
    </AppLayout>
  );
}