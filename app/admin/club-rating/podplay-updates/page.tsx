
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Player = {
  player_id: string;
  full_name: string;
  club_rating: number | null;
};

type PodPlayTask = {
  id: string;
  club_rating_player_id: string;
  action_type: string;
  status: string;
  rating: number | null;
  created_at: string;
  completed_at: string | null;
  staff_notes: string | null;
};

export default function PodPlayRatingUpdatesPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [tasks, setTasks] = useState<PodPlayTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    const [playersResponse, tasksResponse] = await Promise.all([
      fetch("/api/club-rating/players", {
        cache: "no-store",
      }),
      fetch("/api/club-rating/podplay-tasks", {
        cache: "no-store",
      }),
    ]);

    if (!playersResponse.ok || !tasksResponse.ok) {
      throw new Error("Unable to load PodPlay rating updates.");
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
          err instanceof Error
            ? err.message
            : "Unable to load rating updates."
        );
      })
      .finally(() => setLoading(false));
  }, [loadData]);

  const playerNames = useMemo(() => {
    return new Map(
      players.map((player) => [
        player.player_id,
        player.full_name,
      ])
    );
  }, [players]);

  const pendingUpdates = useMemo(() => {
    return tasks
      .filter(
        (task) =>
          task.action_type === "rating_update" &&
          task.status === "pending"
      )
      .filter((task) => {
        const name =
          playerNames.get(task.club_rating_player_id) ??
          "Unknown Player";

        return name
          .toLowerCase()
          .includes(search.toLowerCase());
      })
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
      );
  }, [tasks, playerNames, search]);

  const totalPending = tasks.filter(
    (task) =>
      task.action_type === "rating_update" &&
      task.status === "pending"
  ).length;

  async function confirmUpdate(task: PodPlayTask) {
    const name =
      playerNames.get(task.club_rating_player_id) ??
      "this player";

    if (
      !window.confirm(
        `Confirm that you have updated ${name}'s rating to ${
          task.rating == null
            ? "the required rating"
            : Number(task.rating).toFixed(3)
        } in PodPlay?`
      )
    ) {
      return;
    }

    setBusyTask(task.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/club-rating/podplay-tasks",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            task_id: task.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Unable to confirm rating update."
        );
      }

      await loadData();

      setMessage(
        `${name}'s PodPlay rating update was confirmed.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to confirm rating update."
      );
    } finally {
      setBusyTask(null);
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
            PodPlay Rating Updates
          </h1>

          <p className="mt-2 text-zinc-400">
            Update official Club Ratings manually in PodPlay,
            then confirm each completed update here.
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-blue-900 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
              Pending Rating Updates
            </p>
            <p className="mt-2 text-3xl font-bold text-blue-400">
              {loading ? "—" : totalPending}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
              Players Displayed
            </p>
            <p className="mt-2 text-3xl font-bold">
              {loading ? "—" : pendingUpdates.length}
            </p>
          </div>
        </div>

        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search players..."
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-blue-500"
        />

        <button
          type="button"
          onClick={() => {
            setError(null);
            setLoading(true);
            void loadData()
              .catch((err) =>
                setError(
                  err instanceof Error
                    ? err.message
                    : "Unable to refresh."
                )
              )
              .finally(() => setLoading(false));
          }}
          disabled={loading || busyTask !== null}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50"
        >
          Refresh Updates
        </button>

        {loading ? (
          <p className="text-zinc-400">
            Loading PodPlay rating updates...
          </p>
        ) : pendingUpdates.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
            {search
              ? "No pending updates match your search."
              : "No pending PodPlay rating updates."}
          </div>
        ) : (
          <div className="space-y-3">
            {pendingUpdates.map((task) => {
              const name =
                playerNames.get(task.club_rating_player_id) ??
                "Unknown Player";

              const busy = busyTask === task.id;

              return (
                <div
                  key={task.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {name}
                      </h2>

                      <p className="mt-2 text-sm text-zinc-400">
                        Rating to enter in PodPlay
                      </p>

                      <p className="text-2xl font-bold text-blue-400">
                        {task.rating == null
                          ? "Not Available"
                          : Number(task.rating).toFixed(3)}
                      </p>

                      <p className="mt-2 text-xs text-zinc-500">
                        Created:{" "}
                        {new Date(
                          task.created_at
                        ).toLocaleString()}
                      </p>

                      {task.staff_notes && (
                        <p className="mt-2 text-xs text-zinc-400">
                          {task.staff_notes}
                        </p>
                      )}
                    </div>

                    <div>
                      <button
                        type="button"
                        disabled={
                          busyTask !== null ||
                          task.rating == null
                        }
                        onClick={() => confirmUpdate(task)}
                        className="rounded-lg bg-green-700 px-4 py-3 text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
                      >
                        {busy
                          ? "Saving..."
                          : "Confirm Updated in PodPlay"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-zinc-500">
          Staff must update the rating in PodPlay before
          confirming. Confirmation records completion in
          Supabase but does not change the official Club Rating.
        </p>
      </div>
    </main>
  );
}
