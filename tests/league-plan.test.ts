import assert from "node:assert/strict";
import { test } from "node:test";
import { readLeaguePlan } from "../lib/data/league-plan";
import { calculateSessionRevenue, estimatePaidEntries } from "../lib/data/league-session-revenue";

const planId = "10000000-0000-4000-8000-000000000001";

test("a league plan can include blank seasons and sorts optional schedule dates", () => {
  const plan = readLeaguePlan({
    planId, name: " Weekly League ", description: "",
    seasons: [["2027-01-23", "", "2027-01-16", "2027-01-16"], []],
  });
  assert.deepEqual(plan, {
    planId, name: "Weekly League", description: null,
    dates: [["2027-01-16", "2027-01-16", "2027-01-23"], []],
  });
  assert.throws(() => readLeaguePlan({ planId, name: "Bad date", description: "", seasons: [["2027-02-29"]] }), /Season 1/);
  assert.throws(() => readLeaguePlan({ planId, name: "No seasons", description: "", seasons: [] }), /at least one season/);
});

test("history-based estimates round the member count and preserve the expected total", () => {
  const history = { members: 17, nonmembers: 23, reports: 2, scope: "league" as const };
  assert.deepEqual(estimatePaidEntries(30, history), { members: 13, nonmembers: 17 });
  assert.equal(estimatePaidEntries(30, { ...history, members: 0, nonmembers: 0 }), null);
  assert.equal(estimatePaidEntries(-3, history), null);
  assert.deepEqual(calculateSessionRevenue(13, 17, { memberCents: 1800, nonmemberCents: 3000 }), {
    players: 30, memberRevenue: 23400, nonmemberRevenue: 51000, gross: 74400,
    sessionPayout: 11160, seasonContribution: 11160, totalPayout: 22320, clubRevenue: 52080,
  });
});
