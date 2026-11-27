import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export type LeagueTvMode = "courts" | "standings";

export async function getLeagueTvOverride(screenId: string) {
  const { data, error } = await supabaseAdmin.from("league_tv_overrides")
    .select("event_id, mode, league_events!inner(status)").eq("screen_id", screenId)
    .eq("league_events.status", "active").maybeSingle();
  if (error) {
    console.error("Unable to load a league TV override", error.code);
    return null;
  }
  if (!data || (data.mode !== "courts" && data.mode !== "standings")) return null;
  return { eventId: data.event_id as string, mode: data.mode as LeagueTvMode };
}

export function leagueTvRevision(baseRevision: string | null, assignment: Awaited<ReturnType<typeof getLeagueTvOverride>>) {
  return assignment ? JSON.stringify([baseRevision, assignment.eventId, assignment.mode]) : baseRevision;
}
