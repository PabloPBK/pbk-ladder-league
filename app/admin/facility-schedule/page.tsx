"use client";

import { useEffect, useState } from "react";

type Assignment = {
  level: string;
  customLevel: string;
  wristband: string;
  courts: number[];
  stackCourt: number | null;
};

type ScheduleEvent = {
  start: string;
  end: string;
  type: string;
  customType: string;
  details: string;
  assignments: Assignment[];
};

type Schedule = {
  facility: string;
  welcome: string;
  announcements: string[];
  events: ScheduleEvent[];
  [key: string]: unknown;
};

const EVENT_TYPES = [
  "Open Play",
  "Skills and Drills",
  "3 and Me",
  "Coach's Corner",
  "Seasoned and Smashing",
  "Wise Guys",
  "DUPR $$$ Round Robin",
  "Custom",
];

const LEVELS = [
  "ALL LEVELS SOCIAL",
  "ALL LEVELS COMPETITIVE",
  "3.0 TO 3.5",
  "3.25 TO 3.75",
  "3.5 TO 4.0",
  "3.75+",
  "4.0+",
  "Custom",
];

const WRISTBANDS = [
  "None",
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Pink",
  "White",
  "Black",
];

const COURTS = Array.from(
  { length: 12 },
  (_, index) => index + 1
);

const inputStyle =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-yellow-400";

const secondaryButton =
  "rounded-lg border border-zinc-700 px-4 py-2 font-semibold text-zinc-200 hover:bg-zinc-800";

function newAssignment(): Assignment {
  return {
    level: "ALL LEVELS SOCIAL",
    customLevel: "",
    wristband: "None",
    courts: [],
    stackCourt: null,
  };
}

function newEvent(): ScheduleEvent {
  return {
    start: "09:00",
    end: "10:30",
    type: "Open Play",
    customType: "",
    details: "",
    assignments: [newAssignment()],
  };
}

function eventName(event: ScheduleEvent) {
  return event.type === "Custom"
    ? event.customType.trim() || "Custom Event"
    : event.type;
}

function validateSchedule(schedule: Schedule): string | null {
  for (let i = 0; i < schedule.events.length; i++) {
    const event = schedule.events[i];

    if (!event.start || !event.end || event.end <= event.start) {
      return `Event ${i + 1}: End time must be after start time.`;
    }

    if (event.type === "Custom" && !event.customType.trim()) {
      return `Event ${i + 1}: Enter a custom event name.`;
    }

    if (!event.assignments.length) {
      return `Event ${i + 1}: Add at least one court assignment.`;
    }

    for (let j = 0; j < event.assignments.length; j++) {
      const assignment = event.assignments[j];

      if (!assignment.courts.length) {
        return `Event ${i + 1}, group ${j + 1}: Select at least one court.`;
      }

      if (
        assignment.level === "Custom" &&
        !assignment.customLevel.trim()
      ) {
        return `Event ${i + 1}, group ${j + 1}: Enter a custom level.`;
      }

      if (
        assignment.stackCourt !== null &&
        !assignment.courts.includes(assignment.stackCourt)
      ) {
        return `Event ${i + 1}, group ${j + 1}: Paddle stack court must be assigned to the group.`;
      }
    }
  }

  for (let i = 0; i < schedule.events.length; i++) {
    const first = schedule.events[i];

    for (let j = i + 1; j < schedule.events.length; j++) {
      const second = schedule.events[j];

      if (
        first.start >= second.end ||
        second.start >= first.end
      ) {
        continue;
      }

      const firstCourts = first.assignments.flatMap(
        (assignment) => assignment.courts
      );

      const secondCourts = second.assignments.flatMap(
        (assignment) => assignment.courts
      );

      const overlap = firstCourts.find((court) =>
        secondCourts.includes(court)
      );

      if (overlap !== undefined) {
        return `Court ${overlap} is assigned to overlapping events ${i + 1} and ${j + 1}.`;
      }
    }

    const usedCourts = new Set<number>();

    for (const assignment of first.assignments) {
      for (const court of assignment.courts) {
        if (usedCourts.has(court)) {
          return `Event ${i + 1}: Court ${court} is assigned to multiple groups.`;
        }
        usedCourts.add(court);
      }
    }
  }

  return null;
}

