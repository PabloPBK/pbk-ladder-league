export type SavedRoundPlayer = {
  databasePlayerId: string;
  name: string;
  dupr: number;
  slotNumber: number;
  teamNumber: number | null;
};

export type SavedRoundCourt = {
  databaseCourtId: string;
  courtNumber: number;
  complete: boolean;
  players: SavedRoundPlayer[];
};

export type SavedCurrentRound = {
  event: {
    id: string;
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
  courts: SavedRoundCourt[];
};

type CurrentRoundResponse = {
  event?: SavedCurrentRound["event"];
  round?: SavedCurrentRound["round"];
  courts?: SavedRoundCourt[];
  error?: string;
};

export async function getCurrentRound(
  eventId: string,
): Promise<SavedCurrentRound> {
  const response = await fetch(
    `/api/events/${encodeURIComponent(
      eventId,
    )}/current-round`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const responseText = await response.text();

  let result: CurrentRoundResponse;

  try {
    result = JSON.parse(
      responseText,
    ) as CurrentRoundResponse;
  } catch {
    throw new Error(
      `The current-round API did not return valid JSON. HTTP ${response.status}.`,
    );
  }

  if (
    !response.ok ||
    !result.event ||
    !result.round ||
    !Array.isArray(result.courts)
  ) {
    throw new Error(
      result.error ??
        "Unable to load the current round.",
    );
  }

  return {
    event: result.event,
    round: result.round,
    courts: result.courts,
  };
}