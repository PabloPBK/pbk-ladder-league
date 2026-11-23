import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireStaffUser();
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });
    }
    const { data: tournament, error: lookupError } = await supabaseAdmin
      .from("tournaments").select("id").eq("id", id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!tournament) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
    const types: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
    const ext = types[file.type];
    if (!ext) return NextResponse.json({ error: "Only PNG, JPG, and WebP images are allowed." }, { status: 400 });
    if (file.size === 0 || file.size > 4194304) return NextResponse.json({ error: "Image must be under 4 MB." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const png = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b);
    const jpg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP";
    if (!(ext === "png" && png || ext === "jpg" && jpg || ext === "webp" && webp)) {
      return NextResponse.json({ error: "The file does not match its image type." }, { status: 400 });
    }
    const path = `${id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage.from("tournament-logos")
      .upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: "3600" });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabaseAdmin.storage.from("tournament-logos").getPublicUrl(path);
    const { error: updateError } = await supabaseAdmin.from("tournaments")
      .update({ logo_url: urlData.publicUrl, updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) {
      await supabaseAdmin.storage.from("tournament-logos").remove([path]);
      throw updateError;
    }
    return NextResponse.json({ success: true, logo_url: urlData.publicUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "AUTH_REQUIRED") return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (message === "STAFF_ACCESS_DENIED") return NextResponse.json({ error: "Staff access required." }, { status: 403 });
    console.error("Tournament logo upload failed", error);
    return NextResponse.json({ error: "Unable to upload tournament logo." }, { status: 500 });
  }
}
