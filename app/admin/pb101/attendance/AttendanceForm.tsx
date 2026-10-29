
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

export default function AttendanceForm({ guests }: Props) {
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

  const selectedGuest = guests.find(
    (guest) => guest.id === guestId
  );

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
    const allSelected = visibleIds.every((id) =>
      selectedIds.includes(id)
    );

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

    if (!date) {
      setMessage("Please select an activity date.");
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
        program:
          program === "other"
            ? "beginner_pathway_open_play"
            : program,
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

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
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
                setGuestId(event.target.value);
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
              <div className="rounded-xl bg-zinc-800 p-4 text-sm space-y-1">
                <p>
                  <strong>Coach:</strong> {selectedGuest.coach}
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
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-4">
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
                placeholder="Payment details or staff notes"
                rows={3}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white"
              />
            </div>

            <p className="text-sm text-amber-200">
              This activity will be recorded as unpaid until
              staff confirms payment.
            </p>
          </div>
        )}

        {mode === "bulk" && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Select guests who attended this complimentary
              PB101+ activity.
            </p>

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search by name, email, or coach"
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
    </div>
  );
}
