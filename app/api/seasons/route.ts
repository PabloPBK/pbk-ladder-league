import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffUser } from "@/lib/server/require-auth";

type SeasonRow = { id: string; name: string; status: string };

type CreateSeasonRequest = {
  leagueId?: string;
  seasonNumber?: number;
  startDate?: string;
};

function parseSeasonNumber(name: string) {
  const match = name.match(/season\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const leagueId = url.searchParams.get("leagueId")?.trim() ?? "";

    if (!leagueId) {
      return NextResponse.json({ error: "A league ID is required." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("seasons")
      .select("id, league_id, name, start_date, end_date, status, created_at")
      .eq("league_id", leagueId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ seasons: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load seasons." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffUser();

    const body = (await request.json()) as CreateSeasonRequest;
    const leagueId = body.leagueId?.trim() ?? "";
    const requestedNumber = Number(body.seasonNumber);
    const startDate = body.startDate?.trim() || new Date().toISOString().slice(0, 10);

    if (!leagueId) {
      return NextResponse.json({ error: "Choose a league first." }, { status: 400 });
    }

    const { data: currentSeasons, error: seasonsError } = await supabaseAdmin
      .from("seasons")
      .select("id, name, status")
      .eq("league_id", leagueId);

    if (seasonsError) throw seasonsError;

    const typedCurrentSeasons = (currentSeasons ?? []) as SeasonRow[];
    const existingNumbers = typedCurrentSeasons
      .map((season) => parseSeasonNumber(season.name))
      .filter((value): value is number => Number.isInteger(value));

    const suggestedNumber = Math.max(0, ...existingNumbers) + 1;
    const seasonNumber = Number.isInteger(requestedNumber) && requestedNumber > 0
      ? requestedNumber
      : suggestedNumber;
    const seasonName = `Season ${seasonNumber}`;

    const duplicate = typedCurrentSeasons.some(
      (season) => season.name.trim().toLowerCase() === seasonName.toLowerCase(),
    );

    if (duplicate) {
      return NextResponse.json({ error: `${seasonName} already exists.` }, { status: 409 });
    }

    const activeIds = typedCurrentSeasons
      .filter((season) => season.status === "active")
      .map((season) => season.id);

    if (activeIds.length > 0) {
      const { error: completeError } = await supabaseAdmin
        .from("seasons")
        .update({ status: "complete", end_date: startDate })
        .in("id", activeIds);

      if (completeError) throw completeError;
    }

    const { data: created, error: createError } = await supabaseAdmin
      .from("seasons")
      .insert({
        league_id: leagueId,
        name: seasonName,
        start_date: startDate,
        end_date: null,
        status: "active",
      })
      .select("id, league_id, name, start_date, end_date, status")
      .single();

    if (createError || !created) {
      throw createError ?? new Error("Unable to create the season.");
    }

    return NextResponse.json({ season: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in as staff to create a season." }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create the season." },
      { status: 500 },
    );
  }
}
