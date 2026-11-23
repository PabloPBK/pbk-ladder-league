import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { requireStaffUser } from "@/lib/server/require-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const validId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
function db() { return createClient(process.env.TV_SUPABASE_URL!, process.env.TV_SUPABASE_SECRET_KEY!, {auth:{persistSession:false,autoRefreshToken:false}}); }
export async function POST(request: NextRequest) {
 try {
  await requireStaffUser();
  const form = await request.formData();
  const eventId = form.get("event_id"), file = form.get("file");
  if (!validId(eventId) || !(file instanceof File) || !["image/png","image/jpeg","image/webp"].includes(file.type) || !file.size || file.size > 4*1024*1024)
    return NextResponse.json({error:"Select a PNG, JPG or WebP logo smaller than 4 MB."},{status:400});
  const client=db();
  const {data:event,error:lookupError}=await client.from("roster_events").select("id,logo_storage_path").eq("id",eventId).maybeSingle();
  if(lookupError) throw lookupError;
  if(!event) return NextResponse.json({error:"Event not found"},{status:404});
  const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
  const path=`rosters/${eventId}/logos/${randomUUID()}.${ext}`;
  const {error:uploadError}=await client.storage.from("tv-media").upload(path,file,{contentType:file.type,upsert:false});
  if(uploadError) throw uploadError;
  const {error:updateError}=await client.from("roster_events").update({logo_storage_path:path}).eq("id",eventId);
  if(updateError){await client.storage.from("tv-media").remove([path]);throw updateError;}
  return NextResponse.json({success:true,logo_storage_path:path});
 } catch(error){console.error("Roster logo upload failed",error);return NextResponse.json({error:"Unable to save event logo"},{status:500});}
}
