
"use client";

import { useMemo, useState } from "react";
import {
  savePB101Attendance,
  savePB101IndividualActivity,
} from "./actions";

type Guest = {
  id: string;
  name: string;
  email: string;
  coach: string;
  trialStart: string;
  trialEnd: string;
  status: string;
};

type AttendanceRecord = {
  id: string;
  guestId: string;
  date: string;
  program: string;
  activityName: string | null;
  attendanceStatus: string;
  isIncluded: boolean | null;
  chargeAmount: number;
  paymentStatus: string | null;
  paymentNotes: string | null;
};

type Props = {
  guests: Guest[];
  attendanceHistory: AttendanceRecord[];
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
    label: "Other Activity (Charge Required)",
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

function activityLabel(record: AttendanceRecord) {
  if (record.program === "other") {
    return record.activityName || "Other Activity";
  }

  return (
    PROGRAMS.find((item) => item.value === record.program)
      ?.label || record.program
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default function AttendanceForm({
  guests,
  attendanceHistory,
}: Props) {
  const [mode, setMode] = useState<"individual" | "bulk">(
    "individual"
  );

  const [date, setDate] = useState(localToday());
  const [program, setProgram] = useState<Program>(
    "beginner_pathway_open_play"
  );

  const [guestId, setGuestId] = useState("");
  const [activityName, setActivityName] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const selectedGuest = guests.find(
    (guest) => guest.id === guestId
  );

  const eligibleGuests = useMemo(() => {
    return guests.filter(
      (guest) =>
        guest.trialStart <= date &&
        date < guest.trialEnd
    );
  }, [guests, date]);

  const visibleGuests = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return eligibleGuests;

    return eligibleGuests.filter((guest) =>
      [guest.name, guest.email, guest.coach]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [eligibleGuests, search]);

  const guestHistory = useMemo(() => {
    return attendanceHistory
      .filter((record) => record.guestId === guestId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceHistory, guestId]);

  const summary = useMemo(() => {
    const attended = guestHistory.filter(
      (record) => record.attendanceStatus === "attended"
    );

    const totalCharges = attended.reduce(
      (sum, record) => sum + record.chargeAmount,
      0
    );

    const outstanding = attended
      .filter((record) => record.paymentStatus === "unpaid")
      .reduce(
        (sum, record) => sum + record.chargeAmount,
        0
      );

    const uniqueDates = new Set(
      attended.map((record) => record.date)
    );

    return {
      activities: attended.length,
      visits: uniqueDates.size,
      complimentary: attended.filter(
        (record) =>
          record.isIncluded === true ||
          (record.isIncluded === null &&
            record.program !== "other")
      ).length,
      paidActivities: attended.filter(
        (record) => record.program === "other"
      ).length,
      totalCharges,
      outstanding,
    };
  }, [guestHistory]);

  const isOther = program === "other";

  function resetMessage() {
    setMessage("");
    setSuccess(false);
  }

  function toggleGuest(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  }

  function toggleAllVisible() {
    const visibleIds = visibleGuests.map((guest) => guest.id);
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !visibleIds.includes(id))
      );
    } else {
      setSelectedIds((current) => [
        ...new Set([...current, ...visibleIds]),
      ]);
    }
  }

  async function saveIndividual() {
    resetMessage();

    if (!guestId) {
      setMessage("Please select a guest.");
      return;
    }

    if (!date || date > localToday()) {
      setMessage("Select a valid activity date.");
      return;
    }

    if (
      !selectedGuest ||
      date < selectedGuest.trialStart ||
      date >= selectedGuest.trialEnd
    ) {
      setMessage(
        "The activity date must be within this guest's trial."
      );
      return;
    }

    if (isOther && !activityName.trim()) {
      setMessage("Enter the name of the other activity.");
      return;
    }

    if (
      isOther &&
      (chargeAmount.trim() === "" ||
        !Number.isFinite(Number(chargeAmount)) ||
        Number(chargeAmount) < 0)
    ) {
      setMessage("Enter a valid charge amount.");
      return;
    }

    setSaving(true);

    try {
      const result = await savePB101IndividualActivity({
        guestId,
        date,
        program,
        activityName: isOther ? activityName : undefined,
        chargeAmount: isOther
          ? Number(chargeAmount)
          : undefined,
        paymentNotes: paymentNotes || undefined,
      });

      setSuccess(result.success);
      setMessage(result.message);

      if (result.success) {
        setActivityName("");
        setChargeAmount("");
        setPaymentNotes("");
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  async function saveBulk() {
    resetMessage();

    if (program === "other") {
      setMessage(
        "Other activities must be recorded individually."
      );
      return;
    }

    const validIds = selectedIds.filter((id) =>
      eligibleGuests.some((guest) => guest.id === id)
    );

    if (validIds.length === 0) {
      setMessage("Select at least one guest.");
      return;
    }

    setSaving(true);

    try {
      const result = await savePB101Attendance({
        date,
        program,
        guestIds: validIds,
      });

      setSuccess(result.success);
      setMessage(result.message);

      if (result.success) {
        setSelectedIds([]);
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setMode("individual");
            resetMessage();
          }}
          className={`rounded-xl px-5 py-3 font-bold ${
            mode === "individual"
              ? "bg-yellow-400 text-black"
              : "bg-zinc-800 text-white"
          }`}
        >
          Individual Entry
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("bulk");
            if (program === "other") {
              setProgram("beginner_pathway_open_play");
            }
            resetMessage();
          }}
          className={`rounded-xl px-5 py-3 font-bold ${
            mode === "bulk"
              ? "bg-yellow-400 text-black"
              : "bg-zinc-800 text-white"
          }`}
        >
          Bulk Attendance
        </button>
      </div>

      <div className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-black text-yellow-400">
          {mode === "individual"
            ? "Record Individual Guest Activity"
            : "Record Bulk Attendance"}
        </h2>

        {mode === "individual" && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold">
              Select Guest
            </label>

            <select
              value={guestId}
              onChange={(event) => {
                const id = event.target.value;
                setGuestId(id);

                const guest = guests.find(
                  (item) => item.id === id
                );

                if (guest) {
                  const today = localToday();
                  const lastTrialDay = new Date(
                    `${guest.trialEnd}T00:00:00Z`
                  );
                  lastTrialDay.setUTCDate(
                    lastTrialDay.getUTCDate() - 1
                  );

                  const lastDate = lastTrialDay
                    .toISOString()
                    .slice(0, 10);

                  setDate(
                    today < guest.trialStart
                      ? guest.trialStart
                      : today > lastDate
                        ? lastDate
                        : today
                  );
                }

                resetMessage();
              }}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white"
            >
              <option value="">Choose a guest</option>
              {guests.map((guest) => (
                <option key={guest.id} value={guest.id}>
                  {guest.name} — {guest.email}
                </option>
              ))}
            </select>

            {selectedGuest && (
              <div className="space-y-1 rounded-xl bg-zinc-800 p-4 text-sm">
                <p>
                  <strong>Coach:</strong>{" "}
                  {selectedGuest.coach || "Not assigned"}
                </p>
                <p>
                  <strong>Trial:</strong>{" "}
                  {selectedGuest.trialStart} to{" "}
                  {selectedGuest.trialEnd}
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  {selectedGuest.status}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-semibold">
              Activity Date
            </label>

            <input
              type="date"
              value={date}
              max={localToday()}
              onChange={(event) => {
                setDate(event.target.value);
                setSelectedIds([]);
                resetMessage();
              }}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold">
              Activity
            </label>

            <select
              value={program}
              onChange={(event) => {
                setProgram(event.target.value as Program);
                resetMessage();
              }}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white"
            >
              {PROGRAMS.filter(
                (item) =>
                  mode === "individual" ||
                  item.value !== "other"
              ).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {mode === "individual" && isOther && (
          <div className="space-y-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="font-bold text-amber-300">
              Outside PB101+ Program — Charge Required
            </p>

            <div className="space-y-2">
              <label className="block text-sm font-semibold">
                Activity Name
              </label>
              <input
                type="text"
                value={activityName}
                onChange={(event) =>
                  setActivityName(event.target.value)
                }
                placeholder="e.g. Intermediate Open Play"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold">
                Charge Amount ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={chargeAmount}
                onChange={(event) =>
                  setChargeAmount(event.target.value)
                }
                placeholder="Enter regular activity price"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold">
                Payment Notes (Optional)
              </label>
              <textarea
                value={paymentNotes}
                onChange={(event) =>
                  setPaymentNotes(event.target.value)
                }
                rows={3}
                placeholder="Payment details or staff notes"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white"
              />
            </div>

            <p className="text-sm text-amber-200">
              The charge will be marked unpaid until staff
              confirms payment.
            </p>
          </div>
        )}

        {mode === "bulk" && (
          <div className="space-y-4">
            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search guests by name, email, or coach"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white"
            />

            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">
                {visibleGuests.length} eligible guest(s)
              </span>

              <button
                type="button"
                onClick={toggleAllVisible}
                className="text-sm font-bold text-yellow-400"
              >
                Select / Deselect Visible
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto rounded-xl border border-zinc-700">
              {visibleGuests.length === 0 ? (
                <p className="p-5 text-sm text-zinc-400">
                  No guests are eligible for this date.
                </p>
              ) : (
                visibleGuests.map((guest) => (
                  <label
                    key={guest.id}
                    className="flex cursor-pointer items-center gap-3 border-b border-zinc-800 p-4 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(guest.id)}
                      onChange={() => toggleGuest(guest.id)}
                      className="h-5 w-5 accent-yellow-400"
                    />

                    <span>
                      <span className="block font-semibold">
                        {guest.name}
                      </span>
                      <span className="block text-xs text-zinc-400">
                        {guest.email}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>

            <p className="text-sm text-zinc-400">
              {selectedIds.length} guest(s) selected
            </p>
          </div>
        )}

        {message && (
          <div
            className={`rounded-xl p-4 text-sm ${
              success
                ? "bg-green-900/30 text-green-300"
                : "bg-red-900/30 text-red-300"
            }`}
          >
            {message}
          </div>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={
            mode === "individual"
              ? saveIndividual
              : saveBulk
          }
          className="w-full rounded-xl bg-yellow-400 px-6 py-4 font-black text-black disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : mode === "individual"
              ? "Save Guest Activity"
              : "Save Bulk Attendance"}
        </button>
      </div>

      {mode === "individual" && selectedGuest && (
        <div className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div>
            <h2 className="text-xl font-black text-yellow-400">
              Seven-Day Activity History
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Recorded activities for {selectedGuest.name}.
              Newly saved activities appear after the page
              refreshes.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {[
              ["Activities", String(summary.activities)],
              ["Days Visited", String(summary.visits)],
              [
                "Complimentary",
                String(summary.complimentary),
              ],
              [
                "Outside Program",
                String(summary.paidActivities),
              ],
              ["Total Charges", money(summary.totalCharges)],
              ["Outstanding", money(summary.outstanding)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl bg-zinc-800 p-4"
              >
                <p className="text-xs text-zinc-400">
                  {label}
                </p>
                <p className="mt-2 text-xl font-black text-white">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-700">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-zinc-800 text-zinc-300">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Activity</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Charge</th>
                  <th className="p-3">Payment</th>
                </tr>
              </thead>

              <tbody>
                {guestHistory.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-6 text-center text-zinc-400"
                    >
                      No activities recorded for this guest yet.
                    </td>
                  </tr>
                ) : (
                  guestHistory.map((record) => (
                    <tr
                      key={record.id}
                      className="border-t border-zinc-800"
                    >
                      <td className="p-3">{record.date}</td>
                      <td className="p-3 font-semibold">
                        {activityLabel(record)}
                      </td>
                      <td className="p-3">
                        {record.isIncluded === true ||
                        (record.isIncluded === null &&
                          record.program !== "other")
                          ? "Complimentary"
                          : "Outside Program"}
                      </td>
                      <td className="p-3">
                        {money(record.chargeAmount)}
                      </td>
                      <td className="p-3 capitalize">
                        {(
                          record.paymentStatus ||
                          "not_required"
                        ).replaceAll("_", " ")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-zinc-500">
            Charges are tracked here but are not automatically
            collected through PodPlay.
          </p>
        </div>
      )}
    </div>
  );
}
