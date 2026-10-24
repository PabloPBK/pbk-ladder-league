"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getActiveLeagueEvent, type LeagueEventRecord } from "@/lib/data/events";
import { getEventRound } from "@/lib/data/currentRound";

type WristbandColor = {
  id: number;
  name: string;
  hex_color: string;
  is_active: boolean;
};

type Assignment = {
  level: string;
  customLevel: string;
  wristband: string;
  courts: number[];
  stackCourt: number | null;
};

type LeagueCourtSnapshot = {
  leagueCourt: number;
  facilityCourt: number;
  players: string[];
};

type LeagueSnapshot = {
  eventId: string;
  eventName: string;
  importedAt: string;
  courts: LeagueCourtSnapshot[];
};

type ScheduleEvent = {
  leagueSnapshot?: LeagueSnapshot;
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
  logo_url?: string;
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
  "League",
  "Custom",
];

const OPEN_PLAY_LEVELS = [
  "Beginner/PB101+",
  "Intermediate",
  "Competitive",
  "All Levels Open Play",
  "3.0 to 3.5",
  "3.5 to 4.0",
  "3.75+",
  "4.0+",
  "4.25+",
];

const LEVELS = [
  ...OPEN_PLAY_LEVELS,
  "Custom",
];

function levelKey(assignment: Assignment): string {
  return (assignment.level === "Custom"
    ? assignment.customLevel
    : assignment.level).trim().toLowerCase();
}

const COURTS = Array.from(
  { length: 12 },
  (_, index) => index + 1
);

const inputStyle =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-yellow-400";

const secondaryButton =
  "rounded-lg border border-zinc-700 px-4 py-2 font-semibold text-zinc-200 hover:bg-zinc-800";

function newAssignment(level = OPEN_PLAY_LEVELS[0]): Assignment {
  return {
    level,
    customLevel: "",
    wristband: "None",
    courts: [],
    stackCourt: null,
  };
}

function newEvent(type = "Open Play", groupCount = 1): ScheduleEvent {
  return {
    start: "09:00",
    end: "10:30",
    type,
    customType: "",
    details: "",
    assignments: Array.from({ length: groupCount }, (_, index) =>
      newAssignment(type === "Open Play" ? OPEN_PLAY_LEVELS[index] ?? "Custom" : OPEN_PLAY_LEVELS[0])
    ),
  };
}

function eventName(event: ScheduleEvent) {
  return event.type === "Custom"
    ? event.customType.trim() || "Custom Event"
    : event.type;
}

function selectedCourts(event: ScheduleEvent): number[] {
  return [...new Set(event.assignments.flatMap((a) => a.courts))].sort((a, b) => a - b);
}

