import type { DatabasePlayerRecord } from "@/lib/data/players";

export type PlayerImportInput = {
  name: string;
  dupr: number;
};

type ImportPlayersResponse = {
  created?: number;
  updated?: number;
  skipped?: number;
  players?: DatabasePlayerRecord[];
  error?: string;
};

export async function importPlayers({
  players,
  updateExisting = true,
}: {
  players: PlayerImportInput[];
  updateExisting?: boolean;
}) {
  const response = await fetch(
    "/api/players/import",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        players,
        updateExisting,
      }),
    },
  );

  const responseText = await response.text();

  let result: ImportPlayersResponse;

  try {
    result = JSON.parse(
      responseText,
    ) as ImportPlayersResponse;
  } catch {
    throw new Error(
      `The player-import API did not return valid JSON. HTTP ${response.status}.`,
    );
  }

  if (!response.ok) {
    throw new Error(
      result.error ?? "Unable to import players.",
    );
  }

  return {
    created: result.created ?? 0,
    updated: result.updated ?? 0,
    skipped: result.skipped ?? 0,
    players: result.players ?? [],
  };
}
