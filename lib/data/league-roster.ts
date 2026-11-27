import { getPodPlayImportFields, parsePodPlayCsv } from "./podplayRoster";
import type { ImportDecision, ImportRow, PreviewRow } from "./playerImport";
import type { DatabasePlayerRecord } from "./players";

export const missingDuprIdWarning = "Missing DUPR ID";

function rosterNameKey(name: string) {
  return name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
}

export function suggestedRosterPlayers(players: DatabasePlayerRecord[]) {
  const byName = new Map<string, DatabasePlayerRecord | null>();
  for (const player of players) {
    const key = rosterNameKey(player.name);
    if (key.includes(" ")) byName.set(key, byName.has(key) ? null : player);
  }
  return (row: ImportRow) => {
    const candidate = byName.get(rosterNameKey(row.name));
    if (candidate?.dupr_id && row.duprId && candidate.dupr_id.trim().toUpperCase() !== row.duprId.trim().toUpperCase()) return null;
    return candidate ?? null;
  };
}

export function readLeagueRoster(csv: string): ImportRow[] {
  const rows = parsePodPlayCsv(csv);
  if (!rows.length || !("Full Name" in rows[0])) throw new Error('Upload a PodPlay roster with a "Full Name" column.');
  const hasInvitationStatus = "Invitation Status" in rows[0];
  const roster = rows.flatMap((row, index) => {
    const name = row["Full Name"]?.trim().replace(/\s+/g, " ");
    const status = row["Invitation Status"]?.toUpperCase();
    if (!name || (hasInvitationStatus && (status !== "ACCEPTED" || row["Waitlist Enrollment Time"]))) return [];
    const { duprText, duprId, email } = getPodPlayImportFields(row);
    const rating = duprText ? Number(duprText) : null;
    if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 8)) {
      throw new Error(`${name} has an invalid doubles rating. Correct the CSV and upload it again.`);
    }
    return [{ rowId: index + 1, name, duprId: duprId || null, email: email || null, rating }];
  });
  if (!roster.length) throw new Error("No accepted players were found in the roster.");
  if (roster.length > 500) throw new Error("Upload a roster with 500 or fewer accepted players.");
  return roster.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name));
}

export function rosterWarnings(rows: ImportRow[], previews: PreviewRow[]) {
  const matched = new Map(previews.map((preview) => [preview.rowId, preview]));
  const counts = new Map<string, number>();
  const names = new Map<string, number>();
  const identities = rows.map((row) => {
    const preview = matched.get(row.rowId);
    const player = preview?.player;
    const keys = [
      row.duprId && `dupr:${row.duprId.trim().toUpperCase()}`,
      row.email && `email:${row.email.trim().toLowerCase()}`,
      player && `uuid:${player.id}`,
    ].filter((value): value is string => Boolean(value));
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    const name = row.name.normalize("NFKC").toLowerCase();
    names.set(name, (names.get(name) ?? 0) + 1);
    return { row, keys, player, name, verified: preview?.status === "match" };
  });
  return Object.fromEntries(identities.map(({ row, keys, player, name, verified }) => [
    row.rowId,
    [
      ...(!row.duprId && !player?.dupr_id ? [missingDuprIdWarning] : []),
      ...(keys.some((key) => (counts.get(key) ?? 0) > 1)
        ? ["Possible duplicate in this CSV"]
        : !verified && (names.get(name) ?? 0) > 1 ? ["This name appears more than once. Verify the players’ identities."] : []),
    ],
  ]));
}

export function resolveRosterReview(
  rows: ImportRow[],
  previews: PreviewRow[],
  reviewed: Record<number, ImportDecision>,
) {
  const warnings = rosterWarnings(rows.filter(({ rowId }) => reviewed[rowId]?.action !== "skip"), previews);
  const decisions = { ...reviewed };
  for (const { rowId, status, player } of previews) {
    if (!decisions[rowId] && status === "match" && player && !warnings[rowId]?.some((warning) => warning !== missingDuprIdWarning)) {
      decisions[rowId] = { action: "match", playerId: player.id };
    }
  }
  return { decisions, warnings };
}

export function readSessionRating(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return undefined;
  const rating = Number(trimmed);
  return rating <= 8 ? rating : undefined;
}
