import { NextResponse } from "next/server";

import { isUuid } from "@/lib/data/league-listings";
import { parsePrizeAmount } from "@/lib/data/league-prize";
import { getLeagueEventPrize } from "@/lib/server/league-event-prize";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = { params: Promise<{ eventId: string }> };
const options = { headers: { "Cache-Control": "no-store" } };

async function authorize() {
  try {
    await requireStaffUser();
    return null;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    if (reason === "AUTH_REQUIRED") return NextResponse.json({ error: "Sign in to manage prize money." }, { status: 401 });
    if (reason === "STAFF_ACCESS_DENIED") return NextResponse.json({ error: "Staff access is required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to verify staff access." }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const denied = await authorize();
  if (denied) return denied;
  const { eventId } = await params;
  if (!isUuid(eventId)) return NextResponse.json({ error: "Invalid league night." }, { status: 400 });

  try {
    return NextResponse.json({ amountCents: await getLeagueEventPrize(eventId) }, options);
  } catch (error) {
    console.error("Unable to load league night prize:", error);
    return NextResponse.json({ error: "Unable to load prize money." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const denied = await authorize();
  if (denied) return denied;
  const { eventId } = await params;
  if (!isUuid(eventId)) return NextResponse.json({ error: "Invalid league night." }, { status: 400 });

  let amountCents;
  try {
    const body = await request.json();
    amountCents = parsePrizeAmount(body?.amount);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof SyntaxError ? "Invalid prize amount." : (error as Error).message,
    }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("league_event_prizes")
    .upsert({ event_id: eventId, amount_cents: amountCents }, { onConflict: "event_id" });
  if (error?.code === "23503") return NextResponse.json({ error: "League night not found." }, { status: 404 });
  if (error) {
    console.error("Unable to save league night prize:", error);
    return NextResponse.json({ error: "Unable to save prize money." }, { status: 500 });
  }
  return NextResponse.json({ amountCents }, options);
}
