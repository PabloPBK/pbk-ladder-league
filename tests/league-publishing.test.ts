import assert from "node:assert/strict";
import { test } from "node:test";
import { readLeagueListing } from "../lib/data/league-listings";

const facility = "11111111-1111-4111-8111-111111111111";
const season = "22222222-2222-4222-8222-222222222222";
const valid = {
  name: " League night ", facility_id: facility, start_date: "2026-12-01", end_date: "2026-12-22",
  status: "draft", registration_status: "waitlist", registration_url: "https://example.com/register",
};

test("validates the existing listing fields without changing operations data", () => {
  const result = readLeagueListing(valid);
  assert.equal(result.id, null);
  assert.equal(result.listing.name, "League night");
  assert.equal(result.listing.facility_id, facility);
  assert.equal(result.listing.season_id, null);
  assert.equal(result.listing.registration_status, "waitlist");
  assert.equal(result.listing.show_history, false);
});

test("requires an actual calendar date and a safe public URL", () => {
  assert.throws(() => readLeagueListing({ ...valid, start_date: "2026-02-31" }), /valid dates/);
  assert.throws(() => readLeagueListing({ ...valid, end_date: "2026-11-30" }), /valid dates/);
  assert.throws(() => readLeagueListing({ ...valid, status: "live" }), /valid listing/);
  assert.throws(() => readLeagueListing({ ...valid, logo_url: "javascript:alert(1)" }), /logo URL/);
  assert.throws(() => readLeagueListing({ ...valid, registration_url: "https://user:pass@example.com" }), /registration URL/);
});

test("requires a linked season for public results and an edit version for updates", () => {
  assert.throws(() => readLeagueListing({ ...valid, show_history: true }), /Link a season/);
  assert.throws(() => readLeagueListing({ ...valid, season_id: season, show_player_stats: true }), /daily or season/);
  assert.throws(() => readLeagueListing({ ...valid, id: facility }), /Reload the listing/);
  const { listing } = readLeagueListing({
    ...valid, status: "published", season_id: season, dupr_rated: true,
    show_daily_standings: true, show_season_standings: true, show_history: true, show_player_stats: true,
  });
  assert.equal(listing.status, "published");
  assert.equal(listing.season_id, season);
  assert.equal(listing.show_daily_standings && listing.show_season_standings && listing.show_history && listing.show_player_stats, true);
});
