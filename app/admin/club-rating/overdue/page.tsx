
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Player = {
  player_id: string;
  full_name: string;
  club_rating: number | null;
  rating_status: string | null;
  games_remaining: number | null;
  period_deadline: string | null;
};

function todayLocal(): string {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function isOverdue(player: Player): boolean {
  return (
    player.rating_status?.toLowerCase() === "qualified" &&
    (player.games_remaining ?? 0) > 0 &&
    !!player.period_deadline &&
    player.period_deadline.slice(0, 10) < todayLocal()
  );
}

function daysOverdue(deadline: string): number {
  const start = new Date(`${deadline.slice(0, 10)}T00:00:00Z`);
  const today = new Date(`${todayLocal()}T00:00:00Z`);

  return Math.max(
    0,
    Math.round((today.getTime() - start.getTime()) / 86400000)
  );
}

export default function ClubRatingOverduePage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadPlayers() {
      try {
        const response = await fetch("/api/club-rating/players", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load overdue players.");
        }

        const result = await response.json();
        setPlayers(result.players ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load overdue players."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadPlayers();
  }, []);

  const overduePlayers = useMemo(() => {
    return players
      .filter(isOverdue)
      .filter((player) =>
        player.full_name.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) =>
        (a.period_deadline ?? "").localeCompare(b.period_deadline ?? "")
      );
  }, [players, search]);

  const totalOverdue = useMemo(
    () => players.filter(isOverdue).length,
    [players]
  );

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link
            href="/admin/club-rating/players"
            className="text-sm text-zinc-400 hover:text-white"
          >
            ← Back to Club Rating Players
          </Link>

          <h1 className="mt-4 text-3xl font-bold">
            Overdue Renewals
          </h1>

          <p className="mt-2 text-zinc-400">
            Qualified players who have missed their renewal deadline.
            Staff must manually remove their rating from PodPlay.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-red-900 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
              Total Overdue
            </p>
            <p className="mt-2 text-3xl font-bold text-red-400">
              {loading ? "—" : totalOverdue}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
              Requalification Review
            </p>
            <p className="mt-2 text-3xl font-bold text-yellow-400">
              {loading
                ? "—"
                : players.filter(
                    (player) =>
                      isOverdue(player) &&
                      !!player.period_deadline &&
                      daysOverdue(player.period_deadline) >= 90
                  ).length}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              90+ days overdue; manual review only
            </p>
          </div>
        </div>

        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search overdue players..."
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-blue-500"
        />

        {loading ? (
          <p className="text-zinc-400">Loading overdue players...</p>
        ) : overduePlayers.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
            No overdue players found.
          </div>
        ) : (
          <div className="space-y-3">
            {overduePlayers.map((player) => {
              const overdueDays = daysOverdue(
                player.period_deadline!
              );

              return (
                <div
                  key={player.player_id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {player.full_name}
                      </h2>

                      <p className="mt-1 text-sm text-zinc-400">
                        Official Club Rating:{" "}
                        <span className="font-semibold text-white">
                          {player.club_rating != null
                            ? Number(player.club_rating).toFixed(3)
                            : "Not Available"}
                        </span>
                      </p>

                      <p className="mt-1 text-sm text-zinc-400">
                        Renewal Deadline:{" "}
                        {player.period_deadline?.slice(0, 10)}
                      </p>

                      <p className="mt-1 text-sm text-zinc-400">
                        Games Remaining:{" "}
                        {player.games_remaining ?? 6}
                      </p>
                    </div>

                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <span className="rounded-full bg-red-950 px-3 py-1 text-sm text-red-300">
                        {overdueDays} days overdue
                      </span>

                      {overdueDays >= 90 && (
                        <span className="rounded-full bg-yellow-950 px-3 py-1 text-xs text-yellow-300">
                          Eligible for requalification review
                        </span>
                      )}

                      <span className="text-xs text-zinc-500">
                        PodPlay action tracking coming next
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
