import assert from "node:assert/strict";
import { test } from "node:test";
import { readNoShowRoster, validNoShowDate } from "../lib/data/open-play-no-shows";

const header = "Full Name,Email,Phone Number,Invitation Type,Invitation Status,Waitlist Enrollment Time,DUPR Doubles,DUPR Singles";

test("queues only Accepted rows from the PodPlay roster", () => {
  const csv = [
    header,
    '"Player, One",ONE@example.test,5550101,EVENT_SIGNUP,ACCEPTED,,,',
    "Player Two,two@example.test,,EVENT_SIGNUP,CHECKED_IN,,,",
    "Player Three,three@example.test,,WAITLIST_PASSIVE_ENROLLMENT,WAITLIST,,,",
    "Player Four,four@example.test,,EVENT_SIGNUP,CANCELLED,,,",
    "Player Five,five@example.test,,EVENT_SIGNUP, accepted ,,,",
    "Player Six,,,EVENT_SIGNUP,ACCEPTED,,,",
  ].join("\r\n");
  assert.deepEqual(readNoShowRoster("\uFEFF" + csv), [
    { player_name: "Player, One", player_email: "one@example.test", player_key: "email:one@example.test" },
    { player_name: "Player Five", player_email: "five@example.test", player_key: "email:five@example.test" },
    { player_name: "Player Six", player_email: null, player_key: "name:player six" },
  ]);
});

test("deduplicates the same email but preserves players who share a name", () => {
  const csv = "Full Name,Email,Invitation Status\nSame Name,user@example.test,Accepted\nRenamed,USER@example.test,ACCEPTED\nSame Name,second@example.test,Accepted";
  assert.equal(readNoShowRoster(csv).length, 2);
});

test("rejects inconsistent status or unreadable files before importing", () => {
  assert.throws(() => readNoShowRoster("Full Name,Email\nPlayer,player@example.test"), /Invitation Status/);
  assert.throws(() => readNoShowRoster("Full Name,Invitation Status\n\"Incomplete,Accepted"), /unfinished quote/);
  assert.throws(() => readNoShowRoster("Full Name,Email,Invitation Status\nPlayer,Accepted"), /inconsistent/);
  assert.throws(() => readNoShowRoster("Full Name,Email,Invitation Status\nPlayer,player@example.test,Accepted\nPlayer,player@example.test,CHECKED_IN"), /conflicting/);
});

test("accepts real calendar dates on or after the policy start date", () => {
  assert.equal(validNoShowDate("2026-11-25"), false);
  assert.equal(validNoShowDate("2026-11-26"), true);
  assert.equal(validNoShowDate("2026-11-31"), false);
  assert.equal(validNoShowDate("2027-02-29"), false);
});
