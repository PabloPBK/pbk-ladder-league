import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { requireStaffUser } from "@/lib/server/require-auth";

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

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
]);

export async function POST(request: NextRequest) {
  try {
    await requireStaffUser();

    const form = await request.formData();
    const file = form.get("file");
    const presentationId = form.get("presentation_id");

    if (
      !(file instanceof File) ||
      typeof presentationId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        presentationId
      )
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

    // Keep uploads small enough for standard Vercel
    // serverless request limits.
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        {
          error:
            "File exceeds 4 MB. Larger video uploads will require direct storage uploads.",
        },
        { status: 413 }
      );
    }

    const db = getTVDatabase();

    const { data: presentation, error: lookupError } =
      await db
        .from("tv_presentations")
        .select("id")
        .eq("id", presentationId)
        .single();

    if (lookupError || !presentation) {
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

    const mediaType = file.type.startsWith("video/")
      ? "video"
      : "image";

    const { data: lastSlide, error: orderError } =
      await db
        .from("tv_slides")
        .select("sort_order")
        .eq("presentation_id", presentationId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (orderError) {
      await db.storage.from("tv-media").remove([storagePath]);
      throw orderError;
    }

    const { data: slide, error: insertError } =
      await db
        .from("tv_slides")
        .insert({
          presentation_id: presentationId,
          title: file.name.slice(0, 200),
          media_type: mediaType,
          storage_path: storagePath,
          sort_order: (lastSlide?.sort_order ?? -1) + 1,
          duration_seconds: 10,
        })
        .select("*")
        .single();

    if (insertError) {
      await db.storage.from("tv-media").remove([storagePath]);
      throw insertError;
    }

    return NextResponse.json(
      { slide },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireStaffUser();

    const presentationId =
      request.nextUrl.searchParams.get("presentation_id");

    if (
      !presentationId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        presentationId
      )
    ) {
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
        const { data: signedData, error: signedError } =
          await db.storage
            .from("tv-media")
            .createSignedUrl(slide.storage_path, 3600);

        if (signedError) throw signedError;

        return {
          ...slide,
          media_url: signedData.signedUrl,
        };
      })
    );

    return NextResponse.json({ slides });
  } catch (error) {
    return errorResponse(error);
  }
}
