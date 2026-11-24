import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export async function getLeagueEventPrize(eventId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin.from("league_event_prizes").select("amount_cents")
    .eq("event_id", eventId).maybeSingle();
  if (error) throw error;
  return data?.amount_cents ?? null;
}
