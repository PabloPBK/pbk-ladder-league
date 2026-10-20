"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

type RosterEvent = {
  id: string;
  name: string;
  event_date: string | null;
  event_type: "partnered" | "individual";
  created_at: string;
};

export default function LiveRostersPage() {
  const [events, setEvents] = useState<RosterEvent[]>([]);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState<
    "partnered" | "individual"
  >("partnered");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/roster-events", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to load events"
        );
      }

      setEvents(result.events || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load events"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  async function createEvent(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!name.trim() || saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/roster-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          event_date: eventDate || null,
          event_type: eventType,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to create event"
        );
      }

      setName("");
      setEventDate("");
      setEventType("partnered");
      setSuccess("Event created successfully!");

      await loadEvents();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create event"
      );
    } finally {
      setSaving(false);
    }
  }

  function formatDate(date: string | null) {
    if (!date) return "Date not set";

    const [year, month, day] = date.split("-").map(Number);

    return new Date(
      year,
      month - 1,
      day
    ).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <AppLayout
      title="Live Event Rosters"
      description="Create events, manage teams, free agents, and DUPR rankings."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-2xl font-black text-yellow-400">
            Event Roster Manager
          </h2>

          <p className="mt-2 text-zinc-400">
            Create an event to begin organizing its players,
            partners, and DUPR rankings.
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-bold text-white">
            Create New Event
          </h2>

          <form
            onSubmit={createEvent}
            className="mt-5 space-y-5"
          >
            <div>
              <label
                htmlFor="event-name"
                className="mb-2 block text-sm font-semibold text-white"
              >
                Event Name
              </label>

              <input
                id="event-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Example: Monster Mash Money Ladder"
                maxLength={120}
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="event-date"
                  className="mb-2 block text-sm font-semibold text-white"
                >
                  Event Date
                </label>

                <input
                  id="event-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) =>
                    setEventDate(e.target.value)
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="event-type"
                  className="mb-2 block text-sm font-semibold text-white"
                >
                  Event Type
                </label>

                <select
                  id="event-type"
                  value={eventType}
                  onChange={(e) =>
                    setEventType(
                      e.target.value as
                        | "partnered"
                        | "individual"
                    )
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
                >
                  <option value="partnered">
                    Partnered Teams
                  </option>

                  <option value="individual">
                    Individual Players
                  </option>
                </select>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-300"
              >
                {error}
              </p>
            )}

            {success && (
              <p
                role="status"
                className="rounded-lg border border-green-800 bg-green-950 p-3 text-sm text-green-300"
              >
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Creating Event..." : "+ Create Event"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-white">
              Your Events
            </h2>

            <button
              type="button"
              onClick={() => void loadEvents()}
              disabled={loading}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="mt-5 text-zinc-400">
              Loading events...
            </p>
          ) : events.length === 0 ? (
            <p className="mt-5 text-zinc-400">
              No events created yet. Create your first event
              above.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-zinc-700 bg-zinc-950 p-5"
                >
                  <h3 className="text-lg font-bold text-white">
                    {event.name}
                  </h3>

                  <p className="mt-2 text-sm text-zinc-400">
                    📅 {formatDate(event.event_date)}
                  </p>

                  <p className="mt-2 text-sm text-zinc-400">
                    {event.event_type === "partnered"
                      ? "🤝 Partnered Teams"
                      : "👤 Individual Players"}
                  </p>

                  <p className="mt-4 text-sm font-semibold text-yellow-400">
                    Player management coming next
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <Link
          href="/admin/tv-manager"
          className="inline-block rounded-lg bg-yellow-400 px-5 py-3 font-bold text-black hover:bg-yellow-300"
        >
          Back to TV Manager
        </Link>
      </div>
    </AppLayout>
  );
}
