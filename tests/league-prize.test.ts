import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePrizeAmount } from "../lib/data/league-prize";
import { formatPrizeMoney } from "../zz2-site/lib/league-contract";

test("stores exact cents and preserves zero as a prize amount", () => {
  assert.equal(parsePrizeAmount("0"), 0);
  assert.equal(parsePrizeAmount(" 85.5 "), 8550);
  assert.equal(parsePrizeAmount("125.75"), 12575);
  assert.equal(formatPrizeMoney(12575), "$125.75");
  assert.equal(parsePrizeAmount("999999.99"), 99999999);
  assert.equal(parsePrizeAmount(" "), null);
});

test("rejects negative, excessive, fractional-cent, and malformed amounts", () => {
  for (const amount of ["-1", "1000000", "1.234", "1e3", "$30", 30, null]) {
    assert.throws(() => parsePrizeAmount(amount));
  }
});
