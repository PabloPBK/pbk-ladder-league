import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type CreateEventRequest = {
  seasonId?: string;
  eventDate?: string;
  name?: string;
};

const eventSelection =
  "id, season_id, event_date, name, status, current_round";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const seasonId =
      url.searchParams.get("seasonId")?.trim() ?? "";

    const eventDate =
      url.searchParams.get("eventDate")?.trim() ||
      new Date().toISOString().slice(0, 10);

    if (!seasonId) {
      return NextResponse.json(
        {
          error: "A season ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: event, error } =
      await supabaseAdmin
        .from("league_events")
        .select(eventSelection)
        .eq("season_id", seasonId)
        .eq("event_date", eventDate)
        .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        event: event ?? null,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "Unable to find league event:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to find the league event.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as CreateEventRequest;

    const seasonId = body.seasonId?.trim();

    const eventDate =
      body.eventDate?.trim() ||
      new Date().toISOString().slice(0, 10);

    const eventName =
      body.name?.trim() ||
      `League Night — ${eventDate}`;

    if (!seasonId) {
      return NextResponse.json(
        {
          error: "A season must be selected.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: season, error: seasonError } =
      await supabaseAdmin
        .from("seasons")
        .select("id, name, status")
        .eq("id", seasonId)
        .single();

    if (seasonError) {
      console.error(
        "Season lookup failed:",
        seasonError,
      );

      return NextResponse.json(
        {
          error: `Season lookup failed: ${seasonError.message}`,
        },
        {
          status: 500,
        },
      );
    }

    if (!season) {
      return NextResponse.json(
        {
          error:
            "The selected season does not exist in the Supabase project used by the server.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      season.status === "complete" ||
      season.status === "archived"
    ) {
      return NextResponse.json(
        {
          error:
            "A league night cannot be created for a completed or archived season.",
        },
        {
          status: 400,
        },
      );
    }

    const {
      data: existingEvent,
      error: existingEventError,
    } = await supabaseAdmin
      .from("league_events")
      .select(eventSelection)
      .eq("season_id", seasonId)
      .eq("event_date", eventDate)
      .maybeSingle();

    if (existingEventError) {
      throw existingEventError;
    }

    if (existingEvent) {
      return NextResponse.json(
        {
          event: existingEvent,
          existing: true,
        },
        {
          status: 200,
        },
      );
    }

    const {
      data: createdEvent,
      error: insertError,
    } = await supabaseAdmin
      .from("league_events")
      .insert({
        season_id: seasonId,
        event_date: eventDate,
        name: eventName,
        subtitle: "PBK Ladder League",
        status: "active",
        current_round: 1,
      })
      .select(eventSelection)
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            error:
              "An event already exists for this season and date.",
          },
          {
            status: 409,
          },
        );
      }

      throw insertError;
    }

    return NextResponse.json(
      {
        event: createdEvent,
        existing: false,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Unable to create league event:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create the league event.",
      },
      {
        status: 500,
      },
    );
  }
}