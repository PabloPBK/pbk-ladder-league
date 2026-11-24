
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Player = {
  player_id: string;
  full_name: string;
  club_rating: number | null;
  rating_status: string | null;
  games_needed: number | null;
  games_completed: number | null;
  games_remaining: number | null;
  period_deadline: string | null;
};

function isPastDeadline(deadline: string | null): boolean {
  if (!deadline) return false;

  const today = new Date();
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  return deadline.slice(0, 10) < localToday;
}

function isQualified(player: Player): boolean {
  return player.rating_status?.toLowerCase() === "qualified";
}

function isOverdue(player: Player): boolean {
  return (
    isQualified(player) &&
    (player.games_remaining ?? 0) > 0 &&
    isPastDeadline(player.period_deadline)
  );
}

export default function ClubRatingPlayersPage() {
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
          throw new Error("Unable to load Club Rating players.");
        }

        const result = await response.json();
        setPlayers(result.players ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load Club Rating players."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadPlayers();
  }, []);

  const stats = useMemo(() => {
    return {
      total: players.length,
      qualified: players.filter(isQualified).length,
      provisional: players.filter((p) => !isQualified(p)).length,
      overdue: players.filter(isOverdue).length,
    };
  }, [players]);

  const filteredPlayers = useMemo(() => {
    return players.filter((player) =>
      player.full_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [players, search]);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <Link
            href="/admin/club-rating"
            className="text-sm text-zinc-400 hover:text-white"
          >
            ← Club Rating Dashboard
          </Link>

          <h1 className="mt-4 text-3xl font-bold">
            Club Rating Players
          </h1>

          <p className="mt-2 text-zinc-400">
            Official ratings, qualification progress, and renewal deadlines.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-zinc-400">Loading players...</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/club-rating/overdue"
                className="rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-600"
              >
                Manage Overdue Renewals
              </Link>

              <Link
                href="/admin/club-rating/restorations"
                className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
              >
                Manage PodPlay Restorations
              </Link>

              <Link
                href="/admin/club-rating/podplay-updates"
                className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-600"
              >
                Manage PodPlay Rating Updates
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-400">
                  Total Players
                </p>
                <p className="mt-2 text-3xl font-bold">
                  {stats.total}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-400">
                  Qualified
                </p>
                <p className="mt-2 text-3xl font-bold text-green-400">
                  {stats.qualified}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-400">
                  Provisional
                </p>
                <p className="mt-2 text-3xl font-bold text-yellow-400">
                  {stats.provisional}
                </p>
              </div>

              <Link
                href="/admin/club-rating/overdue"
                className="block rounded-2xl border border-red-900 bg-zinc-900 p-5 transition hover:border-red-500 hover:bg-zinc-800"
              >
                <p className="text-sm text-zinc-400">
                  Overdue Renewals
                </p>

                <p className="mt-2 text-3xl font-bold text-red-400">
                  {stats.overdue}
                </p>

                <p className="mt-2 text-xs text-red-300">
                  View overdue players →
                </p>
              </Link>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <h2 className="text-xl font-semibold">
                  Player Directory
                </h2>

                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search players..."
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500 sm:max-w-xs"
                />
              </div>

              {filteredPlayers.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 p-6 text-zinc-400">
                  No players found.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredPlayers.map((player) => {
                    const qualified = isQualified(player);
                    const overdue = isOverdue(player);
                    const required = qualified ? 6 : 12;
                    const remaining = Math.max(
                      0,
                      player.games_remaining ?? required
                    );
                    const completed = Math.max(
                      0,
                      Math.min(required, required - remaining)
                    );

                    return (
                      <Link
                        key={player.player_id}
                        href={`/admin/club-rating/players/${player.player_id}`}
                        prefetch={false}
                        aria-labelledby={`player-name-${player.player_id} player-history-${player.player_id}`}
                        className="group block rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-blue-400 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3
                            id={`player-name-${player.player_id}`}
                            className="min-w-0 break-words text-lg font-semibold text-blue-300 underline underline-offset-4"
                          >
                            {player.full_name}
                          </h3>

                          <span
                            className={
                              overdue
                                ? "rounded-full bg-red-950 px-3 py-1 text-xs text-red-300"
                                : qualified
                                ? "rounded-full bg-green-950 px-3 py-1 text-xs text-green-300"
                                : "rounded-full bg-yellow-950 px-3 py-1 text-xs text-yellow-300"
                            }
                          >
                            {overdue
                              ? "Overdue"
                              : qualified
                              ? "Qualified"
                              : "Provisional"}
                          </span>
                        </div>

                        <div className="mt-5">
                          <p className="text-xs text-zinc-400">
                            Official Club Rating
                          </p>
                          <p className="mt-1 text-2xl font-bold">
                            {player.club_rating != null
                              ? Number(player.club_rating).toFixed(3)
                              : "Not Yet Rated"}
                          </p>
                        </div>

                        <div className="mt-5">
                          <div className="flex justify-between gap-2 text-sm">
                            <span className="text-zinc-400">
                              {qualified
                                ? "Renewal Progress"
                                : "Initial Qualification Progress"}
                            </span>

                            <span>
                              {completed} of {required} games
                            </span>
                          </div>

                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className={
                                overdue
                                  ? "h-full rounded-full bg-red-500"
                                  : qualified
                                  ? "h-full rounded-full bg-green-500"
                                  : "h-full rounded-full bg-yellow-500"
                              }
                              style={{
                                width: `${Math.min(
                                  100,
                                  (completed / required) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>

                        {qualified && (
                          <p
                            className={`mt-4 text-sm ${
                              overdue
                                ? "text-red-400"
                                : "text-zinc-400"
                            }`}
                          >
                            Renewal Deadline:{" "}
                            {player.period_deadline
                              ? player.period_deadline.slice(0, 10)
                              : "Not Set"}
                          </p>
                        )}
                        <div className="mt-4 border-t border-zinc-700 pt-3 text-sm font-semibold text-blue-300">
                          <span id={`player-history-${player.player_id}`}>View session &amp; game history</span>
                          <span aria-hidden="true" className="ml-2 inline-block transition-transform group-hover:translate-x-1">→</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-lg font-semibold">
                Club Rating Program Rules
              </h2>

              <p className="mt-3 text-sm text-zinc-400">
                New players must complete 12 qualifying games across
                two PB Vision sessions. Qualified players must complete
                six renewal games every three months.
              </p>

              <p className="mt-2 text-sm text-zinc-400">
                Overdue players retain their historical Club Rating.
                PodPlay removal and restoration are managed separately
                by staff.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
