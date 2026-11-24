import { NextResponse } from "next/server";

import { getLeagueSeasonStandings } from "@/lib/server/league-season-standings";

export async function GET(request: Request) {
  try {
    const seasonId = new URL(request.url).searchParams.get("seasonId")?.trim();
    if (!seasonId) return NextResponse.json({ error: "A season ID is required." }, { status: 400 });
    return NextResponse.json(await getLeagueSeasonStandings(seasonId));
  } catch (error) {
    console.error("Unable to load cumulative standings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load cumulative standings." },
      { status: 500 },
    );
  }
}
