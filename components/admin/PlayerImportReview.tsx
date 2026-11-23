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
}: {
  players: DatabasePlayerRecord[];
  onChoose: (decision: ImportDecision) => void;
  canLink: boolean;
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
                  Link verified identifiers
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
          <p className="mt-1 text-sm text-zinc-400">Verify returning players before linking identifiers or creating a new profile.</p>
        </div>
        <button type="button" className={buttonStyle} disabled={busy} onClick={onClose}>Close</button>
      </header>
      <fieldset disabled={busy || retryOnly} className="space-y-3">
        {rows.map((row) => {
          const preview = byRow.get(row.rowId);
          if (!preview) return null;
          const decision = decisions[row.rowId];
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
              <div className="mt-2 flex flex-wrap gap-2">
                {preview.status === "match" && candidate && decision?.action !== "match" && (
                  <button type="button" className={buttonStyle} onClick={() => choose({ action: "match", playerId: candidate.id })}>Use match</button>
                )}
                {preview.status === "review" && candidate && (
                  <button type="button" className={buttonStyle} onClick={() => choose({ action: "link", playerId: candidate.id })}>Verify and link</button>
                )}
                {preview.status === "review" && !candidate && decision?.action !== "new" && (
                  <button type="button" className={buttonStyle} onClick={() => choose({ action: "new" })}>Confirm new player</button>
                )}
                {decision?.action !== "skip" && (
                  <button type="button" className={buttonStyle} onClick={() => choose({ action: "skip" })}>Skip row</button>
                )}
              </div>
              <PlayerPicker
                players={players}
                canLink={preview.status === "review" && !candidate && Boolean(row.email || row.duprId)}
                onChoose={choose}
              />
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
        })}
      </fieldset>
      <footer className="sticky bottom-0 mt-4 space-y-2 border-t border-zinc-700 bg-zinc-900 pt-3">
        {(selectionError || error) && <p role="alert" className="text-sm text-red-300">{selectionError || error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-zinc-400">{selected} ready · {pending} need a decision</p>
          <div className="flex gap-2">
            {canRefresh && <button type="button" className={buttonStyle} disabled={busy} onClick={onRefresh}>Refresh matches</button>}
            <button
              type="button"
              disabled={busy || pending > 0 || Boolean(selectionError)}
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
