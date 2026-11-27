import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/data/league-listings";
import { isPaidPlayerCount, sessionRevenueCsv } from "@/lib/data/league-session-revenue";
import { requireRevenueAdmin, revenueApiDenial } from "@/lib/server/require-revenue-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Context = { params: Promise<{ eventId: string }> };
type ExportEvent = {
  event_date: string;
  session_number: number;
  name: string;
  seasons: { name: string; leagues: { name: string } | null } | null;
};
const selection = "member_count, nonmember_count, revision, updated_at";
const responseOptions = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(request: Request, { params }: Context) {
  try {
    await requireRevenueAdmin();
  } catch (error) {
    return revenueApiDenial(error);
  }
  const { eventId } = await params;
  if (!isUuid(eventId)) return NextResponse.json({ error: "Invalid league night." }, { status: 400 });

  try {
    const { data: report, error } = await supabaseAdmin.from("league_session_revenue")
      .select(selection).eq("event_id", eventId).maybeSingle();
    if (error) throw error;
    if (new URL(request.url).searchParams.get("format") !== "csv") {
      return NextResponse.json({ report }, responseOptions);
    }
    if (!report) return NextResponse.json({ error: "Save the revenue report before downloading it." }, { status: 404 });

    const { data: event, error: eventError } = await supabaseAdmin.from("league_events")
      .select("event_date, session_number, name, seasons(name, leagues(name))")
      .eq("id", eventId).single().overrideTypes<ExportEvent, { merge: false }>();
    if (eventError) throw eventError;

    const csv = sessionRevenueCsv({
      league: event.seasons?.leagues?.name?.trim() ?? "",
      season: event.seasons?.name ?? "",
      date: event.event_date,
      session: event.session_number,
      name: event.name,
    }, report);

    return new NextResponse(csv, {
      headers: {
        ...responseOptions.headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="league-revenue-${event.event_date}-session-${event.session_number}.csv"`,
      },
    });
  } catch (error) {
    console.error("Unable to load league session revenue:", error);
    return NextResponse.json({ error: "Unable to load session revenue." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Context) {
  let staff;
  try {
    staff = await requireRevenueAdmin();
  } catch (error) {
    return revenueApiDenial(error);
  }
  const { eventId } = await params;
  if (!isUuid(eventId)) return NextResponse.json({ error: "Invalid league night." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const members: unknown = body?.members;
  const nonmembers: unknown = body?.nonmembers;
  const revision: unknown = body?.revision;
  if (!isPaidPlayerCount(members) || !isPaidPlayerCount(nonmembers) ||
    (revision !== null && (typeof revision !== "string" || !isUuid(revision)))) {
    return NextResponse.json({ error: "Enter valid whole-number counts for both groups." }, { status: 400 });
  }

  try {
    const table = supabaseAdmin.from("league_session_revenue");
    const fields = {
      member_count: members,
      nonmember_count: nonmembers,
      revision: randomUUID(),
      updated_at: new Date().toISOString(),
      updated_by: staff.id,
    };
    const { data: report, error } = revision === null
      ? await table.insert({ event_id: eventId, ...fields }).select(selection).single()
      : await table.update(fields).eq("event_id", eventId).eq("revision", revision).select(selection).maybeSingle();

    if (error?.code === "23503") return NextResponse.json({ error: "League night not found." }, { status: 404 });
    if (error?.code === "23505" || (!error && !report)) {
      return NextResponse.json({ error: "This report was updated by someone else. Reload it before saving your counts." }, { status: 409 });
    }
    if (error) throw error;

    return NextResponse.json({ report }, responseOptions);
  } catch (error) {
    console.error("Unable to save league session revenue:", error);
    return NextResponse.json({ error: "Unable to save the revenue report." }, { status: 500 });
  }
}
