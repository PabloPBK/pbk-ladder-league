import { getPodPlayImportFields, parsePodPlayCsv } from "./podplayRoster";
import type { ImportDecision, ImportRow, PreviewRow } from "./playerImport";

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
  const matched = new Map(previews.map((preview) => [preview.rowId, preview.player]));
  const counts = new Map<string, number>();
  const names = new Map<string, number>();
  const identities = rows.map((row) => {
    const player = matched.get(row.rowId);
    const keys = [
      row.duprId && `dupr:${row.duprId.trim().toUpperCase()}`,
      row.email && `email:${row.email.trim().toLowerCase()}`,
      player && `uuid:${player.id}`,
    ].filter((value): value is string => Boolean(value));
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    const name = row.name.normalize("NFKC").toLowerCase();
    names.set(name, (names.get(name) ?? 0) + 1);
    return { row, keys, player, name };
  });
  return Object.fromEntries(identities.map(({ row, keys, player, name }) => [
    row.rowId,
    [
      ...(!row.duprId && !player?.dupr_id ? ["Missing DUPR ID"] : []),
      ...(keys.some((key) => (counts.get(key) ?? 0) > 1)
        ? ["Possible duplicate in this CSV"]
        : (names.get(name) ?? 0) > 1 ? ["This name appears more than once. Verify the players’ identities."] : []),
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
    if (!decisions[rowId] && status === "match" && player && !warnings[rowId]?.length) {
      decisions[rowId] = { action: "match", playerId: player.id };
    }
  }
  return { decisions, warnings };
}
