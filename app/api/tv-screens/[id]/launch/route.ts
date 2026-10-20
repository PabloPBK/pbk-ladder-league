import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffUser } from "@/lib/server/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    // Only authorized staff can launch TV displays.
    await requireStaffUser();

    const { id } = await context.params;

    // Validate the TV screen UUID.
    // Correct UUID format: 8-4-4-4-12
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: "Invalid TV screen ID" },
        { status: 400 }
      );
    }

    const url = process.env.TV_SUPABASE_URL;
    const key = process.env.TV_SUPABASE_SECRET_KEY;

    if (!url || !key) {
      console.error("TV database configuration missing");

      return NextResponse.json(
        { error: "TV database is not configured" },
        { status: 500 }
      );
    }

    const db = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Retrieve the TV and its existing display token.
    const { data: screen, error } = await db
      .from("tv_screens")
      .select("id, name, display_token, is_active")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("TV screen lookup failed:", error);

      return NextResponse.json(
        { error: "Unable to load TV screen" },
        { status: 500 }
      );
    }

    if (!screen) {
      return NextResponse.json(
        { error: "TV screen not found" },
        { status: 404 }
      );
    }

    if (!screen.is_active) {
      return NextResponse.json(
        { error: "This TV screen is inactive" },
        { status: 400 }
      );
    }

    if (!screen.display_token) {
      return NextResponse.json(
        { error: "This TV has no display access token" },
        { status: 400 }
      );
    }

    // Build the secure TV player URL.
    const origin = new URL(request.url).origin;

    const playerUrl = new URL(
      `/tv/player/${encodeURIComponent(screen.id)}`,
      origin
    );

    playerUrl.searchParams.set(
      "token",
      String(screen.display_token)
    );

    return NextResponse.json(
      {
        url: playerUrl.toString(),
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

    console.error("TV launch error:", error);

    return NextResponse.json(
      { error: "Unable to launch TV display" },
      { status: 500 }
    );
  }
}
