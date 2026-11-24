import { isUuid, publicWebUrl } from "../../zz2-site/lib/league-contract";
export { isUuid, leagueDate, publicWebUrl, registrationLabels } from "@/zz2-site/lib/league-contract";
export type { ListingFacility } from "@/zz2-site/lib/league-contract";

export const listingStatuses = ["draft", "published", "archived"] as const;
export const registrationStatuses = ["open", "full", "waitlist", "closed"] as const;
export const resultOptions = [
  ["show_daily_standings", "Daily standings"],
  ["show_season_standings", "Season standings"],
  ["show_player_stats", "DUPR ratings and player stats"],
  ["show_history", "Historical results"],
] as const;

function calendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value);
}

export function readLeagueListing(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid league listing.");
  const record = input as Record<string, unknown>;
  function field(key: string, max: number, label: string) {
    const raw = record[key];
    if (raw == null) return "";
    if (typeof raw !== "string" || raw.length > max || raw.includes("\0")) throw new Error("Invalid " + label + ".");
    return raw.trim();
  }
  function optionalUuid(key: string, label: string) {
    const value = field(key, 36, label);
    if (value && !isUuid(value)) throw new Error("Invalid " + label + ".");
    return value || null;
  }
  function optionalUrl(key: string, label: string) {
    const value = field(key, 2048, label);
    if (!value) return null;
    const url = publicWebUrl(value);
    if (!url) throw new Error("Enter a valid " + label + " URL.");
    return url;
  }
  const id = optionalUuid("id", "listing");
  const version = field("updated_at", 64, "listing version");
  if (id && (!version || !Number.isFinite(Date.parse(version)))) throw new Error("Reload the listing before editing.");
  const name = field("name", 180, "league name");
  const facility = optionalUuid("facility_id", "facility");
  const season = optionalUuid("season_id", "season");
  const league = optionalUuid("league_id", "operations league");
  const start = field("start_date", 10, "start date");
  const end = field("end_date", 10, "end date");
  if (!name || !facility) throw new Error("Enter a league name and choose a facility.");
  if (!calendarDate(start) || !calendarDate(end) || end < start) throw new Error("Enter valid dates with the end on or after the start.");
  const status = listingStatuses.find((option) => option === record.status);
  const registration = registrationStatuses.find((option) => option === record.registration_status);
  if (!status || !registration) throw new Error("Choose valid listing and registration statuses.");

  const results = {
    show_daily_standings: record.show_daily_standings === true,
    show_season_standings: record.show_season_standings === true,
    show_history: record.show_history === true,
    show_player_stats: record.show_player_stats === true,
  };
  if (Object.values(results).some(Boolean) && !season) throw new Error("Link a season before selecting public results.");
  if (results.show_player_stats && !results.show_daily_standings && !results.show_season_standings) {
    throw new Error("Choose daily or season standings to display player statistics.");
  }
  return {
    id,
    version,
    listing: {
      name, facility_id: facility, league_id: league, season_id: season,
      description: field("description", 6000, "description") || null,
      format: field("format", 180, "format") || null,
      skill_level: field("skill_level", 100, "skill level") || null,
      pricing: field("pricing", 100, "pricing") || null,
      start_date: start, end_date: end, status, registration_status: registration,
      registration_url: optionalUrl("registration_url", "registration"),
      logo_url: optionalUrl("logo_url", "logo"),
      dupr_rated: record.dupr_rated === true,
      ...results,
    },
  };
}

export type LeagueListing = ReturnType<typeof readLeagueListing>["listing"] & { id: string; updated_at: string };
