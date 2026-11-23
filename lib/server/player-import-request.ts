import type { CommitRow, ImportDecision, ImportRequest, ImportRow } from "../data/playerImport";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid roster request.");
  }
  return value as Record<string, unknown>;
}

function optionalText(value: unknown, max: number, label: string) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length > max || value.includes("\0")) {
    throw new Error(`Invalid ${label}.`);
  }
  return value.trim() || null;
}

function readDecision(value: unknown): ImportDecision {
  const { action, playerId } = object(value);
  if (action === "new" || action === "skip") return { action };
  if ((action === "match" || action === "link" || action === "check-in") && typeof playerId === "string" && uuid.test(playerId)) {
    return { action, playerId: playerId.toLowerCase() };
  }
  throw new Error("Invalid roster decision.");
}

export function readImportRequest(value: unknown): ImportRequest {
  const { mode, rows, requestId } = object(value);
  if (mode !== "preview" && mode !== "commit") throw new Error("Invalid import mode.");
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 500) {
    throw new Error("Select between 1 and 500 rows.");
  }

  const seen = new Set<number>();
  const parsed = rows.map((input): ImportRow | CommitRow => {
    const { rowId, name: inputName, email: inputEmail, duprId: inputDuprId, rating, decision } = object(input);
    if (typeof rowId !== "number" || !Number.isSafeInteger(rowId) || rowId < 1 || seen.has(rowId)) {
      throw new Error("Each source row must have its own row number.");
    }
    seen.add(rowId);
    const name = optionalText(inputName, 250, "player name")?.replace(/\s+/g, " ");
    if (!name) throw new Error(`Row ${rowId} needs a player name.`);
    if (rating !== null && (typeof rating !== "number" || !Number.isFinite(rating) || rating < 0 || rating > 8)) {
      throw new Error(`Row ${rowId} needs a rating between 0 and 8, or a blank rating.`);
    }
    // Keep malformed identifiers in the preview so staff can correct, omit, or skip that row.
    const email = optionalText(inputEmail, 254, "email");
    const duprId = optionalText(inputDuprId, 64, "DUPR ID");
    const row = { rowId, name, email, duprId, rating };
    return mode === "preview" ? row : { ...row, decision: readDecision(decision) };
  });

  if (mode === "preview") return { mode, rows: parsed };
  if (typeof requestId !== "string" || !uuid.test(requestId)) {
    throw new Error("An import request ID is required.");
  }
  return { mode, rows: parsed as CommitRow[], requestId: requestId.toLowerCase() };
}
