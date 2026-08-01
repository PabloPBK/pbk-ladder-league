export type Court = {
  id: number;
  players: [string, string, string, string];
};

export const mockCourts: Court[] = [
  {
    id: 1,
    players: ["John", "Mike", "Steve", "Bob"],
  },
  {
    id: 2,
    players: ["Sarah", "Emily", "Carlos", "David"],
  },
  {
    id: 3,
    players: ["Lisa", "Mark", "Rachel", "Tom"],
  },
  {
    id: 4,
    players: ["Kevin", "Maria", "Chris", "Amanda"],
  },
  {
    id: 5,
    players: ["Jason", "Nicole", "Brian", "Jessica"],
  },
  {
    id: 6,
    players: ["Daniel", "Ashley", "Eric", "Michelle"],
  },
];