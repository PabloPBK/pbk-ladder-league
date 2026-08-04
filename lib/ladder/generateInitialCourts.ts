import type { GeneratedCourt } from "@/types/court";
import type { Player } from "@/types/player";

export function generateInitialCourts(
  players: Player[],
): GeneratedCourt[] {
  const checkedInPlayers = players
    .filter((player) => player.checkedIn)
    .sort((playerA, playerB) => playerB.dupr - playerA.dupr);

  if (checkedInPlayers.length < 4) {
    throw new Error("At least four checked-in players are required.");
  }

  if (checkedInPlayers.length % 4 !== 0) {
    throw new Error(
      "The checked-in player count must be divisible by four.",
    );
  }

  const courts: GeneratedCourt[] = [];

  for (let index = 0; index < checkedInPlayers.length; index += 4) {
    const group = checkedInPlayers.slice(index, index + 4);

    if (group.length !== 4) {
      throw new Error("A court could not be filled with four players.");
    }

    courts.push({
      id: courts.length + 1,
      players: [
        group[0],
        group[1],
        group[2],
        group[3],
      ],
    });
  }

  return courts;
}