import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
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
  return NextResponse.json({ sessions: scheduledOpenPlays(data), saved: data !== null }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
