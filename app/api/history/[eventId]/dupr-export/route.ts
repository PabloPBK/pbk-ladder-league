import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffUser } from "@/lib/server/require-auth";

type RouteContext = { params: Promise<{ eventId: string }> };

type RoundRecord = { id: string; round_number: number };
type EventPlayerRecord = { id: string; player_id: string };
type PlayerRecord = { id: string; name: string; dupr_id: string | null };
type CourtRecord = { id: string; round_id: string; court_number: number; team_1_score: number; team_2_score: number; complete: boolean };

type CourtPlayer = {
  court_id: string;
  event_player_id: string;
  team_number: number | null;
  slot_number: number;
};

const HEADERS = [
  "Event Name", "Match Date", "Match Type", "Scoring Type",
  "Player 1 First Name", "Player 1 Last Name", "Player 1 DUPR ID",
  "Player 2 First Name", "Player 2 Last Name", "Player 2 DUPR ID",
  "Player 3 First Name", "Player 3 Last Name", "Player 3 DUPR ID",
  "Player 4 First Name", "Player 4 Last Name", "Player 4 DUPR ID",
  "Game 1 Team 1 Score", "Game 1 Team 2 Score",
  "Game 2 Team 1 Score", "Game 2 Team 2 Score",
  "Game 3 Team 1 Score", "Game 3 Team 2 Score",
];

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return { first: parts[0] ?? "", last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts.at(-1) ?? "" };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireStaffUser();
    const { eventId } = await context.params;
    const url = new URL(request.url);
    const scoringType = url.searchParams.get("scoringType") === "Rally" ? "Rally" : "Standard";

    const { data: event, error: eventError } = await supabaseAdmin
      .from("league_events")
      .select("id, name, event_date, status")
      .eq("id", eventId)
      .single();
    if (eventError || !event) return NextResponse.json({ error: "League night not found." }, { status: 404 });
    if (event.status !== "complete") return NextResponse.json({ error: "Complete the league night before exporting to DUPR." }, { status: 400 });

    const { data: rounds, error: roundsError } = await supabaseAdmin
      .from("rounds")
      .select("id, round_number")
      .eq("event_id", eventId)
      .order("round_number", { ascending: true });
    if (roundsError) throw roundsError;

    const typedRounds = (rounds ?? []) as RoundRecord[];
    const roundIds = typedRounds.map((round) => round.id);
    const roundNumberById = new Map<string, number>(typedRounds.map((round) => [round.id, round.round_number]));
    let courts: CourtRecord[] = [];
    if (roundIds.length) {
      const { data, error } = await supabaseAdmin
        .from("courts")
        .select("id, round_id, court_number, team_1_score, team_2_score, complete")
        .in("round_id", roundIds)
        .eq("complete", true);
      if (error) throw error;
      courts = (data ?? []) as CourtRecord[];
    }

    const { data: eventPlayers, error: eventPlayersError } = await supabaseAdmin
      .from("event_players")
      .select("id, player_id")
      .eq("event_id", eventId);
    if (eventPlayersError) throw eventPlayersError;
    const typedEventPlayers = (eventPlayers ?? []) as EventPlayerRecord[];
    const playerIds = [...new Set(typedEventPlayers.map((row) => row.player_id))];

    const { data: players, error: playersError } = playerIds.length
      ? await supabaseAdmin.from("players").select("id, name, dupr_id").in("id", playerIds)
      : { data: [], error: null };
    if (playersError) throw playersError;

    const typedPlayers = (players ?? []) as PlayerRecord[];
    const missing = typedPlayers.filter((player) => !player.dupr_id?.trim());
    if (missing.length > 0) {
      return NextResponse.json(
        { error: "Every player in the export needs a DUPR ID.", missingPlayers: missing.map((player) => ({ id: player.id, name: player.name })) },
        { status: 409 },
      );
    }

    const eventPlayerById = new Map<string, EventPlayerRecord>(typedEventPlayers.map((row) => [row.id, row]));
    const playerById = new Map<string, PlayerRecord>(typedPlayers.map((row) => [row.id, row]));
    const courtIds = courts.map((court) => court.id);
    let assignments: CourtPlayer[] = [];
    if (courtIds.length) {
      const { data, error } = await supabaseAdmin
        .from("court_players")
        .select("court_id, event_player_id, team_number, slot_number")
        .in("court_id", courtIds);
      if (error) throw error;
      assignments = (data ?? []) as CourtPlayer[];
    }

    const rows = courts
      .sort((a, b) => (roundNumberById.get(a.round_id) ?? 0) - (roundNumberById.get(b.round_id) ?? 0) || a.court_number - b.court_number)
      .map((court) => {
        const team1 = assignments.filter((a) => a.court_id === court.id && a.team_number === 1).sort((a,b) => a.slot_number-b.slot_number);
        const team2 = assignments.filter((a) => a.court_id === court.id && a.team_number === 2).sort((a,b) => a.slot_number-b.slot_number);
        const ordered = [...team1, ...team2].map((assignment) => {
          const ep = eventPlayerById.get(assignment.event_player_id);
          return ep ? playerById.get(ep.player_id) : undefined;
        });
        if (ordered.length !== 4 || ordered.some((player) => !player)) {
          throw new Error(`Court ${court.court_number} does not have four DUPR-ready players.`);
        }
        const names = ordered.map((player) => splitName(player!.name));
        return [
          event.name, event.event_date, "Doubles", scoringType,
          names[0].first, names[0].last, ordered[0]!.dupr_id,
          names[1].first, names[1].last, ordered[1]!.dupr_id,
          names[2].first, names[2].last, ordered[2]!.dupr_id,
          names[3].first, names[3].last, ordered[3]!.dupr_id,
          court.team_1_score, court.team_2_score,
          "", "", "", "",
        ];
      });

    const csv = [HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
    const safeName = event.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName || "pbk-league-night"}-dupr.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in as staff to export DUPR results." }, { status: 401 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to export DUPR CSV." }, { status: 500 });
  }
}
