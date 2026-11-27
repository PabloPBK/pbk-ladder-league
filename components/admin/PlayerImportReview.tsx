"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { ImportDecision, ImportRow, PreviewRow } from "@/lib/data/playerImport";
import type { DatabasePlayerRecord } from "@/lib/data/players";

const messages: Record<string, string> = {
  dupr_id: "DUPR ID matches",
  email: "Email matches",
  no_identifier: "No DUPR ID or email supplied",
  no_identifier_match: "No saved DUPR ID or email matches",
  verify_new_dupr_id: "Email matches. Verify the new DUPR ID before saving it.",
  invalid_identifier: "The email or DUPR ID is invalid. Check in a verified player without saving these identifiers, or skip this row.",
  different_players: "DUPR ID and email point to different players. Check in a verified player without saving these identifiers, or skip this row.",
  different_identifier: "An identifier disagrees with the saved profile. Check in a verified player without saving these identifiers, or skip this row.",
};

const buttonStyle = "rounded-lg border border-zinc-600 px-3 py-2 text-sm font-semibold disabled:opacity-40";

function PlayerPicker({
  players,
  onChoose,
  canLink,
  saveIdentitiesImmediately,
}: {
  players: DatabasePlayerRecord[];
  onChoose: (decision: ImportDecision) => void;
  canLink: boolean;
  saveIdentitiesImmediately: boolean;
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const matches = query ? players.filter((player) =>
    [player.name, player.dupr_id, player.id].some((value) => value?.toLowerCase().includes(query)),
  ) : [];

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm font-semibold">Find an existing player</summary>
      <label className="mt-2 block text-sm">
        Search by name, DUPR ID or player UUID
        <input
          type="search"
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {query && matches.length === 0 && <p className="mt-2 text-sm text-zinc-400">No saved players found.</p>}
      {query && canLink && saveIdentitiesImmediately && (
        <p className="mt-2 text-sm text-zinc-400">Save the verified link to match future CSVs by their email or DUPR ID.</p>
      )}
      {matches.length > 20 && <p className="mt-2 text-sm text-zinc-400">Showing the first 20 matches. Narrow your search to see others.</p>}
      <ul className="mt-2 space-y-2">
        {matches.slice(0, 20).map((player) => (
          <li key={player.id} className="rounded-lg border border-zinc-700 p-2">
            <p className="mb-2 text-sm">
              {player.name} · Rating {Number(player.dupr).toFixed(2)} · {player.dupr_id ? `DUPR ID ${player.dupr_id}` : "No DUPR ID"} · Player …{player.id.slice(-8)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {canLink && (
                <button type="button" className={buttonStyle} onClick={() => onChoose({ action: "link", playerId: player.id })}>
                  {saveIdentitiesImmediately ? "Save verified link" : "Link verified identifiers"}
                </button>
              )}
              <button type="button" className={buttonStyle} onClick={() => onChoose({ action: "check-in", playerId: player.id })}>
                Check in only
              </button>
              <Link
                href={`/players/${player.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-200 underline"
              >
                Player history
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

type ReviewProps = {
  rows: ImportRow[];
  previews: PreviewRow[];
  decisions: Record<number, ImportDecision>;
  players: DatabasePlayerRecord[];
  busy: boolean;
  error: string;
  selectionError: string;
  canRefresh: boolean;
  retryOnly: boolean;
  focusPending?: boolean;
  saveIdentitiesImmediately?: boolean;
  savedIdentityCount?: number;
  onRetryIdentity?: () => void;
  reviewedRowIds?: Set<number>;
  warnings?: Record<number, string[]>;
  editedDuprIds?: Record<number, string>;
  onEditDuprId?: (rowId: number, value: string) => void;
  onCheckDuprId?: (rowId: number) => void;
  onUndoDecision?: (rowId: number) => void;
  onDecision: (rowId: number, decision: ImportDecision) => void;
  onClose: () => void;
  onRefresh: () => void;
  onConfirm: () => void;
};

export function PlayerImportReview({
  rows,
  previews,
  decisions,
  players,
  busy,
  error,
  selectionError,
  canRefresh,
  retryOnly,
  focusPending = false,
  saveIdentitiesImmediately = false,
  savedIdentityCount = 0,
  onRetryIdentity,
  reviewedRowIds,
  warnings,
  editedDuprIds,
  onEditDuprId,
  onCheckDuprId,
  onUndoDecision,
  onDecision,
  onClose,
  onRefresh,
  onConfirm,
}: ReviewProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const byRow = new Map(previews.map((row) => [row.rowId, row]));
  const byPlayer = new Map(players.map((player) => [player.id, player]));
  const pending = rows.filter(({ rowId }) => !decisions[rowId]).length;
  const selected = rows.filter(({ rowId }) => decisions[rowId] && decisions[rowId].action !== "skip").length;

  const visibleRows = focusPending ? rows.filter(({ rowId }) => !decisions[rowId] || editedDuprIds?.[rowId] !== undefined) : rows;
  const completedRows = focusPending ? rows.filter(({ rowId }) => decisions[rowId] && editedDuprIds?.[rowId] === undefined) : [];

  function renderRow(row: ImportRow) {
    const preview = byRow.get(row.rowId);
    if (!preview) return null;
    const decision = decisions[row.rowId];
    const edited = editedDuprIds?.[row.rowId] !== undefined;
    const candidate = preview.player;
    const chosen = decision && "playerId" in decision
      ? byPlayer.get(decision.playerId) ?? candidate
      : null;
    const choose = (choice: ImportDecision) => onDecision(row.rowId, choice);
    return (
      <section key={row.rowId} aria-label={`Row ${row.rowId}, ${row.name}`} className="rounded-xl border border-zinc-700 bg-zinc-950 p-3">
        <h3 className="font-semibold">{row.name}</h3>
        <p className="break-all text-sm text-zinc-400">
          Row {row.rowId}{row.email && ` · ${row.email}`}{row.duprId && ` · DUPR ID ${row.duprId}`}
        </p>
        <p className={preview.status === "conflict" ? "mt-2 text-sm text-red-300" : "mt-2 text-sm text-zinc-300"}>
          {messages[preview.reason]}{candidate && preview.status !== "conflict" && ` · ${candidate.name} (…${candidate.id.slice(-8)})`}
          {preview.savesEmail && " · Save this email"}
        </p>
        {warnings?.[row.rowId]?.map((warning) => <p key={warning} className="mt-1 text-sm font-semibold text-amber-300">{warning}</p>)}
        {onEditDuprId && (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-sm">
              DUPR ID for {row.name}
              <input value={editedDuprIds?.[row.rowId] ?? row.duprId ?? ""} maxLength={64}
                onChange={(event) => onEditDuprId(row.rowId, event.target.value)}
                className="ml-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" />
            </label>
            {onCheckDuprId && edited && (
              <button type="button" className={buttonStyle} onClick={() => onCheckDuprId(row.rowId)}>Check DUPR ID</button>
            )}
          </div>
        )}
        <fieldset disabled={edited} className="mt-2">
          <div className="flex flex-wrap gap-2">
            {preview.status === "match" && candidate && decision?.action !== "match" && (
              <button type="button" className={buttonStyle} onClick={() => choose({ action: "match", playerId: candidate.id })}>Use match</button>
            )}
            {preview.status === "review" && candidate && (
              <button type="button" className={buttonStyle} onClick={() => choose({ action: "link", playerId: candidate.id })}>{saveIdentitiesImmediately ? "Save verified link" : "Verify and link"}</button>
            )}
            {preview.status === "review" && !candidate && decision?.action !== "new" && (
              <button type="button" className={buttonStyle} onClick={() => choose({ action: "new" })}>{saveIdentitiesImmediately && (row.duprId || row.email) ? "Save new player" : "Confirm new player"}</button>
            )}
            {reviewedRowIds?.has(row.rowId) && onUndoDecision && (
              <button type="button" className={buttonStyle} onClick={() => onUndoDecision(row.rowId)}>Undo decision</button>
            )}
            {decision?.action !== "skip" && (
              <button type="button" className={buttonStyle} onClick={() => choose({ action: "skip" })}>Skip row</button>
            )}
          </div>
          <PlayerPicker
            players={players}
            canLink={preview.status === "review" && !candidate && Boolean(row.email || row.duprId)}
            onChoose={choose}
            saveIdentitiesImmediately={saveIdentitiesImmediately}
          />
        </fieldset>
        {decision && (
          <p className="mt-2 text-sm font-semibold text-blue-200">
            {decision.action === "new" && "New player confirmed"}
            {decision.action === "skip" && "Skipped"}
            {decision.action === "link" && `Link to ${chosen?.name ?? "saved player"}${row.email || row.duprId ? " and save verified identifiers" : ""}`}
            {decision.action === "check-in" && `Check in ${chosen?.name ?? "saved player"} without saving identifiers`}
            {decision.action === "match" && `Use ${chosen?.name ?? "saved player"}`}
          </p>
        )}
      </section>
    );
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="player-review-title"
      className="m-auto max-h-[90vh] w-[min(46rem,95vw)] rounded-2xl border border-zinc-700 bg-zinc-900 p-5 text-white backdrop:bg-black/75"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id="player-review-title" className="text-xl font-bold">Review player matches</h2>
          <p className="mt-1 text-sm text-zinc-400">{saveIdentitiesImmediately
            ? "Save verified links for future uploads. Apply and check in when the roster is ready."
            : "Verify returning players before linking identifiers or creating a new profile."}</p>
        </div>
        <button type="button" className={buttonStyle} disabled={busy} onClick={onClose}>Close</button>
      </header>
      <fieldset disabled={busy || retryOnly || Boolean(onRetryIdentity)} className="space-y-3">
        {visibleRows.map(renderRow)}
        {focusPending && visibleRows.length === 0 && !selectionError && (
          <p role="status" className="text-sm text-green-300">All roster rows have been reviewed.</p>
        )}
        {focusPending && completedRows.length > 0 && (
          <details className="rounded-xl border border-zinc-700 p-3">
            <summary className="cursor-pointer text-sm text-zinc-300">Show reviewed players ({completedRows.length})</summary>
            <div className="mt-3 space-y-3">{completedRows.map(renderRow)}</div>
          </details>
        )}
      </fieldset>
      <footer className="sticky bottom-0 mt-4 space-y-2 border-t border-zinc-700 bg-zinc-900 pt-3">
        {(selectionError || error) && <p role="alert" className="text-sm text-red-300">{error || selectionError}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" className="text-sm text-zinc-400">
            {selected} ready · {pending} need a decision
            {savedIdentityCount > 0 && <span className="ml-2 text-green-300">{savedIdentityCount} saved for future uploads</span>}
          </p>
          <div className="flex gap-2">
            {onRetryIdentity && <button type="button" className={buttonStyle} disabled={busy} onClick={onRetryIdentity}>Retry player save</button>}
            {canRefresh && <button type="button" className={buttonStyle} disabled={busy} onClick={onRefresh}>Refresh matches</button>}
            <button
              type="button"
              disabled={busy || pending > 0 || Boolean(selectionError) || Boolean(onRetryIdentity)}
              className="rounded-lg bg-green-700 px-4 py-2 font-semibold disabled:opacity-40"
              onClick={onConfirm}
            >
              {busy ? "Applying…" : retryOnly ? "Retry submission" : selected ? "Apply and check in" : "Finish review"}
            </button>
          </div>
        </div>
      </footer>
    </dialog>
  );
}
