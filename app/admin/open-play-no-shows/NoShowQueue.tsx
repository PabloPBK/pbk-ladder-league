"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { noShowMoney, parseNoShowAmount } from "@/lib/data/open-play-no-show-billing";
import type { NoShowQueueEntry } from "@/lib/data/open-play-no-shows";

type Action = "claim" | "release" | "charged" | "exception" | "refund" | "note";

const sessionDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const sessionTime = new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone: "UTC" });
const reviewedAt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles",
});

const defaultChargeAmount = "15.00";
const actionButton = "rounded-lg border border-zinc-600 px-3 py-2 text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50";
const textField = "mt-1 block w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white";

export function NoShowQueue({ entries, userId }: { entries: NoShowQueueEntry[]; userId: string }) {
  const [staffName, setStaffName] = useState("");

  return <>
    <label className="mb-4 block max-w-xs text-sm font-semibold">
      Your staff name
      <input value={staffName} onChange={(event) => setStaffName(event.target.value)} className={textField}
        placeholder="First and last name" maxLength={100} autoComplete="name" />
    </label>
    <ul className="divide-y divide-zinc-800">
      {entries.map((entry) => <QueueEntry key={entry.id} entry={entry} userId={userId} staffName={staffName.trim()} />)}
    </ul>
  </>;
}

