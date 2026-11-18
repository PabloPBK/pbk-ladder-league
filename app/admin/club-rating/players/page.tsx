
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Player = {
  player_id: string;
  full_name: string;
  club_rating: number | string | null;
  rating_status: string | null;
  games_needed: number | null;
  games_completed: number | null;
  games_remaining: number | null;
};

export default function ClubRatingPlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPlayers() {
      try {
        const response = await fetch(
          "/api/club-rating/players",
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Unable to load player ratings."
          );
        }

        if (active) {
          setPlayers(data.players ?? []);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load players."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPlayers();

    return () => {
      active = false;
    };
  }, []);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return players.filter((player) =>
      player.full_name.toLowerCase().includes(query)
    );
  }, [players, search]);

  const playersWithRating = players.filter(
  (player) => player.club_rating !== null
).length;

const provisionalPlayers = players.filter(
  (player) =>
    player.rating_status?.toLowerCase() === "provisional"
).length;

  const totalGames = players.reduce(
    (sum, player) =>
      sum + (player.games_completed ?? 0),
    0
  );

  function formatRating(
    rating: number | string | null
  ) {
    if (rating === null) {
      return "—";
    }

    const numeric = Number(rating);

    return Number.isFinite(numeric)
      ? numeric.toFixed(3)
      : "—";
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6 text-zinc-300">
        Loading Club Rating players...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 text-white sm:px-6">
      <div>
        <Link
          href="/admin/club-rating"
          className="text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          ← Back to Club Rating
        </Link>

        <h1 className="mt-5 text-3xl font-bold">
          Player Ratings
        </h1>

        <p className="mt-2 text-sm text-zinc-400">
          Monitor Club Rating qualification progress,
          completed PB Vision games, and official ratings.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200"
        >
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">
            Total Players
          </p>

          <p className="mt-2 text-3xl font-bold text-white">
            {players.length}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">
            Players With Club Rating
          </p>

          <p className="mt-2 text-3xl font-bold text-green-400">
           {playersWithRating}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">
            Provisional Players
          </p>

          <p className="mt-2 text-3xl font-bold text-yellow-400">
            {provisionalPlayers}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              Player Qualification Progress
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              {players.length} players · {totalGames} individual
              game records
            </p>
          </div>

          <div className="w-full sm:w-72">
            <label
              htmlFor="player-search"
              className="sr-only"
            >
              Search players
            </label>

            <input
              id="player-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {filteredPlayers.map((player) => {
            const completed =
              player.games_completed ?? 0;

            const needed =
              player.games_needed ?? 12;

            const remaining =
              player.games_remaining ?? Math.max(
                needed - completed,
                0
              );

            const percentage =
              needed > 0
                ? Math.min(
                    (completed / needed) * 100,
                    100
                  )
                : 100;

           const isQualified =
  player.rating_status?.toLowerCase() === "qualified";

            return (
              <div
                key={player.player_id}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">
                      {player.full_name}
                    </h3>

                    <p className="mt-1 text-xs text-zinc-500">
                      Club Rating:{" "}
                      <span className="font-semibold text-zinc-200">
                        {formatRating(player.club_rating)}
                      </span>
                    </p>
                  </div>

                  <span
                    className={
                      isQualified
                        ? "rounded-full border border-green-800 bg-green-950 px-3 py-1 text-xs font-medium text-green-300"
                        : "rounded-full border border-yellow-800 bg-yellow-950 px-3 py-1 text-xs font-medium text-yellow-300"
                    }
                  >
                    {isQualified ? "Qualified" : "Provisional"}
                  </span>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 text-xs">
                  <span className="text-zinc-400">
                    {completed} of {needed} games completed
                  </span>

                  <span className="font-medium text-zinc-200">
                    {remaining} remaining
                  </span>
                </div>

                <div
                  className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-800"
                  role="progressbar"
                  aria-label={`${player.full_name} qualification progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(percentage)}
                >
                  <div
                    className={
                      isQualified
                        ? "h-full rounded-full bg-green-500 transition-all"
                        : "h-full rounded-full bg-blue-500 transition-all"
                    }
                    style={{
                      width: `${percentage}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}

          {filteredPlayers.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-400">
              {search
                ? "No players match your search."
                : "No Club Rating players found."}
            </div>
          )}
        </div>
      </section>

      <div className="rounded-xl border border-blue-900/50 bg-blue-950/20 p-5">
        <h3 className="font-semibold text-blue-300">
          Club Rating Qualification Rules
        </h3>

        <p className="mt-2 text-sm leading-6 text-zinc-300">
          New players must complete 12 PB Vision-rated
          games to qualify for their initial Club Rating.
          Once qualified, players must complete qualifying
          renewal sessions to maintain rating reliability.
          Official rating calculations and renewal tracking
          will be added separately.
        </p>
      </div>
    </div>
  );
}
