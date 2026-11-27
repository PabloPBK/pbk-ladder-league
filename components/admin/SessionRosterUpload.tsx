"use client";

import { type FormEvent, useState } from "react";

import { PlayerImportReview } from "@/components/admin/PlayerImportReview";
import { useLeague } from "@/components/providers/LeagueProvider";
import { readLeagueRoster, rosterWarnings } from "@/lib/data/league-roster";
import {
  importPlayers, PlayerImportError, rosterSelectionError,
  type AppliedRow, type ImportDecision, type ImportRow, type PreviewRow,
} from "@/lib/data/playerImport";

type Review = {
  rows: ImportRow[];
  previews: PreviewRow[];
  decisions: Record<number, ImportDecision>;
  requestId: string;
  replace: boolean;
};

export function SessionRosterUpload({
  onApply, onBusyChange, disabled,
}: {
  onApply: (rows: AppliedRow[], replace: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const { players, playerDatabaseIds } = useLeague();
  const [review, setReview] = useState<Review>();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [conflict, setConflict] = useState(false);
  const [retryOnly, setRetryOnly] = useState(false);

  function updateBusy(value: boolean) {
    setBusy(value);
    onBusyChange(value || Boolean(review));
  }

  async function preview(rows: ImportRow[], replace: boolean) {
    setError("");
    setConflict(false);
    setRetryOnly(false);
    const previews = await importPlayers({ mode: "preview", rows });
    const decisions: Record<number, ImportDecision> = {};
    for (const row of previews) {
      if (row.status === "match" && row.player) decisions[row.rowId] = { action: "match", playerId: row.player.id };
    }
    setDrafts({});
    setReview({ rows, previews, decisions, requestId: crypto.randomUUID(), replace });
    onBusyChange(true);
  }

  async function load(getRows: () => Promise<ImportRow[]>, replace: boolean) {
    if (busy || disabled) return;
    updateBusy(true);
    setSuccess("");
    try {
      await preview(await getRows(), replace);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to check the roster.");
      setConflict(Boolean(review));
      onBusyChange(Boolean(review));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setReview(undefined);
    setDrafts({});
    setError("");
    onBusyChange(false);
  }

  async function confirm() {
    if (!review || busy || Object.keys(drafts).length || rosterSelectionError(review.rows, review.decisions)) return;
    try {
      updateBusy(true);
      setError("");
      const rows = review.rows.map((row) => ({ ...row, decision: review.decisions[row.rowId] }));
      if (rows.some(({ decision }) => !decision)) return;
      const applied = await importPlayers({ mode: "commit", rows, requestId: review.requestId });
      onApply(applied, review.replace);
      const checkedIn = applied.filter(({ player }) => player).length;
      setSuccess(`${checkedIn} ready for check-in · ${applied.length - checkedIn} skipped.`);
      close();
    } catch (error) {
      const rejected = error instanceof PlayerImportError && error.status >= 400 && error.status < 500;
      setConflict(rejected && error.status === 409);
      setRetryOnly(!rejected);
      setError(rejected ? error.message : "Retry this same submission to confirm whether the roster was saved.");
    } finally {
      setBusy(false);
    }
  }

  function walkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    void load(async () => [{
      rowId: 1, name, email: String(form.get("email") || "").trim() || null,
      duprId: String(form.get("duprId") || "").trim() || null, rating: null,
    }], false);
  }

  return (
    <section className="mt-5 rounded-xl border border-zinc-700 bg-zinc-950 p-4">
      <label className="block text-lg font-bold text-white">
        Upload CSV
        <input className="mt-2 block max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:font-semibold file:text-white"
          type="file" accept=".csv,text/csv" disabled={busy || disabled} onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void load(async () => readLeagueRoster(await file.text()), true);
          }} />
      </label>
      <p className="mt-2 text-sm text-zinc-400">Upload the PodPlay roster to check for missing DUPR IDs and duplicates.</p>
      {!review && busy && <p role="status" className="mt-2 text-sm">Checking roster…</p>}
      {!review && error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
      {success && <p role="status" className="mt-2 text-sm text-green-300">{success}</p>}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-blue-300">Add a walk-in</summary>
        <form onSubmit={walkIn} className="mt-2 flex flex-wrap items-end gap-2">
          <label>Player name<input required name="name" maxLength={250} className="block rounded border border-zinc-700 bg-zinc-900 p-2" /></label>
          <label>Email<input type="email" name="email" maxLength={254} className="block rounded border border-zinc-700 bg-zinc-900 p-2" /></label>
          <label>DUPR ID<input name="duprId" maxLength={64} className="block rounded border border-zinc-700 bg-zinc-900 p-2" /></label>
          <button type="submit" disabled={busy || disabled} className="rounded border border-zinc-600 px-3 py-2 disabled:opacity-50">Review walk-in</button>
        </form>
      </details>
      {review && <PlayerImportReview
        rows={review.rows} previews={review.previews} decisions={review.decisions}
        players={players.flatMap((player) => {
          const id = playerDatabaseIds[player.id];
          return id ? [{ id, name: player.name, dupr: player.savedDupr ?? player.dupr, dupr_id: player.duprId ?? null }] : [];
        })}
        busy={busy} error={error} retryOnly={retryOnly}
        canRefresh={conflict || Boolean(Object.keys(drafts).length)}
        selectionError={Object.keys(drafts).length ? "Refresh matches to check the edited DUPR IDs." : rosterSelectionError(review.rows, review.decisions)}
        warnings={rosterWarnings(review.rows, review.previews)}
        editedDuprIds={drafts}
        onEditDuprId={(rowId, value) => setDrafts((current) => ({ ...current, [rowId]: value }))}
        onDecision={(rowId, decision) => setReview({ ...review, decisions: { ...review.decisions, [rowId]: decision } })}
        onClose={close}
        onRefresh={() => void load(async () => review.rows.map((row) => ({
          ...row, duprId: Object.hasOwn(drafts, row.rowId) ? drafts[row.rowId].trim() || null : row.duprId,
        })), review.replace)}
        onConfirm={() => void confirm()}
      />}
    </section>
  );
}
