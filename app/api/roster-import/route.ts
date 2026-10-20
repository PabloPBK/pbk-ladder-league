import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffUser } from "@/lib/server/require-auth";

export const dynamic = "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RatingStatus =
  | "needs_review"
  | "confirmed_dupr"
  | "club_rating"
  | "manual";

type ImportPlayer = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  club_rating?: number | null;
  dupr_doubles?: number | null;
  dupr_singles?: number | null;
  imported_doubles_rating?: number | null;
  imported_singles_rating?: number | null;
  doubles_rating_status: RatingStatus;
};

const ratingStatuses: RatingStatus[] = [
  "needs_review",
  "confirmed_dupr",
  "club_rating",
  "manual",
];

const clean = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

function validRating(value: unknown): boolean {
  return (
    value == null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 1 &&
      value <= 8)
  );
}

function getDatabase() {
  const url = process.env.TV_SUPABASE_URL;
  const key = process.env.TV_SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("TV_DATABASE_NOT_CONFIGURED");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: Request) {
  try {
    await requireStaffUser();

    const body = await request.json().catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.event_id !== "string" ||
      !uuidPattern.test(body.event_id) ||
      !Array.isArray(body.players) ||
      body.players.length === 0 ||
      body.players.length > 300
    ) {
      return NextResponse.json(
        {
          error: "Invalid event or import size (maximum 300 players)",
        },
        { status: 400 }
      );
    }

    const rows = body.players as ImportPlayer[];

    for (const player of rows) {
      if (
        !player ||
        typeof player.full_name !== "string" ||
        !player.full_name.trim() ||
        player.full_name.length > 200 ||
        (player.email != null &&
          (typeof player.email !== "string" ||
            player.email.length > 300)) ||
        (player.phone != null &&
          (typeof player.phone !== "string" ||
            player.phone.length > 300)) ||
        !ratingStatuses.includes(player.doubles_rating_status) ||
        ![
          player.club_rating,
          player.dupr_doubles,
          player.dupr_singles,
          player.imported_doubles_rating,
          player.imported_singles_rating,
        ].every(validRating)
      ) {
        return NextResponse.json(
          { error: "Invalid player details or rating" },
          { status: 400 }
        );
      }
    }

    const db = getDatabase();

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
    const seenNames = new Set<string>();
    const seenEmails = new Set<string>();

    const insertRows: Record<string, unknown>[] = [];
    let skipped = 0;

    for (const player of rows) {
      const name = clean(player.full_name);
      const email = clean(player.email ?? "");

      const duplicate = existingRows.some(
        (existingPlayer) =>
          clean(existingPlayer.full_name) === name ||
          (email !== "" &&
            clean(existingPlayer.email ?? "") === email)
      );

      if (
        duplicate ||
        seenNames.has(name) ||
        (email !== "" && seenEmails.has(email))
      ) {
        skipped++;
        continue;
      }

      seenNames.add(name);

      if (email) {
        seenEmails.add(email);
      }

      insertRows.push({
        event_id: body.event_id,
        full_name: player.full_name.trim(),
        email: player.email?.trim() || null,
        phone: player.phone?.trim() || null,

        // Independent rating fields.
        club_rating: player.club_rating ?? null,
        dupr_doubles: player.dupr_doubles ?? null,
        dupr_singles: player.dupr_singles ?? null,

        // Preserve the original imported PodPlay values.
        imported_doubles_rating:
          player.imported_doubles_rating ?? null,
        imported_singles_rating:
          player.imported_singles_rating ?? null,

        doubles_rating_status: player.doubles_rating_status,
        registration_status: "Accepted",
        source: "csv",

        rating_updated_at:
          player.doubles_rating_status === "needs_review"
            ? null
            : new Date().toISOString(),
      });
    }

    if (insertRows.length > 0) {
      const { error: insertError } = await db
        .from("roster_players")
        .insert(insertRows);

      if (insertError) throw insertError;
    }

    return NextResponse.json(
      {
        added: insertRows.length,
        skipped,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
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

    console.error("Roster import error:", error);

    return NextResponse.json(
      { error: "Unable to import registrations" },
      { status: 500 }
    );
  }
}
