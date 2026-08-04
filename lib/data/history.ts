export type HistoryWinner = {
  playerId: string;
  name: string;
  wins: number;
  losses: number;
  pointDifferential: number;
};

export type HistoryEventSummary = {
  id: string;
  seasonId: string;
  eventDate: string;
  name: string;
  status: string;
  roundCount: number;
  playerCount: number;
  matchCount: number;
  winner: HistoryWinner | null;
};

export type HistoryPlayer = {
  playerId: string;
  name: string;
  dupr: number;
  slotNumber: number;
  teamNumber: number | null;
};

export type HistoryCourt = {
  databaseCourtId: string;
  courtNumber: number;
  pairingIndex: number | null;
  team1Score: number | null;
  team2Score: number | null;
  winnerTeam: number | null;
  complete: boolean;
  completedAt: string | null;
  team1: HistoryPlayer[];
  team2: HistoryPlayer[];
};

export type HistoryRound = {
  id: string;
  roundNumber: number;
  status: string;
  courts: HistoryCourt[];
};

export type HistoryStanding = {
  rank: number;
  playerId: string;
  name: string;
  dupr: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
};

export type HistoryEventDetail = {
  event: {
    id: string;
    seasonId: string;
    eventDate: string;
    name: string;
    status: string;
    roundCount: number;
    playerCount: number;
  };
  standings: HistoryStanding[];
  rounds: HistoryRound[];
};

type HistoryListResponse = {
  events?: HistoryEventSummary[];
  error?: string;
};

type HistoryDetailResponse = {
  event?: HistoryEventDetail["event"];
  standings?: HistoryStanding[];
  rounds?: HistoryRound[];
  error?: string;
};

async function readJson<T>(
  response: Response,
): Promise<T> {
  const responseText = await response.text();

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error(
      `The History API did not return valid JSON. HTTP ${response.status}.`,
    );
  }
}

export async function getHistoryEvents(): Promise<
  HistoryEventSummary[]
> {
  const response = await fetch("/api/history", {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  const result =
    await readJson<HistoryListResponse>(
      response,
    );

  if (
    !response.ok ||
    !Array.isArray(result.events)
  ) {
    throw new Error(
      result.error ??
        "Unable to load league history.",
    );
  }

  return result.events;
}

export async function getHistoryEvent(
  eventId: string,
): Promise<HistoryEventDetail> {
  const response = await fetch(
    `/api/history/${encodeURIComponent(
      eventId,
    )}`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const result =
    await readJson<HistoryDetailResponse>(
      response,
    );

  if (
    !response.ok ||
    !result.event ||
    !Array.isArray(result.standings) ||
    !Array.isArray(result.rounds)
  ) {
    throw new Error(
      result.error ??
        "Unable to load this league night.",
    );
  }

  return {
    event: result.event,
    standings: result.standings,
    rounds: result.rounds,
  };
}