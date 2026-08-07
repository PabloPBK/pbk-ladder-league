export type RoundOnePlayerLocation = {
  courtNumber: number;
  slotNumber: number;
};

type SwapRoundOnePlayersInput = {
  eventId: string;
  first: RoundOnePlayerLocation;
  second: RoundOnePlayerLocation;
};

type SwapRoundOnePlayersResponse = {
  swap?: {
    eventId: string;
    roundNumber: number;
    first: RoundOnePlayerLocation;
    second: RoundOnePlayerLocation;
    affectedCourts: number[];
  };
  error?: string;
};

export async function swapRoundOnePlayers({
  eventId,
  first,
  second,
}: SwapRoundOnePlayersInput) {
  const response = await fetch(
    `/api/events/${encodeURIComponent(
      eventId,
    )}/rounds/1/swap-players`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        first,
        second,
      }),
    },
  );

  const responseText = await response.text();

  let result: SwapRoundOnePlayersResponse;

  try {
    result = JSON.parse(
      responseText,
    ) as SwapRoundOnePlayersResponse;
  } catch {
    throw new Error(
      `The player-swap API did not return valid JSON. HTTP ${response.status}.`,
    );
  }

  if (!response.ok || !result.swap) {
    throw new Error(
      result.error ??
        "Unable to swap the selected players.",
    );
  }

  return result.swap;
}
