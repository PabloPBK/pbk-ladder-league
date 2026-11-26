import assert from "node:assert/strict";
import { test } from "node:test";
import type { LeagueEventRecord } from "../lib/data/events";
import { buildLeagueSessionOptions } from "../lib/data/league-session-schedule";
import { calculateSessionRevenue, isPaidPlayerCount, sessionRevenueCsv } from "../lib/data/league-session-revenue";

function recorded(id: string, date: string, number: number): LeagueEventRecord {
  return {
    id, name: id, event_date: date, session_number: number, season_id: "season-5",
    status: "complete", current_round: 6, session_note: null,
  };
}

test("Season 5 keeps its saved session identities and offers the scheduled finale as Session 5", () => {
  const sessions = buildLeagueSessionOptions([
    recorded("oct24", "2026-10-24", 1),
    recorded("oct31", "2026-10-31", 2),
    recorded("nov7", "2026-11-07", 1),
    recorded("nov21", "2026-11-21", 4),
  ], [], [{ event_date: "2026-11-28", session_number: 5 }]);

  assert.deepEqual(sessions.map(({ date, number, event }) => [date, number, event?.id]), [
    ["2026-10-24", 1, "oct24"],
    ["2026-10-31", 2, "oct31"],
    ["2026-11-07", 1, "nov7"],
    ["2026-11-21", 4, "nov21"],
    ["2026-11-28", 5, undefined],
  ]);
});

test("future registration dates keep their correct slot even when another session on the date is saved", () => {
  const registrations = [
    { date: "2026-12-05", start_time: "09:00" },
    { date: "2026-12-05", start_time: "11:00" },
    { date: "2026-12-12", start_time: "09:00" },
  ];
  const session = recorded("late", "2026-12-05", 2);
  const sessions = buildLeagueSessionOptions([session], [...registrations, registrations[0]], []);
  assert.deepEqual(sessions.map(({ date, startTime, number, event }) => [date, startTime, number, event?.id]), [
    ["2026-12-05", "09:00", 1, undefined],
    ["2026-12-05", "11:00", 2, "late"],
    ["2026-12-12", "09:00", 3, undefined],
  ]);
});

test("uses exact cents for entry fees, separate payout shares, and remaining revenue", () => {
  assert.deepEqual(calculateSessionRevenue(12, 8), {
    players: 20,
    memberRevenue: 18000,
    nonmemberRevenue: 20000,
    gross: 38000,
    sessionPayout: 5700,
    seasonContribution: 5700,
    totalPayout: 11400,
    clubRevenue: 26600,
  });
  assert.equal(calculateSessionRevenue(1, 0).sessionPayout, 225);
  assert.equal(calculateSessionRevenue(0, 1).sessionPayout, 375);
  assert.equal(calculateSessionRevenue(0, 0).gross, 0);
  for (const invalid of [-1, 1.5, "1", null, Infinity, 10001]) {
    assert.equal(isPaidPlayerCount(invalid), false);
  }
  assert.equal(isPaidPlayerCount(0), true);
});

test("exports the recorded amounts and escapes spreadsheet formula cells", () => {
  const csv = sessionRevenueCsv({
    league: "DUPR $$$ League", season: "Season 5", date: "2026-11-28", session: 5, name: '=HYPERLINK("example")',
  }, { member_count: 12, nonmember_count: 8, revision: "revision", updated_at: "2026-11-28T22:00:00Z" });

  assert.match(csv, /"DUPR \$\$\$ League","Season 5","2026-11-28",5,"'=HYPERLINK\(""example""\)",12,8,20/);
  assert.match(csv, /"380\.00","57\.00","57\.00","114\.00","266\.00"/);
});
