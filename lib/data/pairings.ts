type SaveCourtPairingInput = {
  eventId: string;
  courtNumber: number;
  pairingIndex: number;
};

type SaveCourtPairingResponse = {
  pairing?: {
    eventId: string;
    roundNumber: number;
    courtNumber: number;
    pairingIndex: number;
  };
  error?: string;
};

export async function saveCourtPairing({
  eventId,
  courtNumber,
  pairingIndex,
}: SaveCourtPairingInput) {
  const response = await fetch(
    `/api/events/${encodeURIComponent(
      eventId,
    )}/courts/${courtNumber}/pairing`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pairingIndex,
      }),
    },
  );

  const responseText = await response.text();

  let result: SaveCourtPairingResponse;

  try {
    result = JSON.parse(
      responseText,
    ) as SaveCourtPairingResponse;
  } catch {
    throw new Error(
      `The pairing API did not return valid JSON. HTTP ${response.status}.`,
    );
  }

  if (!response.ok || !result.pairing) {
    throw new Error(
      result.error ??
        "Unable to save the court pairing.",
    );
  }

  return result.pairing;
}