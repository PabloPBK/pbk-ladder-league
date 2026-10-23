"use client";

import { useEffect, useState } from "react";

type Assignment = {
  level: string;
  customLevel?: string;
  wristband?: string;
  courts: number[];
  stackCourt?: number | null;
};

type ScheduleEvent = {
  start: string;
  end: string;
  type: string;
  customType?: string;
  details?: string;
  assignments: Assignment[];
};

type Schedule = {
  facility: string;
  welcome: string;
  logo_url?: string;
  announcements: string[];
  events: ScheduleEvent[];
};

function formatTime(time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) return time;

  const [hours, minutes] = time.split(":").map(Number);
  const hour = hours % 12 || 12;
  const period = hours >= 12 ? "PM" : "AM";

  return `${hour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function eventName(event: ScheduleEvent) {
  return event.type === "Custom"
    ? event.customType || "Special Event"
    : event.type;
}

function levelName(assignment: Assignment) {
  return assignment.level === "Custom"
    ? assignment.customLevel || "Custom Level"
    : assignment.level;
}

function wristbandColor(color?: string) {
  const colors: Record<string, string> = {
    Red: "#ef4444",
    Orange: "#f97316",
    Yellow: "#facc15",
    Green: "#22c55e",
    Blue: "#3b82f6",
    Purple: "#a855f7",
    Pink: "#ec4899",
    White: "#ffffff",
    Black: "#18181b",
  };

  return colors[color || ""] || "#71717a";
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export default function LobbySchedulePage() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSchedule() {
      try {
        const response = await fetch("/api/facility-schedule", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load schedule");
        }

        const result = await response.json();

        if (active) {
          setSchedule(result.schedule_data);
          setError("");
        }
      } catch {
        if (active) {
          setError("Unable to update schedule. Retrying...");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSchedule();

    const refresh = window.setInterval(loadSchedule, 30000);

    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    setNow(new Date());

    const clock = window.setInterval(() => {
      setNow(new Date());
    }, 15000);

    return () => window.clearInterval(clock);
  }, []);

  // Use Lynnwood local time, even if the TV/browser has a different timezone.
  const currentMinutes = now
    ? (() => {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Los_Angeles",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).formatToParts(now);
        const hour = Number(parts.find((part) => part.type === "hour")?.value);
        const minute = Number(parts.find((part) => part.type === "minute")?.value);
        return hour * 60 + minute;
      })()
    : null;

  // Show an event from 15 minutes before its start until 15 minutes
  // before its end. The clock updates every 15 seconds.
  const sortedEvents = [...(schedule?.events || [])]
    .filter((event) => {
      if (currentMinutes === null) return false;
      const start = timeToMinutes(event.start);
      const end = timeToMinutes(event.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return false;
      }
      return currentMinutes >= start - 15 && currentMinutes < end - 15;
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  // Scale the schedule based on the number of events currently displayed.
  const eventCount = sortedEvents.length;
  const spacious = eventCount === 1;
  const roomy = eventCount === 2;

  const dateText = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(now)
    : "";

  const clockText = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        hour: "numeric",
        minute: "2-digit",
      }).format(now)
    : "";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#081327] text-2xl font-bold text-white">
        Loading today's schedule...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#081327] px-5 py-6 text-white md:px-10">
      <div className="mx-auto max-w-[1800px]">
        <header className="mb-6 grid grid-cols-1 items-center gap-5 border-b border-white/15 pb-5 md:grid-cols-[minmax(0,1fr)_minmax(170px,280px)_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-yellow-400">
              Pickleball Kingdom Lynnwood
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight text-white md:text-6xl">
              Today&apos;s Schedule
            </h1>

            <p className="mt-3 text-xl font-semibold text-blue-200">
              {schedule?.welcome ||
                "WELCOME TO PICKLEBALL KINGDOM LYNNWOOD"}
            </p>
          </div>

          <div className="flex items-center justify-center">
            {schedule?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={schedule.logo_url}
                alt="Pickleball Kingdom Lynnwood"
                className="max-h-28 w-full max-w-[280px] object-contain"
              />
            ) : null}
          </div>

          <div className="text-left md:text-right">
            <p className="text-lg font-bold text-blue-200">
              {dateText}
            </p>

            <p className="mt-1 text-4xl font-black text-yellow-400">
              {clockText}
            </p>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-yellow-200">
            {error}
          </div>
        )}

        {sortedEvents.length === 0 ? (
          <section className="flex min-h-[55vh] flex-col items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-12 text-center">
            {schedule?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={schedule.logo_url}
                alt="Pickleball Kingdom Lynnwood"
                className="mb-10 max-h-[35vh] w-full max-w-[680px] object-contain"
              />
            ) : (
              <h2 className="mb-8 text-3xl font-black text-yellow-400">
                Welcome to Pickleball Kingdom Lynnwood
              </h2>
            )}

            <p className="max-w-4xl text-2xl font-bold leading-relaxed text-blue-100 md:text-4xl">
              Upcoming activities will appear 15 minutes before they begin.
            </p>
          </section>
        ) : (
          <div className={spacious ? "space-y-5" : "space-y-4"}>
            {sortedEvents.map((event, eventIndex) => {
              const start = timeToMinutes(event.start);
              const end = timeToMinutes(event.end);

              const isActive =
                currentMinutes !== null &&
                currentMinutes >= start &&
                currentMinutes < end - 15;

              const isStartingSoon =
                currentMinutes !== null &&
                currentMinutes >= start - 15 &&
                currentMinutes < start;

              return (
                <section
                  key={`${event.start}-${eventIndex}`}
                  className={`overflow-hidden rounded-2xl border ${
                    isActive
                      ? "border-yellow-400 bg-[#15294a]"
                      : "border-white/15 bg-[#101f38]"
                  } ${spacious ? "min-h-[min(58vh,620px)]" : roomy ? "min-h-[260px]" : ""}`}
                >
                  <div className={`flex flex-wrap items-center justify-between gap-3 border-b border-white/10 ${spacious ? "px-7 py-6" : "px-5 py-4"}`}>
                    <div className="flex flex-wrap items-center gap-4">
                      <h2 className={`font-black text-yellow-400 ${spacious ? "text-3xl md:text-5xl" : roomy ? "text-2xl md:text-4xl" : "text-2xl md:text-3xl"}`}>
                        {eventName(event)}
                      </h2>

                      {isStartingSoon && (
                        <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-black">
                          Starting Soon
                        </span>
                      )}
                      {isActive && (
                        <span className="rounded-full bg-green-500 px-3 py-1 text-xs font-black uppercase tracking-wider text-black">
                          Happening Now
                        </span>
                      )}
                    </div>

                    <p className={`font-black text-white ${spacious ? "text-2xl md:text-4xl" : roomy ? "text-xl md:text-3xl" : "text-xl md:text-2xl"}`}>
                      {formatTime(event.start)}
                      {" – "}
                      {formatTime(event.end)}
                    </p>
                  </div>

                  {event.details && (
                    <p className="px-5 pt-3 text-base text-blue-200">
                      {event.details}
                    </p>
                  )}

                  <div className={`grid ${spacious ? "gap-5 p-6" : "gap-3 p-4"} ${(event.assignments || []).length > 1 ? "lg:grid-cols-2" : "grid-cols-1"}`}>
                    {(event.assignments || []).map(
                      (assignment, assignmentIndex) => (
                        <div
                          key={assignmentIndex}
                          className={`rounded-xl border border-white/10 bg-black/20 ${spacious ? "p-6" : "p-4"}`}
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <h3 className={`font-black text-white ${spacious ? "text-2xl md:text-4xl" : roomy ? "text-2xl md:text-3xl" : "text-xl"}`}>
                              {levelName(assignment)}
                            </h3>

                            {assignment.wristband &&
                              assignment.wristband !== "None" && (
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`${spacious ? "h-8 w-8" : "h-6 w-6"} shrink-0 rounded-full border border-white/30`}
                                    style={{
                                      backgroundColor: wristbandColor(
                                        assignment.wristband
                                      ),
                                    }}
                                  />
                                  <span className={`font-black text-blue-100 ${spacious ? "text-xl md:text-3xl" : roomy ? "text-xl md:text-2xl" : "text-xl"}`}>
                                    {assignment.wristband} Wristband
                                  </span>
                                </div>
                              )}
                          </div>

                          <div className={`flex flex-wrap ${spacious ? "gap-3" : "gap-2"}`}>
                            {(assignment.courts || [])
                              .slice()
                              .sort((a, b) => a - b)
                              .map((court) => {
                                const isStack =
                                  assignment.stackCourt === court;

                                return (
                                  <div
                                    key={court}
                                    className={`flex flex-col items-center justify-center rounded-xl border-2 ${spacious ? "min-h-20 min-w-20 px-4 py-3 md:min-h-24 md:min-w-24" : roomy ? "min-h-20 min-w-20 px-3 py-2" : "min-h-16 min-w-16 px-3 py-2"} ${
                                      isStack
                                        ? "border-yellow-400 bg-yellow-400/15"
                                        : "border-blue-400/30 bg-blue-900/40"
                                    }`}
                                  >
                                    <span className={`font-black ${spacious ? "text-3xl md:text-4xl" : roomy ? "text-3xl" : "text-2xl"}`}>
                                      {court}
                                    </span>

                                    {isStack && (
                                      <span className={`font-black uppercase tracking-wide text-yellow-300 ${spacious ? "text-xs md:text-sm" : "text-[10px]"}`}>
                                        Stack
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {schedule?.announcements?.some((item) => item.trim()) && (
          <section className="mt-6 rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-5">
            <h2 className="mb-3 text-xl font-black uppercase tracking-wide text-yellow-400">
              Club Announcements
            </h2>

            <div className="space-y-2">
              {schedule.announcements
                .filter((item) => item.trim())
                .map((announcement, index) => (
                  <p
                    key={index}
                    className="text-lg font-semibold text-white"
                  >
                    {announcement}
                  </p>
                ))}
            </div>
          </section>
        )}

        <footer className="mt-8 border-t border-white/10 pt-4 text-center text-sm font-semibold text-blue-300">
          Court assignments and event information may change.
          Please follow staff instructions.
        </footer>
      </div>
    </main>
  );
}
