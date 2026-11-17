"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";

type Attendance =
  | "registered"
  | "attended"
  | "absent"
  | "cancelled";

type Player = {
  name: string;
  email: string;
  dupr: number | null;
  attendance: Attendance;
  selected: boolean;
  podplayStatus: string;
};

type Session = {
  id: string;
  session_name: string | null;
  session_date: string;
  status: string;
};

type ImportResult = {
  created: number;
  existing: number;
  added: number;
  skipped: number;
};

const REQUIRED_COLUMNS = [
  "Full Name",
  "Email",
  "Invitation Status",
  "DUPR Doubles",
];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if (
      (char === "\n" || char === "\r") &&
      !quoted
    ) {
      if (char === "\r" && input[i + 1] === "\n") {
        i++;
      }

      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }

      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (quoted) {
    throw new Error("CSV contains an unclosed quoted field.");
  }

  row.push(value);

  if (row.some((cell) => cell.trim() !== "")) {
    rows.push(row);
  }

  return rows;
}

function mapAttendance(status: string): Attendance {
  switch (status.trim().toUpperCase()) {
    case "CHECKED_IN":
      return "attended";
    case "CANCELLED":
    case "CANCELED":
      return "cancelled";
    case "NO_SHOW":
      return "absent";
    default:
      return "registered";
  }
}

