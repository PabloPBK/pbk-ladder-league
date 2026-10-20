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

type TVDatabase = ReturnType<typeof getTVDatabase>;

function isUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function jsonResponse(
  body: unknown,
  status: number = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

type RosterPlayer = {
  id: string;
  full_name: string;
  dupr_doubles: number | null;
  dupr_singles: number | null;
  club_rating: number | null;
};

type RosterTeam = {
  id: string;
  player1_id: string;
  player2_id: string;
};

function getRating(
  player: RosterPlayer,
  method: string | null
): number | null {
  let value: number | null;

  switch (method) {
    case "dupr_singles":
      value = player.dupr_singles;
      break;

    case "club_rating":
      value = player.club_rating;
      break;

    default:
      value = player.dupr_doubles;
  }

  if (value === null || value === undefined) {
    return null;
  }

  const rating = Number(value);

  return Number.isFinite(rating) && rating > 0
    ? rating
    : null;
}

async function loadRosterData(
  db: TVDatabase,
  eventId: string,
  mediaType: string
) {
  const { data: event, error: eventError } = await db
    .from("roster_events")
    .select("id, name, event_type, rating_method")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) throw eventError;

  if (!event) {
    return {
      event_name: "Event unavailable",
      rating_method: "dupr_doubles",
      entries: [],
    };
  }

  const { data: players, error: playersError } =
    await db
      .from("roster_players")
      .select(
        "id, full_name, dupr_doubles, dupr_singles, club_rating"
      )
      .eq("event_id", eventId);

  if (playersError) throw playersError;

  const rosterPlayers = (players ?? []) as RosterPlayer[];

  const { data: teams, error: teamsError } =
    await db
      .from("roster_teams")
      .select("id, player1_id, player2_id")
      .eq("event_id", eventId);

  if (teamsError) throw teamsError;

  const rosterTeams = (teams ?? []) as RosterTeam[];

  const playerMap = new Map(
    rosterPlayers.map((player) => [player.id, player])
  );

  const assignedIds = new Set<string>();

  for (const team of rosterTeams) {
    assignedIds.add(team.player1_id);
    assignedIds.add(team.player2_id);
  }

  if (mediaType === "roster_teams") {
    const entries = rosterTeams
      .map((team) => {
        const player1 = playerMap.get(team.player1_id);
        const player2 = playerMap.get(team.player2_id);

        if (!player1 || !player2) return null;

        const rating1 = getRating(
          player1,
          event.rating_method
        );

        const rating2 = getRating(
          player2,
          event.rating_method
        );

        const combinedRating =
          rating1 !== null && rating2 !== null
            ? Number((rating1 + rating2).toFixed(2))
            : null;

        return {
          id: team.id,
          player1: player1.full_name,
          player2: player2.full_name,
          player1_rating: rating1,
          player2_rating: rating2,
          combined_rating: combinedRating,
        };
      })
      .filter((entry) => entry !== null)
      .sort((a, b) => {
        if (a.combined_rating === null) return 1;
        if (b.combined_rating === null) return -1;

        return b.combined_rating - a.combined_rating;
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    return {
      event_name: event.name,
      rating_method: event.rating_method,
      entries,
    };
  }

  const entries = rosterPlayers
    .filter((player) => !assignedIds.has(player.id))
    .map((player) => ({
      id: player.id,
      name: player.full_name,
      rating: getRating(
        player,
        event.rating_method
      ),
    }))
    .sort((a, b) => {
      if (a.rating === null) return 1;
      if (b.rating === null) return -1;

      return b.rating - a.rating;
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

  return {
    event_name: event.name,
    rating_method: event.rating_method,
    entries,
  };
}

export async function GET(request: NextRequest) {
  try {
    const screenId =
      request.nextUrl.searchParams.get("screen_id");

    const displayToken =
      request.nextUrl.searchParams.get("token");

    // Never log the private display token.
    console.log("TV PLAYER VALIDATION", {
      screenIdValid: isUUID(screenId),
      tokenValid: isUUID(displayToken),
      tokenLength: displayToken?.length ?? 0,
    });

    if (!isUUID(screenId) || !isUUID(displayToken)) {
      return jsonResponse(
        { error: "Invalid TV display credentials" },
        400
      );
    }

    const db = getTVDatabase();

    // Authenticate the TV before accessing roster data.
    const { data: screen, error: screenError } =
      await db
        .from("tv_screens")
        .select(
          "id, name, is_active, presentation_id, display_mode, slide_duration"
        )
        .eq("id", screenId)
        .eq("display_token", displayToken)
        .maybeSingle();

    if (screenError) throw screenError;

    if (!screen || !screen.is_active) {
      return jsonResponse(
        { error: "TV display unavailable" },
        404
      );
    }

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
      return jsonResponse({
        screen: screenSettings,
        presentation: null,
        slides: [],
      });
    }

    const {
      data: presentation,
      error: presentationError,
    } = await db
      .from("tv_presentations")
      .select(
        "id, name, is_active, logo_storage_path"
      )
      .eq("id", screen.presentation_id)
      .maybeSingle();

    if (presentationError) throw presentationError;

    if (!presentation || !presentation.is_active) {
      return jsonResponse({
        screen: screenSettings,
        presentation: null,
        slides: [],
      });
    }

    // Generate a secure URL for the presentation logo.
    // Presentations without a logo continue normally.
    let logoUrl: string | null = null;

    if (presentation.logo_storage_path) {
      const {
        data: logoData,
        error: logoError,
      } = await db.storage
        .from("tv-media")
        .createSignedUrl(
          presentation.logo_storage_path,
          3600
        );

      if (logoError || !logoData?.signedUrl) {
        throw (
          logoError ||
          new Error(
            "Unable to access presentation logo"
          )
        );
      }

      logoUrl = logoData.signedUrl;
    }

    const { data: slides, error: slidesError } =
      await db
        .from("tv_slides")
        .select(
          "id, title, media_type, storage_path, roster_event_id, sort_order, duration_seconds"
        )
        .eq("presentation_id", presentation.id)
        .order("sort_order", {
          ascending: true,
        });

    if (slidesError) throw slidesError;

    const preparedSlides = await Promise.all(
      (slides ?? []).map(async (slide) => {
        const baseSlide = {
          id: slide.id,
          title: slide.title,
          media_type: slide.media_type,
          sort_order: slide.sort_order,
          duration_seconds:
            slide.duration_seconds ??
            screenSettings.slide_duration,
        };

        if (
          slide.media_type === "roster_teams" ||
          slide.media_type === "roster_free_agents"
        ) {
          if (!isUUID(slide.roster_event_id)) {
            return {
              ...baseSlide,
              media_url: null,
              roster: {
                event_name: "Event unavailable",
                rating_method: "dupr_doubles",
                entries: [],
              },
            };
          }

          const roster = await loadRosterData(
            db,
            slide.roster_event_id,
            slide.media_type
          );

          return {
            ...baseSlide,
            media_url: null,
            roster,
          };
        }

        if (!slide.storage_path) {
          throw new Error(
            "Media slide is missing its storage path"
          );
        }

        const { data, error } = await db.storage
          .from("tv-media")
          .createSignedUrl(
            slide.storage_path,
            60 * 60
          );

        if (error || !data?.signedUrl) {
          throw (
            error ||
            new Error(
              "Unable to access slide media"
            )
          );
        }

        return {
          ...baseSlide,
          media_url: data.signedUrl,
        };
      })
    );

    return jsonResponse({
      screen: screenSettings,
      presentation: {
        id: presentation.id,
        name: presentation.name,
        logo_url: logoUrl,
      },
      slides: preparedSlides,
    });
  } catch (error) {
    console.error("TV player API error:", error);

    return jsonResponse(
      { error: "Unable to load TV presentation" },
      500
    );
  }
}
