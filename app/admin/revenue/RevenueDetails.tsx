"use client";

import { useEffect, useState } from "react";
import { LeagueSeasonRevenue } from "@/components/admin/LeagueSeasonRevenue";
import { LeagueSessionRevenue, SessionPayoutEstimate } from "@/components/admin/LeagueSessionRevenue";
import { leagueDate } from "@/lib/data/league-listings";
import type { LeagueSessionOption } from "@/lib/data/league-session-schedule";

type League = { id: string; name: string };
type Season = League & { league_id: string };
type Schedule = { seasonId: string; sessions: LeagueSessionOption[]; error?: string };
const selectClass = "min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white";

export default function RevenueDetails({ leagues, seasons }: { leagues: League[]; seasons: Season[] }) {
  const [view, setView] = useState<"report" | "estimate">("report");
  const [leagueId, setLeagueId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [sessionKey, setSessionKey] = useState("");
  const [schedule, setSchedule] = useState<Schedule>();

  useEffect(() => {
    if (!seasonId) return;
    const abort = new AbortController();

    async function loadSessions() {
      try {
        const response = await fetch("/api/league-events/schedule?" + new URLSearchParams({ seasonId }), {
          cache: "no-store", signal: abort.signal,
        });
        if (!response.ok) throw new Error();
        const { sessions } = await response.json() as { sessions: LeagueSessionOption[] };
        if (!abort.signal.aborted) setSchedule({ seasonId, sessions });
      } catch {
        if (!abort.signal.aborted) setSchedule({ seasonId, sessions: [], error: "Unable to load session dates." });
      }
    }

    void loadSessions();
    return () => abort.abort();
  }, [seasonId]);

  const selectedSchedule = schedule?.seasonId === seasonId ? schedule : undefined;
  const session = selectedSchedule?.sessions.find(({ key }) => key === sessionKey);
  const availableSeasons = seasons.filter((season) => season.league_id === leagueId);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <nav aria-label="Revenue views" className="flex flex-wrap gap-2 border-b border-zinc-800">
        {([
          ["report", "Revenue report"],
          ["estimate", "Revenue and payout estimate"],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold ${view === key ? "border-yellow-400 text-yellow-400" : "border-transparent text-zinc-300 hover:text-white"}`}>
            {label}
          </button>
        ))}
      </nav>

      <section aria-label="Revenue filters" className="grid gap-4 rounded-xl border border-zinc-700 bg-zinc-900 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1.5 text-sm font-semibold">
          League
          <select className={selectClass} value={leagueId} onChange={(event) => {
            setLeagueId(event.target.value);
            setSeasonId("");
            setSessionKey("");
          }}>
            <option value="">{view === "estimate" ? "All leagues" : "Choose a league"}</option>
            {leagues.map(({ id, name }) => <option key={id} value={id}>{name.trim()}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          Season
          <select className={selectClass} value={seasonId} disabled={!leagueId} onChange={(event) => {
            setSeasonId(event.target.value);
            setSessionKey("");
          }}>
            <option value="">{view === "estimate" ? "Optional" : "Choose a season"}</option>
            {availableSeasons.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        {view === "report" && (
          <label className="grid gap-1.5 text-sm font-semibold">
            Session
            <select className={selectClass} value={sessionKey} disabled={!selectedSchedule?.sessions.length}
              onChange={(event) => setSessionKey(event.target.value)}>
              <option value="">Season totals</option>
              {selectedSchedule?.sessions.map(({ key, date, number, event }) => (
                <option key={key} value={key}>
                  {leagueDate(date)} · Session {number}{!event ? " · Scheduled" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {seasonId && !selectedSchedule && <p role="status" className="text-sm text-zinc-400">Loading session dates…</p>}
      {selectedSchedule?.error && <p role="alert" className="text-sm text-red-300">{selectedSchedule.error}</p>}

      {view === "estimate" ? (
        <SessionPayoutEstimate key={seasonId} leagueId={leagueId}
          plannedSessions={session ? 1 : Math.max(1, selectedSchedule?.sessions.length ?? 0)} />
      ) : session?.event ? (
        <LeagueSessionRevenue key={session.event.id} eventId={session.event.id} />
      ) : session ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
          <p className="font-semibold">{leagueDate(session.date)} · Session {session.number}</p>
          <p className="mt-1 text-sm text-zinc-400">You can record revenue after starting this session in League Night.</p>
          <button type="button" onClick={() => setView("estimate")} className="mt-2 text-sm font-semibold text-yellow-300 underline">
            Estimate the payout
          </button>
        </div>
      ) : seasonId ? (
        <LeagueSeasonRevenue key={seasonId} seasonId={seasonId} />
      ) : (
        <p className="text-sm text-zinc-400">Choose a league and season to see revenue reports.</p>
      )}
    </div>
  );
}
