import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  await requireStaffUser();
  const {id}=await params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return NextResponse.json({error:"Invalid tournament"},{status:400});
  const body=await request.json();
  if(typeof body.publish!=="boolean")return NextResponse.json({error:"Invalid publish action"},{status:400});
  const {data:existing,error:lookupError}=await supabaseAdmin.from("tournaments").select("id,name,registration_url,start_date,end_date,facility_id").eq("id",id).maybeSingle();
  if(lookupError)throw lookupError;
  if(!existing)return NextResponse.json({error:"Tournament not found"},{status:404});
  if(body.publish&&!existing.registration_url)return NextResponse.json({error:"Add a registration URL before publishing."},{status:400});
  // Only the ZZ2 Vercel destination is implemented. Do not claim to publish to unconnected PBK sites.
  const {data,error}=await supabaseAdmin.from("tournaments").update({status:body.publish?"published":"draft",publish_zz2:body.publish,publish_pbk_northwest:false,updated_at:new Date().toISOString()}).eq("id",id).select("id,name,status,publish_zz2").single();
  if(error)throw error;
  return NextResponse.json({success:true,tournament:data,destinations:body.publish?["ZZ2 Pickleball (Vercel preview)"]:[]},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  const message=error instanceof Error?error.message:"";
  if(message==="AUTH_REQUIRED")return NextResponse.json({error:"Sign in required"},{status:401});
  if(message==="STAFF_ACCESS_DENIED")return NextResponse.json({error:"Staff access required"},{status:403});
  console.error("Tournament publish failed",error);
  return NextResponse.json({error:"Unable to update publishing status"},{status:500});
 }
}
