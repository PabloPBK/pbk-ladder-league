import { NextRequest, NextResponse } from "next/server";
import { getCompletedLeagueEvent } from "@/lib/server/league-event-history";
import { getLeagueEventPrize } from "@/lib/server/league-event-prize";
import { getLeagueSeasonStandings } from "@/lib/server/league-season-standings";
import { getLeagueListings, getListingFacilities, getPublishedLeagueEvents, getPublishedLeagueListing } from "@/lib/server/league-listings";
import type { LeagueListing } from "@/lib/data/league-listings";
import { isUuid, publicWebUrl, type LeagueDetailFeed, type PublishedLeague, type PublicLeagueStanding } from "@/zz2-site/lib/league-contract";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

function published(listing: LeagueListing): PublishedLeague {
  const { id, name, facility_id, description, format, skill_level, dupr_rated, pricing,
    start_date, end_date, registration_status } = listing;
  return { id, name, facility_id, description, format, skill_level, dupr_rated, pricing,
    start_date, end_date, registration_status, registration_url: publicWebUrl(listing.registration_url),
    logo_url: publicWebUrl(listing.logo_url) };
}

function publicStanding(row: {
  rank: number; name: string; wins: number; losses: number; pointDifferential: number;
  dupr: number; gamesPlayed: number; pointsFor: number; pointsAgainst: number;
}, playerStats: boolean): PublicLeagueStanding {
  const { rank, name, wins, losses, pointDifferential, dupr, gamesPlayed, pointsFor, pointsAgainst } = row;
  return { position: rank, name, wins, losses, pointDifferential,
    ...(playerStats && { dupr, gamesPlayed, pointsFor, pointsAgainst }),
  };
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const facilityId = request.nextUrl.searchParams.get("facility");
  const eventId = request.nextUrl.searchParams.get("event");
  if ([id, facilityId, eventId].some((value) => value !== null && !isUuid(value)) || (eventId && !id)) {
    return NextResponse.json({ error: "Invalid league query." }, { status: 400, headers });
  }
  try {
    if (!id) {
      const [listings, facilities] = await Promise.all([
        getLeagueListings({ published: true, facilityId: facilityId ?? undefined }), getListingFacilities(),
      ]);
      if (facilityId && !facilities.some((facility) => facility.id === facilityId.toLowerCase())) {
        return NextResponse.json({ error: "Facility not found." }, { status: 404, headers });
      }
      return NextResponse.json({ listings: listings.map(published), facilities }, { headers });
    }
    const listing = await getPublishedLeagueListing(id);
    if (!listing || (facilityId && listing.facility_id !== facilityId.toLowerCase())) {
      return NextResponse.json({ error: "League not found." }, { status: 404, headers });
    }
    const { season_id: seasonId, show_daily_standings: daily, show_season_standings: season,
      show_history: history, show_player_stats: playerStats } = listing;
    const [facilities, events] = await Promise.all([
      getListingFacilities(),
      seasonId && (daily || season || history) ? getPublishedLeagueEvents(seasonId, listing.league_id) : null,
    ]);
    const selected = daily || history ? (eventId ? events?.find((event) => event.id === eventId.toLowerCase()) : events?.[0]) : undefined;
    if (eventId && !selected) return NextResponse.json({ error: "League night not found." }, { status: 404, headers });

    const [seasonResults, dayResults, dailyPrizeCents] = await Promise.all([
      season && seasonId && events?.length ? getLeagueSeasonStandings(seasonId) : null,
      selected && seasonId ? getCompletedLeagueEvent(selected.id, seasonId) : null,
      daily && selected && seasonId ? getLeagueEventPrize(selected.id) : null,
    ]);
    const rounds = history && dayResults ? dayResults.rounds.flatMap((round) => {
      const courts = round.courts.flatMap((court) => {
        if (!court.complete || court.team1Score === null || court.team2Score === null) return [];
        return [{ number: court.courtNumber, team1: court.team1.map((p) => p.name), team2: court.team2.map((p) => p.name),
          score1: court.team1Score, score2: court.team2Score }];
      });
      return courts.length ? [{ number: round.roundNumber, courts }] : [];
    }) : [];

    const response: LeagueDetailFeed = {
      listing: published(listing),
      facility: facilities.find((facility) => facility.id === listing.facility_id) ?? null,
      sections: { daily, season, history, playerStats },
      events: daily || history ? events ?? [] : [],
      selectedEventId: selected?.id ?? null,
      seasonStandings: seasonResults?.standings.map((row) => publicStanding(row, playerStats)) ?? [],
      dailyStandings: daily && dayResults ? dayResults.standings.map((row) => publicStanding(row, playerStats)) : [],
      dailyPrizeCents,
      rounds,
    };
    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error("Public league feed failed:", error);
    return NextResponse.json({ error: "League listings are temporarily unavailable." }, { status: 503, headers });
  }
}
