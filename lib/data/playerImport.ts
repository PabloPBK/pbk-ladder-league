import type { DatabasePlayerRecord } from "@/lib/data/players";

export type ImportRow = {
  rowId: number;
  name: string;
  email: string | null;
  duprId: string | null;
  rating: number | null;
};

export type ImportDecision =
  | { action: "match" | "link" | "check-in"; playerId: string }
  | { action: "new" | "skip" };

export type CommitRow = ImportRow & { decision: ImportDecision };

export type PreviewRow = {
  rowId: number;
  status: "match" | "review" | "conflict";
  reason: string;
  player: DatabasePlayerRecord | null;
  savesEmail: boolean;
};

export type AppliedRow = {
  rowId: number;
  status: "matched" | "linked" | "created" | "skipped";
  player: DatabasePlayerRecord | null;
  rating: number | null;
};

export type ImportRequest =
  | { mode: "preview"; rows: ImportRow[] }
  | { mode: "commit"; rows: CommitRow[]; requestId: string };

export class PlayerImportError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function importPlayers(request: { mode: "preview"; rows: ImportRow[] }): Promise<PreviewRow[]>;
export async function importPlayers(request: { mode: "commit"; rows: CommitRow[]; requestId: string }): Promise<AppliedRow[]>;
export async function importPlayers(request: ImportRequest): Promise<PreviewRow[] | AppliedRow[]> {
  const response = await fetch("/api/players/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  let result: { rows?: PreviewRow[] | AppliedRow[]; error?: string };
  try {
    result = await response.json();
  } catch {
    throw new PlayerImportError("The roster server did not respond. Retry this review.", response.status);
  }
  if (!response.ok || !result.rows) {
    throw new PlayerImportError(result.error ?? "Unable to prepare the roster.", response.status);
  }
  return result.rows;
}

export function rosterSelectionError(rows: ImportRow[], decisions: Record<number, ImportDecision>): string {
  const emails = new Set<string>();
  const duprIds = new Set<string>();
  const playerIds = new Set<string>();

  for (const row of rows) {
    const decision = decisions[row.rowId];
    if (!decision || decision.action === "skip") continue;

    const usesIdentifiers = decision.action !== "check-in";
    const email = usesIdentifiers ? row.email?.trim().toLowerCase() : null;
    const duprId = usesIdentifiers ? row.duprId?.trim().toUpperCase() : null;
    const playerId = "playerId" in decision ? decision.playerId : null;
    if ((email && emails.has(email)) || (duprId && duprIds.has(duprId)) || (playerId && playerIds.has(playerId))) {
      return `Row ${row.rowId} repeats an identifier or player. Skip the extra row or choose a verified player for check-in only.`;
    }
    if (email) emails.add(email);
    if (duprId) duprIds.add(duprId);
    if (playerId) playerIds.add(playerId);
  }
  return "";
}
