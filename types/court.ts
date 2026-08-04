import type { Player } from "@/types/player";

export type GeneratedCourt = {
  id: number;
  players: [Player, Player, Player, Player];
};