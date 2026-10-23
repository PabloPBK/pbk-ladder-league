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

  const currentMinutes = now
    ? now.getHours() * 60 + now.getMinutes()
    : null;

  const sortedEvents = [...(schedule?.events || [])].sort(
    (a, b) => a.start.localeCompare(b.start)
  );

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
        <header className="mb-6 flex flex-wrap items-center justify-between gap-5 border-b border-white/15 pb-5">
          <div>
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
          <section className="rounded-2xl border border-white/15 bg-white/5 px-8 py-20 text-center">
            <h2 className="text-3xl font-black text-yellow-400">
              No Events Scheduled
            </h2>

            <p className="mt-4 text-xl text-blue-200">
              Check with our front desk for today&apos;s activities.
            </p>
          </section>
        ) : (
          <div className="space-y-4">
            {sortedEvents.map((event, eventIndex) => {
              const start = timeToMinutes(event.start);
              const end = timeToMinutes(event.end);

              const isActive =
                currentMinutes !== null &&
                currentMinutes >= start &&
                currentMinutes < end;

              const isPast =
                currentMinutes !== null &&
                currentMinutes >= end;

              return (
                <section
                  key={`${event.start}-${eventIndex}`}
                  className={`overflow-hidden rounded-2xl border ${
                    isActive
                      ? "border-yellow-400 bg-[#15294a]"
                      : "border-white/15 bg-[#101f38]"
                  } ${isPast ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <h2 className="text-2xl font-black text-yellow-400 md:text-3xl">
                        {eventName(event)}
                      </h2>

                      {isActive && (
                        <span className="rounded-full bg-green-500 px-3 py-1 text-xs font-black uppercase tracking-wider text-black">
                          Happening Now
                        </span>
                      )}
                    </div>

                    <p className="text-xl font-black text-white md:text-2xl">
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

                  <div className="grid gap-3 p-4 lg:grid-cols-2">
                    {(event.assignments || []).map(
                      (assignment, assignmentIndex) => (
                        <div
                          key={assignmentIndex}
                          className="rounded-xl border border-white/10 bg-black/20 p-4"
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-xl font-black text-white">
                              {levelName(assignment)}
                            </h3>

                            {assignment.wristband &&
                              assignment.wristband !== "None" && (
                                <div className="flex items-center gap-2">
                                  <span
                                    className="h-5 w-5 rounded-full border border-white/30"
                                    style={{
                                      backgroundColor: wristbandColor(
                                        assignment.wristband
                                      ),
                                    }}
                                  />
<span className="text-xl font-black text-blue-100">
  {assignment.wristband} Wristband
                                  </span>
                                </div>
                              )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {(assignment.courts || [])
                              .slice()
                              .sort((a, b) => a - b)
                              .map((court) => {
                                const isStack =
                                  assignment.stackCourt === court;

                                return (
                                  <div
                                    key={court}
                                    className={`flex min-h-16 min-w-16 flex-col items-center justify-center rounded-xl border-2 px-3 py-2 ${
                                      isStack
                                        ? "border-yellow-400 bg-yellow-400/15"
                                        : "border-blue-400/30 bg-blue-900/40"
                                    }`}
                                  >
                                    <span className="text-2xl font-black">
                                      {court}
                                    </span>

                                    {isStack && (
                                      <span className="text-[10px] font-black uppercase tracking-wide text-yellow-300">
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
