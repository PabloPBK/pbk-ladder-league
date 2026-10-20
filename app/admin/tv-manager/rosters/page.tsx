"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import TeamManager from "./TeamManager";

type RatingMethod = "dupr_doubles" | "dupr_singles" | "club_rating";
type RatingStatus = "needs_review" | "confirmed_dupr" | "club_rating" | "manual";

type RosterEvent = {
  id: string;
  name: string;
  event_date: string | null;
  event_type: "partnered" | "individual";
  rating_method: RatingMethod;
  created_at: string;
};

type RosterPlayer = {
  id: string;
  event_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  club_rating: number | null;
  dupr_doubles: number | null;
  dupr_singles: number | null;
  doubles_rating_status: RatingStatus;
  registration_status: string | null;
};

type PlayerForm = {
  full_name: string;
  club_rating: string;
  dupr_doubles: string;
  dupr_singles: string;
  doubles_rating_status: RatingStatus;
};

type ImportRow = {
  rowId: number;
  full_name: string;
  email: string;
  phone: string;
  club_rating: string;
  dupr_doubles: string;
  dupr_singles: string;
  imported_doubles_rating: number | null;
  imported_singles_rating: number | null;
  doubles_rating_status: RatingStatus;
  duplicate: boolean;
  selected: boolean;
};

const methods: { value: RatingMethod; label: string }[] = [
  { value: "dupr_doubles", label: "DUPR Doubles" },
  { value: "dupr_singles", label: "DUPR Singles" },
  { value: "club_rating", label: "Club Rating" },
];

const statuses: { value: RatingStatus; label: string }[] = [
  { value: "needs_review", label: "Needs Review" },
  { value: "confirmed_dupr", label: "Confirmed DUPR" },
  { value: "club_rating", label: "Original was Club Rating" },
  { value: "manual", label: "Manually Entered DUPR" },
];

const emptyPlayer: PlayerForm = {
  full_name: "",
  club_rating: "",
  dupr_doubles: "",
  dupr_singles: "",
  doubles_rating_status: "needs_review",
};

const fieldClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white";

const norm = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const ratingText = (value: number | null) =>
  value == null ? "" : String(value);

const ratingLabel = (value: number | null) =>
  value == null ? "NR" : value.toFixed(2);

function readRating(value: string): number | null {
  const text = value.trim();

  if (!text || /^(nr|n\/a|not rated|unrated|-)$/.test(text.toLowerCase())) {
    return null;
  }

  const number = Number(text);

  if (!Number.isFinite(number) || number < 1 || number > 8) {
    throw new Error(`Invalid rating: ${text}. Ratings must be 1 to 8.`);
  }

  return number;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";

      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field.");

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);

  return rows;
}

function formatDate(value: string | null) {
  if (!value) return "Date not set";
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function LiveRostersPage() {
  const [events, setEvents] = useState<RosterEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [playersVersion, setPlayersVersion] = useState(0);



  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] =
    useState<"partnered" | "individual">("partnered");
  const [ratingMethod, setRatingMethod] =
    useState<RatingMethod>("dupr_doubles");

  const [playerForm, setPlayerForm] = useState<PlayerForm>(emptyPlayer);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [savingMethod, setSavingMethod] = useState(false);

  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedEvent = events.find((event) => event.id === selectedEventId);

  const loadEvents = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/roster-events", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load events");
      }

      const nextEvents: RosterEvent[] = result.events || [];
      setEvents(nextEvents);

      setSelectedEventId((current) =>
        nextEvents.some((event) => event.id === current)
          ? current
          : nextEvents[0]?.id || ""
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlayers = useCallback(async (eventId: string) => {
    if (!eventId) {
      setPlayers([]);
      return;
    }

    setPlayersLoading(true);

    try {
      const response = await fetch(
        `/api/roster-players?event_id=${encodeURIComponent(eventId)}`,
        { cache: "no-store" }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load players");
      }

      setPlayers(result.players || []);
      setPlayersVersion((current) => current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load players");
    } finally {
      setPlayersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    setEditingId(null);
    setPlayerForm(emptyPlayer);
    setPlayers([]);
    setImportRows([]);
    setFileName("");
    void loadPlayers(selectedEventId);
  }, [selectedEventId, loadPlayers]);

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || savingEvent) return;

    setSavingEvent(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/roster-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          event_date: eventDate || null,
          event_type: eventType,
          rating_method: ratingMethod,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to create event");
      }

      setName("");
      setEventDate("");
      setEventType("partnered");
      setRatingMethod("dupr_doubles");

      await loadEvents();
      setSelectedEventId(result.event.id);
      setSuccess("Event created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create event");
    } finally {
      setSavingEvent(false);
    }
  }

  async function updateEventRatingMethod(method: RatingMethod) {
    if (!selectedEventId || savingMethod) return;

    setSavingMethod(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/roster-events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedEventId,
          rating_method: method,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to change rating method");
      }

      setEvents((current) =>
        current.map((event) =>
          event.id === selectedEventId
            ? { ...event, rating_method: result.event.rating_method }
            : event
        )
      );

      setSuccess("Event rating method updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update event");
    } finally {
      setSavingMethod(false);
    }
  }

  function updatePlayerField<K extends keyof PlayerForm>(
    field: K,
    value: PlayerForm[K]
  ) {
    setPlayerForm((current) => ({ ...current, [field]: value }));
  }

  
