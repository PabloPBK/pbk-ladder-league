import assert from "node:assert/strict";
import { test } from "node:test";
import { assignRoundOneCourts } from "../app/admin/tv-manager/rosters/round-one-courts";

function team(id: number, first: number | string | null, second: number | string | null = 4) {
  return {
    id: String(id),
    player1: { dupr_doubles: first },
    player2: { dupr_doubles: second },
  };
}

test("pairs 24 teams in descending combined doubles DUPR on courts 1 to 12", () => {
  const teams = Array.from({ length: 24 }, (_, index) => team(index, 3 + index / 1000));
  const { courts, unrated } = assignRoundOneCourts(teams);

  assert.deepEqual(courts.map((court) => court.number), Array.from({ length: 12 }, (_, index) => index + 1));
  assert.deepEqual(
    courts.flatMap((court) => court.teams.map(({ team }) => team.id)),
    teams.map((team) => team.id).reverse(),
  );
  assert.equal(courts[0].teams[0].rating, 7.023);
  assert.deepEqual(unrated, []);
});

test("uses a stable order for equal sums and combines both partners' ratings", () => {
  const { courts } = assignRoundOneCourts([
    team(3, "3.000", "4.500"),
    team(2, 4, 3.5),
    team(1, 3, 5),
    team(4, 5, 2),
  ]);
  assert.deepEqual(courts.map((court) => court.teams.map(({ team }) => team.id)), [["1", "2"], ["3", "4"]]);
});

test("does not show partial assignments when teams are unrated, odd in number, or over capacity", () => {
  const rated = team(1, 4);
  for (const rating of [null, 0, Number.NaN]) {
    const unrated = team(2, rating);
    assert.deepEqual(assignRoundOneCourts([rated, unrated]), { courts: [], unrated: [unrated] });
  }
  assert.deepEqual(assignRoundOneCourts([rated]).courts, []);
  assert.deepEqual(assignRoundOneCourts(Array.from({ length: 26 }, (_, index) => team(index, 4))).courts, []);
});
