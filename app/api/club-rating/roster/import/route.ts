
import { NextResponse } from "next/server";

import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type RosterPlayer = {
  name?: string;
  email?: string;
  dupr?: number | null;
  attendance?: string;
};

type ImportRequest = {
  sessionId?: string;
  players?: RosterPlayer[];
};

const VALID_ATTENDANCE = new Set([
  "registered",
  "attended",
  "absent",
  "cancelled",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function handleError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "";

  if (message === "AUTH_REQUIRED") {
    return NextResponse.json(
      { error: "Please sign in." },
      { status: 401 }
    );
  }

  if (message === "STAFF_ACCESS_DENIED") {
    return NextResponse.json(
      { error: "Staff access is required." },
      { status: 403 }
    );
  }

  console.error("Club Rating roster import failed:", error);

  return NextResponse.json(
    { error: "Unable to import Club Rating roster." },
    { status: 500 }
  );
}

export async function POST(request: Request) {
  try {
    await requireStaffUser();

    let body: ImportRequest;

    try {
      body = (await request.json()) as ImportRequest;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body.sessionId !== "string" ||
      !UUID_PATTERN.test(body.sessionId)
    ) {
      return NextResponse.json(
        { error: "A valid session ID is required." },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(body.players) ||
      body.players.length < 1 ||
      body.players.length > 500
    ) {
      return NextResponse.json(
        { error: "Select between 1 and 500 players." },
        { status: 400 }
      );
    }

    const normalizedPlayers: {
      name: string;
      email: string;
      dupr: number | null;
      attendance: string;
    }[] = [];

    const seenEmails = new Set<string>();

    for (const player of body.players) {
      if (!player || typeof player !== "object") {
        return NextResponse.json(
          { error: "Invalid player record." },
          { status: 400 }
        );
      }

      if (
        typeof player.name !== "string" ||
        typeof player.email !== "string"
      ) {
        return NextResponse.json(
          { error: "Every player needs a name and email." },
          { status: 400 }
        );
      }

      const name = player.name.trim().replace(/\s+/g, " ");
      const email = player.email.trim().toLowerCase();
      const attendance = player.attendance ?? "registered";

      if (!name || name.length > 200) {
        return NextResponse.json(
          { error: "Player names must be 1–200 characters." },
          { status: 400 }
        );
      }

      if (
        email.length > 320 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return NextResponse.json(
          { error: `Invalid email for ${name}.` },
          { status: 400 }
        );
      }

      if (seenEmails.has(email)) {
        return NextResponse.json(
          { error: `Duplicate email in roster: ${email}` },
          { status: 400 }
        );
      }

      seenEmails.add(email);

      if (
        typeof attendance !== "string" ||
        !VALID_ATTENDANCE.has(attendance)
      ) {
        return NextResponse.json(
          { error: `Invalid attendance for ${name}.` },
          { status: 400 }
        );
      }

      const dupr =
        player.dupr === null || player.dupr === undefined
          ? null
          : Number(player.dupr);

      if (
        dupr !== null &&
        (!Number.isFinite(dupr) || dupr < 0 || dupr > 8)
      ) {
        return NextResponse.json(
          { error: `Invalid DUPR rating for ${name}.` },
          { status: 400 }
        );
      }

      normalizedPlayers.push({
        name,
        email,
        dupr,
        attendance,
      });
    }

    const { data, error } = await supabaseAdmin.rpc(
      "import_club_rating_roster",
      {
        p_session_id: body.sessionId,
        p_players: normalizedPlayers,
      }
    );

    if (error) {
      console.error("Club Rating import RPC error:", error);

      return NextResponse.json(
        {
          error:
            "The roster could not be saved. Check that the session is active and the player data is valid.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        result: data,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleError(error);
  }
}
