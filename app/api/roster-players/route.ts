import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffUser } from "@/lib/server/require-auth";

export const dynamic = "force-dynamic";

const playerFields =
  "id, event_id, full_name, email, phone, " +
  "club_rating, dupr_doubles, dupr_singles, " +
  "imported_doubles_rating, imported_singles_rating, " +
  "doubles_rating_status, rating_updated_at, " +
  "registration_status, source, created_at";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getDatabase() {
  const url = process.env.TV_SUPABASE_URL;
  const key = process.env.TV_SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("TV_DATABASE_NOT_CONFIGURED");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function handleError(error: unknown) {
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

  console.error("Roster players API error:", error);

  return NextResponse.json(
    { error: "Unable to process roster players" },
    { status: 500 }
  );
}

function validRating(value: unknown) {
  return (
    value === null ||
    (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 1 &&
      value <= 8
    )
  );
}

function validText(value: unknown, maxLength: number) {
  return (
    value === null ||
    (
      typeof value === "string" &&
      value.length <= maxLength
    )
  );
}

const ratingStatuses = [
  "needs_review",
  "confirmed_dupr",
  "club_rating",
  "manual",
];

const editableFields = [
  "full_name",
  "email",
  "phone",
  "club_rating",
  "dupr_doubles",
  "dupr_singles",
  "doubles_rating_status",
  "registration_status",
] as const;

type EditableField = (typeof editableFields)[number];

type PlayerChanges = Partial<
  Record<EditableField, string | number | null>
> & {
  rating_updated_at?: string;
};

function validateChanges(
  body: Record<string, unknown>,
  requireName: boolean
): string | null {
  if (
    (requireName || "full_name" in body) &&
    (
      typeof body.full_name !== "string" ||
      !body.full_name.trim() ||
      body.full_name.trim().length > 200
    )
  ) {
    return "Invalid player name";
  }

  for (const field of ["email", "phone"]) {
    if (
      field in body &&
      !validText(body[field], 300)
    ) {
      return `Invalid ${field}`;
    }
  }

  for (const field of [
    "club_rating",
    "dupr_doubles",
    "dupr_singles",
  ]) {
    if (
      field in body &&
      !validRating(body[field])
    ) {
      return `Invalid ${field}`;
    }
  }

  if (
    "doubles_rating_status" in body &&
    !ratingStatuses.includes(
      body.doubles_rating_status as string
    )
  ) {
    return "Invalid rating status";
  }

  if (
    "registration_status" in body &&
    !validText(body.registration_status, 100)
  ) {
    return "Invalid registration status";
  }

  return null;
}

// GET /api/roster-players?event_id=UUID
export async function GET(request: Request) {
  try {
    await requireStaffUser();

    const url = new URL(request.url);
    const eventId = url.searchParams.get("event_id");

    if (!eventId || !uuidPattern.test(eventId)) {
      return NextResponse.json(
        { error: "Valid event_id is required" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    const { data, error } = await db
      .from("roster_players")
      .select(playerFields)
      .eq("event_id", eventId)
      .order("full_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json(
      { players: data ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/roster-players
// Manually add a player to an event.
export async function POST(request: Request) {
  try {
    await requireStaffUser();

    const body = await request.json().catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid player details" },
        { status: 400 }
      );
    }

    if (
      typeof body.event_id !== "string" ||
      !uuidPattern.test(body.event_id)
    ) {
      return NextResponse.json(
        { error: "Valid event_id is required" },
        { status: 400 }
      );
    }

    const validationError = validateChanges(body, true);

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    const db = getDatabase();

    const { data, error } = await db
      .from("roster_players")
      .insert({
        event_id: body.event_id,
        full_name: body.full_name.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        club_rating: body.club_rating ?? null,
        dupr_doubles: body.dupr_doubles ?? null,
        dupr_singles: body.dupr_singles ?? null,
        doubles_rating_status:
          body.doubles_rating_status ?? "needs_review",
        registration_status:
          body.registration_status ?? "Accepted",
        source: "manual",
        rating_updated_at:
          body.dupr_doubles != null ||
          body.club_rating != null ||
          body.dupr_singles != null
            ? new Date().toISOString()
            : null,
      })
      .select(playerFields)
      .single();

    if (error) throw error;

    return NextResponse.json(
      { player: data },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}

// PATCH /api/roster-players
// Edit an existing player's details or ratings.
export async function PATCH(request: Request) {
  try {
    await requireStaffUser();

    const body = await request.json().catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid player details" },
        { status: 400 }
      );
    }

    if (
      typeof body.id !== "string" ||
      !uuidPattern.test(body.id) ||
      typeof body.event_id !== "string" ||
      !uuidPattern.test(body.event_id)
    ) {
      return NextResponse.json(
        { error: "Valid player and event IDs required" },
        { status: 400 }
      );
    }

    const changes: PlayerChanges = {};

    for (const field of editableFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        changes[field] = body[field];
      }
    }

    if (Object.keys(changes).length === 0) {
      return NextResponse.json(
        { error: "No changes provided" },
        { status: 400 }
      );
    }

    const validationError = validateChanges(changes, false);

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    if (typeof changes.full_name === "string") {
      changes.full_name = changes.full_name.trim();
    }

    for (const field of ["email", "phone"] as const) {
      if (typeof changes[field] === "string") {
        changes[field] = changes[field].trim() || null;
      }
    }

    if (
      "club_rating" in changes ||
      "dupr_doubles" in changes ||
      "dupr_singles" in changes ||
      "doubles_rating_status" in changes
    ) {
      changes.rating_updated_at = new Date().toISOString();
    }

    const db = getDatabase();

    const { data, error } = await db
      .from("roster_players")
      .update(changes)
      .eq("id", body.id)
      .eq("event_id", body.event_id)
      .select(playerFields)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ player: data });
  } catch (error) {
    return handleError(error);
  }
}

 // DELETE /api/roster-players
 // Remove a player from a specific event.
 // Players assigned to teams must be unassigned first.
 export async function DELETE(request: Request) {
   try {
     await requireStaffUser();

     const body = await request.json().catch(() => null);

     const playerId = body?.id;
     const eventId = body?.event_id;

     if (
       typeof playerId !== "string" ||
       !uuidPattern.test(playerId) ||
       typeof eventId !== "string" ||
       !uuidPattern.test(eventId)
     ) {
       return NextResponse.json(
         { error: "Valid player and event IDs required" },
         { status: 400 }
       );
     }

     const db = getDatabase();

     const { data: player, error: lookupError } = await db
       .from("roster_players")
       .select("id, full_name")
       .eq("id", playerId)
       .eq("event_id", eventId)
       .maybeSingle();

     if (lookupError) throw lookupError;

     if (!player) {
       return NextResponse.json(
         { error: "Player not found in this event" },
         { status: 404 }
       );
     }

     // Do not delete a player who is assigned to a team.
     // This protects existing team assignments.
     const { data: teams, error: teamsError } = await db
       .from("roster_teams")
       .select("id")
       .eq("event_id", eventId)
       .or(
         `player1_id.eq.${playerId},player2_id.eq.${playerId}`
       )
       .limit(1);

     if (teamsError) throw teamsError;

     if (teams && teams.length > 0) {
       return NextResponse.json(
         {
           error:
             "This player is assigned to a team. Remove the team assignment before deleting the player.",
         },
         { status: 409 }
       );
     }

     const { data: deleted, error: deleteError } = await db
       .from("roster_players")
       .delete()
       .eq("id", playerId)
       .eq("event_id", eventId)
       .select("id")
       .maybeSingle();

     if (deleteError) throw deleteError;

     if (!deleted) {
       return NextResponse.json(
         { error: "Player could not be deleted" },
         { status: 404 }
       );
     }

     return NextResponse.json({
       success: true,
       deleted_player_id: deleted.id,
     });
   } catch (error) {
     return handleError(error);
   }
 }
