export type MatchCenterPlayer = {
  playerId: string;
  name: string;
  dupr: number;
  slotNumber: number;
  teamNumber: number | null;
};

export type MatchCenterCourt = {
  databaseCourtId: string;
  courtNumber: number;
  pairingIndex: number | null;
  team1Score: number | null;
  team2Score: number | null;
  winnerTeam: number | null;
  complete: boolean;
  completedAt: string | null;
  team1: MatchCenterPlayer[];
  team2: MatchCenterPlayer[];
};

export type LiveStanding = {
  rank: number;
  playerId: string;
  name: string;
  dupr: number;
  wins: number;
  losses: number;
  gamesPlayed: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
};

export type MatchCenterData = {
  event: {
    id: string;
    season_id: string;
    name: string;
    event_date: string;
    status: string;
    current_round: number;
  };
  round: {
    id: string;
    event_id: string;
    round_number: number;
    status: string;
  };
  courts: MatchCenterCourt[];
  standings: LiveStanding[];
  roundComplete: boolean;
};

type MatchCenterResponse = {
  event?: MatchCenterData["event"];
  round?: MatchCenterData["round"];
  courts?: MatchCenterCourt[];
  standings?: LiveStanding[];
  roundComplete?: boolean;
  error?: string;
};

export async function getMatchCenter(
  eventId: string,
): Promise<MatchCenterData> {
  const response = await fetch(
    `/api/events/${encodeURIComponent(
      eventId,
    )}/match-center`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const responseText = await response.text();

  let result: MatchCenterResponse;

  try {
    result = JSON.parse(
      responseText,
    ) as MatchCenterResponse;
  } catch {
    throw new Error(
      `The Match Center API did not return valid JSON. HTTP ${response.status}.`,
    );
  }

  if (
    !response.ok ||
    !result.event ||
    !result.round ||
    !Array.isArray(result.courts) ||
    !Array.isArray(result.standings)
  ) {
    throw new Error(
      result.error ??
        "Unable to load Match Center.",
    );
  }

  return {
    event: result.event,
    round: result.round,
    courts: result.courts,
    standings: result.standings,
    roundComplete:
      result.roundComplete ?? false,
  };
}

type SaveCourtScoreResponse = {
  court?: {
    id: string;
    court_number: number;
    team_1_score: number;
    team_2_score: number;
    winner_team: number;
    complete: boolean;
    completed_at: string;
  };
  roundComplete?: boolean;
  error?: string;
};

export async function saveCourtScore({
  eventId,
  courtNumber,
  team1Score,
  team2Score,
}: {
  eventId: string;
  courtNumber: number;
  team1Score: number;
  team2Score: number;
}) {
  const response = await fetch(
    `/api/events/${encodeURIComponent(
      eventId,
    )}/courts/${courtNumber}/score`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        team1Score,
        team2Score,
      }),
    },
  );

  const responseText = await response.text();

  let result: SaveCourtScoreResponse;

  try {
    result = JSON.parse(
      responseText,
    ) as SaveCourtScoreResponse;
  } catch {
    throw new Error(
      `The score API did not return valid JSON. HTTP ${response.status}.`,
    );
  }

  if (!response.ok || !result.court) {
    throw new Error(
      result.error ??
        "Unable to save the court score.",
    );
  }

  return result;
}
type CompleteLeagueEventResponse = {
  event?: MatchCenterData["event"];
  alreadyComplete?: boolean;
  error?: string;
};

export async function completeLeagueEvent(
  eventId: string,
) {
  const response = await fetch(
    `/api/events/${encodeURIComponent(
      eventId,
    )}/complete`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const responseText =
    await response.text();

  let result: CompleteLeagueEventResponse;

  try {
    result = JSON.parse(
      responseText,
    ) as CompleteLeagueEventResponse;
  } catch {
    throw new Error(
      `The complete-event API did not return valid JSON. HTTP ${response.status}.`,
    );
  }

  if (!response.ok || !result.event) {
    throw new Error(
      result.error ??
        "Unable to complete the league event.",
    );
  }

  return result;
}