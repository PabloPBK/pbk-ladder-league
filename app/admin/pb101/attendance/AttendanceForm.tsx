
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  savePB101Attendance,
  savePB101IndividualActivity,
} from "./actions";
import { updatePB101Payment } from "./payment-actions";

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
type PaymentStatus = "unpaid" | "paid" | "waived";

function localToday() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
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

function lastTrialDate(trialEnd: string) {
  const date = new Date(`${trialEnd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export default function AttendanceForm({
  guests,
  attendanceHistory,
}: Props) {
  const router = useRouter();

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

  const [editingPaymentId, setEditingPaymentId] =
    useState<string | null>(null);
  const [editPaymentStatus, setEditPaymentStatus] =
    useState<PaymentStatus>("unpaid");
  const [editPaymentNotes, setEditPaymentNotes] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);

  const selectedGuest = guests.find(
    (guest) => guest.id === guestId
  );

  const eligibleGuests = useMemo(
    () =>
      guests.filter(
        (guest) =>
          guest.trialStart <= date &&
          date < guest.trialEnd
      ),
    [guests, date]
  );

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

  const guestHistory = useMemo(
    () =>
      attendanceHistory
        .filter((record) => record.guestId === guestId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [attendanceHistory, guestId]
  );

  const summary = useMemo(() => {
    const attended = guestHistory.filter(
      (record) => record.attendanceStatus === "attended"
    );

    const charges = attended.reduce(
      (total, record) => total + record.chargeAmount,
      0
    );

    const outstanding = attended
      .filter((record) => record.paymentStatus === "unpaid")
      .reduce(
        (total, record) => total + record.chargeAmount,
        0
      );

    return {
      activities: attended.length,
      visits: new Set(attended.map((record) => record.date))
        .size,
      complimentary: attended.filter(
        (record) =>
          record.isIncluded === true ||
          (record.isIncluded === null &&
            record.program !== "other")
      ).length,
      outsideProgram: attended.filter(
        (record) => record.program === "other"
      ).length,
      charges,
      outstanding,
    };
  }, [guestHistory]);

  function clearMessage() {
    setMessage("");
    setSuccess(false);
  }

  function toggleGuest(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleAllVisible() {
    const ids = visibleGuests.map((guest) => guest.id);
    const allSelected =
      ids.length > 0 &&
      ids.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !ids.includes(id))
      );
    } else {
      setSelectedIds((current) => [
        ...new Set([...current, ...ids]),
      ]);
    }
  }

  async function saveIndividual() {
    clearMessage();

    if (!selectedGuest) {
      setMessage("Select a guest.");
      return;
    }

    if (
      !date ||
      date > localToday() ||
      date < selectedGuest.trialStart ||
      date >= selectedGuest.trialEnd
    ) {
      setMessage(
        "Select a date within the guest's trial."
      );
      return;
    }

    if (program === "other" && !activityName.trim()) {
      setMessage("Enter the activity name.");
      return;
    }

    if (
      program === "other" &&
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
        activityName:
          program === "other" ? activityName : undefined,
        chargeAmount:
          program === "other"
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
        router.refresh();
      }
    } catch {
      setMessage("Unable to save activity.");
    } finally {
      setSaving(false);
    }
  }

  async function saveBulk() {
    clearMessage();

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
        router.refresh();
      }
    } catch {
      setMessage("Unable to save bulk attendance.");
    } finally {
      setSaving(false);
    }
  }

  function startPaymentEdit(record: AttendanceRecord) {
    setEditingPaymentId(record.id);
    setEditPaymentStatus(
      record.paymentStatus === "paid" ||
        record.paymentStatus === "waived"
        ? record.paymentStatus
        : "unpaid"
    );
    setEditPaymentNotes(record.paymentNotes ?? "");
    clearMessage();
  }

  async function savePayment() {
    if (!editingPaymentId) return;

    if (
      editPaymentStatus === "waived" &&
      !editPaymentNotes.trim()
    ) {
      setSuccess(false);
      setMessage("Enter a reason for waiving the charge.");
      return;
    }

    setPaymentSaving(true);
    clearMessage();

    try {
      const result = await updatePB101Payment({
        attendanceId: editingPaymentId,
        paymentStatus: editPaymentStatus,
        paymentNotes: editPaymentNotes,
      });

      setSuccess(result.success);
      setMessage(result.message);

      if (result.success) {
        setEditingPaymentId(null);
        router.refresh();
      }
    } catch {
      setSuccess(false);
      setMessage("Unable to update payment status.");
    } finally {
      setPaymentSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {(["individual", "bulk"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setMode(item);
              if (item === "bulk" && program === "other") {
                setProgram("beginner_pathway_open_play");
              }
              clearMessage();
            }}
            className={`rounded-xl px-5 py-3 font-bold ${
              mode === item
                ? "bg-yellow-400 text-black"
                : "bg-zinc-800 text-white"
            }`}
          >
            {item === "individual"
              ? "Individual Entry"
              : "Bulk Attendance"}
          </button>
        ))}
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
                  const lastDate = lastTrialDate(
                    guest.trialEnd
                  );

                  setDate(
                    today < guest.trialStart
                      ? guest.trialStart
                      : today > lastDate
                        ? lastDate
                        : today
                  );
                }

                setEditingPaymentId(null);
                clearMessage();
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
                clearMessage();
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
                clearMessage();
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

        {mode === "individual" && program === "other" && (
          <div className="space-y-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="font-bold text-amber-300">
              Outside PB101+ Program — Charge Required
            </p>

            <div className="space-y-2">
              <label className="block text-sm font-semibold">
                Activity Name
              </label>
              <input
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
                placeholder="Regular activity price"
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
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white"
              />
            </div>
          </div>
        )}

        {mode === "bulk" && (
          <div className="space-y-4">
            <input
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

      {mode === "individual" && selectedGuest && (
        <div className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-black text-yellow-400">
            Seven-Day Activity History
          </h2>

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
                String(summary.outsideProgram),
              ],
              ["Total Charges", money(summary.charges)],
              ["Outstanding", money(summary.outstanding)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl bg-zinc-800 p-4"
              >
                <p className="text-xs text-zinc-400">
                  {label}
                </p>
                <p className="mt-2 text-xl font-black">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-700">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-zinc-800 text-zinc-300">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Activity</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Charge</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {guestHistory.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-6 text-center text-zinc-400"
                    >
                      No activities recorded yet.
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
                        {record.program === "other"
                          ? "Outside Program"
                          : "Complimentary"}
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
                      <td className="p-3">
                        {record.program === "other" && (
                          <button
                            type="button"
                            onClick={() =>
                              startPaymentEdit(record)
                            }
                            className="rounded-lg bg-zinc-700 px-3 py-2 text-xs font-bold text-white hover:bg-zinc-600"
                          >
                            Update Payment
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {editingPaymentId && (
            <div className="space-y-4 rounded-xl border border-yellow-500/40 bg-zinc-950 p-5">
              <h3 className="text-lg font-bold text-yellow-400">
                Update Payment Status
              </h3>

              <div className="space-y-2">
                <label className="block text-sm font-semibold">
                  Payment Status
                </label>
                <select
                  value={editPaymentStatus}
                  onChange={(event) =>
                    setEditPaymentStatus(
                      event.target.value as PaymentStatus
                    )
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-white"
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="waived">Waived</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold">
                  Payment Notes
                </label>
                <textarea
                  value={editPaymentNotes}
                  onChange={(event) =>
                    setEditPaymentNotes(event.target.value)
                  }
                  rows={3}
                  placeholder="Payment method, reference, or waiver reason"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-white"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={paymentSaving}
                  onClick={savePayment}
                  className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black disabled:opacity-50"
                >
                  {paymentSaving
                    ? "Saving..."
                    : "Save Payment Status"}
                </button>

                <button
                  type="button"
                  disabled={paymentSaving}
                  onClick={() => setEditingPaymentId(null)}
                  className="rounded-xl bg-zinc-800 px-5 py-3 font-bold text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-zinc-500">
            Payment statuses are recorded internally.
            Charges are not collected automatically through
            PodPlay.
          </p>
        </div>
      )}
    </div>
  );
}
