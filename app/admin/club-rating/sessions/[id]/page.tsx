
"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";

type Attendance =
  | "registered"
  | "attended"
  | "absent"
  | "cancelled";

type Override =
  | "optional_improvement"
  | "mandatory_renewal"
  | null;

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

type ClubRatingPlayer = {
  id: string;
  full_name: string;
  email: string | null;
  club_rating: number | null;
  period_deadline: string | null;
};

type RosterPlayer = {
  id: string;
  club_rating_player_id: string;
  attendance_status: Attendance;
  rating_session_override: Override;
  rating_override_reason: string | null;
  rating_override_by: string | null;
  rating_override_at: string | null;
  club_rating_players:
    | ClubRatingPlayer
    | ClubRatingPlayer[]
    | null;
  classification: string | null;
  classification_error: string | null;
};

type OverrideDraft = {
  override: Override;
  reason: string;
};

const REQUIRED_COLUMNS = [
  "Full Name",
  "Email",
  "Invitation Status",
  "DUPR Doubles",
];

const EDITABLE_STATUSES = ["scheduled", "in_progress"];

function isEditable(status: string) {
  return EDITABLE_STATUSES.includes(status);
}

function getPlayer(
  entry: RosterPlayer
): ClubRatingPlayer | null {
  const value = entry.club_rating_players;

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function formatClassification(value: string | null) {
  switch (value) {
    case "initial_qualification":
      return "Initial Qualification";
    case "optional_improvement":
      return "Optional Improvement";
    case "mandatory_renewal":
      return "Mandatory Renewal";
    case null:
      return "Unavailable";
    default:
      return value.replace(/_/g, " ");
  }
}

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
    throw new Error(
      "CSV contains an unclosed quoted field."
    );
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
    const name = (
      row[column("Full Name")] ?? ""
    ).trim();

    const email = (
      row[column("Email")] ?? ""
    )
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

  const [session, setSession] =
    useState<Session | null>(null);

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [roster, setRoster] =
    useState<RosterPlayer[]>([]);

  const [drafts, setDrafts] = useState<
    Record<string, OverrideDraft>
  >({});

  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] =
    useState(true);

  const [importing, setImporting] = useState(false);
  const [completing, setCompleting] =
    useState(false);

  const [savingPlayer, setSavingPlayer] =
    useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [rosterError, setRosterError] =
    useState("");

  const [result, setResult] =
    useState<ImportResult | null>(null);

  const editable =
    session !== null && isEditable(session.status);

  const loadRoster = useCallback(async () => {
    setRosterLoading(true);
    setRosterError("");

    try {
      const response = await fetch(
        `/api/club-rating/sessions/${id}/players`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to load session players."
        );
      }

      const entries =
        (data.players ?? []) as RosterPlayer[];

      setRoster(entries);

      const nextDrafts: Record<
        string,
        OverrideDraft
      > = {};

      for (const entry of entries) {
        nextDrafts[entry.club_rating_player_id] = {
          override: entry.rating_session_override,
          reason: entry.rating_override_reason ?? "",
        };
      }

      setDrafts(nextDrafts);
    } catch (err) {
      setRosterError(
        err instanceof Error
          ? err.message
          : "Unable to load session players."
      );
    } finally {
      setRosterLoading(false);
    }
  }, [id]);

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

        const found = (
          data.sessions as Session[]
        ).find((item) => item.id === id);

        if (!found) {
          throw new Error(
            "Session not found in the available session list."
          );
        }

        if (active) {
          setSession(found);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load session."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSession();
    void loadRoster();

    return () => {
      active = false;
    };
  }, [id, loadRoster]);

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
        i === index
          ? { ...player, ...changes }
          : player
      )
    );
  }

  function updateDraft(
    playerId: string,
    changes: Partial<OverrideDraft>
  ) {
    setDrafts((current) => ({
      ...current,
      [playerId]: {
        override:
          current[playerId]?.override ?? null,
        reason: current[playerId]?.reason ?? "",
        ...changes,
      },
    }));
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
    if (
      !session ||
      importing ||
      selectedCount === 0 ||
      !editable
    ) {
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
      setSuccess(
        "Roster import completed successfully."
      );

      await loadRoster();
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

  async function saveOverride(entry: RosterPlayer) {
    if (!editable || savingPlayer) return;

    const playerId = entry.club_rating_player_id;

    const draft = drafts[playerId] ?? {
      override: null,
      reason: "",
    };

    if (
      draft.override !== null &&
      (draft.reason.trim().length < 10 ||
        draft.reason.trim().length > 500)
    ) {
      setError(
        "Override reasons must contain 10 to 500 characters."
      );
      return;
    }

    setError("");
    setSuccess("");
    setSavingPlayer(playerId);

    try {
      const response = await fetch(
        `/api/club-rating/sessions/${id}/players`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            playerId,
            override: draft.override,
            reason:
              draft.override === null
                ? null
                : draft.reason.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to save override."
        );
      }

      await loadRoster();

      setSuccess(
        draft.override === null
          ? "Override removed. Automatic classification restored."
          : "Staff override saved successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save override."
      );
    } finally {
      setSavingPlayer(null);
    }
  }

  async function completeSession() {
    if (
      !session ||
      completing ||
      importing ||
      savingPlayer ||
      !editable
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Complete this Club Rating session? " +
        "PB Vision scores will be finalized, " +
        "rating classifications will be applied, " +
        "and qualifying official Club Ratings may be updated. " +
        "Further score entry and staff overrides will be disabled."
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
        throw new Error(
          data.error ?? "Unable to complete session."
        );
      }

      setSession((current) =>
        current
          ? { ...current, status: "completed" }
          : current
      );

      setSuccess(
        data.message ??
          "Session completed successfully."
      );

      await loadRoster();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete session."
      );
    } finally {
      setCompleting(false);
    }
  }

  return (
    <AppLayout
      title="Club Rating Session"
      description="Manage PodPlay registration, PB Vision scores, and rating classifications."
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
            {/* SESSION INFORMATION */}

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                Selected Rating Session
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                {session.session_name ??
                  "Rating Session"}
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                {session.session_date} ·{" "}
                {session.status.replace(/_/g, " ")}
              </p>
            </section>

            {/* SESSION COMPLETION */}

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-bold">
                Session Completion
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                Review all PB Vision scores and rating
                classifications before completing this
                session. Completion finalizes scores and
                applies qualifying rating updates.
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
                  onClick={() =>
                    void completeSession()
                  }
                  disabled={
                    completing ||
                    importing ||
                    savingPlayer !== null ||
                    !editable
                  }
                  className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {completing
                    ? "Completing..."
                    : "Complete Session"}
                </button>
              </div>

              {session.status === "completed" && (
                <p className="mt-3 text-sm text-green-300">
                  This session is completed and
                  read-only.
                </p>
              )}
            </section>

            {/* STAFF RATING CLASSIFICATIONS */}

            <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-3 p-6">
                <div>
                  <h2 className="text-xl font-bold">
                    Session Players & Rating Classification
                  </h2>

                  <p className="mt-2 text-sm text-zinc-400">
                    Review automatic classifications
                    and manage staff overrides before
                    completing the session.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void loadRoster()
                  }
                  disabled={
                    rosterLoading ||
                    savingPlayer !== null
                  }
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50"
                >
                  Refresh Players
                </button>
              </div>

              {rosterError && (
                <div className="mx-6 mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">
                  {rosterError}
                </div>
              )}

              {rosterLoading ? (
                <p className="px-6 pb-6 text-sm text-zinc-400">
                  Loading registered players...
                </p>
              ) : roster.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-zinc-400">
                  No players have been assigned to
                  this session yet. Import a PodPlay
                  roster below to populate this section.
                </p>
              ) : (
                <div className="space-y-4 px-6 pb-6">
                  <p className="text-sm text-zinc-400">
                    {roster.length} registered session
                    player{roster.length === 1 ? "" : "s"}
                  </p>

                  {roster.map((entry) => {
                    const player = getPlayer(entry);

                    const playerId =
                      entry.club_rating_player_id;

                    const draft = drafts[playerId] ?? {
                      override:
                        entry.rating_session_override,
                      reason:
                        entry.rating_override_reason ??
                        "",
                    };

                    const initialQualification =
                      player?.club_rating == null;

                    const canOverride =
                      editable &&
                      !initialQualification &&
                      !entry.classification_error;

                    const hasChanges =
                      draft.override !==
                        entry.rating_session_override ||
                      (
                        draft.override !== null &&
                        draft.reason.trim() !==
                          (entry.rating_override_reason ??
                            "")
                      );

                    return (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 p-5"
                      >
                        <div className="flex flex-wrap justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-bold text-white">
                              {player?.full_name ??
                                "Unknown Player"}
                            </h3>

                            <p className="mt-1 text-sm text-zinc-400">
                              {player?.email ??
                                "Email unavailable"}
                            </p>

                            <p className="mt-2 text-xs text-zinc-500">
                              Attendance:{" "}
                              {entry.attendance_status}
                            </p>
                          </div>

                          <div className="text-sm">
                            <p className="text-zinc-400">
                              Current Club Rating
                            </p>

                            <p className="text-xl font-bold text-yellow-400">
                              {player?.club_rating != null
                                ? Number(
                                    player.club_rating
                                  ).toFixed(3)
                                : "Not Qualified"}
                            </p>

                            <p className="mt-2 text-zinc-400">
                              Renewal Deadline
                            </p>

                            <p className="font-semibold text-white">
                              {player?.period_deadline ??
                                "Not established"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                            Current Classification
                          </p>

                          <p className="mt-1 font-bold text-blue-300">
                            {formatClassification(
                              entry.classification
                            )}
                          </p>

                          {entry.classification_error && (
                            <p className="mt-2 text-sm text-red-300">
                              {entry.classification_error}
                            </p>
                          )}

                          {entry.rating_session_override && (
                            <p className="mt-2 text-xs text-yellow-300">
                              Manual staff override
                              currently applied
                            </p>
                          )}
                        </div>

                        {initialQualification ? (
                          <p className="mt-4 text-sm text-zinc-400">
                            Initial qualification is
                            determined automatically
                            and cannot be overridden.
                          </p>
                        ) : (
                          <div className="mt-4 space-y-4">
                            <div>
                              <label
                                htmlFor={`override-${playerId}`}
                                className="mb-2 block text-sm font-semibold text-zinc-300"
                              >
                                Staff Classification
                              </label>

                              <select
                                id={`override-${playerId}`}
                                value={
                                  draft.override ?? ""
                                }
                                disabled={
                                  !canOverride ||
                                  savingPlayer !== null
                                }
                                onChange={(event) =>
                                  updateDraft(playerId, {
                                    override:
                                      event.target.value ===
                                      ""
                                        ? null
                                        : (event.target
                                            .value as Override),
                                  })
                                }
                                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white disabled:opacity-50"
                              >
                                <option value="">
                                  Automatic Classification
                                </option>

                                <option value="optional_improvement">
                                  Optional Improvement
                                </option>

                                <option value="mandatory_renewal">
                                  Mandatory Renewal
                                </option>
                              </select>
                            </div>

                            {draft.override !== null && (
                              <div>
                                <label
                                  htmlFor={`reason-${playerId}`}
                                  className="mb-2 block text-sm font-semibold text-zinc-300"
                                >
                                  Override Reason
                                </label>

                                <textarea
                                  id={`reason-${playerId}`}
                                  value={draft.reason}
                                  disabled={
                                    !canOverride ||
                                    savingPlayer !== null
                                  }
                                  maxLength={500}
                                  rows={3}
                                  placeholder="Explain why this classification is being overridden..."
                                  onChange={(event) =>
                                    updateDraft(playerId, {
                                      reason:
                                        event.target.value,
                                    })
                                  }
                                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-white disabled:opacity-50"
                                />

                                <p className="mt-1 text-xs text-zinc-500">
                                  Minimum 10 characters,
                                  maximum 500.
                                </p>
                              </div>
                            )}

                            {entry.rating_override_at && (
                              <div className="text-xs text-zinc-400">
                                <p>
                                  Last override:{" "}
                                  {new Date(
                                    entry.rating_override_at
                                  ).toLocaleString()}
                                </p>

                                <p className="mt-1 break-all">
                                  Staff ID:{" "}
                                  {entry.rating_override_by ??
                                    "Unavailable"}
                                </p>

                                {entry.rating_override_reason && (
                                  <p className="mt-2">
                                    Saved reason:{" "}
                                    {
                                      entry.rating_override_reason
                                    }
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                disabled={
                                  !canOverride ||
                                  !hasChanges ||
                                  savingPlayer !== null ||
                                  completing ||
                                  importing
                                }
                                onClick={() =>
                                  void saveOverride(entry)
                                }
                                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {savingPlayer === playerId
                                  ? "Saving..."
                                  : draft.override === null
                                    ? "Restore Automatic"
                                    : "Save Override"}
                              </button>

                              <button
                                type="button"
                                disabled={
                                  !canOverride ||
                                  savingPlayer !== null
                                }
                                onClick={() =>
                                  updateDraft(playerId, {
                                    override:
                                      entry.rating_session_override,
                                    reason:
                                      entry.rating_override_reason ??
                                      "",
                                  })
                                }
                                className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                              >
                                Discard Changes
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* PODPLAY CSV UPLOAD */}

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
                  importing || !editable
                }
                className="mt-5 block w-full rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white"
              />

              {fileName && (
                <p className="mt-3 text-sm text-zinc-400">
                  Loaded: {fileName}
                </p>
              )}
            </section>

            {/* CSV PREVIEW */}

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
                        disabled={
                          importing || !editable
                        }
                        onClick={() =>
                          setPlayers((current) =>
                            current.map((player) => ({
                              ...player,
                              selected: true,
                            }))
                          )
                        }
                        className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
                      >
                        Select All
                      </button>

                      <button
                        type="button"
                        disabled={
                          importing || !editable
                        }
                        onClick={() =>
                          setPlayers((current) =>
                            current.map((player) => ({
                              ...player,
                              selected: false,
                            }))
                          )
                        }
                        className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
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
                        {players.map(
                          (player, index) => (
                            <tr
                              key={player.email}
                              className="border-t border-zinc-800"
                            >
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={
                                    player.selected
                                  }
                                  disabled={
                                    importing ||
                                    !editable
                                  }
                                  onChange={(event) =>
                                    updatePlayer(
                                      index,
                                      {
                                        selected:
                                          event.target
                                            .checked,
                                      }
                                    )
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
                                {player.dupr?.toFixed(
                                  2
                                ) ?? "Unrated"}
                              </td>

                              <td className="px-4 py-3 text-zinc-400">
                                {player.podplayStatus}
                              </td>

                              <td className="px-4 py-3">
                                <select
                                  value={
                                    player.attendance
                                  }
                                  disabled={
                                    importing ||
                                    !editable
                                  }
                                  onChange={(event) =>
                                    updatePlayer(
                                      index,
                                      {
                                        attendance:
                                          event.target
                                            .value as Attendance,
                                      }
                                    )
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
                          )
                        )}
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
                        !editable
                      }
                      onClick={() =>
                        void importRoster()
                      }
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

            {/* IMPORT RESULTS */}

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
