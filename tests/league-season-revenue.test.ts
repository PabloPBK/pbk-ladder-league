import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { paidEntryMix, seasonRevenueCsv, summarizeSeasonRevenue, type SeasonRevenueSession } from "../lib/data/league-session-revenue";
import { buildSeasonRevenuePdf } from "../lib/server/season-revenue-pdf";

const sessions: SeasonRevenueSession[] = [
  {
    event_date: "2026-11-07", session_number: 3, name: "Session 3", status: "complete",
    league_session_revenue: null,
  },
  {
    event_date: "2026-10-31", session_number: 2, name: "Session 2", status: "complete",
    league_session_revenue: { member_count: 5, nonmember_count: 15, updated_at: "2026-10-31T18:00:00Z" },
  },
  {
    event_date: "2026-10-24", session_number: 1, name: "Session 1", status: "complete",
    league_session_revenue: { member_count: 12, nonmember_count: 8, updated_at: "2026-10-24T18:00:00Z" },
  },
  {
    event_date: "2026-11-21", session_number: 4, name: "Session 4", status: "active",
    league_session_revenue: null,
  },
];

test("season totals sum only saved reports and count completed sessions still missing reports", () => {
  const totals = summarizeSeasonRevenue(sessions);
  assert.deepEqual(totals, {
    members: 17, nonmembers: 23, players: 40, memberRevenue: 25500, nonmemberRevenue: 57500,
    gross: 83000, sessionPayout: 12450, seasonContribution: 12450, totalPayout: 24900, clubRevenue: 58100,
    saved: 2, missing: 1,
  });
  assert.deepEqual(paidEntryMix(totals.members, totals.nonmembers), { members: 42.5, nonmembers: 57.5 });
  assert.deepEqual(paidEntryMix(1, 2), { members: 33.3, nonmembers: 66.7 });
  assert.equal(paidEntryMix(0, 0), null);
});

test("season CSV includes a summary, ordered saved sessions, and blank amounts for missing reports", () => {
  const csv = seasonRevenueCsv("DUPR $$$ League", "Season 5", sessions);
  const lines = csv.trimEnd().split("\r\n");
  assert.match(lines[1], /2 saved \/ 1 completed without a report.*"830\.00","124\.50","124\.50","249\.00","581\.00"/);
  assert.match(lines[2], /2026-10-24/);
  assert.match(lines[3], /2026-10-31/);
  assert.match(lines[4], /"Missing report"(,""){13}$/);
  assert.equal(lines.length, 5);
});

test("season PDF is readable for both a populated report and a season with no paid entries", async () => {
  const report = await PDFDocument.load(await buildSeasonRevenuePdf("DUPR $$$ League 🏓", "Season 5", summarizeSeasonRevenue(sessions)));
  assert.equal(report.getPageCount(), 1);
  assert.equal(report.getTitle(), "Season 5 Revenue Report");
  const blank = await PDFDocument.load(await buildSeasonRevenuePdf("DUPR $$$ League", "Season 5", summarizeSeasonRevenue([])));
  assert.equal(blank.getPageCount(), 1);
});
