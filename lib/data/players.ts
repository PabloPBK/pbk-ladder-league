export type DatabasePlayerRecord = {
  id: string;
  name: string;
  dupr: number;
};

export type PlayerProfile = {
  id: string;
  name: string;
  dupr: number;
};

type PlayersResponse = {
  players?: DatabasePlayerRecord[];
  player?: PlayerProfile;
  error?: string;
};

async function parseResponse(
  response: Response,
): Promise<PlayersResponse> {
  const text = await response.text();

  try {
    return JSON.parse(text) as PlayersResponse;
  } catch {
    throw new Error(
      `Invalid JSON. HTTP ${response.status}.`,
    );
  }
}

export async function getPlayers(): Promise<
  DatabasePlayerRecord[]
> {
  const response = await fetch("/api/players", {
    cache: "no-store",
  });

  const result = await parseResponse(response);

  if (!response.ok) {
    throw new Error(
      result.error ?? "Unable to load players.",
    );
  }

  return (result.players ?? []).map((player) => ({
    ...player,
    dupr: Number(player.dupr),
  }));
}

export async function getPlayer(
  playerId: string,
): Promise<PlayerProfile> {
  const response = await fetch(
    `/api/players/${playerId}`,
    {
      cache: "no-store",
    },
  );

  const result = await parseResponse(response);

  if (!response.ok || !result.player) {
    throw new Error(
      result.error ?? "Unable to load player.",
    );
  }

  return {
    ...result.player,
    dupr: Number(result.player.dupr),
  };
}