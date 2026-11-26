
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { liveRosterSlideLabels, roundOneSlideType, type LiveRosterSlideType } from "@/lib/data/tv-roster-slides";

type RosterEvent = {
  id: string;
  name: string;
  event_type: "partnered" | "individual";
};

type Props = {
  presentationId: string;
  onSlideAdded: () => Promise<void>;
  disabled?: boolean;
};

export default function LiveRosterSlides({
  presentationId,
  onSlideAdded,
  disabled = false,
}: Props) {
  const [events, setEvents] = useState<RosterEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [slideType, setSlideType] = useState<LiveRosterSlideType>("roster_teams");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/roster-events", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load roster events"
          );
        }

        const loaded: RosterEvent[] = Array.isArray(result.events)
          ? result.events
          : [];

        if (cancelled) return;

        setEvents(loaded);
        setEventId((current) =>
          loaded.some((item) => item.id === current)
            ? current
            : loaded[0]?.id ?? ""
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load roster events"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedEvent = events.find(
    (item) => item.id === eventId
  );
  const partnered = selectedEvent?.event_type === "partnered";
  const availableType = partnered ? slideType : "roster_free_agents";

  async function addSlide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!eventId || !presentationId || saving || disabled) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/tv-slides", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          presentation_id: presentationId,
          roster_event_id: eventId,
          media_type: availableType,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to add live roster slide"
        );
      }

      await onSlideAdded();

      setMessage(`${liveRosterSlideLabels[availableType]} added.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add live roster slide"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-950 p-6">
      <h3 className="text-lg font-bold text-yellow-400">
        Add Live Roster Slide
      </h3>

      <p className="mt-2 text-sm text-zinc-400">
        Show live team rankings, free agents, or Round 1 court assignments from an event roster.
      </p>

      {loading ? (
        <p className="mt-5 text-zinc-400">
          Loading roster events...
        </p>
      ) : events.length === 0 ? (
        <p className="mt-5 text-zinc-400">
          Create an event in{" "}
          <Link className="underline" href="/admin/tv-manager/rosters">Partnered League Management</Link>{" "}
          to add a live roster slide.
        </p>
      ) : (
        <form onSubmit={addSlide} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="live-roster-event"
              className="mb-2 block text-sm font-semibold text-white"
            >
              Select Event
            </label>

            <select
              id="live-roster-event"
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value);
                setError("");
              }}
              disabled={saving || disabled}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white"
            >
              {events.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="live-roster-type"
              className="mb-2 block text-sm font-semibold text-white"
            >
              Slide Type
            </label>

            <select
              id="live-roster-type"
              value={availableType}
              onChange={(e) => setSlideType(e.target.value as LiveRosterSlideType)}
              disabled={saving || disabled}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white"
            >
              {partnered && (
                <>
                  <option value="roster_teams">{liveRosterSlideLabels.roster_teams}</option>
                  <option value={roundOneSlideType}>{liveRosterSlideLabels[roundOneSlideType]}</option>
                </>
              )}

              <option value="roster_free_agents">
                {liveRosterSlideLabels.roster_free_agents}
              </option>
            </select>
          </div>

          <button
            type="submit"
            disabled={
              saving ||
              disabled ||
              !eventId
            }
            className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Adding Slide..." : "+ Add Live Roster Slide"}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="mt-4 text-sm text-green-400">
          {message}
        </p>
      )}
    </div>
  );
}
