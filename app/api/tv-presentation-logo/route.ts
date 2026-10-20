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
]);

function isUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    uuidPattern.test(value)
  );
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

  console.error("Presentation logo API error:", error);

  return NextResponse.json(
    { error: "Unable to process presentation logo" },
    { status: 500 }
  );
}

async function getPresentation(
  db: ReturnType<typeof getTVDatabase>,
  presentationId: string
) {
  const { data, error } = await db
    .from("tv_presentations")
    .select("id, logo_storage_path")
    .eq("id", presentationId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

// UPLOAD OR REPLACE PRESENTATION LOGO
export async function POST(request: NextRequest) {
  try {
    await requireStaffUser();

    const form = await request.formData();
    const file = form.get("file");
    const presentationId = form.get("presentation_id");

    if (
      !(file instanceof File) ||
      !isUUID(presentationId)
    ) {
      return NextResponse.json(
        { error: "Invalid logo upload details" },
        { status: 400 }
      );
    }

    const extension = allowedTypes.get(file.type);

    if (!extension || file.size === 0) {
      return NextResponse.json(
        {
          error:
            "Please select a PNG, JPG, or WebP image.",
        },
        { status: 400 }
      );
    }

    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: "Logo must be smaller than 4 MB.",
        },
        { status: 413 }
      );
    }

    const db = getTVDatabase();

    const presentation = await getPresentation(
      db,
      presentationId
    );

    if (!presentation) {
      return NextResponse.json(
        { error: "Presentation not found" },
        { status: 404 }
      );
    }

    const previousPath =
      presentation.logo_storage_path;

    const storagePath =
      `${presentationId}/logos/${randomUUID()}.${extension}`;

    const { error: uploadError } = await db.storage
      .from("tv-media")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: updated, error: updateError } =
      await db
        .from("tv_presentations")
        .update({
          logo_storage_path: storagePath,
        })
        .eq("id", presentationId)
        .eq(
          "logo_storage_path",
          previousPath ?? null
        )
        .select("id")
        .maybeSingle();

    if (updateError || !updated) {
      await db.storage
        .from("tv-media")
        .remove([storagePath]);

      if (updateError) throw updateError;

      return NextResponse.json(
        {
          error:
            "Presentation logo changed during upload. Please try again.",
        },
        { status: 409 }
      );
    }

    if (previousPath) {
      const { error: cleanupError } = await db.storage
        .from("tv-media")
        .remove([previousPath]);

      if (cleanupError) {
        console.error(
          "Old presentation logo cleanup failed:",
          cleanupError
        );
      }
    }

    const { data: signed, error: signedError } =
      await db.storage
        .from("tv-media")
        .createSignedUrl(storagePath, 3600);

    if (signedError) throw signedError;

    return NextResponse.json({
      success: true,
      logo_storage_path: storagePath,
      logo_url: signed.signedUrl,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// GET CURRENT PRESENTATION LOGO
export async function GET(request: NextRequest) {
  try {
    await requireStaffUser();

    const presentationId =
      request.nextUrl.searchParams.get(
        "presentation_id"
      );

    if (!isUUID(presentationId)) {
      return NextResponse.json(
        { error: "Invalid presentation ID" },
        { status: 400 }
      );
    }

    const db = getTVDatabase();

    const presentation = await getPresentation(
      db,
      presentationId
    );

    if (!presentation) {
      return NextResponse.json(
        { error: "Presentation not found" },
        { status: 404 }
      );
    }

    if (!presentation.logo_storage_path) {
      return NextResponse.json(
        {
          logo_storage_path: null,
          logo_url: null,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const { data: signed, error: signedError } =
      await db.storage
        .from("tv-media")
        .createSignedUrl(
          presentation.logo_storage_path,
          3600
        );

    if (signedError) throw signedError;

    return NextResponse.json(
      {
        logo_storage_path:
          presentation.logo_storage_path,
        logo_url: signed.signedUrl,
      },
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

// REMOVE PRESENTATION LOGO
export async function DELETE(request: NextRequest) {
  try {
    await requireStaffUser();

    const presentationId =
      request.nextUrl.searchParams.get(
        "presentation_id"
      );

    if (!isUUID(presentationId)) {
      return NextResponse.json(
        { error: "Invalid presentation ID" },
        { status: 400 }
      );
    }

    const db = getTVDatabase();

    const presentation = await getPresentation(
      db,
      presentationId
    );

    if (!presentation) {
      return NextResponse.json(
        { error: "Presentation not found" },
        { status: 404 }
      );
    }

    const previousPath =
      presentation.logo_storage_path;

    if (!previousPath) {
      return NextResponse.json({
        success: true,
      });
    }

    const { data: updated, error: updateError } =
      await db
        .from("tv_presentations")
        .update({
          logo_storage_path: null,
        })
        .eq("id", presentationId)
        .eq("logo_storage_path", previousPath)
        .select("id")
        .maybeSingle();

    if (updateError) throw updateError;

    if (!updated) {
      return NextResponse.json(
        {
          error:
            "Presentation logo changed. Please refresh.",
        },
        { status: 409 }
      );
    }

    const { error: storageError } = await db.storage
      .from("tv-media")
      .remove([previousPath]);

    if (storageError) {
      console.error(
        "Presentation logo cleanup failed:",
        storageError
      );
    }

    return NextResponse.json({
      success: true,
      warning: storageError
        ? "Logo removed, but storage cleanup requires attention."
        : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
