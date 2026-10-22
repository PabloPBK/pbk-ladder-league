"use client";

import { useEffect, useState } from "react";

type Schedule = {
  facility: string;
  welcome: string;
  announcements: string[];
  events: unknown[];
};

export default function FacilitySchedulePage() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSchedule() {
      try {
        const response = await fetch("/api/facility-schedule", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load schedule");
        }

        const result = await response.json();
        setSchedule(result.schedule_data);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load schedule"
        );
      } finally {
        setLoading(false);
      }
    }

    loadSchedule();
  }, []);

  async function saveSchedule() {
    if (!schedule) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/facility-schedule", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schedule_data: schedule,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save schedule");
      }

      setMessage("Schedule saved successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save schedule"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-white">
        Loading daily schedule...
      </main>
    );
  }

  if (!schedule) {
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-white">
        {message || "Schedule unavailable"}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-3xl font-black text-yellow-400">
            Daily Operations Schedule
          </h1>

          <p className="mt-2 text-zinc-400">
            Pickleball Kingdom Lynnwood
          </p>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <label className="block text-sm font-semibold">
            Welcome Message
          </label>

          <input
            value={schedule.welcome}
            onChange={(event) =>
              setSchedule({
                ...schedule,
                welcome: event.target.value,
              })
            }
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-white"
          />

          <label className="mt-6 block text-sm font-semibold">
            Announcements (one per line)
          </label>

          <textarea
            value={schedule.announcements.join("\n")}
            onChange={(event) =>
              setSchedule({
                ...schedule,
                announcements: event.target.value.split("\n"),
              })
            }
            rows={5}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-white"
          />
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-bold">Scheduled Events</h2>

          <p className="mt-2 text-zinc-400">
            {schedule.events.length} events currently scheduled.
          </p>

          <p className="mt-4 text-sm text-zinc-500">
            Event editing, court assignments, wristbands, and paddle
            stack controls will be added next.
          </p>
        </section>

        {message && (
          <p className="text-sm text-yellow-400">{message}</p>
        )}

        <button
          onClick={saveSchedule}
          disabled={saving}
          className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-black disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save & Publish"}
        </button>
      </div>
    </main>
  );
}
