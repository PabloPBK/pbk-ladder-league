import type {
  CourtPairing,
  CourtResult,
} from "@/components/providers/LeagueProvider";
import type { GeneratedCourt } from "@/types/court";
import type { Player } from "@/types/player";

type CourtPairings = Record<number, CourtPairing>;
type CourtResults = Record<number, CourtResult>;

function getPlayer(
  court: GeneratedCourt,
  playerId: number,
): Player {
  const player = court.players.find(
    (currentPlayer) => currentPlayer.id === playerId,
  );

  if (!player) {
    throw new Error(
      `Player ${playerId} was not found on Court ${court.id}.`,
    );
  }

  return player;
}

function getWinnersAndLosers(
  court: GeneratedCourt,
  pairing: CourtPairing,
  result: CourtResult,
) {
  const team1Players = pairing.team1PlayerIds.map((playerId) =>
    getPlayer(court, playerId),
  ) as [Player, Player];

  const team2Players = pairing.team2PlayerIds.map((playerId) =>
    getPlayer(court, playerId),
  ) as [Player, Player];

  if (result.team1Score > result.team2Score) {
    return {
      winners: team1Players,
      losers: team2Players,
    };
  }

  return {
    winners: team2Players,
    losers: team1Players,
  };
}

export function generateNextRound(
  courts: GeneratedCourt[],
  courtPairings: CourtPairings,
  courtResults: CourtResults,
): GeneratedCourt[] {
  if (courts.length === 0) {
    throw new Error("There are no courts to advance.");
  }

  const orderedCourts = [...courts].sort(
    (courtA, courtB) => courtA.id - courtB.id,
  );

  const outcomes = orderedCourts.map((court) => {
    const pairing = courtPairings[court.id];
    const result = courtResults[court.id];

    if (!pairing) {
      throw new Error(
        `Court ${court.id} does not have a confirmed pairing.`,
      );
    }

    if (!result?.complete) {
      throw new Error(
        `Court ${court.id} does not have a completed result.`,
      );
    }

    return getWinnersAndLosers(court, pairing, result);
  });

  return orderedCourts.map((court, index) => {
    let players: [Player, Player, Player, Player];

    if (orderedCourts.length === 1) {
      players = [
        ...outcomes[index].winners,
        ...outcomes[index].losers,
      ] as [Player, Player, Player, Player];
    } else if (index === 0) {
      players = [
        ...outcomes[0].winners,
        ...outcomes[1].winners,
      ] as [Player, Player, Player, Player];
    } else if (index === orderedCourts.length - 1) {
      players = [
        ...outcomes[index - 1].losers,
        ...outcomes[index].losers,
      ] as [Player, Player, Player, Player];
    } else {
      players = [
        ...outcomes[index - 1].losers,
        ...outcomes[index + 1].winners,
      ] as [Player, Player, Player, Player];
    }

    return {
      id: court.id,
      players,
    };
  });
}