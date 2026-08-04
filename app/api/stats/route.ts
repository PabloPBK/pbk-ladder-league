import { NextRequest, NextResponse } from "next/server";

import { getSeasonStandings } from "@/lib/server/statistics";

export async function GET(request: NextRequest) {
  try {
    const seasonId =
      request.nextUrl.searchParams.get("seasonId");

    if (!seasonId) {
      return NextResponse.json(
        {
          error: "seasonId is required.",
        },
        {
          status: 400,
        },
      );
    }

    const standings =
      await getSeasonStandings(seasonId);

    return NextResponse.json(standings);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load statistics.",
      },
      {
        status: 500,
      },
    );
  }
}