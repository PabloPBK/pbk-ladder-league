import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getTVDatabase() {
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

function isUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

export async function GET(request: NextRequest) {
  try {
    const screenId =
      request.nextUrl.searchParams.get("screen_id");

    const displayToken =
      request.nextUrl.searchParams.get("token");

    if (!isUUID(screenId) || !isUUID(displayToken)) {
      return NextResponse.json(
        { error: "Invalid TV display credentials" },
        { status: 400 }
      );
    }

    const db = getTVDatabase();

    // Validate the screen and its private display token.
    // Include the settings needed by the TV player.
    const { data: screen, error: screenError } = await db
      .from("tv_screens")
      .select(
        "id, name, is_active, presentation_id, display_mode, slide_duration"
      )
      .eq("id", screenId)
      .eq("display_token", displayToken)
      .maybeSingle();

    if (screenError) {
      throw screenError;
    }

    if (!screen || !screen.is_active) {
      return NextResponse.json(
        { error: "TV display unavailable" },
        { status: 404 }
      );
    }

    // Return the TV settings with every response,
    // including when no presentation is assigned.
    const screenSettings = {
      id: screen.id,
      name: screen.name,
      display_mode:
        screen.display_mode === "single"
          ? "single"
          : "slideshow",
      slide_duration:
        typeof screen.slide_duration === "number" &&
        screen.slide_duration >= 1
          ? screen.slide_duration
          : 10,
    };

    if (!screen.presentation_id) {
      return NextResponse.json(
        {
          screen: screenSettings,
          presentation: null,
          slides: [],
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // Load the presentation assigned to this TV.
    const {
      data: presentation,
      error: presentationError,
    } = await db
      .from("tv_presentations")
      .select("id, name, is_active")
      .eq("id", screen.presentation_id)
      .maybeSingle();

    if (presentationError) {
      throw presentationError;
    }

    if (!presentation || !presentation.is_active) {
      return NextResponse.json(
        {
          screen: screenSettings,
          presentation: null,
          slides: [],
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // Retrieve the slides in their saved order.
    const { data: slides, error: slidesError } = await db
      .from("tv_slides")
      .select(
        "id, title, media_type, storage_path, sort_order, duration_seconds"
      )
      .eq("presentation_id", presentation.id)
      .order("sort_order", { ascending: true });

    if (slidesError) {
      throw slidesError;
    }

    // Generate temporary access URLs for media.
    const slidesWithUrls = await Promise.all(
      (slides ?? []).map(async (slide) => {
        const { data, error } = await db.storage
          .from("tv-media")
          .createSignedUrl(
            slide.storage_path,
            60 * 60
          );

        if (error || !data?.signedUrl) {
          throw (
            error ||
            new Error("Unable to access slide media")
          );
        }

        return {
          id: slide.id,
          title: slide.title,
          media_type: slide.media_type,
          sort_order: slide.sort_order,
          duration_seconds:
            slide.duration_seconds ??
            screenSettings.slide_duration,
          media_url: data.signedUrl,
        };
      })
    );

    return NextResponse.json(
      {
        screen: screenSettings,
        presentation: {
          id: presentation.id,
          name: presentation.name,
        },
        slides: slidesWithUrls,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("TV player API error:", error);

    return NextResponse.json(
      {
        error: "Unable to load TV presentation",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
