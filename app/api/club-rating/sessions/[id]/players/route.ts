
import { NextResponse } from "next/server";

import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OverrideType =
  | "optional_improvement"
  | "mandatory_renewal"
  | null;

function errorResponse(error: unknown, operation: string) {
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

  if (message === "STAFF_CHECK_FAILED") {
    return NextResponse.json(
      { error: "Unable to verify staff authorization." },
      { status: 503 }
    );
  }

  console.error(`Club Rating ${operation}:`, error);

  return NextResponse.json(
    { error: `Unable to ${operation}.` },
    { status: 500 }
  );
}

// ----------------------------------------------------
// GET — Session roster and rating classifications
// ----------------------------------------------------

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    await requireStaffUser();

    const { id } = await context.params;

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "Invalid session ID." },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } =
      await supabaseAdmin
        .from("club_rating_sessions")
        .select("id, session_date, session_name, status")
        .eq("id", id)
        .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 }
      );
    }

    const { data: roster, error: rosterError } =
      await supabaseAdmin
        .from("club_rating_session_players")
        .select(
          `
          id,
          club_rating_player_id,
          attendance_status,
          rating_session_override,
          rating_override_reason,
          rating_override_by,
          rating_override_at,
          club_rating_players (
            id,
            full_name,
            email,
            club_rating,
            period_deadline
          )
          `
        )
        .eq("session_id", id);

    if (rosterError) {
      throw rosterError;
    }

    const players = [];

    for (const entry of roster ?? []) {
      const { data: classification, error } =
        await supabaseAdmin.rpc(
          "classify_club_rating_session",
          {
            p_player_id: entry.club_rating_player_id,
            p_session_id: id,
          }
        );

      players.push({
        ...entry,
        classification: error ? null : classification,
        classification_error: error
          ? error.message
          : null,
      });
    }

    return NextResponse.json({
      session,
      players,
    });
  } catch (error) {
    return errorResponse(error, "load session players");
  }
}

// ----------------------------------------------------
// PATCH — Save or remove staff rating override
// ----------------------------------------------------

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    // Identity comes from authenticated session,
    // never from the browser request body.
    const user = await requireStaffUser();

    const { id: sessionId } = await context.params;

    if (!UUID_REGEX.test(sessionId)) {
      return NextResponse.json(
        { error: "Invalid session ID." },
        { status: 400 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;

    const playerId = input.playerId;
    const override = input.override;
    const reason = input.reason;

    if (
      typeof playerId !== "string" ||
      !UUID_REGEX.test(playerId)
    ) {
      return NextResponse.json(
        { error: "Invalid player ID." },
        { status: 400 }
      );
    }

    const validOverrides: OverrideType[] = [
      "optional_improvement",
      "mandatory_renewal",
      null,
    ];

    if (
      override === undefined ||
      !validOverrides.includes(override as OverrideType)
    ) {
      return NextResponse.json(
        { error: "Invalid rating override." },
        { status: 400 }
      );
    }

    const selectedOverride = override as OverrideType;

    const trimmedReason =
      typeof reason === "string"
        ? reason.trim()
        : "";

    if (selectedOverride !== null) {
      if (
        trimmedReason.length < 10 ||
        trimmedReason.length > 500
      ) {
        return NextResponse.json(
          {
            error:
              "Override reason must contain 10 to 500 characters.",
          },
          { status: 400 }
        );
      }
    }

    // Database function enforces:
    // - session is editable
    // - player belongs to session
    // - initial qualification cannot be overridden
    // - override type and reason are valid
    // - session is locked during update
    const { error: overrideError } =
      await supabaseAdmin.rpc(
        "set_club_rating_session_override",
        {
          p_session_id: sessionId,
          p_player_id: playerId,
          p_override: selectedOverride,
          p_reason:
            selectedOverride === null
              ? null
              : trimmedReason,
          p_staff_id: user.id,
        }
      );

    if (overrideError) {
      const message = overrideError.message ?? "";

      if (
        message.includes("Session not found") ||
        message.includes("not registered in session")
      ) {
        return NextResponse.json(
          { error: message },
          { status: 404 }
        );
      }

      if (
        message.includes("cannot be changed") ||
        message.includes("cannot be overridden")
      ) {
        return NextResponse.json(
          { error: message },
          { status: 409 }
        );
      }

      if (
        message.includes("Invalid override") ||
        message.includes("Override reason")
      ) {
        return NextResponse.json(
          { error: message },
          { status: 400 }
        );
      }

      throw overrideError;
    }

    // Read the classification after the change.
    const {
      data: classification,
      error: classificationError,
    } = await supabaseAdmin.rpc(
      "classify_club_rating_session",
      {
        p_player_id: playerId,
        p_session_id: sessionId,
      }
    );

    if (classificationError) {
      console.error(
        "Override saved, but classification refresh failed:",
        classificationError
      );

      return NextResponse.json({
        success: true,
        classification: null,
        refreshRequired: true,
      });
    }

    return NextResponse.json({
      success: true,
      classification,
      refreshRequired: false,
    });
  } catch (error) {
    return errorResponse(error, "save rating override");
  }
}
