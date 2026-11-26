import { assignRoundOneCourts } from "./round-one-courts";

export const roundOneSlideType = "roster_round_one";

export const liveRosterSlideLabels = {
  roster_teams: "Live Team Rankings",
  roster_free_agents: "Live Free Agents",
  [roundOneSlideType]: "Round 1 Court Assignments",
} as const;

export type LiveRosterSlideType = keyof typeof liveRosterSlideLabels;

export function isLiveRosterSlideType(value: unknown): value is LiveRosterSlideType {
  return typeof value === "string" && Object.hasOwn(liveRosterSlideLabels, value);
}

export type RoundOneCourtSlide = {
  eventName: string;
  courts: { number: number; teams: [string, string] }[];
};

type RosterPlayer = {
  full_name: string;
  dupr_doubles: number | string | null;
};

export function buildRoundOneCourtSlide(
  event: { name: string; event_type: string },
  teams: readonly { id: string; player1_id: string; player2_id: string }[],
  players: ReadonlyMap<string, RosterPlayer>,
): RoundOneCourtSlide {
  const eventName = event.name;
  if (event.event_type !== "partnered") return { eventName, courts: [] };

  const doublesTeams = [];
  for (const team of teams) {
    const player1 = players.get(team.player1_id);
    const player2 = players.get(team.player2_id);
    if (!player1 || !player2) return { eventName, courts: [] };
    doublesTeams.push({ id: team.id, player1, player2 });
  }

  const { courts } = assignRoundOneCourts(doublesTeams);
  return {
    eventName,
    courts: courts.map(({ number, teams: [home, away] }) => ({
      number,
      teams: [
        `${home.team.player1.full_name} & ${home.team.player2.full_name}`,
        `${away.team.player1.full_name} & ${away.team.player2.full_name}`,
      ],
    })),
  };
}
