"use client";

import { LeagueSeasonSelector } from "@/components/league-selectors/LeagueSeasonSelector";

type LeagueNightSetupProps = {
  selectedLeagueId: string;
  selectedSeasonId: string;
  eventDate: string;
  sessionNumber: number;
  sessionNote: string;
  isStarting: boolean;
  errorMessage?: string;

  onLeagueChange: (leagueId: string) => void;
  onSeasonChange: (seasonId: string) => void;
  onEventDateChange: (eventDate: string) => void;
  onSessionNumberChange: (
    sessionNumber: number,
  ) => void;
  onSessionNoteChange: (
    sessionNote: string,
  ) => void;
  onStartLeagueNight: () => void;
};

export function LeagueNightSetup({
  selectedLeagueId,
  selectedSeasonId,
  eventDate,
  sessionNumber,
  sessionNote,
  isStarting,
  errorMessage,
  onLeagueChange,
  onSeasonChange,
  onEventDateChange,
  onSessionNumberChange,
  onSessionNoteChange,
  onStartLeagueNight,
}: LeagueNightSetupProps) {
  const canStart =
    Boolean(selectedLeagueId) &&
    Boolean(selectedSeasonId) &&
    Boolean(eventDate) &&
    Number.isInteger(sessionNumber) &&
    sessionNumber >= 1 &&
    !isStarting;

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      <header className="border-b border-zinc-800 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
          League-night setup
        </p>

        <h2 className="mt-1 text-2xl font-bold text-white">
          Start a League Night
        </h2>

        <p className="mt-1 text-sm text-zinc-400">
          Choose the league, season, date, and
          session before checking players in.
        </p>
      </header>

      <div className="p-5">
        <LeagueSeasonSelector
          selectedLeagueId={selectedLeagueId}
          selectedSeasonId={selectedSeasonId}
          onLeagueChange={onLeagueChange}
          onSeasonChange={onSeasonChange}
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-zinc-300">
              Event Date
            </span>

            <input
              type="date"
              value={eventDate}
              onChange={(event) =>
                onEventDateChange(
                  event.target.value,
                )
              }
              className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-white outline-none transition focus:border-blue-500"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-zinc-300">
              Session Number
            </span>

            <input
              type="number"
              min="1"
              step="1"
              value={sessionNumber}
              onChange={(event) => {
                const value = Number(
                  event.target.value,
                );

                onSessionNumberChange(
                  Number.isInteger(value) &&
                    value >= 1
                    ? value
                    : 1,
                );
              }}
              className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-white outline-none transition focus:border-blue-500"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-semibold text-zinc-300">
            Session Note
            <span className="ml-2 font-normal text-zinc-500">
              Optional
            </span>
          </span>

          <input
            type="text"
            value={sessionNote}
            maxLength={80}
            placeholder="Late session, advanced group, beginners..."
            onChange={(event) =>
              onSessionNoteChange(
                event.target.value,
              )
            }
            className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500"
          />
        </label>

        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Event Preview
          </p>

          <p className="mt-2 font-bold text-white">
            Session {sessionNumber}
            {sessionNote.trim()
              ? ` — ${sessionNote.trim()}`
              : ""}
          </p>

          <p className="mt-1 text-sm text-zinc-400">
            {eventDate ||
              "Choose an event date"}
          </p>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          disabled={!canStart}
          onClick={onStartLeagueNight}
          className="mt-5 min-h-12 w-full rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {isStarting
            ? "Starting League Night..."
            : "Start League Night"}
        </button>
      </div>
    </section>
  );
}