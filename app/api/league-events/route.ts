import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffUser } from "@/lib/server/require-auth";

type CreateEventRequest = {
  seasonId?: string;
  eventDate?: string;
  sessionNumber?: number;
  sessionNote?: string;
  name?: string;
};

const eventSelection =
  "id, season_id, event_date, name, status, current_round, session_number, session_note, created_at";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const seasonId = url.searchParams.get("seasonId")?.trim() ?? "";
    const eventDate = url.searchParams.get("eventDate")?.trim() || new Date().toISOString().slice(0, 10);
    const sessionNumberText = url.searchParams.get("sessionNumber")?.trim() ?? "";
    const sessionNumber = Number(sessionNumberText);

    if (!seasonId) {
      return NextResponse.json({ error: "A season ID is required." }, { status: 400 });
    }

    let query = supabaseAdmin
      .from("league_events")
      .select(eventSelection)
      .eq("season_id", seasonId)
      .eq("event_date", eventDate)
      .order("session_number", { ascending: true });

    if (sessionNumberText && Number.isInteger(sessionNumber) && sessionNumber > 0) {
      const { data, error } = await query.eq("session_number", sessionNumber).maybeSingle();
      if (error) throw error;
      return NextResponse.json({ event: data ?? null });
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ events: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to find league events." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffUser();
    const body = (await request.json()) as CreateEventRequest;
    const seasonId = body.seasonId?.trim() ?? "";
    const eventDate = body.eventDate?.trim() || new Date().toISOString().slice(0, 10);
    const sessionNumber = Number(body.sessionNumber ?? 1);
    const sessionNote = body.sessionNote?.trim() || null;

    if (!seasonId) {
      return NextResponse.json({ error: "A season must be selected." }, { status: 400 });
    }
    if (!Number.isInteger(sessionNumber) || sessionNumber < 1) {
      return NextResponse.json({ error: "Session number must be a positive whole number." }, { status: 400 });
    }

    const { data: season, error: seasonError } = await supabaseAdmin
      .from("seasons")
      .select("id, name, status")
      .eq("id", seasonId)
      .single();
    if (seasonError || !season) throw seasonError ?? new Error("Season not found.");

    if (season.status === "complete" || season.status === "archived") {
      return NextResponse.json({ error: "A league night cannot be created for a completed or archived season." }, { status: 400 });
    }

    const { data: existingEvent, error: existingEventError } = await supabaseAdmin
      .from("league_events")
      .select(eventSelection)
      .eq("season_id", seasonId)
      .eq("event_date", eventDate)
      .eq("session_number", sessionNumber)
      .maybeSingle();
    if (existingEventError) throw existingEventError;
    if (existingEvent) return NextResponse.json({ event: existingEvent, existing: true });

    const eventName = body.name?.trim() || `League Night — ${eventDate} — Session ${sessionNumber}${sessionNote ? ` — ${sessionNote}` : ""}`;

    const { data: createdEvent, error: insertError } = await supabaseAdmin
      .from("league_events")
      .insert({
        season_id: seasonId,
        event_date: eventDate,
        name: eventName,
        subtitle: "PBK Ladder League",
        status: "active",
        current_round: 1,
        session_number: sessionNumber,
        session_note: sessionNote,
      })
      .select(eventSelection)
      .single();

    if (insertError || !createdEvent) throw insertError ?? new Error("Unable to create league event.");
    return NextResponse.json({ event: createdEvent, existing: false }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in as staff to start a league night." }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create the league event." },
      { status: 500 },
    );
  }
}
