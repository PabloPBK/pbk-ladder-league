export const registrationLabels = {
  open: "Registration open",
  full: "Full",
  waitlist: "Waitlist",
  closed: "Registration closed",
} as const;

export const isUuid = (value: string) => /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

export function publicWebUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch {
    return null;
  }
  return null;
}

export function leagueDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(value + "T12:00:00Z"));
}

const prizeMoneyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export function formatPrizeMoney(cents: number) {
  return prizeMoneyFormat.format(cents / 100);
}

export type ListingFacility = { id: string; name: string; city: string | null; state: string | null };

export type PublishedLeague = {
  id: string; name: string; facility_id: string; description: string | null;
  format: string | null; skill_level: string | null; dupr_rated: boolean; pricing: string | null;
  start_date: string; end_date: string; registration_status: keyof typeof registrationLabels;
  registration_url: string | null; logo_url: string | null;
};

export type PublicLeagueStanding = {
  position: number; name: string; wins: number; losses: number; pointDifferential: number;
  dupr?: number; gamesPlayed?: number; pointsFor?: number; pointsAgainst?: number;
};

export type LeagueDirectoryFeed = { listings: PublishedLeague[]; facilities: ListingFacility[] };

export type LeagueDetailFeed = {
  listing: PublishedLeague;
  facility: ListingFacility | null;
  sections: { daily: boolean; season: boolean; history: boolean; playerStats: boolean };
  events: { id: string; name: string; event_date: string; session_number: number }[];
  selectedEventId: string | null;
  seasonStandings: PublicLeagueStanding[];
  dailyStandings: PublicLeagueStanding[];
  dailyPrizeCents?: number | null;
  rounds: { number: number; courts: {
    number: number; team1: string[]; team2: string[]; score1: number; score2: number;
  }[] }[];
};
