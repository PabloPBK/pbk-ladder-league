import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const seasonId = url.searchParams.get("seasonId")?.trim() ?? "";

    let query = supabaseAdmin
      .from("league_events")
      .select("id, season_id, event_date, name, status, current_round, session_number, session_note, created_at")
      .eq("status", "active")
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (seasonId) query = query.eq("season_id", seasonId);

    const { data: event, error } = await query.maybeSingle();
    if (error) throw error;

    return NextResponse.json({ event: event ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load the active league event." },
      { status: 500 },
    );
  }
}
