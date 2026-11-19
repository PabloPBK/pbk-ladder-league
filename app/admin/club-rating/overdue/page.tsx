
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Player = {
  player_id: string;
  full_name: string;
  club_rating: number | null;
  rating_status: string | null;
  games_remaining: number | null;
  period_deadline: string | null;
};

type PodPlayTask = {
  id: string;
  club_rating_player_id: string;
  action_type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
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
  const start = Date.parse(`${deadline.slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${todayLocal()}T00:00:00Z`);

  return Math.max(0, Math.round((today - start) / 86400000));
}

function requalificationDate(deadline: string): string {
  const [year, month, day] = deadline
    .slice(0, 10)
    .split("-")
    .map(Number);

  const targetMonth = month - 1 + 3;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  const lastDay = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0)
  ).getUTCDate();

  const targetDay = Math.min(day, lastDay);

  return [
    targetYear,
    String(normalizedMonth + 1).padStart(2, "0"),
    String(targetDay).padStart(2, "0"),
  ].join("-");
}

function isRequalificationEligible(player: Player): boolean {
  return (
    isOverdue(player) &&
    !!player.period_deadline &&
    todayLocal() >= requalificationDate(player.period_deadline)
  );
}

function getTaskState(tasks: PodPlayTask[]) {
  const completed = tasks
    .filter((task) => task.status === "completed")
    .sort((a, b) =>
      (b.completed_at ?? "").localeCompare(a.completed_at ?? "")
    );

  const removalPending = tasks.find(
    (task) =>
      task.action_type === "rating_removal" &&
      task.status === "pending"
  );

  const restorationPending = tasks.find(
    (task) =>
      task.action_type === "rating_restoration" &&
      task.status === "pending"
  );

  const removed = completed[0]?.action_type === "rating_removal";

  return {
    removalPending,
    restorationPending,
    removed,
  };
}

