type DoublesPlayer = {
  dupr_doubles: number | string | null;
};

type DoublesTeam = {
  id: string;
  player1: DoublesPlayer;
  player2: DoublesPlayer;
};

type RankedTeam<Team> = { team: Team; rating: number };
type Court<Team> = { number: number; teams: [RankedTeam<Team>, RankedTeam<Team>] };

export const roundOneCourtLimit = 12;

export function assignRoundOneCourts<Team extends DoublesTeam>(teams: readonly Team[]) {
  const ranked = [];
  const unrated = [];

  for (const team of teams) {
    const first = Number(team.player1.dupr_doubles);
    const second = Number(team.player2.dupr_doubles);
    if (!Number.isFinite(first) || !Number.isFinite(second) || first <= 0 || second <= 0) {
      unrated.push(team);
      continue;
    }
    const rating = Math.round((first + second) * 1000) / 1000;
    ranked.push({ team, rating });
  }

  const courts: Court<Team>[] = [];
  if (unrated.length || teams.length % 2 || teams.length > roundOneCourtLimit * 2) {
    return { courts, unrated };
  }

  ranked.sort((a, b) => b.rating - a.rating || a.team.id.localeCompare(b.team.id));
  for (let index = 0; index < ranked.length; index += 2) {
    courts.push({
      number: index / 2 + 1,
      teams: [ranked[index], ranked[index + 1]],
    });
  }

  return { courts, unrated };
}
