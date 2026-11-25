import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isUuid } from "@/zz2-site/lib/league-contract";
export const dynamic = "force-dynamic";
const fields = "id,name,start_date,end_date,description,registration_url,registration_platform,logo_url,tournament_facilities(name,city,state,address)";
export async function GET(request:NextRequest){
  try {
    const id=request.nextUrl.searchParams.get("id");
    let query=supabaseAdmin.from("tournaments").select(fields).eq("status","published").eq("publish_zz2",true);
    if(id){
      if(!isUuid(id))return NextResponse.json({error:"Invalid tournament"},{status:400});
      query=query.eq("id",id);
    }else query=query.gte("end_date",new Date().toISOString().slice(0,10)).order("start_date",{ascending:true});
    const {data,error}=await query;
    if(error)throw error;
    if(id&&!data?.length)return NextResponse.json({error:"Tournament not found"},{status:404});
    return NextResponse.json({tournaments:data??[]},{headers:{"Cache-Control":"public, s-maxage=60, stale-while-revalidate=120"}});
  }catch(error){console.error("Public ZZ2 tournament feed failed",error);return NextResponse.json({error:"Tournament listings unavailable"},{status:503});}
}