function editPlayer(player: RosterPlayer) {
  setEditingId(player.id);
  setPlayerForm({
    full_name: player.full_name,
    club_rating: ratingText(player.club_rating),
    dupr_doubles: ratingText(player.dupr_doubles),
    dupr_singles: ratingText(player.dupr_singles),
    doubles_rating_status: player.doubles_rating_status,
  });

  setError("");
  setSuccess("");

  window.requestAnimationFrame(() => {
    document
      .getElementById("player-edit-form")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  });
}

  function cancelEdit() {
    setEditingId(null);
    setPlayerForm(emptyPlayer);
  }
  
async function deletePlayer(player: RosterPlayer) {
  if (!selectedEventId) return;

  const confirmed = window.confirm(
    `Are you sure you want to delete ${player.full_name}?\n\n` +
      "This removes the player from the selected event. " +
      "Players assigned to teams must be unassigned first."
  );

  if (!confirmed) return;

  setError("");
  setSuccess("");

  try {
    const response = await fetch("/api/roster-players", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: player.id,
        event_id: selectedEventId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Unable to delete player"
      );
    }

    if (editingId === player.id) {
      cancelEdit();
    }

    await loadPlayers(selectedEventId);

    setSuccess(
      `${player.full_name} was removed from this event.`
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Unable to delete player";

    setError(message);
    window.alert(message);
  }
}

  async function savePlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEventId || savingPlayer) return;

    let club: number | null;
    let doubles: number | null;
    let singles: number | null;

    try {
      club = readRating(playerForm.club_rating);
      doubles = readRating(playerForm.dupr_doubles);
      singles = readRating(playerForm.dupr_singles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid rating");
      return;
    }

    setSavingPlayer(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/roster-players", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          event_id: selectedEventId,
          full_name: playerForm.full_name.trim(),
          club_rating: club,
          dupr_doubles: doubles,
          dupr_singles: singles,
          doubles_rating_status: playerForm.doubles_rating_status,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save player");
      }

      setSuccess(editingId ? "Player updated." : "Player added.");
      cancelEdit();
      await loadPlayers(selectedEventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save player");
    } finally {
      setSavingPlayer(false);
    }
  }

  async function previewCSV(file: File | undefined) {
    if (!file || !selectedEventId) return;

    setError("");
    setSuccess("");
    setImportRows([]);

    try {
      if (file.size > 2_000_000) {
        throw new Error("CSV must be smaller than 2 MB.");
      }

      // Reload existing registrations before duplicate checking.
      const response = await fetch(
        `/api/roster-players?event_id=${encodeURIComponent(selectedEventId)}`,
        { cache: "no-store" }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to check existing players");
      }

      const existingPlayers: RosterPlayer[] = result.players || [];
      setPlayers(existingPlayers);

      const text = (await file.text()).replace(/^\uFEFF/, "");
      const parsed = parseCSV(text);

      if (parsed.length < 2) {
        throw new Error("CSV contains no registrations.");
      }

      if (parsed.length > 301) {
        throw new Error("Maximum 300 registrations per import.");
      }

      const headers = parsed[0].map((value) =>
        norm(value).replace(/[^a-z0-9]/g, "")
      );

      const column = (...names: string[]) =>
        headers.findIndex((header) => names.includes(header));

      const nameIndex = column("fullname", "playername", "name");
      const emailIndex = column("email", "emailaddress");
      const phoneIndex = column("phone", "phonenumber");
      const doublesIndex = column("duprdoubles", "doublesdupr");
      const singlesIndex = column("duprsingles", "singlesdupr");
      const clubIndex = column("clubrating", "clubdupr");
      const statusIndex = column(
        "invitationstatus",
        "registrationstatus",
        "status"
      );

      if (nameIndex < 0) {
        throw new Error("Missing Full Name column.");
      }

      const cell = (row: string[], index: number) =>
        index < 0 ? "" : (row[index] ?? "").trim();

      const seenNames = new Set<string>();
      const seenEmails = new Set<string>();
      const next: ImportRow[] = [];

      for (let i = 1; i < parsed.length; i++) {
        const row = parsed[i];
        const full_name = cell(row, nameIndex);

        if (!full_name) continue;

        const status = norm(cell(row, statusIndex));

        if (statusIndex >= 0 && status !== "accepted") continue;

        const email = cell(row, emailIndex);
        const nameKey = norm(full_name);
        const emailKey = norm(email);

        const duplicate =
          existingPlayers.some(
            (player) =>
              norm(player.full_name) === nameKey ||
              (emailKey !== "" && norm(player.email ?? "") === emailKey)
          ) ||
          seenNames.has(nameKey) ||
          (emailKey !== "" && seenEmails.has(emailKey));

        seenNames.add(nameKey);
        if (emailKey) seenEmails.add(emailKey);

        const originalDoubles = readRating(cell(row, doublesIndex));
        const originalSingles = readRating(cell(row, singlesIndex));
        const club = readRating(cell(row, clubIndex));

        // If PodPlay supplies a separate Club Rating column,
        // its Doubles column can be reviewed as a DUPR candidate.
        // Otherwise preserve it without treating it as verified.
        next.push({
          rowId: i,
          full_name,
          email,
          phone: cell(row, phoneIndex),
          club_rating: ratingText(club),
          dupr_doubles:
            clubIndex >= 0 ? ratingText(originalDoubles) : "",
          dupr_singles: ratingText(originalSingles),
          imported_doubles_rating: originalDoubles,
          imported_singles_rating: originalSingles,
          doubles_rating_status: "needs_review",
          duplicate,
          selected: !duplicate,
        });
      }

      setImportRows(next);
      setFileName(file.name);

      if (!next.length) {
        setError("No accepted registrations found.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to read CSV");
    }
  }

  function updateImportRow(rowId: number, changes: Partial<ImportRow>) {
    setImportRows((current) =>
      current.map((row) =>
        row.rowId === rowId ? { ...row, ...changes } : row
      )
    );
  }

  async function importApproved() {
    if (!selectedEventId || importing) return;

    const approved = importRows.filter(
      (row) => row.selected && !row.duplicate
    );

    if (!approved.length) return;

    let payload;

    try {
      payload = approved.map((row) => ({
        full_name: row.full_name,
        email: row.email || null,
        phone: row.phone || null,
        club_rating: readRating(row.club_rating),
        dupr_doubles: readRating(row.dupr_doubles),
        dupr_singles: readRating(row.dupr_singles),
        imported_doubles_rating: row.imported_doubles_rating,
        imported_singles_rating: row.imported_singles_rating,
        doubles_rating_status: row.doubles_rating_status,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid import rating");
      return;
    }

    setImporting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/roster-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: selectedEventId,
          players: payload,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Import failed");
      }

      setSuccess(
        `Imported ${result.added} new players. Skipped ${result.skipped} duplicates.`
      );
      setImportRows([]);
      setFileName("");
      await loadPlayers(selectedEventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to import");
    } finally {
      setImporting(false);
    }
  }

  const newCount = importRows.filter((row) => !row.duplicate).length;
  const duplicateCount = importRows.filter((row) => row.duplicate).length;
  const approvedCount = importRows.filter(
    (row) => row.selected && !row.duplicate
  ).length;

  return (
    <AppLayout
      title="Live Event Rosters"
      description="Manage events, players, ratings, and CSV registrations."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-2xl font-black text-yellow-400">
            Event Roster Manager
          </h2>
          <p className="mt-2 text-zinc-400">
            Manage event registrations and select Club Rating or DUPR
            for each event.
          </p>
        </section>

        {error && (
          <p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-4 text-red-200">
            {error}
          </p>
        )}

        {success && (
          <p role="status" className="rounded-lg border border-green-800 bg-green-950 p-4 text-green-200">
            {success}
          </p>
        )}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-bold">Create New Event</h2>

          <form onSubmit={createEvent} className="mt-5 space-y-4">
            <div>
              <label htmlFor="event-name" className="mb-2 block text-sm font-semibold">
                Event Name
              </label>
              <input
                id="event-name"
                className={fieldClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Example: Monster Mash Money Ladder"
                maxLength={120}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="event-date" className="mb-2 block text-sm font-semibold">
                  Event Date
                </label>
                <input
                  id="event-date"
                  type="date"
                  className={fieldClass}
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="event-type" className="mb-2 block text-sm font-semibold">
                  Event Type
                </label>
                <select
                  id="event-type"
                  className={fieldClass}
                  value={eventType}
                  onChange={(e) =>
                    setEventType(e.target.value as "partnered" | "individual")
                  }
                >
                  <option value="partnered">Partnered Teams</option>
                  <option value="individual">Individual Players</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="event-rating" className="mb-2 block text-sm font-semibold">
                Event Rating Method
              </label>
              <select
                id="event-rating"
                className={fieldClass}
                value={ratingMethod}
                onChange={(e) =>
                  setRatingMethod(e.target.value as RatingMethod)
                }
              >
                {methods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-zinc-400">
                This determines how players and teams will be ranked.
              </p>
            </div>

            <button
              type="submit"
              disabled={savingEvent || !name.trim()}
              className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-black disabled:opacity-50"
            >
              {savingEvent ? "Creating Event..." : "+ Create Event"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Your Events</h2>
            <button
              type="button"
              onClick={() => void loadEvents()}
              disabled={loading}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="mt-4 text-zinc-400">Loading events...</p>
          ) : events.length === 0 ? (
            <p className="mt-4 text-zinc-400">No events yet.</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {events.map((event) => (
                <button
                  type="button"
                  key={event.id}
                  onClick={() => {
                    setSelectedEventId(event.id);
                    setError("");
                    setSuccess("");
                  }}
                  className={`rounded-xl border p-5 text-left ${
                    selectedEventId === event.id
                      ? "border-yellow-400 bg-zinc-800"
                      : "border-zinc-700 bg-zinc-950"
                  }`}
                >
                  <h3 className="text-lg font-bold text-white">
                    {event.name}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-400">
                    {formatDate(event.event_date)}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {event.event_type === "partnered"
                      ? "Partnered Teams"
                      : "Individual Players"}
                  </p>
                  <p className="mt-2 text-sm text-yellow-400">
                    {methods.find((m) => m.value === event.rating_method)?.label ??
                      "DUPR Doubles"}
                  </p>
                  <p className="mt-3 text-xs text-zinc-400">
                    {selectedEventId === event.id
                      ? "Selected event"
                      : "Select to manage"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        {selectedEvent && (
          <>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-bold text-yellow-400">
                Event Ranking Settings
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Choose the rating used for {selectedEvent.name}.
                Changing this does not alter any player ratings.
              </p>

              <label
                htmlFor="selected-event-rating"
                className="mt-4 mb-2 block text-sm font-semibold"
              >
                Rating Method
              </label>
              <select
                id="selected-event-rating"
                className={fieldClass}
                value={selectedEvent.rating_method ?? "dupr_doubles"}
                disabled={savingMethod}
                onChange={(e) =>
                  void updateEventRatingMethod(
                    e.target.value as RatingMethod
                  )
                }
              >
                {methods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
              {savingMethod && (
                <p className="mt-2 text-sm text-zinc-400">Saving...</p>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-bold text-yellow-400">
                Players — {selectedEvent.name}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                {selectedEvent.event_type === "partnered"
                  ? "Players without assigned partners are Free Agents. Partner assignment is coming next."
                  : "Individual event roster."}
              </p>
          
<h3
  id="player-edit-form"
  className="mt-6 scroll-mt-8 text-lg font-bold"
>
  {editingId ? "Edit Player" : "Add Player Manually"}
</h3>

              <form onSubmit={savePlayer} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="player-name" className="mb-2 block text-sm font-semibold">
                    Full Name
                  </label>
                  <input
                    id="player-name"
                    className={fieldClass}
                    value={playerForm.full_name}
                    onChange={(e) =>
                      updatePlayerField("full_name", e.target.value)
                    }
                    maxLength={200}
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {(
                    [
                      ["club_rating", "Club Rating"],
                      ["dupr_doubles", "DUPR Doubles"],
                      ["dupr_singles", "DUPR Singles"],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field}>
                      <label htmlFor={field} className="mb-2 block text-sm font-semibold">
                        {label}
                      </label>
                      <input
                        id={field}
                        type="number"
                        min="1"
                        max="8"
                        step="0.001"
                        placeholder="NR"
                        className={fieldClass}
                        value={playerForm[field]}
                        onChange={(e) =>
                          updatePlayerField(field, e.target.value)
                        }
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label htmlFor="rating-status" className="mb-2 block text-sm font-semibold">
                    Doubles Rating Source
                  </label>
                  <select
                    id="rating-status"
                    className={fieldClass}
                    value={playerForm.doubles_rating_status}
                    onChange={(e) =>
                      updatePlayerField(
                        "doubles_rating_status",
                        e.target.value as RatingStatus
                      )
                    }
                  >
                    {statuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-zinc-400">
                    Club Rating and verified DUPR can both be entered.
                    They are saved independently.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={savingPlayer || !playerForm.full_name.trim()}
                    className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-black disabled:opacity-50"
                  >
                    {savingPlayer
                      ? "Saving..."
                      : editingId
                        ? "Save Changes"
                        : "+ Add Player"}
                  </button>

                  {editingId && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-lg border border-zinc-600 px-6 py-3 text-white"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-bold text-yellow-400">
                Import PodPlay CSV
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Upload updated registrations. Existing players are skipped
                without overwriting their ratings or team assignments.
                Review imported ratings before saving.
              </p>

              <input
                key={selectedEventId}
                type="file"
                accept=".csv,text/csv"
                className="mt-4 block w-full text-sm"
                onChange={(e) => void previewCSV(e.target.files?.[0])}
              />

              {fileName && (
                <p className="mt-2 text-sm text-zinc-400">
                  Reviewing: {fileName}
                </p>
              )}

              {importRows.length > 0 && (
                <>
                  <p className="mt-4 font-semibold">
                    {duplicateCount} existing/duplicate · {newCount} new
                  </p>

                  <p className="mt-2 text-sm text-amber-300">
                    The original PodPlay Doubles value is preserved.
                    Enter verified DUPR separately if you know it.
                    Players may have both Club and DUPR ratings.
                  </p>

                  <div className="mt-4 space-y-3">
                    {importRows.map((row) => (
                      <div
                        key={row.rowId}
                        className={`rounded-xl border p-4 ${
                          row.duplicate
                            ? "border-zinc-700 opacity-60"
                            : "border-zinc-600"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <input
                            type="checkbox"
                            checked={row.selected && !row.duplicate}
                            disabled={row.duplicate}
                            onChange={(e) =>
                              updateImportRow(row.rowId, {
                                selected: e.target.checked,
                              })
                            }
                          />
                          <span className="font-semibold">{row.full_name}</span>
                          <span className="ml-auto text-xs text-zinc-400">
                            {row.duplicate
                              ? "Already registered — skipped"
                              : "New registration"}
                          </span>
                        </div>

                        {!row.duplicate && (
                          <>
                            <p className="mt-2 text-xs text-zinc-400">
                              Original PodPlay Doubles:{" "}
                              {ratingLabel(row.imported_doubles_rating)}
                            </p>

                            <div className="mt-3 grid gap-3 md:grid-cols-4">
                              {(
                                [
                                  ["club_rating", "Club Rating"],
                                  ["dupr_doubles", "Verified DUPR Doubles"],
                                  ["dupr_singles", "DUPR Singles"],
                                ] as const
                              ).map(([field, label]) => (
                                <label key={field} className="text-xs font-semibold">
                                  {label}
                                  <input
                                    type="number"
                                    min="1"
                                    max="8"
                                    step="0.001"
                                    placeholder="NR"
                                    className={`${fieldClass} mt-1`}
                                    value={row[field]}
                                    onChange={(e) =>
                                      updateImportRow(row.rowId, {
                                        [field]: e.target.value,
                                      })
                                    }
                                  />
                                </label>
                              ))}

                              <label className="text-xs font-semibold">
                                Doubles Rating Source
                                <select
                                  className={`${fieldClass} mt-1`}
                                  value={row.doubles_rating_status}
                                  onChange={(e) =>
                                    updateImportRow(row.rowId, {
                                      doubles_rating_status:
                                        e.target.value as RatingStatus,
                                    })
                                  }
                                >
                                  {statuses.map((status) => (
                                    <option key={status.value} value={status.value}>
                                      {status.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => void importApproved()}
                    disabled={importing || approvedCount === 0}
                    className="mt-5 rounded-lg bg-yellow-400 px-6 py-3 font-bold text-black disabled:opacity-50"
                  >
                    {importing
                      ? "Importing..."
                      : `Import ${approvedCount} New Players`}
                  </button>

                  {error && (
                    <p className="mt-3 text-sm text-red-300" role="alert">
                      {error}
                    </p>
                  )}
                </>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">
                  {selectedEvent.event_type === "partnered"
                    ? "Players / Free Agents"
                    : "Individual Players"}{" "}
                  ({players.length})
                </h2>
                <button
                  type="button"
                  onClick={() => void loadPlayers(selectedEventId)}
                  disabled={playersLoading}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm disabled:opacity-50"
                >
                  Refresh Players
                </button>
              </div>

              {playersLoading ? (
                <p className="mt-4 text-zinc-400">Loading players...</p>
              ) : players.length === 0 ? (
                <p className="mt-4 text-zinc-400">
                  No players yet. Add a player or import CSV above.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead className="border-b border-zinc-700 text-zinc-400">
                      <tr>
                        <th className="py-3 pr-3">Player</th>
                        <th className="px-3">Club</th>
                        <th className="px-3">Doubles</th>
                        <th className="px-3">Singles</th>
                        <th className="px-3">Rating Source</th>
                        <th className="pl-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((player) => (
                        <tr key={player.id} className="border-b border-zinc-800">
                          <td className="py-3 pr-3 font-semibold">
                            {player.full_name}
                          </td>
                          <td className="px-3">
                            {ratingLabel(player.club_rating)}
                          </td>
                          <td className="px-3">
                            {ratingLabel(player.dupr_doubles)}
                          </td>
                          <td className="px-3">
                            {ratingLabel(player.dupr_singles)}
                          </td>
                          <td className="px-3 text-zinc-400">
                            {player.doubles_rating_status.replaceAll("_", " ")}
                          </td>
                          <td className="pl-3">
  <div className="flex items-center gap-5">
    <button
      type="button"
      onClick={() => editPlayer(player)}
      className="font-semibold text-yellow-400 hover:underline"
    >
      Edit
    </button>

    <button
      type="button"
      onClick={() => void deletePlayer(player)}
      className="font-semibold text-red-400 hover:underline"
    >
      Delete
    </button>
  </div>
</td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <TeamManager
  eventId={selectedEvent.id}
  eventName={selectedEvent.name}
  eventType={selectedEvent.event_type}
  ratingMethod={selectedEvent.rating_method ?? "dupr_doubles"}
  playersVersion={playersVersion}
/>
          </>
        )}

        <Link
          href="/admin/tv-manager"
          className="inline-block rounded-lg bg-yellow-400 px-5 py-3 font-bold text-black"
        >
          Back to TV Manager
        </Link>
      </div>
    </AppLayout>
  );
}
