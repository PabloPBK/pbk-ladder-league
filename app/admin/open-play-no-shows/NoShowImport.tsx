"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { noShowFacilityName, noShowMaxFiles, noShowMaxFileSize, noShowStartDate } from "@/lib/data/open-play-no-shows";
import type { ScheduledOpenPlay } from "@/lib/data/open-play-no-show-schedule";

const dayLabel = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });
const timeLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

function sessionLabel(session: ScheduledOpenPlay) {
  const start = timeLabel.format(new Date(`2000-01-01T${session.start}:00Z`));
  const end = timeLabel.format(new Date(`2000-01-01T${session.end}:00Z`));
  return `${start}–${end} · ${session.name}`;
}

type Roster = { file: File; name: string; date: string; time: string; end: string };
type ScheduleResult = { date: string; sessions: (ScheduledOpenPlay & { uploaded: boolean })[]; saved: boolean; error?: string };

const field = "mt-1 block w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white";

export function NoShowImport({ scheduleDates }: { scheduleDates: string[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [uploadVersion, setUploadVersion] = useState(0);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const scheduleDate = scheduleDates.includes(selectedDate) ? selectedDate : scheduleDates[0];
  const schedule = scheduleResult?.date === scheduleDate ? scheduleResult : null;
  const sessions = schedule?.sessions ?? [];
  const trackingAvailable = scheduleDate >= noShowStartDate;

  useEffect(() => {
    const controller = new AbortController();
    async function loadSchedule() {
      try {
        const response = await fetch(`/api/open-play-no-shows/schedule?date=${encodeURIComponent(scheduleDate)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const data: Pick<ScheduleResult, "sessions" | "saved"> = await response.json();
        if (!controller.signal.aborted) setScheduleResult({ ...data, date: scheduleDate });
      } catch {
        if (!controller.signal.aborted) {
          setScheduleResult({
            date: scheduleDate, sessions: [], saved: false,
            error: "Could not load the schedule. You can enter the session details manually.",
          });
        }
      }
    }
    void loadSchedule();
    return () => controller.abort();
  }, [scheduleDate, uploadVersion]);

  function updateRoster(index: number, details: Partial<Omit<Roster, "file">>) {
    setRosters((current) => current.map((roster, i) => i === index ? { ...roster, ...details } : roster));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !rosters.length) return;
    const form = new FormData(event.currentTarget);
    rosters.forEach(({ file }) => form.append("file", file));
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await fetch("/api/open-play-no-shows/import", { method: "POST", body: form });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || "Unable to import the rosters.");
      const { added, duplicates } = data as { added: number; duplicates: number };
      setMessage(
        added || duplicates
          ? `${added} added to the queue. ${duplicates} already recorded or repeated in these exports.`
          : "Upload recorded. No Accepted players were found in these exports."
      );
      formRef.current?.reset();
      setRosters([]);
      setUploadVersion((version) => version + 1);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to import the rosters.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <h2 className="text-xl font-bold">Import PodPlay rosters</h2>
      <p className="mt-2 text-sm text-zinc-300">
        Choose up to five CSV exports from completed open plays at {noShowFacilityName}.
        Only rows with an invitation status of Accepted enter the queue.
      </p>
      <div className="mt-5 space-y-3 rounded-lg border border-zinc-700 p-4">
        <label className="block max-w-xs text-sm font-semibold">Scheduled open plays
          <select value={scheduleDate} onChange={(event) => setSelectedDate(event.target.value)} className={field}>
            {scheduleDates.map((date) => (
              <option key={date} value={date}>
                {dayLabel.format(new Date(date + "T00:00:00Z"))}
              </option>
            ))}
          </select>
        </label>
        {!trackingAvailable && <p className="text-sm text-zinc-400">
          CSV tracking starts {dayLabel.format(new Date(noShowStartDate + "T00:00:00Z"))}.
        </p>}
        <div role="status" className="text-sm text-zinc-300">
          {!schedule ? "Loading open plays…" : schedule.error ?? (!schedule.saved
            ? "No published schedule is available for this date."
            : sessions.length === 0 ? "No open plays were scheduled for this date." : (
              <ul className="space-y-1">
                {sessions.map((session) => (
                  <li key={sessionLabel(session)} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span>{sessionLabel(session)}</span>
                    {trackingAvailable && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${session.uploaded ? "bg-emerald-950 text-emerald-200" : "bg-amber-950 text-amber-200"}`}>
                      {session.uploaded ? "Uploaded" : "Missing CSV"}
                    </span>}
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </div>
      <form ref={formRef} onSubmit={submit} className="mt-5 space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          <div className="max-w-xl">
            <label className="block text-sm font-semibold">PodPlay CSV exports
              <input type="file" accept=".csv,text/csv" multiple className={field} onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                setMessage("");
                if (selected.length > noShowMaxFiles || selected.some((file) => !file.size || file.size > noShowMaxFileSize || !/\.csv$/i.test(file.name))) {
                  setRosters([]);
                  event.target.value = "";
                  setError("Choose up to five non-empty CSV files, each under 500 KB.");
                  return;
                }
                setRosters(selected.map((file) => ({ file, name: "", date: "", time: "", end: "" })));
                setError("");
              }} />
            </label>
          </div>
          {rosters.map(({ file, name, date, time, end }, index) => (
            <fieldset key={`${file.name}-${file.lastModified}-${index}`} className="grid gap-3 rounded-lg border border-zinc-700 px-4 pb-4 pt-2 sm:grid-cols-3">
              <legend className="max-w-full break-all px-1 text-sm font-semibold">{file.name}</legend>
              {sessions.length > 0 && trackingAvailable && (
                <label className="block text-sm sm:col-span-3">Fill details from the schedule
                  <select className={field} value={date === scheduleDate
                    ? String(sessions.findIndex((session) => session.name === name && session.start === time && session.end === end)) : "-1"}
                    onChange={(event) => {
                      const session = sessions[Number(event.target.value)];
                      if (session) updateRoster(index, { name: session.name, date: scheduleDate, time: session.start, end: session.end });
                    }}>
                    <option value="-1" disabled>Choose a scheduled open play</option>
                    {sessions.map((session, sessionIndex) => (
                      <option key={sessionLabel(session)} value={sessionIndex}>{sessionLabel(session)}</option>
                    ))}
                  </select>
                </label>
              )}
              <input type="hidden" name="session_end" value={end} />
              <label className="block text-sm">Open-play name
                <input name="session_name" value={name} onChange={(event) => updateRoster(index, { name: event.target.value, end: "" })} className={field} placeholder="e.g. Beginner Open Play" required maxLength={160} />
              </label>
              <label className="block text-sm">Session date
                <input name="session_date" type="date" value={date} onChange={(event) => updateRoster(index, { date: event.target.value, end: "" })} className={field} required min={noShowStartDate} />
              </label>
              <label className="block text-sm">Start time at the facility
                <input name="session_time" type="time" value={time} onChange={(event) => updateRoster(index, { time: event.target.value, end: "" })} className={field} required />
              </label>
            </fieldset>
          ))}
          {rosters.length > 0 && <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="completed" value="yes" required />
            I confirmed these open plays have ended.
          </label>}
        </fieldset>
        <button type="submit" disabled={!rosters.length || busy} className="rounded-lg bg-blue-500 px-5 py-2.5 font-bold text-zinc-950 hover:bg-blue-400 disabled:opacity-50">
          {busy ? "Importing…" : "Import CSVs"}
        </button>
        {message && <p role="status" className="text-sm font-semibold text-green-300">{message}</p>}
        {error && <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>}
      </form>
    </section>
  );
}
