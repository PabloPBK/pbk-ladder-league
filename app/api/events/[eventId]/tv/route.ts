import { NextResponse } from "next/server";

import { isUuid } from "@/lib/data/league-listings";
import { getStaffApiDenial } from "@/lib/server/require-auth";
import { getTVDatabase } from "@/lib/server/tv-database";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const denial = await getStaffApiDenial();
  if (denial) return denial;

  const { eventId } = await params;
  const body = await request.json().catch(() => null);
  if (!isUuid(eventId) || typeof body?.screenId !== "string" || !isUuid(body.screenId)
    || (body.mode !== "courts" && body.mode !== "standings")) {
    return NextResponse.json({ error: "Choose a TV and league display." }, { status: 400 });
  }

  try {
    const { data: screen, error: screenError } = await getTVDatabase().from("tv_screens")
      .select("id, name").eq("id", body.screenId).eq("is_active", true).maybeSingle();
    if (screenError) throw screenError;
    if (!screen) return NextResponse.json({ error: "That TV is unavailable." }, { status: 404 });

    const { data: assigned, error } = await supabaseAdmin.rpc("assign_league_session_tv", {
      p_screen_id: screen.id, p_event_id: eventId, p_mode: body.mode,
    });
    if (error) throw error;
    if (!assigned) {
      return NextResponse.json({ error: "Start the session and generate Round 1 before sending it to a TV." }, { status: 409 });
    }
    return NextResponse.json({ screenName: screen.name }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Unable to assign a league session TV", error);
    return NextResponse.json({ error: "Unable to send the session to that TV." }, { status: 500 });
  }
}