export default function ClubRatingOverduePage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [tasks, setTasks] = useState<PodPlayTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPlayer, setBusyPlayer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    const [playersResponse, tasksResponse] = await Promise.all([
      fetch("/api/club-rating/players", { cache: "no-store" }),
      fetch("/api/club-rating/podplay-tasks", { cache: "no-store" }),
    ]);

    if (!playersResponse.ok || !tasksResponse.ok) {
      throw new Error(
        "Unable to load overdue players or PodPlay tasks."
      );
    }

    const playersResult = await playersResponse.json();
    const tasksResult = await tasksResponse.json();

    setPlayers(playersResult.players ?? []);
    setTasks(tasksResult.tasks ?? []);
  }, []);

  useEffect(() => {
    let active = true;

    async function initialLoad() {
      try {
        await loadData();
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Unable to load data."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialLoad();

    return () => {
      active = false;
    };
  }, [loadData]);

  const overduePlayers = useMemo(
    () => players.filter(isOverdue),
    [players]
  );

  const visiblePlayers = useMemo(() => {
    return overduePlayers
      .filter((player) =>
        player.full_name
          .toLowerCase()
          .includes(search.toLowerCase())
      )
      .sort((a, b) =>
        (a.period_deadline ?? "").localeCompare(
          b.period_deadline ?? ""
        )
      );
  }, [overduePlayers, search]);

  const eligiblePlayers = overduePlayers.filter(
    isRequalificationEligible
  );

  const removedCount = overduePlayers.filter((player) => {
    const playerTasks = tasks.filter(
      (task) => task.club_rating_player_id === player.player_id
    );

    return getTaskState(playerTasks).removed;
  }).length;

  async function performAction(
    playerId: string,
    action: "rating_removal" | "confirm_removal",
    taskId?: string
  ) {
    if (action === "confirm_removal") {
      const confirmed = window.confirm(
        "Confirm that you have manually removed this player's rating from PodPlay?"
      );

      if (!confirmed) return;
    }

    setBusyPlayer(playerId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/club-rating/podplay-tasks",
        {
          method:
            action === "confirm_removal" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "confirm_removal"
              ? { task_id: taskId }
              : {
                  player_id: playerId,
                  action_type: "rating_removal",
                }
          ),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Unable to save PodPlay action."
        );
      }

      await loadData();

      setMessage(
        action === "confirm_removal"
          ? "PodPlay removal confirmed and recorded."
          : "PodPlay removal task created."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save action."
      );
    } finally {
      setBusyPlayer(null);
    }
  }

  async function startRequalification(player: Player) {
    if (!isRequalificationEligible(player)) return;

    const confirmed = window.confirm(
      `Require 12-game requalification for ${player.full_name}?\n\n` +
        "This will:\n" +
        "• Change their status to Requalification Required.\n" +
        "• Require two NEW qualifying sessions with six PB Vision games each.\n" +
        "• Preserve their previous Club Rating and history.\n" +
        "• Remove them from the Overdue Renewals list.\n\n" +
        "Their PodPlay rating must already be removed.\n\n" +
        "This action cannot be undone from this page.\n\n" +
        "Continue?"
    );

    if (!confirmed) return;

    setBusyPlayer(player.player_id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/club-rating/requalification",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player_id: player.player_id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Unable to start requalification."
        );
      }

      await loadData();

      setMessage(
        `${player.full_name} now requires 12 new PB Vision games ` +
          "across two qualifying sessions. Previous rating preserved."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start requalification."
      );
    } finally {
      setBusyPlayer(null);
    }
  }

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
            Manage PodPlay rating removals and manual
            requalification for players who missed their
            renewal deadlines.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-green-800 bg-green-950/40 p-4 text-green-300">
            {message}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-red-900 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
              Total Overdue
            </p>
            <p className="mt-2 text-3xl font-bold text-red-400">
              {loading ? "—" : overduePlayers.length}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
              Removed from PodPlay
            </p>
            <p className="mt-2 text-3xl font-bold text-blue-400">
              {loading ? "—" : removedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
              Requalification Eligible
            </p>
            <p className="mt-2 text-3xl font-bold text-yellow-400">
              {loading ? "—" : eligiblePlayers.length}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Three months beyond renewal deadline
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
          <p className="text-zinc-400">
            Loading overdue players...
          </p>
        ) : visiblePlayers.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
            No overdue players found.
          </div>
        ) : (
          <div className="space-y-3">
            {visiblePlayers.map((player) => {
              const playerTasks = tasks.filter(
                (task) =>
                  task.club_rating_player_id === player.player_id
              );

              const state = getTaskState(playerTasks);
              const overdueDays = daysOverdue(
                player.period_deadline!
              );
              const eligible = isRequalificationEligible(player);
              const busy = busyPlayer === player.player_id;

              return (
                <div
                  key={player.player_id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {player.full_name}
                      </h2>

                      <p className="mt-1 text-sm text-zinc-400">
                        Official Rating:{" "}
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

                      {eligible && (
                        <span className="rounded-full bg-yellow-950 px-3 py-1 text-xs text-yellow-300">
                          Requalification review eligible
                        </span>
                      )}

                      {state.removed ? (
                        <span className="rounded-full bg-blue-950 px-3 py-1 text-xs text-blue-300">
                          Removed from PodPlay
                        </span>
                      ) : state.removalPending ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            performAction(
                              player.player_id,
                              "confirm_removal",
                              state.removalPending?.id
                            )
                          }
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                        >
                          {busy
                            ? "Saving..."
                            : "Confirm PodPlay Removal"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            performAction(
                              player.player_id,
                              "rating_removal"
                            )
                          }
                          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
                        >
                          {busy
                            ? "Saving..."
                            : "Request PodPlay Removal"}
                        </button>
                      )}

                      {eligible && state.removed && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            startRequalification(player)
                          }
                          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                        >
                          {busy
                            ? "Processing..."
                            : "Require 12-Game Requalification"}
                        </button>
                      )}

                      {eligible && !state.removed && (
                        <p className="max-w-xs text-right text-xs text-zinc-500">
                          Confirm PodPlay removal before
                          starting requalification.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-zinc-500">
          PodPlay changes are manual. Confirm removal only
          after completing the change in PodPlay. Requalification
          requires two new qualifying sessions of six PB Vision
          games each. Previous ratings and historical records
          are preserved.
        </p>
      </div>
    </main>
  );
}
