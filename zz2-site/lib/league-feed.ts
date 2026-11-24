import "server-only";

import type { LeagueDetailFeed, LeagueDirectoryFeed } from "./league-contract";

async function leagueFeed<T>(params: Record<string, string>) {
  const origin = process.env.TOURNAMENT_FEED_URL;
  const base = process.env.LEAGUE_FEED_URL ?? (origin ? new URL("/api/public/zz2/leagues", origin).href : "");
  if (!base) throw new Error("The league feed is not configured.");
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("The league feed is temporarily unavailable.");
  return response.json() as Promise<T>;
}

export function getPublicLeagues(facilityId?: string) {
  return leagueFeed<LeagueDirectoryFeed>(facilityId ? { facility: facilityId } : {});
}

export function getPublicLeague(id: string, eventId?: string) {
  return leagueFeed<LeagueDetailFeed>(eventId ? { id, event: eventId } : { id });
}
