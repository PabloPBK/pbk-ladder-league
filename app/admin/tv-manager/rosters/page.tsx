"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

type RosterEvent = {
  id: string;
  name: string;
  event_date: string | null;
  event_type: "partnered" | "individual";
  created_at: string;
};

type RatingStatus = "needs_review" | "confirmed_dupr" | "club_rating" | "manual";

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

const emptyPlayer: PlayerForm = {
  full_name: "",
  club_rating: "",
  dupr_doubles: "",
  dupr_singles: "",
  doubles_rating_status: "needs_review",
};

function ratingValue(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function ratingText(value: number | null): string {
  return value == null ? "" : String(value);
}

function ratingLabel(value: number | null): string {
  return value == null ? "NR" : value.toFixed(2);
}

function formatDate(date: string | null): string {
  if (!date) return "Date not set";
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const fieldClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white";

export default function LiveRostersPage() {
  const [events, setEvents] = useState<RosterEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState<"partnered" | "individual">("partnered");
  const [playerForm, setPlayerForm] = useState<PlayerForm>(emptyPlayer);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedEvent = events.find((event) => event.id === selectedEventId);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/roster-events", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load events");
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
      if (!response.ok) throw new Error(result.error || "Unable to load players");
      setPlayers(result.players || []);
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
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create event");
      setName("");
      setEventDate("");
      setEventType("partnered");
      await loadEvents();
      setSelectedEventId(result.event.id);
      setSuccess("Event created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create event");
    } finally {
      setSavingEvent(false);
    }
  }

  function updatePlayerField<K extends keyof PlayerForm>(field: K, value: PlayerForm[K]) {
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
  }

  function cancelEdit() {
    setEditingId(null);
    setPlayerForm(emptyPlayer);
  }

  async function savePlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEventId || savingPlayer) return;
    const ratings = [
      playerForm.club_rating,
      playerForm.dupr_doubles,
      playerForm.dupr_singles,
    ];
    if (ratings.some((value) => value.trim() !== "" &&
      (!Number.isFinite(Number(value)) || Number(value) < 1 || Number(value) > 8))) {
      setError("Ratings must be between 1 and 8, or left blank for NR.");
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
          club_rating: ratingValue(playerForm.club_rating),
          dupr_doubles: ratingValue(playerForm.dupr_doubles),
          dupr_singles: ratingValue(playerForm.dupr_singles),
          doubles_rating_status: playerForm.doubles_rating_status,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save player");
      setSuccess(editingId ? "Player updated." : "Player added.");
      cancelEdit();
      await loadPlayers(selectedEventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save player");
    } finally {
      setSavingPlayer(false);
    }
  }

  return (
    <AppLayout
      title="Live Event Rosters"
      description="Create events, manage players, free agents, and DUPR ratings."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-2xl font-black text-yellow-400">Event Roster Manager</h2>
          <p className="mt-2 text-zinc-400">
            Create events and add players. Partner assignments and CSV imports are next.
          </p>
        </section>

        {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-4 text-red-200">{error}</p>}
        {success && <p role="status" className="rounded-lg border border-green-800 bg-green-950 p-4 text-green-200">{success}</p>}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-bold text-white">Create New Event</h2>
          <form onSubmit={createEvent} className="mt-5 space-y-4">
            <div>
              <label htmlFor="event-name" className="mb-2 block text-sm font-semibold">Event Name</label>
              <input id="event-name" className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Example: Monster Mash Money Ladder" required />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="event-date" className="mb-2 block text-sm font-semibold">Event Date</label>
                <input id="event-date" type="date" className={fieldClass} value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>
              <div>
                <label htmlFor="event-type" className="mb-2 block text-sm font-semibold">Event Type</label>
                <select id="event-type" className={fieldClass} value={eventType} onChange={(e) => setEventType(e.target.value as "partnered" | "individual")}>
                  <option value="partnered">Partnered Teams</option>
                  <option value="individual">Individual Players</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={savingEvent || !name.trim()} className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-black hover:bg-yellow-300 disabled:opacity-50">
              {savingEvent ? "Creating Event..." : "+ Create Event"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Your Events</h2>
            <button type="button" onClick={() => void loadEvents()} disabled={loading} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50">Refresh</button>
          </div>
          {loading ? <p className="mt-4 text-zinc-400">Loading events...</p> : events.length === 0 ? (
            <p className="mt-4 text-zinc-400">No events yet. Create one above.</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {events.map((event) => (
                <button
                  type="button"
                  key={event.id}
                  onClick={() => { setSelectedEventId(event.id); setError(""); setSuccess(""); }}
                  className={`rounded-xl border p-5 text-left transition hover:border-yellow-400 ${selectedEventId === event.id ? "border-yellow-400 bg-zinc-800" : "border-zinc-700 bg-zinc-950"}`}
                >
                  <h3 className="text-lg font-bold text-white">{event.name}</h3>
                  <p className="mt-2 text-sm text-zinc-400">{formatDate(event.event_date)}</p>
                  <p className="mt-1 text-sm text-zinc-400">{event.event_type === "partnered" ? "Partnered Teams" : "Individual Players"}</p>
                  <p className="mt-3 text-sm font-semibold text-yellow-400">{selectedEventId === event.id ? "Selected event" : "Select to manage players"}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        {selectedEvent && (
          <>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-bold text-yellow-400">Players — {selectedEvent.name}</h2>
              <p className="mt-2 text-sm text-zinc-400">
                {selectedEvent.event_type === "partnered"
                  ? "Until partners are assigned, players are considered Free Agents. Partner assignment is the next feature."
                  : "Individual event roster. Players do not need partners."}
              </p>
              <h3 className="mt-6 text-lg font-bold">{editingId ? "Edit Player" : "Add Player Manually"}</h3>
              <form onSubmit={savePlayer} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="player-name" className="mb-2 block text-sm font-semibold">Full Name</label>
                  <input id="player-name" className={fieldClass} value={playerForm.full_name} onChange={(e) => updatePlayerField("full_name", e.target.value)} maxLength={200} required />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {([
                    ["club_rating", "Club Rating"],
                    ["dupr_doubles", "DUPR Doubles"],
                    ["dupr_singles", "DUPR Singles"],
                  ] as const).map(([field, label]) => (
                    <div key={field}>
                      <label htmlFor={field} className="mb-2 block text-sm font-semibold">{label}</label>
                      <input id={field} type="number" min="1" max="8" step="0.001" placeholder="NR" className={fieldClass} value={playerForm[field]} onChange={(e) => updatePlayerField(field, e.target.value)} />
                    </div>
                  ))}
                </div>
                <div>
                  <label htmlFor="rating-status" className="mb-2 block text-sm font-semibold">Doubles Rating Status</label>
                  <select id="rating-status" className={fieldClass} value={playerForm.doubles_rating_status} onChange={(e) => updatePlayerField("doubles_rating_status", e.target.value as RatingStatus)}>
                    <option value="needs_review">Needs Review</option>
                    <option value="confirmed_dupr">Confirmed DUPR</option>
                    <option value="club_rating">Imported value was Club Rating</option>
                    <option value="manual">Manually Entered DUPR</option>
                  </select>
                  <p className="mt-2 text-xs text-zinc-400">If PodPlay supplied a Club Rating, put it in Club Rating and clear DUPR Doubles until you know the actual DUPR.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="submit" disabled={savingPlayer || !playerForm.full_name.trim()} className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-black hover:bg-yellow-300 disabled:opacity-50">
                    {savingPlayer ? "Saving..." : editingId ? "Save Changes" : "+ Add Player"}
                  </button>
                  {editingId && <button type="button" onClick={cancelEdit} className="rounded-lg border border-zinc-600 px-6 py-3 text-white hover:bg-zinc-800">Cancel Edit</button>}
                </div>
              </form>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">{selectedEvent.event_type === "partnered" ? "Players / Free Agents" : "Individual Players"} ({players.length})</h2>
                <button type="button" onClick={() => void loadPlayers(selectedEventId)} disabled={playersLoading} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50">Refresh Players</button>
              </div>
              {playersLoading ? <p className="mt-4 text-zinc-400">Loading players...</p> : players.length === 0 ? (
                <p className="mt-4 text-zinc-400">No players yet. Add your first player above.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead className="border-b border-zinc-700 text-zinc-400">
                      <tr><th className="py-3 pr-3">Player</th><th className="px-3">Club</th><th className="px-3">Doubles</th><th className="px-3">Singles</th><th className="px-3">Rating Status</th><th className="pl-3">Action</th></tr>
                    </thead>
                    <tbody>
                      {players.map((player) => (
                        <tr key={player.id} className="border-b border-zinc-800">
                          <td className="py-3 pr-3 font-semibold">{player.full_name}</td>
                          <td className="px-3">{ratingLabel(player.club_rating)}</td>
                          <td className="px-3">{ratingLabel(player.dupr_doubles)}</td>
                          <td className="px-3">{ratingLabel(player.dupr_singles)}</td>
                          <td className="px-3 text-zinc-400">{player.doubles_rating_status.replaceAll("_", " ")}</td>
                          <td className="pl-3"><button type="button" onClick={() => editPlayer(player)} className="font-semibold text-yellow-400 hover:underline">Edit</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        <Link href="/admin/tv-manager" className="inline-block rounded-lg bg-yellow-400 px-5 py-3 font-bold text-black hover:bg-yellow-300">Back to TV Manager</Link>
      </div>
    </AppLayout>
  );
}
