
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

function getTaskState(tasks: PodPlayTask[]) {
  const completedRemovals = tasks
    .filter(
      (task) =>
        task.action_type === "rating_removal" &&
        task.status === "completed"
    )
    .sort((a, b) =>
      (b.completed_at ?? "").localeCompare(a.completed_at ?? "")
    );

  const completedRestorations = tasks
    .filter(
      (task) =>
        task.action_type === "rating_restoration" &&
        task.status === "completed"
    )
    .sort((a, b) =>
      (b.completed_at ?? "").localeCompare(a.completed_at ?? "")
    );

  const lastRemoval = completedRemovals[0];
  const lastRestoration = completedRestorations[0];

  const removed =
    !!lastRemoval &&
    (!lastRestoration ||
      (lastRemoval.completed_at ?? "") >
        (lastRestoration.completed_at ?? ""));

  const restorationPending = tasks.find(
    (task) =>
      task.action_type === "rating_restoration" &&
      task.status === "pending"
  );

  return { removed, restorationPending };
}

export default function ClubRatingRestorationsPage() {
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
      throw new Error("Unable to load restoration records.");
    }

    const playersResult = await playersResponse.json();
    const tasksResult = await tasksResponse.json();

    setPlayers(playersResult.players ?? []);
    setTasks(tasksResult.tasks ?? []);
  }, []);

  useEffect(() => {
    void loadData()
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Unable to load data."
        );
      })
      .finally(() => setLoading(false));
  }, [loadData]);

  const restorationPlayers = useMemo(() => {
    return players
      .filter((player) => {
        const playerTasks = tasks.filter(
          (task) =>
            task.club_rating_player_id === player.player_id
        );

        const state = getTaskState(playerTasks);

        return (
          state.removed &&
          player.rating_status?.toLowerCase() === "qualified" &&
          player.club_rating != null &&
          !isOverdue(player)
        );
      })
      .filter((player) =>
        player.full_name.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      );
  }, [players, tasks, search]);

  async function performAction(
    playerId: string,
    action: "request" | "confirm",
    taskId?: string
  ) {
    if (
      action === "confirm" &&
      !window.confirm(
        "Confirm that this player's official Club Rating has been restored in PodPlay?"
      )
    ) {
      return;
    }

    setBusyPlayer(playerId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/club-rating/podplay-tasks", {
        method: action === "confirm" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "confirm"
            ? { task_id: taskId }
            : {
                player_id: playerId,
                action_type: "rating_restoration",
              }
        ),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Unable to save restoration action."
        );
      }

      await loadData();

      setMessage(
        action === "confirm"
          ? "PodPlay restoration confirmed and recorded."
          : "PodPlay restoration task created."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save action."
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
            PodPlay Restorations
          </h1>

          <p className="mt-2 text-zinc-400">
            Restore PodPlay ratings for players who have completed
            their renewal after a confirmed removal.
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

        <div className="rounded-2xl border border-blue-900 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">
            Players Ready for Restoration
          </p>
          <p className="mt-2 text-3xl font-bold text-blue-400">
            {loading ? "—" : restorationPlayers.length}
          </p>
        </div>

        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search players..."
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-blue-500"
        />

        {loading ? (
          <p className="text-zinc-400">Loading restorations...</p>
        ) : restorationPlayers.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
            No players currently require restoration.
          </div>
        ) : (
          <div className="space-y-3">
            {restorationPlayers.map((player) => {
              const playerTasks = tasks.filter(
                (task) =>
                  task.club_rating_player_id === player.player_id
              );

              const state = getTaskState(playerTasks);
              const busy = busyPlayer === player.player_id;

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
                          {Number(player.club_rating).toFixed(3)}
                        </span>
                      </p>

                      <p className="mt-1 text-sm text-zinc-400">
                        Renewal Deadline:{" "}
                        {player.period_deadline?.slice(0, 10) ??
                          "Not Set"}
                      </p>
                    </div>

                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <span className="rounded-full bg-blue-950 px-3 py-1 text-xs text-blue-300">
                        Ready for Restoration
                      </span>

                      {state.restorationPending ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            performAction(
                              player.player_id,
                              "confirm",
                              state.restorationPending?.id
                            )
                          }
                          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
                        >
                          {busy
                            ? "Saving..."
                            : "Confirm PodPlay Restoration"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            performAction(player.player_id, "request")
                          }
                          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold hover:bg-blue-600 disabled:opacity-50"
                        >
                          {busy
                            ? "Saving..."
                            : "Request Restoration"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-zinc-500">
          Restoration is manual. Staff must update PodPlay before
          confirming completion. The player's official rating
          remains stored in Supabase throughout the process.
        </p>
      </div>
    </main>
  );
}
