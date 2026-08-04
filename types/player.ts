export type Player = {
  id: number;
  name: string;
  dupr: number;
  checkedIn: boolean;

  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
};