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
  regenerated?: boolean;
  currentRoundNumber?: number;
  requiresConfirmation?: boolean;
  laterRoundNumbers?: number[];
  message?: string;
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

export type RegenerateLaterRoundsResult = {
  round?: SavedRoundRecord;
  courtCount?: number;
  playerCount?: number;
  regenerated?: boolean;
  currentRoundNumber?: number;
  requiresConfirmation: boolean;
  laterRoundNumbers: number[];
  message?: string;
};

export async function regenerateLaterRounds({
  eventId,
  editedRoundNumber,
  force = false,
}: {
  eventId: string;
  editedRoundNumber: number;
  force?: boolean;
}): Promise<RegenerateLaterRoundsResult> {
  const response = await fetch(
    `/api/events/${encodeURIComponent(
      eventId,
    )}/rounds/regenerate-after`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        editedRoundNumber,
        force,
      }),
    },
  );

  const result =
    await readRoundResponse(response);

  if (
    response.status === 409 &&
    result.requiresConfirmation
  ) {
    return {
      requiresConfirmation: true,
      laterRoundNumbers:
        result.laterRoundNumbers ?? [],
    };
  }

  if (!response.ok) {
    throw new Error(
      result.error ??
        "Unable to regenerate later rounds.",
    );
  }

  return {
    round: result.round,
    courtCount: result.courtCount,
    playerCount: result.playerCount,
    regenerated:
      result.regenerated ??
      Boolean(result.round),
    currentRoundNumber:
      result.currentRoundNumber ??
      result.round?.round_number,
    requiresConfirmation: false,
    laterRoundNumbers: [],
    message: result.message,
  };
}