function readPodPlayCSV(text: string): Player[] {
  const rows = parseCSV(text);

  if (rows.length < 2) {
    throw new Error("CSV contains no player records.");
  }

  const headers = rows[0].map((header) =>
    header.trim().toLowerCase()
  );

  for (const column of REQUIRED_COLUMNS) {
    if (!headers.includes(column.toLowerCase())) {
      throw new Error(
        `Missing required PodPlay column: ${column}`
      );
    }
  }

  const column = (name: string) =>
    headers.indexOf(name.toLowerCase());

  const players: Player[] = [];
  const seen = new Set<string>();

  for (const [index, row] of rows.slice(1).entries()) {
    const name = (row[column("Full Name")] ?? "").trim();
    const email = (row[column("Email")] ?? "")
      .trim()
      .toLowerCase();
    const status = (
      row[column("Invitation Status")] ?? ""
    ).trim();

    const rawDupr = (
      row[column("DUPR Doubles")] ?? ""
    ).trim();

    if (!name || !email) {
      throw new Error(
        `Row ${index + 2}: name and email are required.`
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(
        `Row ${index + 2}: invalid email address.`
      );
    }

    if (seen.has(email)) {
      throw new Error(
        `Duplicate email in CSV: ${email}`
      );
    }

    seen.add(email);

    let dupr: number | null = null;

    if (
      rawDupr &&
      rawDupr.toLowerCase() !== "not rated"
    ) {
      dupr = Number(rawDupr);

      if (
        !Number.isFinite(dupr) ||
        dupr < 0 ||
        dupr > 8
      ) {
        throw new Error(
          `Row ${index + 2}: invalid DUPR Doubles value.`
        );
      }
    }

    const attendance = mapAttendance(status);

    players.push({
      name,
      email,
      dupr,
      attendance,
      selected: attendance === "attended",
      podplayStatus: status,
    });
  }

  if (players.length > 500) {
    throw new Error(
      "A maximum of 500 players can be imported."
    );
  }

  return players;
}

export default function ClubRatingRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [session, setSession] = useState<Session | null>(
    null
  );
  const [players, setPlayers] = useState<Player[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [result, setResult] =
    useState<ImportResult | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch(
          "/api/club-rating/sessions",
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ?? "Unable to load session."
          );
        }

        const found = (data.sessions as Session[]).find(
          (item) => item.id === id
        );

        if (!found) {
          throw new Error(
            "Session not found in the available session list."
          );
        }

        if (active) setSession(found);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load session."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, [id]);

  async function handleFile(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setSuccess("");
    setResult(null);
    setPlayers([]);
    setFileName("");

    try {
      if (file.size > 2 * 1024 * 1024) {
        throw new Error(
          "CSV file must be smaller than 2 MB."
        );
      }

      const text = await file.text();
      const parsed = readPodPlayCSV(text);

      setPlayers(parsed);
      setFileName(file.name);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to read CSV."
      );
    }

    event.target.value = "";
  }

  function updatePlayer(
    index: number,
    changes: Partial<Player>
  ) {
    setPlayers((current) =>
      current.map((player, i) =>
        i === index ? { ...player, ...changes } : player
      )
    );
  }

  const selectedCount = players.filter(
    (player) => player.selected
  ).length;

  const attendedCount = players.filter(
    (player) =>
      player.selected &&
      player.attendance === "attended"
  ).length;

  async function importRoster() {
    if (!session || importing || selectedCount === 0) {
      return;
    }

    setError("");
    setSuccess("");
    setResult(null);
    setImporting(true);

    try {
      const selected = players
        .filter((player) => player.selected)
        .map((player) => ({
          name: player.name,
          email: player.email,
          dupr: player.dupr,
          attendance: player.attendance,
        }));

      const response = await fetch(
        "/api/club-rating/roster/import",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: session.id,
            players: selected,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Roster import failed."
        );
      }

      setResult(data.result as ImportResult);
      setSuccess("Roster import completed successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to import roster."
      );
    } finally {
      setImporting(false);
    }
  }

  async function completeSession() {
    if (!session || completing || importing) return;

    const confirmed = window.confirm(
      "Complete this Club Rating session? " +
      "Scores will be finalized and new score entry will be disabled. " +
      "Official rating publication is not enabled yet."
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setCompleting(true);

    try {
      const response = await fetch(
        `/api/club-rating/sessions/${session.id}/complete`,
        { method: "POST" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to complete session.");
      }
      setSession((current) =>
        current ? { ...current, status: "completed" } : current
      );
      setSuccess(
        data.message ?? "Session completed successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to complete session."
      );
    } finally {
      setCompleting(false);
    }
  }

  return (
    <AppLayout
      title="PodPlay Roster Import"
      description="Review registration information and assign players to a Club Rating session."
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <Link
          href="/admin/club-rating/sessions"
          className="inline-flex rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Back to Rating Sessions
        </Link>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-green-300"
          >
            {success}
          </div>
        )}

        {loading ? (
          <p className="text-zinc-400">
            Loading session...
          </p>
        ) : session ? (
          <>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                Selected Rating Session
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                {session.session_name ?? "Rating Session"}
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                {session.session_date} ·{" "}
                {session.status.replace(/_/g, " ")}
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-bold">Session Completion</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Enter and review all PB Vision scores before completing
                this session. Completion prevents further score entry.
                Official Club Ratings will not be published yet.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href={`/admin/club-rating/sessions/${id}/videos`}
                  className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
                >
                  PB Vision Score Entry
                </Link>
                <button
                  type="button"
                  onClick={() => void completeSession()}
                  disabled={
                    completing ||
                    importing ||
                    !["scheduled", "in_progress"].includes(session.status)
                  }
                  className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {completing ? "Completing..." : "Complete Session"}
                </button>
              </div>
              {session.status === "completed" && (
                <p className="mt-3 text-sm text-green-300">
                  This session is completed.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-bold">
                Upload PodPlay CSV
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                Select a PodPlay registration export.
                Checked-in players will be selected
                automatically.
              </p>

              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) =>
                  void handleFile(event)
                }
                disabled={
                  importing ||
                  !["scheduled", "in_progress"].includes(
                    session.status
                  )
                }
                className="mt-5 block w-full rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white"
              />

              {fileName && (
                <p className="mt-3 text-sm text-zinc-400">
                  Loaded: {fileName}
                </p>
              )}
            </section>

            {players.length > 0 && (
              <>
                <section className="grid gap-4 sm:grid-cols-3">
                  {[
                    ["CSV Players", players.length],
                    ["Selected", selectedCount],
                    ["Attended", attendedCount],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
                    >
                      <p className="text-sm text-zinc-400">
                        {label}
                      </p>

                      <p className="mt-2 text-3xl font-black text-yellow-400">
                        {value}
                      </p>
                    </div>
                  ))}
                </section>

                <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <h2 className="text-xl font-bold">
                      Review Players
                    </h2>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={importing}
                        onClick={() =>
                          setPlayers((current) =>
                            current.map((player) => ({
                              ...player,
                              selected: true,
                            }))
                          )
                        }
                        className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800"
                      >
                        Select All
                      </button>

                      <button
                        type="button"
                        disabled={importing}
                        onClick={() =>
                          setPlayers((current) =>
                            current.map((player) => ({
                              ...player,
                              selected: false,
                            }))
                          )
                        }
                        className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="bg-zinc-950 text-xs uppercase text-zinc-500">
                        <tr>
                          <th className="px-4 py-3">
                            Import
                          </th>
                          <th className="px-4 py-3">
                            Player
                          </th>
                          <th className="px-4 py-3">
                            Email
                          </th>
                          <th className="px-4 py-3">
                            DUPR
                          </th>
                          <th className="px-4 py-3">
                            PodPlay Status
                          </th>
                          <th className="px-4 py-3">
                            Attendance
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {players.map((player, index) => (
                          <tr
                            key={player.email}
                            className="border-t border-zinc-800"
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={player.selected}
                                disabled={importing}
                                onChange={(event) =>
                                  updatePlayer(index, {
                                    selected:
                                      event.target.checked,
                                  })
                                }
                                className="h-4 w-4 accent-blue-500"
                                aria-label={`Select ${player.name}`}
                              />
                            </td>

                            <td className="px-4 py-3 font-semibold text-white">
                              {player.name}
                            </td>

                            <td className="px-4 py-3 text-zinc-400">
                              {player.email}
                            </td>

                            <td className="px-4 py-3 text-zinc-300">
                              {player.dupr?.toFixed(2) ??
                                "Unrated"}
                            </td>

                            <td className="px-4 py-3 text-zinc-400">
                              {player.podplayStatus}
                            </td>

                            <td className="px-4 py-3">
                              <select
                                value={player.attendance}
                                disabled={importing}
                                onChange={(event) =>
                                  updatePlayer(index, {
                                    attendance:
                                      event.target.value as Attendance,
                                  })
                                }
                                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                              >
                                <option value="registered">
                                  Registered
                                </option>
                                <option value="attended">
                                  Attended
                                </option>
                                <option value="absent">
                                  Absent
                                </option>
                                <option value="cancelled">
                                  Cancelled
                                </option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-zinc-800 p-5">
                    <p className="mb-4 text-sm text-zinc-400">
                      Only selected players will be
                      imported. Review attendance
                      before saving.
                    </p>

                    <button
                      type="button"
                      disabled={
                        importing ||
                        selectedCount === 0 ||
                        !["scheduled", "in_progress"].includes(
                          session.status
                        )
                      }
                      onClick={() => void importRoster()}
                      className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {importing
                        ? "Importing..."
                        : `Import ${selectedCount} Players`}
                    </button>
                  </div>
                </section>
              </>
            )}

            {result && (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="text-xl font-bold">
                  Import Results
                </h2>

                <div className="mt-4 grid gap-4 sm:grid-cols-4">
                  {[
                    ["New Players", result.created],
                    ["Existing Players", result.existing],
                    ["Added to Session", result.added],
                    ["Already Assigned", result.skipped],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-sm text-zinc-400">
                        {label}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-yellow-400">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <p className="text-zinc-400">
            Rating session unavailable.
          </p>
        )}
      </div>
    </AppLayout>
  );
}
