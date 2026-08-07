type PairingResult = {
  eventId: string;
  roundNumber: number;
  courtNumber: number;
  pairingIndex: number;
};

type PairingResponse = {
  pairing?: PairingResult;
  undone?: boolean;
  error?: string;
};

async function readPairingResponse(
  response: Response,
): Promise<PairingResponse> {
  const responseText = await response.text();

  try {
    return JSON.parse(responseText) as PairingResponse;
  } catch {
    throw new Error(
      `The pairing API did not return valid JSON. HTTP ${response.status}.`,
    );
  }
}

export async function saveCustomCourtPairing({
  eventId,
  courtNumber,
  roundNumber,
  team1PlayerIds,
}: {
  eventId: string;
  courtNumber: number;
  roundNumber: number;
  team1PlayerIds: [string, string];
}) {
  const response = await fetch(
    `/api/events/${encodeURIComponent(
      eventId,
    )}/courts/${courtNumber}/pairing?roundNumber=${roundNumber}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        roundNumber,
        team1PlayerIds,
      }),
    },
  );

  const result = await readPairingResponse(response);

  if (!response.ok || !result.pairing) {
    throw new Error(
      result.error ?? "Unable to save the court pairing.",
    );
  }

  return result.pairing;
}

export async function undoCourtPairing({
  eventId,
  courtNumber,
  roundNumber,
}: {
  eventId: string;
  courtNumber: number;
  roundNumber: number;
}) {
  const response = await fetch(
    `/api/events/${encodeURIComponent(
      eventId,
    )}/courts/${courtNumber}/pairing?roundNumber=${roundNumber}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const result = await readPairingResponse(response);

  if (!response.ok || !result.undone) {
    throw new Error(
      result.error ?? "Unable to undo the court pairing.",
    );
  }
}
