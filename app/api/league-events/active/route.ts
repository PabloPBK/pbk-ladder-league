import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const { data: event, error } =
      await supabaseAdmin
        .from("league_events")
        .select(
          `
          id,
          season_id,
          event_date,
          name,
          status,
          current_round,
          created_at
          `,
        )
        .eq("status", "active")
        .order("event_date", {
          ascending: false,
        })
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
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
      "Unable to load the active league event:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the active league event.",
      },
      {
        status: 500,
      },
    );
  }
}