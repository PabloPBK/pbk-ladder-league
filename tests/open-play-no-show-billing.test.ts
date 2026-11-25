import assert from "node:assert/strict";
import { test } from "node:test";
import { noShowDailyCsv, parseNoShowAmount, type NoShowReportEvent } from "../lib/data/open-play-no-show-billing";
import { validCalendarDate } from "../lib/data/open-play-no-shows";

test("billing entry accepts exact positive cents and rejects ambiguous amounts", () => {
  for (const [input, cents] of [["12", 1200], ["23.1", 2310], ["0.01", 1], ["10000.00", 1_000_000]] as const) {
    assert.equal(parseNoShowAmount(input), cents);
  }
  for (const input of ["", "0", "-3", "12.345", "1e3", "$12", "10000.01", "Infinity"]) {
    assert.equal(parseNoShowAmount(input), null);
  }
});

test("daily CSV itemizes both sides of a reversal and reports unknown legacy amounts separately", () => {
  const entry = {
    session_date: "2026-11-28", session_time: "19:00:00", session_name: "Open play",
    player_name: '=HYPERLINK("example.com")', recorded_at: "2026-11-29T00:00:00Z",
    staff_name: "Staff", notes: "  +1", reason: null,
  };
  const events: NoShowReportEvent[] = [
    { ...entry, event: "Charge", amount_cents: 1250 },
    { ...entry, event: "Charge", amount_cents: null },
    { ...entry, event: "Refund", amount_cents: 700, reason: 'Confirmed, "attended"' },
    { ...entry, event: "Exception", amount_cents: 0 },
  ];
  const csv = noShowDailyCsv("2026-11-28", events);
  assert.match(csv, /^2,1,1,12\.5,7,5\.5,1\r$/m);
  assert.match(csv, /"'=HYPERLINK\(""example\.com""\)"/);
  assert.match(csv, /"'  \+1"/);
  assert.match(csv, /"Confirmed, ""attended"""/);
  assert.match(csv, /04:00:00 PM PST/);
  assert.equal(validCalendarDate("2026-11-31"), false);
  assert.equal(validCalendarDate("0000-01-01"), false);
  assert.equal(validCalendarDate("2026-11-28"), true);
});
