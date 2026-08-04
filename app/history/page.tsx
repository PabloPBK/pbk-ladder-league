"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import {
  getHistoryEvents,
  type HistoryEventSummary,
} from "@/lib/data/history";

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(
    new Date(`${value}T12:00:00`),
  );
}

function formatDifferential(value: number) {
  return value > 0
    ? `+${value}`
    : String(value);
}

export default function HistoryPage() {
  const [events, setEvents] = useState<
    HistoryEventSummary[]
  >([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const result =
          await getHistoryEvents();

        if (!cancelled) {
          setEvents(result);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load league history.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const groupedEvents = useMemo(() => {
    const groups = new Map<
      string,
      HistoryEventSummary[]
    >();

    events.forEach((event) => {
      const month =
        new Intl.DateTimeFormat("en-US", {
          month: "long",
          year: "numeric",
        }).format(
          new Date(
            `${event.eventDate}T12:00:00`,
          ),
        );

      const monthEvents =
        groups.get(month) ?? [];

      monthEvents.push(event);
      groups.set(month, monthEvents);
    });

    return [...groups.entries()];
  }, [events]);

  return (
    <AppLayout
      title="League History"
      description="Review completed league nights, standings, rounds, and match results."
    >
      <div className="mx-auto max-w-5xl">
        {isLoading && (
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-8 text-center text-blue-300">
            Loading league history...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-red-300">
            {errorMessage}
          </div>
        )}

        {!isLoading &&
          !errorMessage &&
          events.length === 0 && (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-center">
              <div className="text-6xl">
                📅
              </div>

              <h2 className="mt-5 text-3xl font-bold text-white">
                No Completed League Nights
              </h2>

              <p className="mt-3 text-zinc-400">
                Completed league events will appear here automatically.
              </p>
            </div>
          )}

        <div className="space-y-10">
          {groupedEvents.map(
            ([month, monthEvents]) => (
              <section key={month}>
                <h2 className="mb-5 text-3xl font-bold text-white">
                  {month}
                </h2>

                <div className="space-y-4">
                  {monthEvents.map((event) => (
                    <Link
                      key={event.id}
                      href={`/history/${event.id}`}
                      className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-blue-500 hover:bg-zinc-800/80"
                    >
                      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-wide text-blue-300">
                            {formatEventDate(
                              event.eventDate,
                            )}
                          </p>

                          <h3 className="mt-2 text-2xl font-bold text-white">
                            {event.name}
                          </h3>

                          <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-400">
                            <span>
                              {event.playerCount} players
                            </span>

                            <span>•</span>

                            <span>
                              {event.roundCount} rounds
                            </span>

                            <span>•</span>

                            <span>
                              {event.matchCount} matches
                            </span>
                          </div>
                        </div>

                        <div className="min-w-52 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-yellow-300">
                            League Night Winner
                          </p>

                          <p className="mt-2 text-xl font-bold text-white">
                            {event.winner?.name ??
                              "No results"}
                          </p>

                          {event.winner && (
                            <p className="mt-1 text-sm text-zinc-300">
                              {event.winner.wins}-
                              {event.winner.losses}
                              {" • "}
                              {formatDifferential(
                                event.winner
                                  .pointDifferential,
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      </div>
    </AppLayout>
  );
}