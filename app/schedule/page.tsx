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
    Aqua: "#22d3ee",
    Brown: "#92400e",
    Chartreuse: "#a3e635",
    Cranberry: "#be123c",
    Gold: "#eab308",
    Gray: "#9ca3af",
    Lavender: "#c4b5fd",
    "Neon Green": "#39ff14",
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

    const update = () => setNow(new Date());
    const clock = window.setInterval(update, 5000);
    document.addEventListener("visibilitychange", update);

    return () => {
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", update);
    };
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
    <main className="h-screen h-[100dvh] overflow-hidden bg-[#081327] px-4 py-3 text-white md:px-6">
      <div className="mx-auto flex h-full max-w-[1800px] min-h-0 flex-col">
        <header className="mb-2 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-white/15 pb-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.45fr)_minmax(0,0.75fr)] lg:gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-400 sm:text-sm">
              Pickleball Kingdom Lynnwood
            </p>

            <h1 className={`${eventCount > 0 ? "text-2xl lg:text-[clamp(1.6rem,2.3vw,2.8rem)]" : "text-2xl lg:text-[clamp(1.7rem,2.6vw,3.2rem)]"} mt-1 font-black tracking-tight text-white`}>
              Today&apos;s Schedule
            </h1>

            <p className={`${eventCount > 0 ? "mt-1 text-xs lg:text-sm" : "mt-1 text-xs lg:text-sm"} font-semibold text-blue-200`}>
              {schedule?.welcome ||
                "WELCOME TO PICKLEBALL KINGDOM LYNNWOOD"}
            </p>
          </div>

          <div className={`${"hidden lg:flex"} items-center justify-center overflow-hidden`}>
            {schedule?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={schedule.logo_url}
                alt="Pickleball Kingdom Lynnwood"
                className={`${"max-h-16 max-w-[180px]"} w-full object-contain`}
              />
            ) : null}
          </div>

          <div className="text-right">
            <p className={`${"text-xs lg:text-base"} whitespace-nowrap font-bold text-blue-200`}>
              {dateText}
            </p>

            <p className={`${"text-xl lg:text-3xl"} mt-1 whitespace-nowrap font-black text-yellow-400`}>
              {clockText}
            </p>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-yellow-200">
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {sortedEvents.length === 0 ? (
          <section className="flex min-h-[min(58dvh,600px)] flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-center">
            {schedule?.logo_url ? (
              <div className="flex h-[min(31dvh,300px)] w-full items-center justify-center">
                {/* The uploaded PNG has generous transparent margins. Scaling the
                    image enlarges the visible artwork without making the panel
                    or the message extend beyond the TV viewport. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={schedule.logo_url}
                  alt="Pickleball Kingdom Lynnwood"
                  className="h-full w-full max-w-[850px] object-contain"
                />
              </div>
            ) : (
              <h2 className="text-3xl font-black text-yellow-400">
                Welcome to Pickleball Kingdom Lynnwood
              </h2>
            )}

            <p className="max-w-6xl text-xl font-bold leading-snug text-blue-100 lg:text-[clamp(1.3rem,2vw,2rem)]">
              Upcoming activities will appear 15 minutes before they begin.
            </p>
          </section>
        ) : (
          <div className="space-y-2">
            {sortedEvents.map((event, eventIndex) => {
              const start = timeToMinutes(event.start);
              const end = timeToMinutes(event.end);
              const isActive = currentMinutes !== null && currentMinutes >= start && currentMinutes < end - 15;
              const isStartingSoon = currentMinutes !== null && currentMinutes >= start - 15 && currentMinutes < start;
              const assignments = event.assignments || [];

              return (
                <section
                  key={`${event.start}-${eventIndex}`}
                  className={`overflow-hidden rounded-2xl border ${isActive ? "border-blue-400/70 bg-[#0c2b57]" : "border-blue-500/35 bg-[#0b2448]"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 border-b border-blue-300/20 px-5 py-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-black tracking-tight text-yellow-400 lg:text-[clamp(1.6rem,2.5vw,3rem)]">
                        {eventName(event)}
                      </h2>
                      {isStartingSoon && (
                        <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-black uppercase text-black">Starting Soon</span>
                      )}
                      {isActive && (
                        <span className="rounded-full bg-green-400 px-3 py-1 text-xs font-black uppercase text-black">Happening Now</span>
                      )}
                    </div>
                    <p className="whitespace-nowrap text-lg font-extrabold text-blue-100 lg:text-2xl">
                      {formatTime(event.start)} - {formatTime(event.end)}
                    </p>
                  </div>

                  {event.details && (
                    <p className="px-5 pt-2 text-base font-medium text-blue-200">{event.details}</p>
                  )}

                  <div className="divide-y divide-blue-300/20">
                    {assignments.map((assignment, assignmentIndex) => (
                      <div
                        key={assignmentIndex}
                        className="grid grid-cols-[minmax(0,30%)_minmax(0,43%)_minmax(0,27%)] items-center gap-2 px-4 py-2 sm:gap-3 sm:px-5"
                      >
                        <h3 className="text-[clamp(17px,2vw,28px)] font-black leading-tight text-white">
                          {levelName(assignment)}
                        </h3>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {(assignment.courts || []).slice().sort((a, b) => a - b).map((court) => {
                            const isStack = assignment.stackCourt === court;
                            return (
                              <div
                                key={court}
                                className={`flex h-[clamp(46px,5vw,76px)] w-[clamp(46px,5vw,76px)] flex-col items-center justify-center rounded-xl border-2 px-1 py-1 ${isStack ? "border-yellow-400 bg-yellow-400/15" : "border-blue-400 bg-blue-500/20"}`}
                              >
                                <span className="text-[clamp(22px,3vw,38px)] font-black leading-none text-white">{court}</span>
                                <span className={`mt-1 text-[10px] font-black uppercase tracking-wide ${isStack ? "text-yellow-300" : "text-blue-100"}`}>
                                  {isStack ? "Stack" : "Court"}
                                </span>
                              </div>
                            );
                          })}
                          {(assignment.courts || []).length === 0 && (
                            <span className="text-base font-semibold text-yellow-200">Courts not assigned</span>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          {assignment.wristband && assignment.wristband !== "None" ? (
                            <>
                              <span
                                className="h-[clamp(25px,3.3vw,44px)] w-[clamp(25px,3.3vw,44px)] shrink-0 rounded-full border-2 border-white/40"
                                style={{ backgroundColor: wristbandColor(assignment.wristband) }}
                              />
                              <span className="text-[clamp(14px,1.7vw,23px)] font-black leading-tight text-white">
                                {assignment.wristband} Wristband
                              </span>
                            </>
                          ) : (
                            <span className="text-base font-semibold text-blue-200">No wristband</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {schedule?.announcements?.some((item) => item.trim()) && (
          <section className="mt-2 rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-3">
            <h2 className="mb-1 text-base font-black uppercase tracking-wide text-yellow-400">
              Club Announcements
            </h2>

            <div className="space-y-2">
              {schedule.announcements
                .filter((item) => item.trim())
                .map((announcement, index) => (
                  <p
                    key={index}
                    className="text-sm font-semibold text-white"
                  >
                    {announcement}
                  </p>
                ))}
            </div>
          </section>
        )}

        </div>

        <footer className="mt-2 shrink-0 border-t border-white/10 pt-2 text-center text-xs font-semibold text-blue-300">
          Court assignments and event information may change.
          Please follow staff instructions.
        </footer>
      </div>
    </main>
  );
}
