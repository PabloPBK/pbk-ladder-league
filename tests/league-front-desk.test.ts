import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

import { readLeagueRoster, resolveRosterReview, rosterWarnings, suggestedRosterPlayers } from "../lib/data/league-roster";
import { isFrontDesk, isFrontDeskApi, isFrontDeskWorkspace } from "../lib/data/operations-role";
import type { PreviewRow } from "../lib/data/playerImport";

test("the upload shows missing DUPR IDs and repeated identities while leaving matches to staff", () => {
  const rows = readLeagueRoster([
    "Full Name,Email Address,DUPR ID,Ratings Doubles,Invitation Status,Waitlist Enrollment Time",
    "Casey,casey@club.example,,4,Accepted,",
    "Casey 🏓,CASEY@club.example,Z99AB0,3,Accepted,",
    "Morgan,morgan@club.example,,2,Accepted,",
    "On Waitlist,wait@club.example,,,Accepted,2026-11-26",
    "Declined,other@club.example,,,Declined,",
  ].join("\n"));
  assert.deepEqual(rows.map(({ name }) => name), ["Casey", "Casey 🏓", "Morgan"]);
  assert.deepEqual(rosterWarnings(rows, []), {
    1: ["Missing DUPR ID", "Possible duplicate in this CSV"],
    2: ["Possible duplicate in this CSV"],
    3: ["Missing DUPR ID"],
  });
  const knownPlayer: PreviewRow = {
    rowId: 1, status: "match", reason: "email", savesEmail: false,
    player: { id: "abc", name: "Casey", dupr: 4, dupr_id: "Z99AB0" },
  };
  assert.deepEqual(rosterWarnings(rows, [knownPlayer])[1], ["Possible duplicate in this CSV"]);
});

test("clean matches leave the work list while verified choices stay in the eventual import", () => {
  const input = [
    { rowId: 1, name: "Casey", email: "casey@club.example", duprId: null, rating: 4 },
    { rowId: 2, name: "Morgan", email: null, duprId: "M12345", rating: 3 },
  ];
  const previews: PreviewRow[] = [
    { rowId: 1, status: "match", reason: "email", savesEmail: false,
      player: { id: "casey", name: "Casey", dupr: 4, dupr_id: null } },
    { rowId: 2, status: "match", reason: "dupr_id", savesEmail: false,
      player: { id: "morgan", name: "Morgan", dupr: 3, dupr_id: "M12345" } },
  ];

  const emailMatch = resolveRosterReview(input, previews, {});
  assert.deepEqual(emailMatch.decisions, {
    1: { action: "match", playerId: "casey" },
    2: { action: "match", playerId: "morgan" },
  });
  assert.deepEqual(emailMatch.warnings[1], ["Missing DUPR ID"]);
  input[0].duprId = "C12345";
  previews[0].status = "review";
  previews[0].reason = "verify_new_dupr_id";
  assert.equal(resolveRosterReview(input, previews, {}).decisions[1], undefined);
  assert.deepEqual(resolveRosterReview(input, previews, { 1: { action: "link", playerId: "casey" } }).decisions, {
    1: { action: "link", playerId: "casey" },
    2: { action: "match", playerId: "morgan" },
  });

  const duplicate = { ...input[1], rowId: 3 };
  const duplicatePreview = { ...previews[1], rowId: 3 };
  assert.equal(resolveRosterReview([...input, duplicate], [...previews, duplicatePreview], {}).decisions[2], undefined);
  assert.deepEqual(resolveRosterReview([...input, duplicate], [...previews, duplicatePreview], { 3: { action: "skip" } }).decisions, {
    2: { action: "match", playerId: "morgan" },
    3: { action: "skip" },
  });
});

test("name suggestions handle emojis and leave ambiguous or conflicting records for staff review", () => {
  const player = { id: "existing", name: "Casey Smith 🏓", dupr: 4, dupr_id: "C12345" };
  const row = { rowId: 1, name: "Casey Smith", email: "casey@club.example", duprId: null, rating: 4 };
  assert.equal(suggestedRosterPlayers([player])(row)?.id, player.id);
  assert.equal(suggestedRosterPlayers([player])({ ...row, duprId: "D12345" }), null);
  assert.equal(suggestedRosterPlayers([player, { ...player, id: "second" }])(row), null);
  assert.deepEqual(resolveRosterReview([row], [{
    rowId: 1, status: "review", reason: "no_identifier_match", savesEmail: false, player: null,
  }], {}).decisions, {});
});

test("front desk can run a league but cannot reach admin-only finance or cancel a session", () => {
  assert.equal(isFrontDesk({ app_metadata: { operations_role: "front_desk" } }), true);
  assert.equal(isFrontDesk({ app_metadata: {} }), false);
  assert.equal(isFrontDeskWorkspace("/admin/revenue"), false);
  assert.equal(isFrontDeskWorkspace("/admin"), true);
  assert.equal(isFrontDeskApi("/api/events/session/tv", "POST"), true);
  assert.equal(isFrontDeskApi("/api/events/session/complete", "POST"), true);
  assert.equal(isFrontDeskApi("/api/players/import", "POST"), true);
  assert.equal(isFrontDeskApi("/api/events/session/revenue", "GET"), false);
  assert.equal(isFrontDeskApi("/api/events/session/cancel", "DELETE"), false);
  assert.equal(isFrontDeskApi("/api/tv-screens", "PATCH"), false);
});

test("a screen follows its latest active session and completion removes only that session’s overrides", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create table public.league_events (id uuid primary key, status text);
      create table public.rounds (event_id uuid references public.league_events(id), round_number int);
      grant select, update on public.league_events to service_role;
      grant select on public.rounds to service_role;
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/20261127020508_league_session_tv_override.sql", import.meta.url), "utf8"));
    await db.exec(`
      insert into public.league_events values
        ('00000000-0000-0000-0000-000000000001', 'active'),
        ('00000000-0000-0000-0000-000000000002', 'active');
      insert into public.rounds values ('00000000-0000-0000-0000-000000000001', 1);
      set role service_role;
    `);
    const sessionA = "00000000-0000-0000-0000-000000000001";
    const sessionB = "00000000-0000-0000-0000-000000000002";
    const tvA = "00000000-0000-0000-0000-000000000003";
    const tvB = "00000000-0000-0000-0000-000000000004";
    async function assign(screen: string, event: string, mode: string) {
      const result = await db.query<{ assigned: boolean }>(
        "select public.assign_league_session_tv($1, $2, $3) as assigned", [screen, event, mode],
      );
      return result.rows[0].assigned;
    }
    assert.equal(await assign(tvA, sessionB, "standings"), false);
    assert.equal(await assign(tvA, sessionA, "courts"), true);
    assert.equal(await assign(tvB, sessionA, "standings"), true);

    await db.exec("reset role");
    await db.query("insert into public.rounds values ($1, 1)", [sessionB]);
    await db.exec("set role service_role");
    assert.equal(await assign(tvB, sessionB, "standings"), true);
    await db.query("update public.league_events set status = 'complete' where id = $1", [sessionA]);

    assert.equal(await assign(tvB, sessionA, "courts"), false);
    assert.deepEqual((await db.query("select * from public.league_tv_overrides")).rows, [
      { screen_id: tvB, event_id: sessionB, mode: "standings" },
    ]);
    await db.exec("reset role; set role authenticated");
    await assert.rejects(db.query("select * from public.league_tv_overrides"), /permission denied/);
  } finally {
    await db.close();
  }
});