function leagueSnapshotError(event: ScheduleEvent): string | null {
  if (event.type !== "League" || !event.leagueSnapshot) return null;
  const selected = selectedCourts(event);
  const imported = event.leagueSnapshot.courts;
  if (selected.length !== imported.length) {
    return "The number of selected facility courts no longer matches the imported league courts. Update the mapping or import again.";
  }
  const mapped = imported.map((court) => court.facilityCourt);
  if (new Set(mapped).size !== mapped.length || mapped.some((court) => !selected.includes(court))) {
    return "Each imported league court must map to one distinct selected facility court.";
  }
  if (imported.some((court) => court.players.length !== 4 || court.players.some((name) => !name.trim()))) {
    return "Each imported league court must have four named players.";
  }
  return null;
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

    const leagueError = leagueSnapshotError(event);
    if (leagueError) return `Event ${i + 1}: ${leagueError}`;

    if (!event.assignments.length) {
      return `Event ${i + 1}: Add at least one court assignment.`;
    }

    if (event.type === "Open Play") {
      const seenLevels = new Set<string>();
      for (const assignment of event.assignments) {
        const key = levelKey(assignment);
        if (!key) continue;
        if (seenLevels.has(key)) {
          return `Event ${i + 1}: Each Open Play level can appear only once in the same timed session (${assignment.level === "Custom" ? assignment.customLevel : assignment.level}).`;
        }
        seenLevels.add(key);
      }
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

      if (assignment.wristband !== "None" && event.assignments.some(
        (other, otherIndex) => otherIndex !== j &&
          other.wristband.toLowerCase() === assignment.wristband.toLowerCase()
      )) {
        return `Event ${i + 1}: Wristband ${assignment.wristband} is assigned to multiple groups.`;
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
  const [wristbandColors, setWristbandColors] = useState<WristbandColor[]>([]);
  const [colorsError, setColorsError] = useState("");
  const [showEventSetup, setShowEventSetup] = useState(false);
  const [newEventType, setNewEventType] = useState("Open Play");
  const [newCustomEventName, setNewCustomEventName] = useState("");
  const [newEventGroups, setNewEventGroups] = useState(1);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoMessage, setLogoMessage] = useState("");
  const [logoError, setLogoError] = useState("");
  const [activeLeague, setActiveLeague] = useState<LeagueEventRecord | null>(null);
  const [leagueLoading, setLeagueLoading] = useState(false);
  const [leagueImporting, setLeagueImporting] = useState<number | null>(null);
  const [leagueMessage, setLeagueMessage] = useState("");

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

    async function loadWristbandColors() {
      try {
        const response = await fetch("/api/facility-wristband-colors", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Unable to load wristband colors");
        const result: { colors?: WristbandColor[] } = await response.json();
        if (!Array.isArray(result.colors)) throw new Error("Invalid wristband color list");
        setWristbandColors(result.colors);
      } catch (error) {
        setColorsError(error instanceof Error ? error.message : "Unable to load wristband colors");
      }
    }

    void loadWristbandColors();
  }, []);

  async function refreshActiveLeague() {
    setLeagueLoading(true);
    setLeagueMessage("");
    try {
      const active = await getActiveLeagueEvent();
      setActiveLeague(active);
      if (!active) setLeagueMessage("No active league session found. Start or resume the league in League Manager first.");
    } catch (error) {
      setActiveLeague(null);
      setLeagueMessage(error instanceof Error ? error.message : "Unable to find active league session.");
    } finally {
      setLeagueLoading(false);
    }
  }

  async function importLeagueRoundOne(eventIndex: number) {
    if (!schedule || !activeLeague || leagueImporting !== null) return;
    const event = schedule.events[eventIndex];
    const physicalCourts = selectedCourts(event);
    if (physicalCourts.length < 2 || physicalCourts.length > 12) {
      setLeagueMessage("Select between 2 and 12 facility courts before importing.");
      return;
    }
    if (schedule.schedule_date && activeLeague.event_date !== schedule.schedule_date) {
      setLeagueMessage(`The active league is dated ${activeLeague.event_date}, but this schedule is for ${schedule.schedule_date}.`);
      return;
    }
    setLeagueImporting(eventIndex);
    setLeagueMessage("");
    try {
      const round = await getEventRound(activeLeague.id, 1);
      if (round.round.round_number !== 1) throw new Error("The response was not Round 1.");
      const leagueCourts = [...round.courts].sort((a, b) => a.courtNumber - b.courtNumber);
      if (leagueCourts.length !== physicalCourts.length) {
        throw new Error(`Round 1 has ${leagueCourts.length} courts, but this event reserves ${physicalCourts.length}. Select matching facility courts before importing.`);
      }
      if (leagueCourts.some((court) => court.players.length !== 4)) {
        throw new Error("Every starting court must contain four players.");
      }
      const snapshot: LeagueSnapshot = {
        eventId: activeLeague.id,
        eventName: activeLeague.name,
        importedAt: new Date().toISOString(),
        courts: leagueCourts.map((court, index) => ({
          leagueCourt: court.courtNumber,
          facilityCourt: physicalCourts[index],
          players: [...court.players]
            .sort((a, b) => a.slotNumber - b.slotNumber)
            .map((player) => player.name),
        })),
      };
      updateEvent(eventIndex, { ...event, leagueSnapshot: snapshot });
      setLeagueMessage(`Imported ${snapshot.courts.length} starting courts from ${activeLeague.name}. Review the mapping, then Save & Publish.`);
    } catch (error) {
      setLeagueMessage(error instanceof Error ? error.message : "Unable to import starting courts.");
    } finally {
      setLeagueImporting(null);
    }
  }

  function updateLeagueCourtMapping(eventIndex: number, leagueCourt: number, facilityCourt: number) {
    if (!schedule) return;
    const event = schedule.events[eventIndex];
    if (!event.leagueSnapshot) return;
    const courts = event.leagueSnapshot.courts.map((court) =>
      court.leagueCourt === leagueCourt ? { ...court, facilityCourt } : court
    );
    updateEvent(eventIndex, {
      ...event,
      leagueSnapshot: { ...event.leagueSnapshot, courts },
    });
  }

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

    if (newEventType === "Custom" && !newCustomEventName.trim()) {
      setErrorMessage("Enter an event name before creating a custom event.");
      return;
    }

    const index = schedule.events.length;
    const groupCount = newEventType === "Open Play" ? newEventGroups : 1;

    const event = newEvent(newEventType, groupCount);
    if (newEventType === "Custom") {
      event.customType = newCustomEventName.trim();
    }

    updateSchedule({
      ...schedule,
      events: [...schedule.events, event],
    });

    setOpenEvents((previous) => [...previous, index]);
    setShowEventSetup(false);
    setNewEventType("Open Play");
    setNewCustomEventName("");
    setNewEventGroups(1);
  }

  function duplicateEvent(index: number) {
    if (!schedule) return;

    const copy = JSON.parse(
      JSON.stringify(schedule.events[index])
    ) as ScheduleEvent;
    // Never duplicate a published player roster into another event.
    delete copy.leagueSnapshot;

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

    if (schedule.events[eventIndex].assignments.some(
      (other, index) => index !== assignmentIndex && other.courts.includes(court)
    )) return;

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

  async function uploadLogo(file: File | undefined) {
    if (!file || !schedule) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      setLogoError("Choose a PNG, JPG, or WebP image smaller than 5 MB.");
      setLogoMessage("");
      return;
    }

    setUploadingLogo(true);
    setLogoError("");
    setLogoMessage("");

    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/facility-branding", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok || typeof result.logo_url !== "string") {
        throw new Error(result.error || "Logo upload failed");
      }
      updateSchedule({ ...schedule, logo_url: result.logo_url });
      setLogoMessage("Logo uploaded. Click Save & Publish to activate it on the TV.");
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : "Logo upload failed");
    } finally {
      setUploadingLogo(false);
    }
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
          <Link href="/admin/facility-schedule/colors" className="mt-3 inline-block text-sm font-semibold text-blue-400 hover:text-blue-300">
            Manage Wristband Colors →
          </Link>
          {colorsError && <p className="mt-2 text-sm text-red-300">{colorsError}. Existing assignments remain unchanged; reload to retry.</p>}
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

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-bold text-yellow-400">Branding &amp; Logos</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Upload a transparent Canva PNG (or JPG/WebP). The same logo will be used
            in the schedule header and the larger welcome display when no events are visible.
          </p>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="facility-logo-upload" className="block text-sm font-semibold">
                Upload facility logo (maximum 5 MB)
              </label>
              <input
                id="facility-logo-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploadingLogo}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  void uploadLogo(file);
                  event.currentTarget.value = "";
                }}
                className="mt-3 block w-full text-sm text-zinc-200 file:mr-4 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-4 file:py-2 file:font-bold file:text-black hover:file:bg-yellow-300 disabled:opacity-50"
              />
              {uploadingLogo && <p className="mt-3 text-sm text-blue-300">Uploading logo...</p>}
              {logoMessage && <p className="mt-3 text-sm text-green-300">{logoMessage}</p>}
              {logoError && <p className="mt-3 text-sm text-red-300">{logoError}</p>}
              {schedule.logo_url && (
                <button
                  type="button"
                  onClick={() => {
                    updateSchedule({ ...schedule, logo_url: "" });
                    setLogoMessage("Logo cleared. Click Save & Publish to update the TV.");
                    setLogoError("");
                  }}
                  className="mt-4 rounded-lg border border-red-800 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950"
                >
                  Remove logo from schedule
                </button>
              )}
              <p className="mt-4 text-xs text-zinc-500">
                Uploading stores the image; Save &amp; Publish selects it for your schedule.
                The TV display will be updated in the next step.
              </p>
            </div>
            <div className="flex min-h-48 items-center justify-center rounded-xl border border-zinc-700 bg-[#081327] p-5">
              {schedule.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={schedule.logo_url}
                  alt="Facility logo preview"
                  className="max-h-48 max-w-full object-contain"
                />
              ) : (
                <p className="text-center text-sm text-zinc-400">No logo selected yet</p>
              )}
            </div>
          </div>
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
              onClick={() => setShowEventSetup((previous) => !previous)}
              className="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500"
            >
              {showEventSetup ? "Cancel New Event" : "+ Add Event"}
            </button>
          </div>

          {showEventSetup && (
            <div className="space-y-4 rounded-xl border border-blue-700 bg-zinc-900 p-6">
              <h3 className="text-xl font-bold text-yellow-400">Create a New Event</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold">
                  Event Type
                  <select
                    value={newEventType}
                    onChange={(e) => {
                      setNewEventType(e.target.value);
                      setNewCustomEventName("");
                      setNewEventGroups(1);
                    }}
                    className={`${inputStyle} mt-2`}
                  >
                    {EVENT_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                {newEventType === "Custom" && (
                  <label className="text-sm font-semibold">
                    Event Name
                    <input
                      type="text"
                      value={newCustomEventName}
                      onChange={(e) => setNewCustomEventName(e.target.value)}
                      placeholder="e.g., Birthday Party or Corporate Event"
                      maxLength={100}
                      className={`${inputStyle} mt-2`}
                    />
                  </label>
                )}
                {newEventType === "Open Play" && (
                  <label className="text-sm font-semibold">
                    Number of Skill Levels
                    <select
                      value={newEventGroups}
                      onChange={(e) => setNewEventGroups(Number(e.target.value))}
                      className={`${inputStyle} mt-2`}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((count) => (
                        <option key={count} value={count}>{count}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <p className="text-sm text-zinc-400">
                {newEventType === "Open Play"
                  ? `One Open Play event will be created with ${newEventGroups} skill level ${newEventGroups === 1 ? "group" : "groups"}. All groups share the same start and end time.`
                  : "This event will start with one court assignment group. You can add more groups later."}
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={addEvent} disabled={newEventType === "Custom" && !newCustomEventName.trim()} className="rounded-lg bg-yellow-400 px-5 py-3 font-bold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50">
                  Create Event
                </button>
                <button type="button" onClick={() => setShowEventSetup(false)} className={secondaryButton}>
                  Cancel
                </button>
              </div>
            </div>
          )}

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
                               leagueSnapshot: e.target.value === "League" ? event.leagueSnapshot : undefined,
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

                    {event.type === "League" && (
                      <section className="space-y-4 rounded-xl border border-yellow-500/40 bg-zinc-950 p-5">
                        <h3 className="text-lg font-bold text-yellow-400">League Starting Court Assignments</h3>
                        <p className="text-sm text-zinc-400">
                          Select 2–12 facility courts below, then import the active league session's original Round 1.
                          Imported names remain fixed as the ladder progresses.
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="min-w-0 flex-1 text-sm text-zinc-200">
                            {activeLeague
                              ? `Active session: ${activeLeague.name} (${activeLeague.event_date})`
                              : "No active league session loaded"}
                          </div>
                          <button type="button" onClick={() => void refreshActiveLeague()}
                            disabled={leagueLoading} className={secondaryButton}>
                            {leagueLoading ? "Checking..." : "Find Active League"}
                          </button>
                          <button type="button" onClick={() => void importLeagueRoundOne(eventIndex)}
                            disabled={!activeLeague || leagueImporting !== null}
                            className="rounded-lg bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-300 disabled:opacity-40">
                            {leagueImporting === eventIndex ? "Importing..." : "Import Round 1"}
                          </button>
                        </div>
                        {leagueMessage && <p className="text-sm text-blue-300">{leagueMessage}</p>}
                        {event.leagueSnapshot && (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-green-300">
                                Imported from {event.leagueSnapshot.eventName} · {event.leagueSnapshot.courts.length} courts
                              </p>
                              <button type="button" className="text-sm font-semibold text-red-300 hover:text-red-200"
                                onClick={() => updateEvent(eventIndex, { ...event, leagueSnapshot: undefined })}>
                                Clear Import
                              </button>
                            </div>
                            {leagueSnapshotError(event) && (
                              <p className="rounded-lg border border-red-700 bg-red-950 p-3 text-sm text-red-200">
                                {leagueSnapshotError(event)}
                              </p>
                            )}
                            <div className="grid gap-3 md:grid-cols-2">
                              {event.leagueSnapshot.courts.map((court) => (
                                <div key={court.leagueCourt} className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-bold text-yellow-400">League Court {court.leagueCourt}</span>
                                    <label className="text-xs font-semibold text-zinc-300">
                                      Facility Court
                                      <select value={court.facilityCourt}
                                        onChange={(e) => updateLeagueCourtMapping(eventIndex, court.leagueCourt, Number(e.target.value))}
                                        className={`${inputStyle} mt-1`}>
                                        {selectedCourts(event).map((physical) => (
                                          <option key={physical} value={physical}>Court {physical}</option>
                                        ))}
                                      </select>
                                    </label>
                                  </div>
                                  <ol className="space-y-1 text-sm text-zinc-200">
                                    {court.players.map((name, playerIndex) => (
                                      <li key={playerIndex}>{playerIndex + 1}. {name}</li>
                                    ))}
                                  </ol>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </section>
                    )}

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
                                newAssignment(
                                  event.type === "Open Play"
                                    ? OPEN_PLAY_LEVELS.find((level) =>
                                        !event.assignments.some((existing) => levelKey(existing) === level.toLowerCase())
                                      ) ?? "Custom"
                                    : OPEN_PLAY_LEVELS[0]
                                ),
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
                                    <option
                                      key={level}
                                      value={level}
                                      disabled={
                                        event.type === "Open Play" &&
                                        level !== "Custom" &&
                                        level !== assignment.level &&
                                        event.assignments.some((other, otherIndex) =>
                                          otherIndex !== assignmentIndex && levelKey(other) === level.toLowerCase()
                                        )
                                      }
                                    >
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
                                        wristband: event.assignments.some(
                                          (other, index) => index !== assignmentIndex &&
                                            e.target.value !== "None" &&
                                            other.wristband.toLowerCase() === e.target.value.toLowerCase()
                                        ) ? assignment.wristband : e.target.value,
                                      }
                                    )
                                  }
                                  className={`${inputStyle} mt-2`}
                                >
                                  <option value="None">None</option>
                                  {assignment.wristband !== "None" &&
                                    !wristbandColors.some(
                                      (color) => color.is_active && color.name === assignment.wristband
                                    ) && (
                                      <option value={assignment.wristband}>
                                        {assignment.wristband} (previously assigned)
                                      </option>
                                    )}
                                  {wristbandColors
                                    .filter((color) => color.is_active)
                                    .map((color) => {
                                      const used = event.assignments.some(
                                        (other, index) => index !== assignmentIndex &&
                                          other.wristband.toLowerCase() === color.name.toLowerCase()
                                      );
                                      return (
                                        <option key={color.id} value={color.name} disabled={used}>
                                          {color.name}{used ? " (in use)" : ""}
                                        </option>
                                      );
                                    })}
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
                                  const usedByOtherGroup = event.assignments.some(
                                    (other, index) => index !== assignmentIndex && other.courts.includes(court)
                                  );

                                  return (
                                    <button
                                      key={court}
                                      type="button"
                                      disabled={usedByOtherGroup}
                                      title={usedByOtherGroup ? "Assigned to another group" : `Court ${court}`}
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
                                          : usedByOtherGroup
                                            ? "cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-600 opacity-40"
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
