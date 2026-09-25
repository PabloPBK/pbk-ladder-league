"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { getHistoryEvents, type HistoryEventSummary, updateHistoryEventSeason } from "@/lib/data/history";
import { getSeasonsForLeague, type SeasonRecord } from "@/lib/data/leagues";

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatDifferential(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export default function HistoryPage() {
  const [events, setEvents] = useState<HistoryEventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [editingEventId, setEditingEventId] = useState("");
  const [availableSeasons, setAvailableSeasons] = useState<SeasonRecord[]>([]);
  const [draftSeasonId, setDraftSeasonId] = useState("");
  const [savingEventId, setSavingEventId] = useState("");

  async function loadHistory() {
    try {
      setIsLoading(true);
      setErrorMessage("");
      setEvents(await getHistoryEvents());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load league history.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  const seasonOptions = useMemo(() => {
    const byId = new Map<string, string>();
    events.forEach((event) => byId.set(event.seasonId, event.seasonName));
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }));
  }, [events]);

  const visibleEvents = useMemo(
    () => seasonFilter === "all" ? events : events.filter((event) => event.seasonId === seasonFilter),
    [events, seasonFilter],
  );

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, HistoryEventSummary[]>();
    visibleEvents.forEach((event) => {
      const month = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" })
        .format(new Date(`${event.eventDate}T12:00:00`));
      const monthEvents = groups.get(month) ?? [];
      monthEvents.push(event);
      groups.set(month, monthEvents);
    });
    return [...groups.entries()];
  }, [visibleEvents]);

  async function beginEdit(event: HistoryEventSummary) {
    try {
      setErrorMessage("");
      const seasons = await getSeasonsForLeague(event.leagueId);
      setAvailableSeasons(seasons);
      setDraftSeasonId(event.seasonId);
      setEditingEventId(event.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load seasons.");
    }
  }

  async function saveSeason(eventId: string) {
    if (!draftSeasonId) return;
    try {
      setSavingEventId(eventId);
      setErrorMessage("");
      await updateHistoryEventSeason(eventId, draftSeasonId);
      await loadHistory();
      setEditingEventId("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update season.");
    } finally {
      setSavingEventId("");
    }
  }

  return (
    <AppLayout title="League History" description="Review completed league nights, standings, rounds, match results, and season assignments.">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Filter by season</p>
            <p className="text-xs text-zinc-400">Staff can also correct a league night&apos;s season here.</p>
          </div>
          <select value={seasonFilter} onChange={(event) => setSeasonFilter(event.target.value)} className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-white">
            <option value="all">All seasons</option>
            {seasonOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>

        {isLoading && <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-8 text-center text-blue-300">Loading league history...</div>}
        {errorMessage && <div className="mb-5 rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-red-300">{errorMessage}</div>}

        {!isLoading && !errorMessage && visibleEvents.length === 0 && (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-center">
            <div className="text-6xl">📅</div>
            <h2 className="mt-5 text-3xl font-bold text-white">No Completed League Nights</h2>
            <p className="mt-3 text-zinc-400">Completed league events will appear here automatically.</p>
          </div>
        )}

        <div className="space-y-10">
          {groupedEvents.map(([month, monthEvents]) => (
            <section key={month}>
              <h2 className="mb-5 text-3xl font-bold text-white">{month}</h2>
              <div className="space-y-4">
                {monthEvents.map((event) => (
                  <article key={event.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold uppercase tracking-wide text-blue-300">{formatEventDate(event.eventDate)}</p>
                          <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs font-bold text-purple-300">{event.seasonName}</span>
                        </div>
                        <h3 className="mt-2 text-2xl font-bold text-white">{event.name}</h3>
                        <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-400">
                          <span>{event.playerCount} players</span><span>•</span><span>{event.roundCount} rounds</span><span>•</span><span>{event.matchCount} matches</span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link href={`/history/${event.id}`} className="inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-500">View Results</Link>
                          <button type="button" onClick={() => void beginEdit(event)} className="min-h-10 rounded-lg border border-zinc-700 px-4 text-sm font-bold text-zinc-200 hover:border-blue-500">Edit Season</button>
                        </div>
                        {editingEventId === event.id && (
                          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 sm:flex-row">
                            <select value={draftSeasonId} onChange={(e) => setDraftSeasonId(e.target.value)} className="min-h-10 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white">
                              {availableSeasons.map((season) => <option key={season.id} value={season.id}>{season.name}{season.status === "active" ? " — Active" : ""}</option>)}
                            </select>
                            <button type="button" disabled={savingEventId === event.id} onClick={() => void saveSeason(event.id)} className="min-h-10 rounded-lg bg-green-600 px-4 font-bold text-white disabled:bg-zinc-700">{savingEventId === event.id ? "Saving..." : "Save Season"}</button>
                            <button type="button" onClick={() => setEditingEventId("")} className="min-h-10 rounded-lg border border-zinc-700 px-4 font-bold text-zinc-300">Cancel</button>
                          </div>
                        )}
                      </div>
                      <div className="min-w-52 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-yellow-300">League Night Winner</p>
                        <p className="mt-2 text-xl font-bold text-white">{event.winner?.name ?? "No results"}</p>
                        {event.winner && <p className="mt-1 text-sm text-zinc-300">{event.winner.wins}-{event.winner.losses} • {formatDifferential(event.winner.pointDifferential)}</p>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
