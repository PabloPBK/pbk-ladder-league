import { NextRequest, NextResponse } from "next/server";
import { getTVDatabase } from "@/lib/server/tv-database";
import { getLeagueTvOverride, leagueTvRevision } from "@/lib/server/league-tv";
import { requireStaffUser } from "@/lib/server/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight revision check. Does not load slides, images, or signed URLs.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("short_code");
  const id = request.nextUrl.searchParams.get("screen_id");
  const token = request.nextUrl.searchParams.get("token");
  if (!code && !(id && token)) return NextResponse.json({error:"Missing TV credentials"},{status:400});
  if (code && !/^tv[a-z0-9]{1,30}$/.test(code)) return NextResponse.json({error:"Invalid TV address"},{status:400});
  if (!code && (!/^[0-9a-f-]{36}$/i.test(id ?? "") || !/^[0-9a-f-]{36}$/i.test(token ?? ""))) return NextResponse.json({error:"Invalid credentials"},{status:400});
  try {
    let query = getTVDatabase().from("tv_screens").select("id, updated_at").eq("is_active",true);
    query = code ? query.eq("short_code",code) : query.eq("id",id!).eq("display_token",token!);
    const {data,error} = await query.maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({error:"TV not found"},{status:404});
    const assignment = await getLeagueTvOverride(data.id);
    return NextResponse.json({revision:leagueTvRevision(data.updated_at, assignment)},{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Unable to check TV updates"},{status:500});
  }
}

// Publish updated content to one screen, or all screens.
export async function POST(request: NextRequest) {
  try {
    await requireStaffUser();
    const body = await request.json().catch(()=>null);
    const screenId = body?.screen_id;
    if (screenId !== null && screenId !== undefined &&
        (typeof screenId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(screenId))) {
      return NextResponse.json({error:"Invalid screen ID"},{status:400});
    }
    let query = getTVDatabase().from("tv_screens").update({updated_at:new Date().toISOString()}).select("id");
    if (screenId) query = query.eq("id",screenId);
    const {data,error} = await query;
    if (error) throw error;
    if (screenId && !data?.length) return NextResponse.json({error:"TV not found"},{status:404});
    return NextResponse.json({success:true,updated:data?.length ?? 0});
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "AUTH_REQUIRED") return NextResponse.json({error:"Authentication required"},{status:401});
    if (message === "STAFF_ACCESS_DENIED") return NextResponse.json({error:"Staff access required"},{status:403});
    return NextResponse.json({error:"Unable to publish TV updates"},{status:500});
  }
}
