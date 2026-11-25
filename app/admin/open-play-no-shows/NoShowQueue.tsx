"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NoShowQueueEntry } from "@/lib/data/open-play-no-shows";

type Action = "claim" | "release" | "charged" | "skipped";

const sessionDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const sessionTime = new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone: "UTC" });
const reviewedAt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles",
});

const actionButton = "rounded-lg border border-zinc-600 px-3 py-2 text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50";
const textField = "mt-1 block w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white";

export function NoShowQueue({ entries, userId, pendingView }: {
  entries: NoShowQueueEntry[];
  userId: string;
  pendingView: boolean;
}) {
  const [staffName, setStaffName] = useState("");

  return <>
    {pendingView && entries.length > 0 && (
      <label className="mb-4 block max-w-xs text-sm font-semibold">
        Your staff name
        <input value={staffName} onChange={(event) => setStaffName(event.target.value)} className={textField}
          placeholder="First and last name" maxLength={100} autoComplete="name" />
      </label>
    )}
    <ul className="divide-y divide-zinc-800">
      {entries.map((entry) => <QueueEntry key={entry.id} entry={entry} userId={userId} staffName={staffName.trim()} />)}
    </ul>
  </>;
}

function QueueEntry({ entry, userId, staffName }: { entry: NoShowQueueEntry; userId: string; staffName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const isPending = entry.status === "pending";
  const isMyReview = entry.claimed_by === userId;

  async function update(action: Action) {
    if (busy) return;
    if (action === "charged" && !window.confirm(`Record that ${entry.player_name} was already charged in your billing system?`)) return;
    if (action === "release" && !window.confirm("Release this review so someone else can take it? Only release it if no charge was made.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/open-play-no-shows/" + entry.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, staffName, claimedAt: entry.claimed_at, reason }),
      });
      const data = await response.json();
      if (response.status === 409) router.refresh();
      if (!response.ok) throw new Error(data.error || "Unable to update the review.");
      setReason("");
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
      <div className="space-y-2">
        {!isPending ? (
          <div className="text-sm">
            <p className={entry.status === "charged" ? "font-bold text-green-300" : "font-bold text-amber-300"}>
              {entry.status === "charged" ? "Charged" : "Skipped"} by {entry.staff_name}
            </p>
            {entry.resolved_at && <p className="text-zinc-300">{reviewedAt.format(new Date(entry.resolved_at))} PT</p>}
            {entry.skip_reason && <p className="mt-2 whitespace-pre-wrap break-words text-zinc-300">{entry.skip_reason}</p>}
          </div>
        ) : !entry.claimed_by ? (
          <button type="button" className={actionButton} disabled={busy || !staffName}
            onClick={() => void update("claim")} aria-label={`Start review for ${entry.player_name}`}>
            Start review
          </button>
        ) : (
          <p className="text-sm font-semibold text-blue-300">In review by {entry.staff_name}</p>
        )}
        {isPending && isMyReview && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={actionButton} disabled={busy} onClick={() => void update("charged")}>Record charged</button>
              <button type="button" className={actionButton} disabled={busy} onClick={() => void update("release")}>Release review</button>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); void update("skipped"); }} className="space-y-2">
              <label className="block text-sm">Reason for skipping
                <textarea className={textField} value={reason} onChange={(event) => setReason(event.target.value)}
                  required rows={2} maxLength={500} />
              </label>
              <button type="submit" className={actionButton} disabled={busy || !reason.trim()}>Record skipped</button>
            </form>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      </div>
    </li>
  );
}
