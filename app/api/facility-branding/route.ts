import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffUser } from "@/lib/server/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "facility-branding";
const FACILITY_ID = "lynnwood";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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

export async function POST(request: NextRequest) {
  try {
    await requireStaffUser();

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please select a logo." },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (
      !allowedTypes.includes(file.type) ||
      file.size === 0 ||
      file.size > MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        { error: "Use a PNG, JPG, or WebP image under 5 MB." },
        { status: 400 }
      );
    }

    const db = getTVDatabase();

    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";

    const path = `${FACILITY_ID}/logo-${crypto.randomUUID()}.${extension}`;

    const { error } = await db.storage
      .from(BUCKET)
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    const { data } = db.storage
      .from(BUCKET)
      .getPublicUrl(path);

    return NextResponse.json({
      success: true,
      logo_url: data.publicUrl,
      path,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "AUTH_REQUIRED") {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      if (error.message === "STAFF_ACCESS_DENIED") {
        return NextResponse.json(
          { error: "Staff access required" },
          { status: 403 }
        );
      }
    }

    console.error("Logo upload error:", error);

    return NextResponse.json(
      { error: "Unable to upload logo" },
      { status: 500 }
    );
  }
}
