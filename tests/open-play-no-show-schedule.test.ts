import assert from "node:assert/strict";
import { test } from "node:test";
import { recentOpenPlayDates, scheduledOpenPlays } from "../lib/data/open-play-no-show-schedule";

test("offers the prior three local calendar days across month and DST boundaries", () => {
  assert.deepEqual(recentOpenPlayDates("2026-11-02"), ["2026-11-01", "2026-10-31", "2026-10-30"]);
});

test("turns published open-play slots into distinct, chronological roster choices", () => {
  const slots = [
    { start: "14:30", end: "16:30", levels: [] },
    { start: "09:00", end: "11:00", levels: ["Beginner/PB101+", "Intermediate", "Intermediate", null] },
    { start: "07:00", end: "06:00", levels: [] },
    null,
  ];
  assert.deepEqual(scheduledOpenPlays(slots), [
    { start: "09:00", end: "11:00", name: "Beginner/PB101+ · Open Play" },
    { start: "09:00", end: "11:00", name: "Intermediate · Open Play" },
    { start: "14:30", end: "16:30", name: "Open Play" },
  ]);
});
