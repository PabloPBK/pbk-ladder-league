import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { noShowFacilityId } from "@/lib/data/open-play-no-shows";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { noShowToday } from "@/lib/data/open-play-no-show-billing";
import { recentOpenPlayDates, scheduledOpenPlays } from "@/lib/data/open-play-no-show-schedule";
import { requireStaffUser, staffApiDenial } from "@/lib/server/require-auth";

export async function GET(request: Request) {
  try {
    await requireStaffUser();
  } catch (error) {
    return staffApiDenial(error);
  }

  const dates = recentOpenPlayDates(noShowToday());
  const date = new URL(request.url).searchParams.get("date") ?? dates[0];
  if (!dates.includes(date)) {
    return NextResponse.json({ error: "Choose one of the previous three days." }, { status: 400 });
  }

  const url = process.env.TV_SUPABASE_URL;
  const key = process.env.TV_SUPABASE_SECRET_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Schedule history is unavailable right now." }, { status: 503 });
  }

  const tv = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await tv.rpc("lynnwood_scheduled_open_plays", { requested_date: date });
  if (error) {
    console.error("Unable to retrieve the Lynnwood open-play schedule:", error.code);
    return NextResponse.json({ error: "Could not load the schedule. You can enter the session details manually." }, { status: 503 });
  }
  const sessions = scheduledOpenPlays(data);
  let uploaded = new Set<number>();
  if (sessions.length > 0) {
    const status = await supabaseAdmin.rpc("open_play_uploaded_sessions", {
      schedule_facility: noShowFacilityId, schedule_date: date,
      sessions: sessions.map(({ name, start, end }, idx) => ({ idx, name, start_time: start, end_time: end })),
    });
    if (status.error) {
      console.error("Unable to check the Lynnwood roster upload status:", status.error.code);
      return NextResponse.json({ error: "Could not load the upload status. You can enter session details manually." }, { status: 503 });
    }
    uploaded = new Set(status.data as number[]);
  }
  return NextResponse.json({
    sessions: sessions.map((session, idx) => ({ ...session, uploaded: uploaded.has(idx) })),
    saved: data !== null,
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