export default function FacilitySchedulePage() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [openEvents, setOpenEvents] = useState<number[]>([]);

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
        const data = result.schedule_data as Schedule;

        setSchedule({
          ...data,
          announcements: Array.isArray(data.announcements)
            ? data.announcements
            : [],
          events: Array.isArray(data.events)
            ? data.events
            : [],
        });
      } catch (error) {
        setErrorMessage(
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

  function updateSchedule(next: Schedule) {
    setSchedule(next);
    setDirty(true);
    setMessage("");
    setErrorMessage("");
  }

  function updateEvent(
    eventIndex: number,
    nextEvent: ScheduleEvent
  ) {
    if (!schedule) return;

    const events = [...schedule.events];
    events[eventIndex] = nextEvent;

    updateSchedule({ ...schedule, events });
  }

  function updateAssignment(
    eventIndex: number,
    assignmentIndex: number,
    nextAssignment: Assignment
  ) {
    if (!schedule) return;

    const event = schedule.events[eventIndex];
    const assignments = [...event.assignments];

    assignments[assignmentIndex] = nextAssignment;

    updateEvent(eventIndex, {
      ...event,
      assignments,
    });
  }

  function addEvent() {
    if (!schedule) return;

    const index = schedule.events.length;

    updateSchedule({
      ...schedule,
      events: [...schedule.events, newEvent()],
    });

    setOpenEvents((previous) => [...previous, index]);
  }

  function duplicateEvent(index: number) {
    if (!schedule) return;

    const copy = JSON.parse(
      JSON.stringify(schedule.events[index])
    ) as ScheduleEvent;

    updateSchedule({
      ...schedule,
      events: [
        ...schedule.events.slice(0, index + 1),
        copy,
        ...schedule.events.slice(index + 1),
      ],
    });

    setOpenEvents(schedule.events.map((_, i) => i).concat(index + 1));
  }

  function deleteEvent(index: number) {
    if (!schedule) return;

    if (!window.confirm("Delete this scheduled event?")) {
      return;
    }

    updateSchedule({
      ...schedule,
      events: schedule.events.filter((_, i) => i !== index),
    });

    setOpenEvents([]);
  }

  function toggleEvent(index: number) {
    setOpenEvents((previous) =>
      previous.includes(index)
        ? previous.filter((value) => value !== index)
        : [...previous, index]
    );
  }

  function toggleCourt(
    eventIndex: number,
    assignmentIndex: number,
    court: number
  ) {
    if (!schedule) return;

    const assignment =
      schedule.events[eventIndex].assignments[assignmentIndex];

    const courts = assignment.courts.includes(court)
      ? assignment.courts.filter((value) => value !== court)
      : [...assignment.courts, court].sort((a, b) => a - b);

    updateAssignment(eventIndex, assignmentIndex, {
      ...assignment,
      courts,
      stackCourt:
        assignment.stackCourt !== null &&
        !courts.includes(assignment.stackCourt)
          ? null
          : assignment.stackCourt,
    });
  }

  async function saveSchedule() {
    if (!schedule) return;

    const validationError = validateSchedule(schedule);

    if (validationError) {
      setErrorMessage(validationError);
      setMessage("");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setMessage("");

    try {
      const sortedEvents = [...schedule.events].sort(
        (a, b) => a.start.localeCompare(b.start)
      );

      const nextSchedule = {
        ...schedule,
        events: sortedEvents,
      };

      const response = await fetch("/api/facility-schedule", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schedule_data: nextSchedule,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to save schedule"
        );
      }

      setSchedule(nextSchedule);
      setDirty(false);
      setOpenEvents([]);
      setMessage("Schedule published successfully.");
    } catch (error) {
      setErrorMessage(
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
        {errorMessage || "Schedule unavailable"}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="text-3xl font-black text-yellow-400">
            Daily Operations Schedule
          </h1>
          <p className="mt-2 text-zinc-400">
            Pickleball Kingdom Lynnwood · 12 Courts
          </p>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-5 text-xl font-bold">
            Welcome & Announcements
          </h2>

          <label className="block text-sm font-semibold">
            Welcome Message
          </label>
          <input
            value={schedule.welcome}
            onChange={(event) =>
              updateSchedule({
                ...schedule,
                welcome: event.target.value,
              })
            }
            className={`${inputStyle} mt-2`}
          />

          <label className="mt-6 block text-sm font-semibold">
            Announcements (one per line)
          </label>
          <textarea
            value={schedule.announcements.join("\n")}
            onChange={(event) =>
              updateSchedule({
                ...schedule,
                announcements: event.target.value.split("\n"),
              })
            }
            rows={3}
            className={`${inputStyle} mt-2`}
          />
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Scheduled Events
              </h2>
              <p className="text-sm text-zinc-400">
                {schedule.events.length} events scheduled
              </p>
            </div>

            <button
              type="button"
              onClick={addEvent}
              className="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500"
            >
              + Add Event
            </button>
          </div>

          {schedule.events.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900 p-10 text-center text-zinc-400">
              No events yet. Select Add Event to begin.
            </div>
          )}

          {schedule.events.map((event, eventIndex) => {
            const isOpen = openEvents.includes(eventIndex);

            return (
              <article
                key={eventIndex}
                className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <button
                    type="button"
                    onClick={() => toggleEvent(eventIndex)}
                    className="text-left"
                  >
                    <div className="font-bold text-yellow-400">
                      {eventName(event)}
                    </div>
                    <div className="mt-1 text-sm text-zinc-400">
                      {event.start}–{event.end} ·{" "}
                      {event.assignments
                        .flatMap((assignment) => assignment.courts)
                        .length}{" "}
                      courts assigned
                    </div>
                  </button>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleEvent(eventIndex)}
                      className={secondaryButton}
                    >
                      {isOpen ? "Collapse" : "Edit"}
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateEvent(eventIndex)}
                      className={secondaryButton}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteEvent(eventIndex)}
                      className="rounded-lg border border-red-900 px-4 py-2 font-semibold text-red-300 hover:bg-red-950"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="space-y-6 border-t border-zinc-800 p-5">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <label className="text-sm font-semibold">
                        Start Time
                        <input
                          type="time"
                          value={event.start}
                          onChange={(e) =>
                            updateEvent(eventIndex, {
                              ...event,
                              start: e.target.value,
                            })
                          }
                          className={`${inputStyle} mt-2`}
                        />
                      </label>

                      <label className="text-sm font-semibold">
                        End Time
                        <input
                          type="time"
                          value={event.end}
                          onChange={(e) =>
                            updateEvent(eventIndex, {
                              ...event,
                              end: e.target.value,
                            })
                          }
                          className={`${inputStyle} mt-2`}
                        />
                      </label>

                      <label className="text-sm font-semibold">
                        Event Type
                        <select
                          value={event.type}
                          onChange={(e) =>
                            updateEvent(eventIndex, {
                              ...event,
                              type: e.target.value,
                            })
                          }
                          className={`${inputStyle} mt-2`}
                        >
                          {EVENT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>

                      {event.type === "Custom" && (
                        <label className="text-sm font-semibold">
                          Custom Event Name
                          <input
                            value={event.customType}
                            onChange={(e) =>
                              updateEvent(eventIndex, {
                                ...event,
                                customType: e.target.value,
                              })
                            }
                            className={`${inputStyle} mt-2`}
                          />
                        </label>
                      )}
                    </div>

                    <label className="block text-sm font-semibold">
                      Event Details
                      <textarea
                        value={event.details}
                        onChange={(e) =>
                          updateEvent(eventIndex, {
                            ...event,
                            details: e.target.value,
                          })
                        }
                        rows={2}
                        className={`${inputStyle} mt-2`}
                        placeholder="Optional description or staff instructions"
                      />
                    </label>

                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-bold">
                          Court Assignments
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            updateEvent(eventIndex, {
                              ...event,
                              assignments: [
                                ...event.assignments,
                                newAssignment(),
                              ],
                            })
                          }
                          className={secondaryButton}
                        >
                          + Add Group
                        </button>
                      </div>

                      {event.assignments.map(
                        (assignment, assignmentIndex) => (
                          <div
                            key={assignmentIndex}
                            className="space-y-5 rounded-xl border border-zinc-700 bg-zinc-950 p-5"
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold">
                                Group {assignmentIndex + 1}
                              </h4>
                              <button
                                type="button"
                                onClick={() =>
                                  updateEvent(eventIndex, {
                                    ...event,
                                    assignments:
                                      event.assignments.filter(
                                        (_, i) => i !== assignmentIndex
                                      ),
                                  })
                                }
                                className="text-sm font-semibold text-red-300 hover:text-red-200"
                              >
                                Remove Group
                              </button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                              <label className="text-sm font-semibold">
                                Skill Level
                                <select
                                  value={assignment.level}
                                  onChange={(e) =>
                                    updateAssignment(
                                      eventIndex,
                                      assignmentIndex,
                                      {
                                        ...assignment,
                                        level: e.target.value,
                                      }
                                    )
                                  }
                                  className={`${inputStyle} mt-2`}
                                >
                                  {LEVELS.map((level) => (
                                    <option key={level} value={level}>
                                      {level}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              {assignment.level === "Custom" && (
                                <label className="text-sm font-semibold">
                                  Custom Level
                                  <input
                                    value={assignment.customLevel}
                                    onChange={(e) =>
                                      updateAssignment(
                                        eventIndex,
                                        assignmentIndex,
                                        {
                                          ...assignment,
                                          customLevel: e.target.value,
                                        }
                                      )
                                    }
                                    className={`${inputStyle} mt-2`}
                                  />
                                </label>
                              )}

                              <label className="text-sm font-semibold">
                                Wristband Color
                                <select
                                  value={assignment.wristband}
                                  onChange={(e) =>
                                    updateAssignment(
                                      eventIndex,
                                      assignmentIndex,
                                      {
                                        ...assignment,
                                        wristband: e.target.value,
                                      }
                                    )
                                  }
                                  className={`${inputStyle} mt-2`}
                                >
                                  {WRISTBANDS.map((color) => (
                                    <option key={color} value={color}>
                                      {color}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div>
                              <p className="mb-3 text-sm font-semibold">
                                Select Courts
                              </p>
                              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
                                {COURTS.map((court) => {
                                  const selected =
                                    assignment.courts.includes(court);

                                  return (
                                    <button
                                      key={court}
                                      type="button"
                                      onClick={() =>
                                        toggleCourt(
                                          eventIndex,
                                          assignmentIndex,
                                          court
                                        )
                                      }
                                      className={`rounded-lg border px-2 py-3 text-sm font-bold ${
                                        selected
                                          ? "border-yellow-400 bg-yellow-400 text-black"
                                          : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-yellow-400"
                                      }`}
                                    >
                                      {court}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <label className="block max-w-sm text-sm font-semibold">
                              Paddle Stack Court
                              <select
                                value={assignment.stackCourt ?? ""}
                                onChange={(e) =>
                                  updateAssignment(
                                    eventIndex,
                                    assignmentIndex,
                                    {
                                      ...assignment,
                                      stackCourt: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                    }
                                  )
                                }
                                className={`${inputStyle} mt-2`}
                              >
                                <option value="">No paddle stack</option>
                                {assignment.courts.map((court) => (
                                  <option key={court} value={court}>
                                    Court {court}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        {errorMessage && (
          <div className="rounded-lg border border-red-700 bg-red-950 p-4 text-red-200">
            {errorMessage}
          </div>
        )}

        {message && (
          <div className="rounded-lg border border-green-700 bg-green-950 p-4 text-green-200">
            {message}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 border-t border-zinc-800 py-6">
          <button
            type="button"
            onClick={saveSchedule}
            disabled={saving}
            className="rounded-lg bg-yellow-400 px-7 py-3 font-black text-black hover:bg-yellow-300 disabled:opacity-50"
          >
            {saving ? "Publishing..." : "Save & Publish"}
          </button>

          {dirty && (
            <span className="text-sm text-yellow-400">
              You have unpublished changes.
            </span>
          )}
        </div>
      </div>
    </main>
  );
}
