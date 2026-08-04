import { SeasonStanding } from "@/lib/server/statistics";

export async function getSeasonStandings(
  seasonId: string,
): Promise<SeasonStanding[]> {
  if (!seasonId) {
    return [];
  }

  const response = await fetch(
    `/api/standings?seasonId=${seasonId}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      "Unable to load standings.",
    );
  }

  const data = await response.json();

  return data.standings ?? [];
}