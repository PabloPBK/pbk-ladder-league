
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffUser } from "@/lib/server/require-auth";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

type RoundRecord = {
  id: string;
  round_number: number;
};

type EventPlayerRecord = {
  id: string;
  player_id: string;
};

type PlayerRecord = {
  id: string;
  name: string;
  dupr_id: string | null;
};

type CourtRecord = {
  id: string;
  round_id: string;
  court_number: number;
  team_1_score: number;
  team_2_score: number;
  complete: boolean;
};

type CourtPlayer = {
  court_id: string;
  event_player_id: string;
  team_number: number | null;
  slot_number: number;
};

// Exact order from DUPR's single-match-import.csv template.
const HEADERS = [
  "matchType",
  "event",
  "date",
  "playerA1",
  "playerA1DuprId",
  "playerA1ExternalId",
  "playerA2",
  "playerA2DuprId",
  "playerA2ExternalId",
  "playerB1",
  "playerB1DuprId",
  "playerB1ExternalId",
  "playerB2",
  "playerB2DuprId",
  "playerB2ExternalId",
  "teamAGame1",
  "teamBGame1",
  "teamAGame2",
  "teamBGame2",
  "teamAGame3",
  "teamBGame3",
  "teamAGame4",
  "teamBGame4",
  "teamAGame5",
  "teamBGame5",
  "location",
  "scoreType",
];

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    await requireStaffUser();

    const { eventId } = await context.params;

    const { data: event, error: eventError } =
      await supabaseAdmin
        .from("league_events")
        .select("id, name, event_date, status")
        .eq("id", eventId)
        .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "League night not found." },
        { status: 404 },
      );
    }

    if (event.status !== "complete") {
      return NextResponse.json(
        {
          error:
            "Complete the league night before exporting to DUPR.",
        },
        { status: 400 },
      );
    }

    const { data: rounds, error: roundsError } =
      await supabaseAdmin
        .from("rounds")
        .select("id, round_number")
        .eq("event_id", eventId)
        .order("round_number", { ascending: true });

    if (roundsError) throw roundsError;

    const typedRounds = (rounds ?? []) as RoundRecord[];

    const roundIds = typedRounds.map((round) => round.id);

    const roundNumberById = new Map(
      typedRounds.map((round) => [
        round.id,
        round.round_number,
      ]),
    );

    let courts: CourtRecord[] = [];

    // Fetch completed courts in batches.
    for (let i = 0; i < roundIds.length; i += 50) {
      const batch = roundIds.slice(i, i + 50);

      const { data, error } = await supabaseAdmin
        .from("courts")
        .select(
          "id, round_id, court_number, team_1_score, team_2_score, complete",
        )
        .in("round_id", batch)
        .eq("complete", true);

      if (error) throw error;

      courts.push(...((data ?? []) as CourtRecord[]));
    }

    const { data: eventPlayers, error: eventPlayersError } =
      await supabaseAdmin
        .from("event_players")
        .select("id, player_id")
        .eq("event_id", eventId);

    if (eventPlayersError) throw eventPlayersError;

    const typedEventPlayers =
      (eventPlayers ?? []) as EventPlayerRecord[];

    const eventPlayerById = new Map(
      typedEventPlayers.map((row) => [row.id, row]),
    );

    const courtIds = courts.map((court) => court.id);

    let assignments: CourtPlayer[] = [];

    for (let i = 0; i < courtIds.length; i += 50) {
      const batch = courtIds.slice(i, i + 50);

      const { data, error } = await supabaseAdmin
        .from("court_players")
        .select(
          "court_id, event_player_id, team_number, slot_number",
        )
        .in("court_id", batch);

      if (error) throw error;

      assignments.push(...((data ?? []) as CourtPlayer[]));
    }

    // Only require DUPR IDs for players in completed matches.
    const usedEventPlayerIds = new Set(
      assignments.map((row) => row.event_player_id),
    );

    const playerIds = [
      ...new Set(
        typedEventPlayers
          .filter((row) => usedEventPlayerIds.has(row.id))
          .map((row) => row.player_id),
      ),
    ];

    let typedPlayers: PlayerRecord[] = [];

    for (let i = 0; i < playerIds.length; i += 50) {
      const batch = playerIds.slice(i, i + 50);

      const { data, error } = await supabaseAdmin
        .from("players")
        .select("id, name, dupr_id")
        .in("id", batch);

      if (error) throw error;

      typedPlayers.push(
        ...((data ?? []) as PlayerRecord[]),
      );
    }

    const playerById = new Map(
      typedPlayers.map((row) => [row.id, row]),
    );

    const missingRecords = playerIds.filter(
      (id) => !playerById.has(id),
    );

    if (missingRecords.length > 0) {
      return NextResponse.json(
        {
          error:
            "Some match participants are missing player records.",
          playerIds: missingRecords,
        },
        { status: 409 },
      );
    }

    const missing = typedPlayers.filter(
      (player) => !player.dupr_id?.trim(),
    );

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error:
            "Every player in the export needs a DUPR ID.",
          missingPlayers: missing.map((player) => ({
            id: player.id,
            name: player.name,
          })),
        },
        { status: 409 },
      );
    }

    const assignmentsByCourt = new Map<
      string,
      CourtPlayer[]
    >();

    for (const assignment of assignments) {
      const existing =
        assignmentsByCourt.get(assignment.court_id) ?? [];

      existing.push(assignment);

      assignmentsByCourt.set(
        assignment.court_id,
        existing,
      );
    }

    const rows = courts
      .sort(
        (a, b) =>
          (roundNumberById.get(a.round_id) ?? 0) -
            (roundNumberById.get(b.round_id) ?? 0) ||
          a.court_number - b.court_number,
      )
      .map((court) => {
        const courtAssignments =
          assignmentsByCourt.get(court.id) ?? [];

        const teamA = courtAssignments
          .filter((row) => row.team_number === 1)
          .sort(
            (a, b) => a.slot_number - b.slot_number,
          );

        const teamB = courtAssignments
          .filter((row) => row.team_number === 2)
          .sort(
            (a, b) => a.slot_number - b.slot_number,
          );

        const orderedAssignments = [
          ...teamA,
          ...teamB,
        ];

        if (
          teamA.length !== 2 ||
          teamB.length !== 2
        ) {
          throw new Error(
            `Court ${court.court_number} does not have two players on each team.`,
          );
        }

        const orderedPlayers = orderedAssignments.map(
          (assignment) => {
            const eventPlayer = eventPlayerById.get(
              assignment.event_player_id,
            );

            return eventPlayer
              ? playerById.get(eventPlayer.player_id)
              : undefined;
          },
        );

        if (orderedPlayers.some((player) => !player)) {
          throw new Error(
            `Court ${court.court_number} has an unresolved player.`,
          );
        }

        const [a1, a2, b1, b2] =
          orderedPlayers as PlayerRecord[];

        return [
          "D",
          event.name,
          event.event_date,

          a1.name,
          a1.dupr_id,
          "",

          a2.name,
          a2.dupr_id,
          "",

          b1.name,
          b1.dupr_id,
          "",

          b2.name,
          b2.dupr_id,
          "",

          court.team_1_score,
          court.team_2_score,

          "", "",
          "", "",
          "", "",
          "", "",

          "",
          "SIDEOUT",
        ];
      });

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No completed matches were found for this league night.",
        },
        { status: 409 },
      );
    }

    const csv =
      [HEADERS, ...rows]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n") + "\r\n";

    const safeName = event.name
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          `attachment; filename="${safeName || "pbk-league-night"}-dupr.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "AUTH_REQUIRED"
    ) {
      return NextResponse.json(
        {
          error: "Sign in as staff to export DUPR results.",
        },
        { status: 401 },
      );
    }

    console.error("DUPR CSV export error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to export DUPR CSV.",
      },
      { status: 500 },
    );
  }
}
