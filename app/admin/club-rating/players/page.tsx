
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
  period_deadline: string | null;
};

function formatRating(rating: number | string | null) {
  if (rating === null) return "—";

  const numeric = Number(rating);
  return Number.isFinite(numeric)
    ? numeric.toFixed(3)
    : "—";
}

function formatDate(date: string | null) {
  if (!date) return "Not available";

  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isPastDeadline(date: string | null) {
  if (!date) return false;

  const today = new Date();
  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  return date.slice(0, 10) < todayString;
}

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
        if (active) setLoading(false);
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

  const qualifiedPlayers = players.filter(
    (player) =>
      player.rating_status?.toLowerCase() === "qualified"
  ).length;

  const provisionalPlayers = players.filter(
    (player) =>
      player.rating_status?.toLowerCase() === "provisional"
  ).length;

  const overduePlayers = players.filter((player) => {
    const qualified =
      player.rating_status?.toLowerCase() === "qualified";

    return (
      qualified &&
      (player.games_remaining ?? 0) > 0 &&
      isPastDeadline(player.period_deadline)
    );
  }).length;

  const totalGames = players.reduce(
    (sum, player) =>
      sum + (player.games_completed ?? 0),
    0
  );

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
          Monitor official Club Ratings, initial qualification,
          renewal progress, and deadlines.
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

      <section className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">
            Total Players
          </p>
          <p className="mt-2 text-3xl font-bold">
            {players.length}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">
            Qualified Players
          </p>
          <p className="mt-2 text-3xl font-bold text-green-400">
            {qualifiedPlayers}
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

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">
            Overdue Renewals
          </p>
          <p className="mt-2 text-3xl font-bold text-red-400">
            {overduePlayers}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              Player Rating & Renewal Progress
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
            const isQualified =
              player.rating_status?.toLowerCase() === "qualified";

            const completed = Math.max(
              0,
              player.games_completed ?? 0
            );

            const required = isQualified ? 6 : 12;

            const remaining = Math.max(
              0,
              player.games_remaining ??
                (required - completed)
            );

            const percentage = Math.min(
              (completed / required) * 100,
              100
            );

            const overdue =
              isQualified &&
              remaining > 0 &&
              isPastDeadline(player.period_deadline);

            return (
              <div
                key={player.player_id}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">
                      {player.full_name}
                    </h3>

                    <p className="mt-1 text-xs text-zinc-400">
                      {isQualified
                        ? "Official Club Rating"
                        : "Current Club Rating"}
                      :{" "}
                      <span className="font-semibold text-white">
                        {formatRating(player.club_rating)}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={
                        isQualified
                          ? "rounded-full border border-green-800 bg-green-950 px-3 py-1 text-xs font-medium text-green-300"
                          : "rounded-full border border-yellow-800 bg-yellow-950 px-3 py-1 text-xs font-medium text-yellow-300"
                      }
                    >
                      {isQualified ? "Qualified" : "Provisional"}
                    </span>

                    {overdue && (
                      <span className="rounded-full border border-red-800 bg-red-950 px-3 py-1 text-xs font-medium text-red-300">
                        Renewal Overdue
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-zinc-300">
                      {isQualified
                        ? "Renewal Progress"
                        : "Initial Qualification Progress"}
                    </span>

                    <span className="text-zinc-400">
                      {completed} of {required} games ·{" "}
                      {remaining} remaining
                    </span>
                  </div>

                  <div
                    className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-800"
                    role="progressbar"
                    aria-label={`${player.full_name} ${
                      isQualified ? "renewal" : "qualification"
                    } progress`}
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
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  {isQualified && (
                    <p
                      className={`mt-3 text-xs ${
                        overdue
                          ? "font-medium text-red-300"
                          : "text-zinc-400"
                      }`}
                    >
                      Renewal Deadline:{" "}
                      {formatDate(player.period_deadline)}
                    </p>
                  )}
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
          Club Rating Program Rules
        </h3>

        <p className="mt-2 text-sm leading-6 text-zinc-300">
          New players qualify after completing two qualifying
          PB Vision sessions with six rated games each.
          Qualified players maintain their official Club Rating
          and complete renewal sessions during each three-month
          rating period. Renewal progress and deadlines are
          tracked separately from initial qualification.
        </p>
      </div>
    </div>
  );
}
