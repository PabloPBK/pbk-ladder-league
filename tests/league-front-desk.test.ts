import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

import { readLeagueRoster, rosterWarnings } from "../lib/data/league-roster";
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
