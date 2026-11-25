import { parsePodPlayCsvTable } from "./podplayRoster";

export const noShowStartDate = "2026-11-26";
export const noShowFacilityId = "e022d6a9-a957-44dc-ab8a-d7460b906124";
export const noShowFacilityName = "Pickleball Kingdom Lynnwood";
export const noShowMaxFiles = 5;
export const noShowMaxFileSize = 500_000;
export const noShowStatuses = ["pending", "charged", "reversed"] as const;
export type NoShowStatus = typeof noShowStatuses[number];

export function validNoShowDate(date: string) {
  return date >= noShowStartDate && validCalendarDate(date);
}

export function validCalendarDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith("0000")) return false;
  const parsed = new Date(date + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function playerIdentity(name: string, email: string) {
  return email ? "email:" + email : "name:" + name.normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
}

export function readNoShowRoster(text: string) {
  const [headers, ...rows] = parsePodPlayCsvTable(text, { strict: true });
  const lower = headers?.map((value) => value.trim().toLowerCase()) ?? [];
  const nameIndex = lower.indexOf("full name");
  const statusIndex = lower.indexOf("invitation status");
  const emailIndex = lower.findIndex((value) => value === "email" || value === "email address");
  if (nameIndex < 0 || statusIndex < 0 || new Set(lower).size !== lower.length) {
    throw new Error("Use a PodPlay export with Full Name and Invitation Status columns.");
  }
  if (rows.length > 1000) throw new Error("Each export can contain up to 1,000 rows.");

  const players = new Map<string, { player_name: string; player_email: string | null; player_key: string }>();
  const otherStatuses = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const name = row[nameIndex].trim();
    const status = row[statusIndex].trim().toUpperCase();
    const rawEmail = row[emailIndex]?.trim().toLowerCase() ?? "";
    const email = rawEmail.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : "";
    const key = playerIdentity(name, email);

    if (status !== "ACCEPTED") {
      if (name) otherStatuses.add(key);
      continue;
    }
    if (!name || name.length > 160) throw new Error("CSV row " + (index + 2) + " needs a valid player name.");
    if (!players.has(key)) players.set(key, { player_name: name, player_email: email || null, player_key: key });
  }

  if ([...players.keys()].some((key) => otherStatuses.has(key))) {
    throw new Error("A player has conflicting invitation statuses in this file. Verify attendance and export the roster again.");
  }

  return [...players.values()];
}

export type NoShowQueueEntry = {
  id: string;
  session_date: string;
  session_time: string;
  session_name: string;
  player_name: string;
  player_email: string | null;
  status: NoShowStatus | "skipped";
  claimed_by: string | null;
  claimed_at: string | null;
  staff_name: string | null;
  resolved_at: string | null;
  skip_reason: string | null;
  charge_cents: number | null;
  reversal_cents: number | null;
  reversal_reason: string | null;
  reversal_staff_name: string | null;
  reversed_at: string | null;
  notes: string | null;
  notes_updated_at: string | null;
  notes_staff_name: string | null;
};

export type NoShowPlayerGroup = {
  player_key: string;
  entries: [NoShowQueueEntry, ...NoShowQueueEntry[]];
};
