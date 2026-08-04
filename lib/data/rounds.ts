export type FirstRoundCourtInput = {
  courtNumber: number;
  players: {
    databasePlayerId: string;
    slotNumber: number;
  }[];
};

type SaveFirstRoundInput = {
  eventId: string;
  roundNumber: number;
  courts: FirstRoundCourtInput[];
};

type SavedRoundRecord = {
  id: string;
  event_id: string;
  round_number: number;
  status: string;
};

type SaveRoundResponse = {
  round?: SavedRoundRecord;
  courtCount?: number;
  playerCount?: number;
  error?: string;
};

async function readRoundResponse(
  response: Response,
): Promise<SaveRoundResponse> {
  const responseText =
    await response.text();

  try {
    return JSON.parse(
      responseText,
    ) as SaveRoundResponse;
  } catch {
    throw new Error(
      `The rounds API did not return valid JSON. HTTP ${response.status}.`,
    );
  }
}

export async function saveFirstRound({
  eventId,
  roundNumber,
  courts,
}: SaveFirstRoundInput) {
  const response = await fetch(
    "/api/rounds/first",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        eventId,
        roundNumber,
        courts,
      }),
    },
  );

  const result =
    await readRoundResponse(response);

  if (!response.ok || !result.round) {
    throw new Error(
      result.error ??
        "Unable to save Round 1.",
    );
  }

  return result;
}

export async function generateSavedNextRound(
  eventId: string,
) {
  const response = await fetch(
    `/api/events/${encodeURIComponent(
      eventId,
    )}/rounds/next`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const result =
    await readRoundResponse(response);

  if (!response.ok || !result.round) {
    throw new Error(
      result.error ??
        "Unable to generate the next round.",
    );
  }

  return result;
}