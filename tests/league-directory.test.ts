import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLeagueDirectory, type DirectoryLeague } from "../lib/data/league-directory";

test("opens named current and upcoming seasons in League Night and completed seasons in History", () => {
  const league: DirectoryLeague = {
    id: "dupr",
    name: "DUPR $$$ League ",
    active: true,
    seasons: [
      { id: "7", name: "Season 7", status: "draft", start_date: "2027-01-16", end_date: "2027-02-13" },
      { id: "4", name: "Season 4", status: "complete", start_date: null, end_date: null },
      { id: "5", name: "Season 5", status: "active", start_date: "2026-10-24", end_date: "2026-11-26" },
      { id: "6", name: "Season 6", status: "draft", start_date: "2026-12-05", end_date: "2027-01-09" },
    ],
  };

  const result = buildLeagueDirectory([league], [
    { id: "turkey", name: "Turkey Cup Ladder $$$", event_date: "2026-11-26" },
    { id: "mash", name: "Monster Mash Ladder", event_date: "2026-10-31" },
  ], "2026-11-26");
  assert.deepEqual(result.current.map(({ label }) => label), [
    "DUPR $$$ League · Season 5",
    "Turkey Cup Ladder $$$",
    "DUPR $$$ League · Season 6",
    "DUPR $$$ League · Season 7",
  ]);
  assert.deepEqual(result.current.map(({ href }) => href), [
    "/admin?leagueId=dupr&seasonId=5",
    "/admin/tv-manager/rosters?event=turkey",
    "/admin?leagueId=dupr&seasonId=6",
    "/admin?leagueId=dupr&seasonId=7",
  ]);
  assert.deepEqual(result.past.map(({ href }) => href), [
    "/admin/tv-manager/rosters?event=mash",
    "/history?leagueId=dupr&seasonId=4",
  ]);
});

test("includes a league awaiting its first season and keeps retired leagues in Past Leagues", () => {
  const result = buildLeagueDirectory([
    { id: "new", name: "Wednesday Ladder", active: true, seasons: [] },
    { id: "retired", name: "Smashing", active: false, seasons: [] },
  ], [{ id: "undated", name: "Club Event", event_date: null }], "2026-11-26");

  assert.deepEqual(result.current.map(({ href }) => href), [
    "/admin/tv-manager/rosters?event=undated",
    "/admin?leagueId=new",
  ]);
  assert.deepEqual(result.past.map(({ href }) => href), ["/history?leagueId=retired"]);
});