function QueueEntry({ entry, userId, staffName }: { entry: NoShowQueueEntry; userId: string; staffName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [chargeAmount, setChargeAmount] = useState(defaultChargeAmount);
  const [refundAmount, setRefundAmount] = useState("");
  const [reason, setReason] = useState("");
  const [noteDraft, setNoteDraft] = useState<{ text: string; version: string | null } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isPending = entry.status === "pending";
  const isMyReview = entry.claimed_by === userId;
  const isCharged = entry.status === "charged";
  const hasRefund = (entry.reversal_cents ?? 0) > 0;
  const chargeCents = parseNoShowAmount(chargeAmount);
  const refundCents = parseNoShowAmount(refundAmount);
  const canSave = !busy && !!staffName;

  async function update(action: Action) {
    if (busy) return;
    if (action === "charged") {
      if (chargeCents === null || !window.confirm(`Record a ${noShowMoney(chargeCents)} charge already made for ${entry.player_name} in your billing system?`)) return;
    }
    if (action === "refund" && !window.confirm(`Record that ${entry.player_name} was already refunded in your billing system?`)) return;
    if (action === "release" && !window.confirm("Release this review so someone else can take it? Only release it if no charge was made.")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/open-play-no-shows/" + entry.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action, staffName, claimedAt: entry.claimed_at, reason,
          amount: action === "charged" ? chargeAmount : action === "refund" ? refundAmount : undefined,
          notes: noteDraft?.text, notesUpdatedAt: noteDraft?.version,
        }),
      });
      const data = await response.json();
      if (response.status === 409) router.refresh();
      if (!response.ok) throw new Error(data.error || "Unable to update the review.");
      if (action === "note") {
        setNoteDraft(null);
        setMessage("Notes saved.");
      } else {
        setReason("");
        setChargeAmount(defaultChargeAmount);
        setRefundAmount("");
      }
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to update the review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid gap-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <h3 className="break-words font-bold">{entry.player_name}</h3>
        <p className="break-all text-sm text-zinc-400">{entry.player_email ?? "No email in the export. Verify the player in PodPlay."}</p>
        <p className="mt-2 text-sm text-zinc-300">{entry.session_name}</p>
        <p className="text-sm text-zinc-400">
          {sessionDate.format(new Date(entry.session_date + "T00:00:00Z"))}
          {" · "}
          {sessionTime.format(new Date("2000-01-01T" + entry.session_time + "Z"))}
        </p>
      </div>
      <div className="space-y-3">
        {isPending && (!entry.claimed_by ? (
          <button type="button" className={actionButton} disabled={!canSave}
            onClick={() => void update("claim")} aria-label={`Start review for ${entry.player_name}`}>
            Start review
          </button>
        ) : (
          <p className="text-sm font-semibold text-blue-300">In review by {entry.staff_name}</p>
        ))}
        {(isCharged || hasRefund) && (
          <div className="text-sm">
            <p className="font-bold text-green-300">
              Charged {entry.charge_cents === null ? "(amount unrecorded)" : noShowMoney(entry.charge_cents)} by {entry.staff_name}
            </p>
            {entry.resolved_at && <p className="text-zinc-300">{reviewedAt.format(new Date(entry.resolved_at))} PT</p>}
          </div>
        )}
        {(entry.status === "reversed" || entry.status === "skipped") && (
          <div className="text-sm">
            <p className="font-bold text-amber-300">
              {hasRefund ? `Refunded ${noShowMoney(entry.reversal_cents ?? 0)}` : "Exception · No charge"}
              {" · "}{entry.reversal_staff_name ?? entry.staff_name}
            </p>
            {(entry.reversed_at || entry.resolved_at) && (
              <p className="text-zinc-300">{reviewedAt.format(new Date((entry.reversed_at ?? entry.resolved_at)!))} PT</p>
            )}
            <p className="mt-2 whitespace-pre-wrap break-words text-zinc-300">{entry.reversal_reason ?? entry.skip_reason}</p>
          </div>
        )}
        {isPending && isMyReview && (
          <>
            <form onSubmit={(event) => { event.preventDefault(); void update("charged"); }} className="space-y-2">
              <label className="block text-sm">Amount already charged (USD)
                <input inputMode="decimal" className={textField} maxLength={8} value={chargeAmount}
                  onChange={(event) => setChargeAmount(event.target.value)} required />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={actionButton} disabled={!canSave || chargeCents === null}>Record charge</button>
                <button type="button" className={actionButton} disabled={busy} onClick={() => void update("release")}>Release review</button>
              </div>
            </form>
            <details className="rounded-lg border border-zinc-700 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Record exception</summary>
              <form onSubmit={(event) => { event.preventDefault(); void update("exception"); }} className="mt-3 space-y-2">
                <label className="block text-sm">Reason for the exception
                  <textarea className={textField} value={reason} onChange={(event) => setReason(event.target.value)}
                    required rows={2} maxLength={500} placeholder="For example, attended and forgot to check in." />
                </label>
                <button type="submit" className={actionButton} disabled={!canSave || !reason.trim()}>Save exception</button>
              </form>
            </details>
          </>
        )}
        {isCharged && (
          <details className="rounded-lg border border-zinc-700 p-3">
            <summary className="cursor-pointer text-sm font-semibold">Record reversal</summary>
            <form onSubmit={(event) => { event.preventDefault(); void update("refund"); }} className="mt-3 space-y-2">
              <label className="block text-sm">Amount already refunded (USD)
                <input inputMode="decimal" className={textField} maxLength={8} value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)} placeholder="0.00" required />
              </label>
              <label className="block text-sm">Reason for the reversal
                <textarea className={textField} value={reason} onChange={(event) => setReason(event.target.value)}
                  required rows={2} maxLength={500} placeholder="For example, confirmed the member attended." />
              </label>
              {entry.charge_cents !== null && refundCents !== null && refundCents > entry.charge_cents && (
                <p className="text-sm text-amber-300">The refund cannot exceed the original charge.</p>
              )}
              <button type="submit" className={actionButton}
                disabled={!canSave || !reason.trim() || refundCents === null || (entry.charge_cents !== null && refundCents > entry.charge_cents)}>
                Save reversal
              </button>
            </form>
          </details>
        )}
        {!isPending && (
          <div className="space-y-2 text-sm">
            {entry.notes && <p className="whitespace-pre-wrap break-words text-zinc-300">{entry.notes}</p>}
            {entry.notes_updated_at && <p className="text-xs text-zinc-400">
              Notes edited by {entry.notes_staff_name} · {reviewedAt.format(new Date(entry.notes_updated_at))} PT
            </p>}
            {noteDraft ? (
              <form onSubmit={(event) => { event.preventDefault(); void update("note"); }} className="space-y-2">
                <label className="block">Staff notes
                  <textarea className={textField} value={noteDraft.text} onChange={(event) => {
                    const text = event.target.value;
                    setNoteDraft((draft) => draft && { ...draft, text });
                  }} rows={3} maxLength={2000} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className={actionButton} disabled={!canSave}>Save notes</button>
                  <button type="button" className={actionButton} disabled={busy} onClick={() => setNoteDraft(null)}>Cancel</button>
                </div>
              </form>
            ) : (
              <button type="button" className={actionButton} disabled={busy} onClick={() =>
                setNoteDraft({ text: entry.notes ?? "", version: entry.notes_updated_at })}>
                {entry.notes ? "Edit notes" : "Add notes"}
              </button>
            )}
          </div>
        )}
        {message && <p role="status" className="text-sm text-green-300">{message}</p>}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      </div>
    </li>
  );
}
