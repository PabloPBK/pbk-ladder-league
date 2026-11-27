import { NextResponse } from "next/server";
import { readLeaguePlan } from "@/lib/data/league-plan";
import { getStaffApiDenial } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const denial = await getStaffApiDenial();
  if (denial) return denial;

  let plan;
  try {
    plan = readLeaguePlan(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid league plan." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.rpc("create_league_with_seasons", {
    plan_id: plan.planId,
    league_name: plan.name,
    league_description: plan.description,
    season_plans: plan.dates,
  });
  if (error) {
    console.error("Unable to create planned league:", error);
    return NextResponse.json({ error: "Unable to create the league." }, { status: 500 });
  }

  const firstSeason = await supabaseAdmin.from("seasons").select("id")
    .eq("league_id", plan.planId).eq("name", "Season 1").single();
  if (firstSeason.error || !firstSeason.data) {
    console.error("Unable to open new league:", firstSeason.error);
    return NextResponse.json({ error: "Unable to open the new league. Retry to open the saved plan." }, { status: 500 });
  }
  return NextResponse.json({ leagueId: plan.planId, seasonId: firstSeason.data.id }, { status: 201 });
}
