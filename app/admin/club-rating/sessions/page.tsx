
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";

type RatingSession = {
  id: string;
  session_date: string;
  session_name: string | null;
  status: string;
  created_at: string;
};

type SessionsResponse = {
  sessions?: RatingSession[];
  session?: RatingSession;
  error?: string;
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export default function ClubRatingSessionsPage() {
  const [sessions, setSessions] = useState<RatingSession[]>([]);
  const [sessionName, setSessionName] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch(
        "/api/club-rating/sessions",
        {
          cache: "no-store",
        }
      );

      const result =
        (await response.json()) as SessionsResponse;

      if (!response.ok) {
        throw new Error(
          result.error ?? "Unable to load rating sessions."
        );
      }

      setSessions(result.sessions ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load rating sessions."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function createSession(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await fetch(
        "/api/club-rating/sessions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionName,
            sessionDate,
          }),
        }
      );

      const result =
        (await response.json()) as SessionsResponse;

      if (!response.ok) {
        throw new Error(
          result.error ?? "Unable to create rating session."
        );
      }

      setSuccessMessage(
        `Rating session "${sessionName}" created successfully.`
      );

      setSessionName("");
      setSessionDate("");

      await loadSessions();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create rating session."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout
      title="Club Rating Sessions"
      description="Create rating sessions and prepare PodPlay roster imports."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/admin/club-rating"
          className="inline-flex rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Back to Club Rating
        </Link>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300"
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-green-300"
          >
            {successMessage}
          </div>
        )}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-bold text-white">
            Create Rating Session
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Create a session before importing the PodPlay
            registration roster.
          </p>

          <form
            onSubmit={(event) => void createSession(event)}
            className="mt-5 grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end"
          >
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-300">
                Session Name
              </span>

              <input
                type="text"
                required
                maxLength={150}
                value={sessionName}
                onChange={(event) =>
                  setSessionName(event.target.value)
                }
                placeholder="November Club Rating"
                className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-white outline-none focus:border-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-300">
                Session Date
              </span>

              <input
                type="date"
                required
                value={sessionDate}
                onChange={(event) =>
                  setSessionDate(event.target.value)
                }
                className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-white outline-none focus:border-blue-500"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="min-h-12 rounded-xl bg-blue-600 px-6 font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Session"}
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 p-5">
            <h2 className="text-xl font-bold text-white">
              Rating Sessions
            </h2>

            <button
              type="button"
              onClick={() => void loadSessions()}
              disabled={loading}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-zinc-400">
              Loading sessions...
            </p>
          ) : sessions.length === 0 ? (
            <p className="p-6 text-sm text-zinc-400">
              No rating sessions yet. Create your first
              session above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead className="bg-zinc-950 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-5 py-3">Session</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Next Step</th>
                  </tr>
                </thead>

                <tbody>
                  {sessions.map((session) => {
                   const sessionActionLabel =
  session.status === "scheduled"
    ? "Import Roster"
    : session.status === "in_progress"
      ? "Manage Session"
      : "View Session";
                    return (
                      <tr
                        key={session.id}
                        className="border-t border-zinc-800"
                      >
                        <td className="px-5 py-4 font-semibold text-white">
                          {session.session_name ??
                            "Unnamed Session"}
                        </td>

                        <td className="px-5 py-4 text-zinc-300">
                          {formatDate(session.session_date)}
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold capitalize text-blue-300">
                            {session.status.replace(
                              /_/g,
                              " "
                            )}
                          </span>
                        </td>

                       <td className="px-5 py-4">
  <Link
    href={`/admin/club-rating/sessions/${session.id}`}
    className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500"
  >
    {sessionActionLabel}
  </Link>
</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
