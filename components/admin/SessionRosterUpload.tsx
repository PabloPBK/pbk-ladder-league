"use client";

import { type FormEvent, useState } from "react";

import { PlayerImportReview } from "@/components/admin/PlayerImportReview";
import { useLeague } from "@/components/providers/LeagueProvider";
import { readLeagueRoster, resolveRosterReview } from "@/lib/data/league-roster";
import {
  importPlayers, PlayerImportError, rosterSelectionError,
  type AppliedRow, type CommitRow, type ImportDecision, type ImportRow, type PreviewRow,
} from "@/lib/data/playerImport";

type IdentitySave = { row: CommitRow; requestId: string };

type Review = {
  rows: ImportRow[];
  previews: PreviewRow[];
  reviewed: Record<number, ImportDecision>;
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
  const [retryIdentity, setRetryIdentity] = useState<IdentitySave>();
  const [savedIdentities, setSavedIdentities] = useState(() => new Set<number>());

  function updateBusy(value: boolean) {
    setBusy(value);
    onBusyChange(value || Boolean(review));
  }

  async function preview(rows: ImportRow[], replace: boolean, editedRowId?: number, refreshReview = false) {
    setError("");
    setConflict(false);
    setRetryOnly(false);
    const previews = await importPlayers({ mode: "preview", rows });
    const reviewed: Review["reviewed"] = {};
    if (review && (editedRowId !== undefined || refreshReview)) {
      const previous = new Map(review.previews.map((row) => [row.rowId, row]));
      for (const row of previews) {
        const before = previous.get(row.rowId);
        const decision = review.reviewed[row.rowId];
        if (row.rowId !== editedRowId && before && decision
          && (decision.action === "skip" || (before.status === row.status && before.reason === row.reason
            && before.player?.id === row.player?.id))) {
          reviewed[row.rowId] = decision;
        }
      }
    }
    setDrafts((current) => {
      if (editedRowId === undefined) return refreshReview ? current : {};
      const next = { ...current };
      delete next[editedRowId];
      return next;
    });
    if (editedRowId === undefined && !refreshReview) setSavedIdentities(new Set());
    setReview({ rows, previews, reviewed, requestId: crypto.randomUUID(), replace });
    onBusyChange(true);
  }

  async function load(getRows: () => Promise<ImportRow[]>, replace: boolean, editedRowId?: number, refreshReview = false) {
    if (busy || disabled) return;
    updateBusy(true);
    setSuccess("");
    try {
      await preview(await getRows(), replace, editedRowId, refreshReview);
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
    setRetryIdentity(undefined);
    setSavedIdentities(new Set());
    setError("");
    onBusyChange(false);
  }

  const resolution = review && resolveRosterReview(review.rows, review.previews, review.reviewed);

  async function saveIdentity(attempt: IdentitySave) {
    if (!review || busy) return;
    const { row, requestId } = attempt;
    try {
      updateBusy(true);
      setError("");
      setConflict(false);
      const [result] = await importPlayers({ mode: "commit", rows: [row], requestId });
      if (!result?.player) throw new Error("The player save could not be confirmed.");

      const player = result.player;
      setRetryIdentity(undefined);
      setSavedIdentities((current) => new Set(current).add(row.rowId));
      setReview({
        ...review,
        previews: review.previews.map((preview) => preview.rowId === row.rowId
          ? { rowId: row.rowId, status: "match", reason: row.duprId ? "dupr_id" : "email", player, savesEmail: false }
          : preview),
        reviewed: { ...review.reviewed, [row.rowId]: { action: "match", playerId: player.id } },
      });
    } catch (error) {
      const rejected = error instanceof PlayerImportError && error.status >= 400 && error.status < 500;
      setRetryIdentity(rejected ? undefined : attempt);
      setConflict(rejected && error.status === 409);
      setError(rejected ? error.message : "Retry the same save to confirm whether the player was updated.");
    } finally {
      setBusy(false);
    }
  }

  function choose(rowId: number, decision: ImportDecision) {
    if (!review || busy || retryIdentity) return;
    const row = review.rows.find((entry) => entry.rowId === rowId);
    if (row && (row.duprId || row.email) && (decision.action === "link" || decision.action === "new")) {
      void saveIdentity({ row: { ...row, decision }, requestId: crypto.randomUUID() });
      return;
    }
    setReview({ ...review, reviewed: { ...review.reviewed, [rowId]: decision } });
  }

  async function confirm() {
    if (!review || !resolution || busy || retryIdentity || Object.keys(drafts).length
      || rosterSelectionError(review.rows, resolution.decisions)) return;
    try {
      updateBusy(true);
      setError("");
      const rows = review.rows.map((row) => ({ ...row, decision: resolution.decisions[row.rowId] }));
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
      {review && resolution && <PlayerImportReview
        rows={review.rows} previews={review.previews} decisions={resolution.decisions}
        focusPending reviewedRowIds={new Set(Object.keys(review.reviewed).map(Number))}
        players={players.flatMap((player) => {
          const id = playerDatabaseIds[player.id];
          return id ? [{ id, name: player.name, dupr: player.savedDupr ?? player.dupr, dupr_id: player.duprId ?? null }] : [];
        })}
        busy={busy} error={error} retryOnly={retryOnly}
        saveIdentitiesImmediately
        savedIdentityCount={savedIdentities.size}
        onRetryIdentity={retryIdentity ? () => void saveIdentity(retryIdentity) : undefined}
        canRefresh={conflict}
        selectionError={Object.keys(drafts).length ? "Use Check DUPR ID on each edited row to continue." : rosterSelectionError(review.rows, resolution.decisions)}
        warnings={resolution.warnings}
        editedDuprIds={drafts}
        onEditDuprId={(rowId, value) => setDrafts((current) => ({ ...current, [rowId]: value }))}
        onCheckDuprId={(rowId) => void load(async () => review.rows.map((row) =>
          row.rowId === rowId ? { ...row, duprId: drafts[rowId].trim() || null } : row,
        ), review.replace, rowId)}
        onDecision={choose}
        onUndoDecision={(rowId) => {
          const reviewed = { ...review.reviewed };
          delete reviewed[rowId];
          setReview({ ...review, reviewed });
        }}
        onClose={close}
        onRefresh={() => void load(async () => review.rows, review.replace, undefined, true)}
        onConfirm={() => void confirm()}
      />}
    </section>
  );
}
