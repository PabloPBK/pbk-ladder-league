"use client";

import { useState } from "react";

type Pairing = {
  team1: [string, string];
  team2: [string, string];
};

type CourtCardProps = {
  courtNumber: number;
  totalCourts: number;
  players: string[];
  pairings: Pairing[];
  onSelect: (index: number) => void;
};

export function CourtCard({
  courtNumber,
  totalCourts,
  players,
  pairings,
  onSelect,
}: CourtCardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  function handleSelect(index: number) {
    if (selectedIndex !== null) return;

    setSelectedIndex(index);
    onSelect(index);
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Court {courtNumber}</h2>

        <span className="text-zinc-400">
          {courtNumber} of {totalCourts}
        </span>
      </div>

      <div className="mb-6 space-y-2">
        {players.map((player) => (
          <div
            key={player}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-lg"
          >
            {player}
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {pairings.map((pairing, index) => {
          const isSelected = selectedIndex === index;

          return (
            <button
              key={index}
              type="button"
              disabled={selectedIndex !== null}
              onClick={() => handleSelect(index)}
              className={`w-full rounded-xl border p-4 text-left transition ${
                isSelected
                  ? "border-green-500 bg-green-500/15"
                  : "border-zinc-700 hover:border-blue-500 hover:bg-zinc-800"
              } disabled:cursor-default`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">
                    {pairing.team1[0]} + {pairing.team1[1]}
                  </div>

                  <div className="mt-1 text-zinc-400">
                    {pairing.team2[0]} + {pairing.team2[1]}
                  </div>
                </div>

                {isSelected && (
                  <span className="text-lg font-bold text-green-400">
                    ✓ Confirmed
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
