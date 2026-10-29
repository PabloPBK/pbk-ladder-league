
"use client";

import { useMemo, useState } from "react";
import { savePB101Attendance } from "./actions";

type Guest = {
  id: string;
  name: string;
  email: string;
  coach: string;
  trialStart: string;
  trialEnd: string;
  status: string;
};

type Props = {
  guests: Guest[];
};

const PROGRAMS = [
  {
    value: "beginner_pathway_open_play",
    label: "Beginner / Pathway Open Play",
  },
  {
    value: "guided_pb101_open_play",
    label: "Guided PB101+ Open Play",
  },
  {
    value: "pb101_skills_drills",
    label: "PB101+ Skills & Drills",
  },
  {
    value: "other",
    label: "Other",
  },
] as const;

type Program = (typeof PROGRAMS)[number]["value"];

function localToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function AttendanceForm({ guests }: Props) {
  const [date, setDate] = useState(localToday);
  const [program, setProgram] = useState<Program>(
    "beginner_pathway_open_play"
  );
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const eligibleGuests = useMemo(
    () =>
      guests.filter(
        (guest) =>
          guest.status === "active" &&
          guest.trialStart <= date &&
          date < guest.trialEnd
      ),
    [guests, date]
  );

  const visibleGuests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return eligibleGuests.filter(
      (guest) =>
        guest.name.toLowerCase().includes(query) ||
        guest.email.toLowerCase().includes(query) ||
        guest.coach.toLowerCase().includes(query)
    );
  }, [eligibleGuests, search]);

  const selectedSet = new Set(selectedIds);

  const visibleSelectedCount = visibleGuests.filter(
    (guest) => selectedSet.has(guest.id)
  ).length;

  function resetSelection() {
    setSelectedIds([]);
    setMessage("");
    setSuccess(false);
  }

  function toggleGuest(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );

    setMessage("");
    setSuccess(false);
  }

  function toggleAllVisible() {
    const visibleIds = visibleGuests.map((guest) => guest.id);

    if (visibleSelectedCount === visibleIds.length) {
      setSelectedIds((current) =>
        current.filter((id) => !visibleIds.includes(id))
      );
    } else {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...visibleIds]))
      );
    }

    setMessage("");
    setSuccess(false);
  }

  async function handleSave() {
    if (saving || selectedIds.length === 0) return;

    const confirmed = window.confirm(
      `Save attendance for ${selectedIds.length} guest(s) ` +
        `on ${date} for ${
          PROGRAMS.find((item) => item.value === program)?.label
        }?`
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setSuccess(false);

    try {
      const result = await savePB101Attendance({
        date,
        program,
        guestIds: selectedIds,
      });

      setMessage(result.message);
      setSuccess(result.success);

      if (result.success) {
        setSelectedIds([]);
      }
    } catch {
      setMessage("Unable to save attendance. Please try again.");
      setSuccess(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <h2 className="text-xl font-bold text-yellow-400">
          Record PB101+ Attendance
        </h2>

        <p className="mt-2 text-sm text-zinc-400">
          Select the date and activity, then check the guests
          who attended. You can save multiple guests together.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="attendance_date"
              className="mb-2 block text-sm font-semibold text-zinc-300"
            >
              Attendance Date
            </label>

            <input
              id="attendance_date"
              type="date"
              value={date}
              max={localToday()}
              disabled={saving}
              onChange={(event) => {
                setDate(event.target.value);
                resetSelection();
              }}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
            />
          </div>

          <div>
            <label
              htmlFor="attendance_program"
              className="mb-2 block text-sm font-semibold text-zinc-300"
            >
              PB101+ Activity
            </label>

            <select
              id="attendance_program"
              value={program}
              disabled={saving}
              onChange={(event) => {
                setProgram(event.target.value as Program);
                resetSelection();
              }}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
            >
              {PROGRAMS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">
              Eligible Guests
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              {eligibleGuests.length} guest(s) within their
              active seven-day trial on {date}.
            </p>
          </div>

          <span className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-yellow-400">
            {selectedIds.length} selected
          </span>
        </div>

        <div className="mt-5">
          <label
            htmlFor="attendance_search"
            className="mb-2 block text-sm font-semibold text-zinc-300"
          >
            Search Guests
          </label>

          <input
            id="attendance_search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, or coach..."
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
          />
        </div>

        {visibleGuests.length > 0 ? (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-700 text-zinc-400">
                <tr>
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all visible guests"
                      checked={
                        visibleGuests.length > 0 &&
                        visibleSelectedCount === visibleGuests.length
                      }
                      disabled={saving}
                      onChange={toggleAllVisible}
                      className="h-4 w-4 accent-yellow-400"
                    />
                  </th>
                  <th className="px-3 py-3">Guest</th>
                  <th className="px-3 py-3">Coach</th>
                  <th className="px-3 py-3">Trial Ends</th>
                </tr>
              </thead>

              <tbody>
                {visibleGuests.map((guest) => (
                  <tr
                    key={guest.id}
                    className="border-b border-zinc-800"
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${guest.name}`}
                        checked={selectedSet.has(guest.id)}
                        disabled={saving}
                        onChange={() => toggleGuest(guest.id)}
                        className="h-4 w-4 accent-yellow-400"
                      />
                    </td>

                    <td className="px-3 py-3">
                      <p className="font-semibold text-white">
                        {guest.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {guest.email}
                      </p>
                    </td>

                    <td className="px-3 py-3 text-zinc-300">
                      {guest.coach || "Not assigned"}
                    </td>

                    <td className="px-3 py-3 text-zinc-300">
                      {guest.trialEnd}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center text-sm text-zinc-400">
            No eligible guests found for this date and search.
          </div>
        )}

        <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
          <h3 className="font-bold text-yellow-400">
            Save Attendance
          </h3>

          <p className="mt-2 text-sm text-zinc-300">
            {selectedIds.length} guest(s) selected for{" "}
            {PROGRAMS.find((item) => item.value === program)?.label}
            {" "}on {date}.
          </p>

          <button
            type="button"
            disabled={saving || selectedIds.length === 0}
            onClick={handleSave}
            className="mt-4 rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving
              ? "Saving..."
              : `Save Attendance for ${selectedIds.length} Guest(s)`}
          </button>

          {message && (
            <p
              role="status"
              className={`mt-3 text-sm ${
                success ? "text-green-400" : "text-red-400"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
