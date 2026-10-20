import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { requireStaffUser } from "@/lib/server/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
]);

const liveTypes = [
  "roster_teams",
  "roster_free_agents",
] as const;

function isUUID(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

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

function errorResponse(error: unknown) {
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

  console.error("TV slides API error:", error);

  return NextResponse.json(
    { error: "Unable to process TV slides" },
    { status: 500 }
  );
}

async function getNextSortOrder(
  db: ReturnType<typeof getTVDatabase>,
  presentationId: string
) {
  const { data, error } = await db
    .from("tv_slides")
    .select("sort_order")
    .eq("presentation_id", presentationId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return (data?.sort_order ?? -1) + 1;
}

export async function POST(request: NextRequest) {
  try {
    await requireStaffUser();

    const db = getTVDatabase();
    const contentType =
      request.headers.get("content-type") ?? "";

    // LIVE ROSTER SLIDE
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => null);

      if (
        !body ||
        !isUUID(body.presentation_id) ||
        !isUUID(body.roster_event_id) ||
        !liveTypes.includes(body.media_type)
      ) {
        return NextResponse.json(
          { error: "Invalid live roster slide details" },
          { status: 400 }
        );
      }

      const { data: presentation, error: presentationError } =
        await db
          .from("tv_presentations")
          .select("id")
          .eq("id", body.presentation_id)
          .maybeSingle();

      if (presentationError) throw presentationError;

      if (!presentation) {
        return NextResponse.json(
          { error: "Presentation not found" },
          { status: 404 }
        );
      }

      const { data: event, error: eventError } = await db
        .from("roster_events")
        .select("id, name")
        .eq("id", body.roster_event_id)
        .maybeSingle();

      if (eventError) throw eventError;

      if (!event) {
        return NextResponse.json(
          { error: "Roster event not found" },
          { status: 404 }
        );
      }

      const title =
        body.media_type === "roster_teams"
          ? `${event.name} - Team Rankings`
          : `${event.name} - Free Agents`;

      const sortOrder = await getNextSortOrder(
        db,
        body.presentation_id
      );

      const { data: slide, error: insertError } =
        await db
          .from("tv_slides")
          .insert({
            presentation_id: body.presentation_id,
            title: title.slice(0, 200),
            media_type: body.media_type,
            storage_path: null,
            roster_event_id: body.roster_event_id,
            sort_order: sortOrder,
            duration_seconds: 15,
          })
          .select("*")
          .single();

      if (insertError) throw insertError;

      return NextResponse.json(
        { slide },
        { status: 201 }
      );
    }

    // EXISTING IMAGE / VIDEO UPLOAD
    const form = await request.formData();
    const file = form.get("file");
    const presentationId = form.get("presentation_id");

    if (
      !(file instanceof File) ||
      !isUUID(presentationId)
    ) {
      return NextResponse.json(
        { error: "Invalid upload details" },
        { status: 400 }
      );
    }

    const extension = allowedTypes.get(file.type);

    if (!extension || file.size === 0) {
      return NextResponse.json(
        { error: "Unsupported or empty file" },
        { status: 400 }
      );
    }

    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        {
          error:
            "File exceeds 4 MB. Larger video uploads require direct storage uploads.",
        },
        { status: 413 }
      );
    }

    const { data: presentation, error: lookupError } =
      await db
        .from("tv_presentations")
        .select("id")
        .eq("id", presentationId)
        .maybeSingle();

    if (lookupError) throw lookupError;

    if (!presentation) {
      return NextResponse.json(
        { error: "Presentation not found" },
        { status: 404 }
      );
    }

    const storagePath =
      `${presentationId}/${randomUUID()}.${extension}`;

    const { error: uploadError } = await db.storage
      .from("tv-media")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    try {
      const sortOrder = await getNextSortOrder(
        db,
        presentationId
      );

      const mediaType = file.type.startsWith("video/")
        ? "video"
        : "image";

      const { data: slide, error: insertError } =
        await db
          .from("tv_slides")
          .insert({
            presentation_id: presentationId,
            title: file.name.slice(0, 200),
            media_type: mediaType,
            storage_path: storagePath,
            roster_event_id: null,
            sort_order: sortOrder,
            duration_seconds: 10,
          })
          .select("*")
          .single();

      if (insertError) throw insertError;

      return NextResponse.json(
        { slide },
        { status: 201 }
      );
    } catch (error) {
      await db.storage
        .from("tv-media")
        .remove([storagePath]);

      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireStaffUser();

    const presentationId =
      request.nextUrl.searchParams.get("presentation_id");

    if (!isUUID(presentationId)) {
      return NextResponse.json(
        { error: "Invalid presentation ID" },
        { status: 400 }
      );
    }

    const db = getTVDatabase();

    const { data, error } = await db
      .from("tv_slides")
      .select("*")
      .eq("presentation_id", presentationId)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const slides = await Promise.all(
      (data ?? []).map(async (slide) => {
        // Live roster slides have no uploaded media.
        if (
          slide.media_type === "roster_teams" ||
          slide.media_type === "roster_free_agents"
        ) {
          return {
            ...slide,
            media_url: null,
          };
        }

        if (!slide.storage_path) {
          throw new Error("Media slide missing storage path");
        }

        const { data: signedData, error: signedError } =
          await db.storage
            .from("tv-media")
            .createSignedUrl(
              slide.storage_path,
              3600
            );

        if (signedError) throw signedError;

        return {
          ...slide,
          media_url: signedData.signedUrl,
        };
      })
    );

    return NextResponse.json(
      { slides },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireStaffUser();

    const slideId =
      request.nextUrl.searchParams.get("id");

    if (!isUUID(slideId)) {
      return NextResponse.json(
        { error: "Invalid slide ID" },
        { status: 400 }
      );
    }

    const db = getTVDatabase();

    const { data: slide, error: lookupError } =
      await db
        .from("tv_slides")
        .select("id, media_type, storage_path")
        .eq("id", slideId)
        .maybeSingle();

    if (lookupError) throw lookupError;

    if (!slide) {
      return NextResponse.json(
        { error: "Slide not found" },
        { status: 404 }
      );
    }

    const { error: deleteError } = await db
      .from("tv_slides")
      .delete()
      .eq("id", slideId);

    if (deleteError) throw deleteError;

    // Only uploaded slides have files to remove.
    if (slide.storage_path) {
      const { error: storageError } = await db.storage
        .from("tv-media")
        .remove([slide.storage_path]);

      if (storageError) {
        console.error(
          "Slide deleted, but media cleanup failed:",
          storageError
        );
      }

      return NextResponse.json({
        success: true,
        warning: storageError
          ? "Slide deleted, but media cleanup requires attention"
          : null,
      });
    }

    return NextResponse.json({
      success: true,
      warning: null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
