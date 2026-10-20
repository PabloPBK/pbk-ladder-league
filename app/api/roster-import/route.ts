import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffUser } from "@/lib/server/require-auth";

export const dynamic = "force-dynamic";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  club_rating?: number | null;
  dupr_doubles?: number | null;
  dupr_singles?: number | null;
  imported_doubles_rating?: number | null;
  imported_singles_rating?: number | null;
  doubles_rating_status:
    | "needs_review"
    | "confirmed_dupr"
    | "club_rating"
    | "manual";
};

const clean = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const validRating = (value: unknown) =>
  value == null ||
  (typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 1 &&
    value <= 8);

export async function POST(request: Request) {
  try {
    await requireStaffUser();

    const body = await request.json().catch(() => null);

    if (
      !body ||
      !uuid.test(body.event_id) ||
      !Array.isArray(body.players) ||
      body.players.length === 0 ||
      body.players.length > 300
    ) {
      return NextResponse.json(
        { error: "Invalid event or import size (maximum 300 rows)" },
        { status: 400 }
      );
    }

    const rows = body.players as Row[];

    for (const p of rows) {
      if (
        !p ||
        typeof p.full_name !== "string" ||
        !p.full_name.trim() ||
        p.full_name.length > 200 ||
        (p.email != null &&
          (typeof p.email !== "string" || p.email.length > 300)) ||
        (p.phone != null &&
          (typeof p.phone !== "string" || p.phone.length > 300)) ||
        ![
          "needs_review",
          "confirmed_dupr",
          "club_rating",
          "manual",
        ].includes(p.doubles_rating_status) ||
        ![
          p.club_rating,
          p.dupr_doubles,
          p.dupr_singles,
          p.imported_doubles_rating,
          p.imported_singles_rating,
        ].every(validRating)
      ) {
        return NextResponse.json(
          { error: "Invalid player data or rating" },
          { status: 400 }
        );
      }

      if (
        p.doubles_rating_status === "club_rating" &&
        p.dupr_doubles != null
      ) {
        return NextResponse.json(
          { error: "Club rating cannot also be used as DUPR Doubles" },
          { status: 400 }
        );
      }
    }

    const url = process.env.TV_SUPABASE_URL;
    const secret = process.env.TV_SUPABASE_SECRET_KEY;

    if (!url || !secret) {
      throw new Error("TV_DATABASE_NOT_CONFIGURED");
    }

    const db = createClient(url, secret, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: event, error: eventError } = await db
      .from("roster_events")
      .select("id")
      .eq("id", body.event_id)
      .maybeSingle();

    if (eventError) throw eventError;

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const { data: existing, error: existingError } = await db
      .from("roster_players")
      .select("full_name,email")
      .eq("event_id", body.event_id);

    if (existingError) throw existingError;

    const existingRows = existing ?? [];
    const seen = new Set<string>();
    const insertRows: Record<string, unknown>[] = [];
    let skipped = 0;

    for (const p of rows) {
      const email = clean(p.email ?? "");
      const name = clean(p.full_name);

      const duplicate = existingRows.some(
        (x) =>
          (email && clean(x.email ?? "") === email) ||
          clean(x.full_name) === name
      );

      if (
        duplicate ||
        seen.has(`n:${name}`) ||
        (email && seen.has(`e:${email}`))
      ) {
        skipped++;
        continue;
      }

      seen.add(`n:${name}`);

      if (email) seen.add(`e:${email}`);

      insertRows.push({
        event_id: body.event_id,
        full_name: p.full_name.trim(),
        email: p.email?.trim() || null,
        phone: p.phone?.trim() || null,
        club_rating: p.club_rating ?? null,
        dupr_doubles: p.dupr_doubles ?? null,
        dupr_singles: p.dupr_singles ?? null,
        imported_doubles_rating:
          p.imported_doubles_rating ?? null,
        imported_singles_rating:
          p.imported_singles_rating ?? null,
        doubles_rating_status: p.doubles_rating_status,
        registration_status: "Accepted",
        source: "csv",
        rating_updated_at:
          p.doubles_rating_status === "needs_review"
            ? null
            : new Date().toISOString(),
      });
    }

    if (insertRows.length) {
      const { error } = await db
        .from("roster_players")
        .insert(insertRows);

      if (error) throw error;
    }

    return NextResponse.json(
      { added: insertRows.length, skipped },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (message === "STAFF_ACCESS_DENIED") {
      return NextResponse.json(
        { error: "Staff access required" },
        { status: 403 }
      );
    }

    console.error("Roster CSV import error", error);

    return NextResponse.json(
      { error: "Unable to import registrations" },
      { status: 500 }
    );
  }
}
