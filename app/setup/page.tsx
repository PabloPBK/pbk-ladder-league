"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import { LeagueNightSetup } from "@/components/admin/LeagueNightSetup";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLeague } from "@/components/providers/LeagueProvider";
import {
  createLeagueEvent,
  getLeagueEventsForDate,
} from "@/lib/data/events";

function getLocalDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();

  return new Date(
    now.getTime() - offset * 60_000,
  )
    .toISOString()
    .slice(0, 10);
}

export default function SetupPage() {
  const {
    activeEvent,
    setActiveEvent,
    resetLeague,
  } = useLeague();

  const [
    selectedLeagueId,
    setSelectedLeagueId,
  ] = useState("");

  const [
    selectedSeasonId,
    setSelectedSeasonId,
  ] = useState("");

  const [eventDate, setEventDate] =
    useState(getLocalDateValue);

  const [
    sessionNumber,
    setSessionNumber,
  ] = useState(1);

  const [sessionNote, setSessionNote] =
    useState("");

  const [
    isStartingEvent,
    setIsStartingEvent,
  ] = useState(false);

  const [
    isCalculatingSession,
    setIsCalculatingSession,
  ] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (
      !selectedSeasonId ||
      !eventDate ||
      activeEvent
    ) {
      return;
    }

    let cancelled = false;

    async function calculateNextSession() {
      try {
        setIsCalculatingSession(true);
        setErrorMessage("");

        const events =
          await getLeagueEventsForDate({
            seasonId: selectedSeasonId,
            eventDate,
          });

        if (cancelled) {
          return;
        }

        const nextSession =
          events.reduce(
            (highest, event) =>
              Math.max(
                highest,
                event.session_number,
              ),
            0,
          ) + 1;

        setSessionNumber(
          Math.max(1, nextSession),
        );
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to calculate the next session.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsCalculatingSession(false);
        }
      }
    }

    void calculateNextSession();

    return () => {
      cancelled = true;
    };
  }, [
    activeEvent,
    eventDate,
    selectedSeasonId,
  ]);

  function handleLeagueChange(
    leagueId: string,
  ) {
    setSelectedLeagueId(leagueId);
    setSelectedSeasonId("");
    setSessionNumber(1);
    setSessionNote("");
    setErrorMessage("");
  }

  function handleSeasonChange(
    seasonId: string,
  ) {
    setSelectedSeasonId(seasonId);
    setSessionNumber(1);
    setSessionNote("");
    setErrorMessage("");
  }

  async function handleStartLeagueNight() {
    if (
      !selectedSeasonId ||
      isStartingEvent ||
      isCalculatingSession
    ) {
      return;
    }

    try {
      setIsStartingEvent(true);
      setErrorMessage("");

      resetLeague();

      const event =
        await createLeagueEvent({
          seasonId: selectedSeasonId,
          eventDate,
          sessionNumber,
          sessionNote,
        });

      if (event.status === "complete") {
        throw new Error(
          `Session ${sessionNumber} is already complete. Choose another session number.`,
        );
      }

      setActiveEvent(event);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start the league night.",
      );
    } finally {
      setIsStartingEvent(false);
    }
  }

  if (activeEvent) {
    return (
      <AppLayout
        title="League Setup"
        description="The league event is ready. Import the PodPlay roster next."
      >
        <div className="mx-auto max-w-3xl space-y-5">
          <section className="rounded-2xl border border-green-500/40 bg-green-500/10 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-300">
              Step 1 complete
            </p>

            <h2 className="mt-2 text-3xl font-bold text-white">
              {activeEvent.name}
            </h2>

            <p className="mt-2 text-zinc-300">
              {activeEvent.event_date} · Session{" "}
              {activeEvent.session_number}
              {activeEvent.session_note
                ? ` · ${activeEvent.session_note}`
                : ""}
            </p>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/admin/players"
              className="flex min-h-28 flex-col justify-center rounded-2xl bg-blue-600 px-6 py-5 text-white transition hover:bg-blue-500"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-blue-100">
                Step 2
              </span>

              <span className="mt-1 text-xl font-bold">
                Import PodPlay Roster
              </span>

              <span className="mt-1 text-sm text-blue-100">
                Select confirmed players, manage the waitlist, and add walk-ins.
              </span>
            </Link>

            <Link
              href="/admin"
              className="flex min-h-28 flex-col justify-center rounded-2xl border border-zinc-700 bg-zinc-900 px-6 py-5 text-white transition hover:bg-zinc-800"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Skip import
              </span>

              <span className="mt-1 text-xl font-bold">
                Open Check-In
              </span>

              <span className="mt-1 text-sm text-zinc-400">
                Use the players already saved in the system.
              </span>
            </Link>
          </section>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Start League Night"
      description="Choose the league session, then import the PodPlay roster."
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">
              Step 1
            </p>
            <p className="mt-1 font-bold text-white">
              Start Session
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Step 2
            </p>
            <p className="mt-1 font-bold text-zinc-300">
              Import Roster
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Step 3
            </p>
            <p className="mt-1 font-bold text-zinc-300">
              Check In & Play
            </p>
          </div>
        </div>

        <LeagueNightSetup
          selectedLeagueId={
            selectedLeagueId
          }
          selectedSeasonId={
            selectedSeasonId
          }
          eventDate={eventDate}
          sessionNumber={sessionNumber}
          sessionNote={sessionNote}
          isStarting={
            isStartingEvent ||
            isCalculatingSession
          }
          errorMessage={errorMessage}
          onLeagueChange={
            handleLeagueChange
          }
          onSeasonChange={
            handleSeasonChange
          }
          onEventDateChange={
            setEventDate
          }
          onSessionNumberChange={
            setSessionNumber
          }
          onSessionNoteChange={
            setSessionNote
          }
          onStartLeagueNight={() =>
            void handleStartLeagueNight()
          }
        />
      </div>
    </AppLayout>
  );
}