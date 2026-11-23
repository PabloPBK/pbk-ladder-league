import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { rosterSelectionError, type CommitRow, type ImportRow } from "../lib/data/playerImport";
import { getPodPlayImportFields, parsePodPlayCsv } from "../lib/data/podplayRoster";
import { readImportRequest } from "../lib/server/player-import-request";

const alice = "11111111-1111-4111-8111-111111111111";
const legacy = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const actor = "44444444-4444-4444-8444-444444444444";

const fixture = `
  create role anon;
  create role authenticated;
  create role service_role;
  create table public.players (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    dupr numeric not null default 0,
    dupr_id text
  );
  create table public.league_events (id uuid primary key, season_id uuid, event_date date);
  create table public.event_players (
    id uuid primary key, event_id uuid not null references public.league_events(id),
    player_id uuid not null references public.players(id), unique (event_id, player_id)
  );
  create table public.courts (id uuid primary key, team_1_score int, team_2_score int, winner_team int);
  create table public.court_players (court_id uuid references public.courts(id), event_player_id uuid references public.event_players(id));
  insert into public.players (id, name, dupr, dupr_id) values
    ('${alice}', 'Alice Original', 3.51, 'AB12CD'),
    ('${legacy}', 'Alex Same', 3.88, null),
    ('${other}', 'Alex Same', 4.25, 'XY12ZW');
  insert into public.league_events (id) values ('55555555-5555-4555-8555-555555555555');
  insert into public.event_players values ('66666666-6666-4666-8666-666666666666', '55555555-5555-4555-8555-555555555555', '${alice}');
  insert into public.courts values ('77777777-7777-4777-8777-777777777777', 11, 7, 1);
  insert into public.court_players values ('77777777-7777-4777-8777-777777777777', '66666666-6666-4666-8666-666666666666');
`;
const oldMigration = new URL("../supabase/migrations/20260925_seasons_roster_dupr.sql", import.meta.url);
const migration = new URL("../supabase/migrations/20261123_player_import_identity.sql", import.meta.url);

function row(changes: Partial<ImportRow> = {}): ImportRow {
  return { rowId: 1, name: "Alex Same", rating: null, email: null, duprId: null, ...changes };
}

test("reads email and DUPR ID separately from the doubles rating", () => {
  const [source] = parsePodPlayCsv('﻿Full Name,Email Address,DUPR Player ID,DUPR Doubles Rating\r\n"Alex, Jr. 🏓",Alex+league@Example.com, AB12CD ,4.2\r\n');
  assert.equal(source["Full Name"], "Alex, Jr. 🏓");
  assert.deepEqual(getPodPlayImportFields(source), {
    email: "Alex+league@Example.com",
    duprId: "AB12CD",
    duprText: "4.2",
  });
  assert.deepEqual(getPodPlayImportFields({ Email: "a@example.com", DUPR: "Not rated" }), {
    email: "a@example.com", duprId: "", duprText: "",
  });
});

test("validates source rows, staff decisions, and rating types", () => {
  const valid = row({ rowId: 5, name: " Alex  🏓 ", rating: 0, email: " A+tag@Example.com " });
  assert.deepEqual(readImportRequest({ mode: "preview", rows: [valid] }), {
    mode: "preview",
    rows: [row({ rowId: 5, name: "Alex 🏓", rating: 0, email: "A+tag@Example.com" })],
  });
  assert.throws(() => readImportRequest({ players: [valid] }), /mode/);
  assert.throws(() => readImportRequest({ mode: "preview", rows: [valid, valid] }), /row number/);
  assert.throws(() => readImportRequest({ mode: "preview", rows: [{ ...valid, rating: "0" }] }), /rating/);
  assert.throws(() => readImportRequest({ mode: "commit", rows: [valid], requestId: randomUUID() }), /request/);
  assert.throws(() => readImportRequest({
    mode: "commit", requestId: randomUUID(),
    rows: [{ ...valid, decision: { action: "link", playerId: "Alex" } }],
  }), /decision/);
});

test("prevents overlapping identifiers and UUIDs from filling multiple check-in slots", () => {
  const rows = [row({ email: " Alex@example.com " }), row({ rowId: 2, email: "ALEX@example.com" })];
  assert.match(rosterSelectionError(rows, { 1: { action: "new" }, 2: { action: "new" } }), /Row 2/);
  assert.match(rosterSelectionError(rows, {
    1: { action: "match", playerId: legacy },
    2: { action: "check-in", playerId: legacy },
  }), /Row 2/);
  assert.equal(rosterSelectionError(rows, { 1: { action: "new" }, 2: { action: "skip" } }), "");
  assert.equal(rosterSelectionError(rows, {
    1: { action: "link", playerId: legacy },
    2: { action: "check-in", playerId: other },
  }), "");
});

type DbResult = {
  rowId: number;
  status: string;
  reason: string;
  player: { id: string; name: string; dupr: number; dupr_id: string | null } | null;
  rating: number | null;
  savesEmail: boolean;
};

test("Supabase migration resolves and commits roster identity without rewriting history", async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(fixture);
  await db.exec(await readFile(oldMigration, "utf8"));
  await db.exec(await readFile(migration, "utf8"));

  async function importRows(rows: (ImportRow | CommitRow)[], requestId: string | null = null, user = actor) {
    const result = await db.query<{ result: DbResult[] }>(
      "select public.prepare_player_import($1::jsonb, $2::uuid, $3::uuid) as result",
      [JSON.stringify(rows), user, requestId],
    );
    return result.rows[0].result;
  }

  const renamed = row({ name: "Alice Updated 🏓", rating: 4.55, email: " Alice+league@Example.com ", duprId: " ab12cd " });
  const alex = row({ rowId: 3, email: " Alex@Example.com " });

  await t.test("matches DUPR ID across case, spaces, and an emoji rename", async () => {
    const history = "select ep.player_id, c.* from court_players cp join event_players ep on cp.event_player_id = ep.id join courts c on cp.court_id = c.id";
    const before = (await db.query(history)).rows;
    const [preview] = await importRows([renamed]);
    assert.equal(preview.reason, "dupr_id");
    assert.equal(preview.player?.id, alice);
    assert.equal(preview.savesEmail, true);
    assert.equal((await db.query("select email from pbk_staff.player_contacts")).rows.length, 0);
    const [applied] = await importRows([{ ...renamed, decision: { action: "match", playerId: alice } }], randomUUID());
    assert.deepEqual(applied.player, { id: alice, name: "Alice Original", dupr: 3.51, dupr_id: "AB12CD" });
    assert.equal(applied.rating, 4.55);
    assert.deepEqual((await db.query(history)).rows, before);
    const [emailMatch] = await importRows([row({ name: "Entirely Different", email: "ALICE+LEAGUE@example.com" })]);
    assert.equal(emailMatch.reason, "email");
    assert.equal(emailMatch.player?.id, alice);
    const [alias] = await importRows([row({ email: "alice@example.com" })]);
    assert.equal(alias.status, "review");
  });

  await t.test("requires a staff link for a legacy player and preserves same-name UUIDs", async () => {
    const [preview] = await importRows([alex]);
    assert.equal(preview.status, "review");
    assert.equal(preview.player, null);
    await importRows([{ ...alex, decision: { action: "link", playerId: legacy } }], randomUUID());
    const [matched] = await importRows([row({ email: "alex@example.com", name: "New Account Name" })]);
    assert.equal(matched.player?.id, legacy);
    const sameNames = await db.query("select id, dupr_id from players where name = 'Alex Same' order by id");
    assert.deepEqual(sameNames.rows, [{ id: legacy, dupr_id: null }, { id: other, dupr_id: "XY12ZW" }]);
    const [unverifiedId] = await importRows([row({ email: "alex@example.com", duprId: "NEW123" })]);
    assert.equal(unverifiedId.reason, "verify_new_dupr_id");
    assert.equal(unverifiedId.player?.dupr_id, null);
    const [verifiedId] = await importRows([{
      ...row({ email: "alex@example.com", duprId: "NEW123" }),
      decision: { action: "link", playerId: legacy },
    }], randomUUID());
    assert.equal(verifiedId.player?.dupr_id, "NEW123");
  });

  await t.test("blocks disagreeing identifiers and permits verified check-in without changing them", async () => {
    const conflict = { ...alex, duprId: "AB12CD" };
    const [preview] = await importRows([conflict]);
    assert.equal(preview.reason, "different_players");
    await assert.rejects(importRows([{ ...conflict, decision: { action: "link", playerId: alice } }], randomUUID()), /conflicting/);
    const [applied] = await importRows([{ ...conflict, decision: { action: "check-in", playerId: legacy } }], randomUUID());
    assert.equal(applied.player?.id, legacy);
    assert.equal(applied.savesEmail, false);
    assert.equal((await importRows([conflict]))[0].status, "conflict");
    assert.equal((await importRows([row({ duprId: "ab12cd", email: "moved@example.com" })]))[0].reason, "different_identifier");
    assert.equal((await importRows([row({ email: "missing-address" })]))[0].reason, "invalid_identifier");
  });

  await t.test("returns rows in staff order and rolls back a batch with a repeated identifier or UUID", async () => {
    const repeatedEmail = [row({ email: "Example@league.example", rowId: 9 }), row({ email: " example@league.example ", rowId: 2 })];
    await assert.rejects(
      importRows(repeatedEmail.map((source) => ({ ...source, decision: { action: "new" } })), randomUUID()),
      /repeats an identifier/,
    );
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from players")).rows[0].count, 3);
    await assert.rejects(importRows([
      { ...row({ email: "alice+league@example.com" }), decision: { action: "match", playerId: alice } },
      { ...row({ rowId: 2 }), decision: { action: "check-in", playerId: alice } },
    ], randomUUID()), /repeats a player/);
    const applied = await importRows([
      { ...row({ rowId: 7 }), decision: { action: "check-in", playerId: other } },
      { ...row({ rowId: 3 }), decision: { action: "skip" } },
      { ...row({ rowId: 4 }), decision: { action: "check-in", playerId: alice } },
      { ...row({ rowId: 1 }), decision: { action: "check-in", playerId: legacy } },
    ], randomUUID());
    assert.deepEqual(applied.map(({ rowId, player }) => [rowId, player?.id]), [[7, other], [3, undefined], [4, alice], [1, legacy]]);
  });

  await t.test("reuses a committed receipt, even for an identifier-free walk-in", async () => {
    const id = randomUUID();
    const walkIn: CommitRow = { ...row({ name: "Confirmed new walk-in", rating: 4.75 }), decision: { action: "new" } };
    const first = await importRows([walkIn], id);
    const second = await importRows([walkIn], id);
    assert.deepEqual(second, first);
    assert.equal(second[0].player?.dupr, 0);
    assert.equal(second[0].rating, 4.75);
    await assert.rejects(importRows([{ ...walkIn, name: "Different payload" }], id), /already in use/);
    await assert.rejects(importRows([walkIn], id, randomUUID()), /already in use/);
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from players where name = 'Confirmed new walk-in'")).rows[0].count, 1);
  });

  await t.test("rechecks a proposed new player at commit and enforces identifier and staff boundaries in PostgreSQL", async () => {
    const newRow: CommitRow = { ...row({ email: "new@example.com" }), decision: { action: "new" } };
    assert.equal((await importRows([newRow]))[0].status, "review");
    await importRows([newRow], randomUUID());
    await assert.rejects(importRows([newRow], randomUUID()), /matches an existing player/);

    await assert.rejects(db.exec("insert into players (name, dupr_id) values ('Duplicate', ' ab12cd ')"), { code: "23505" });
    await assert.rejects(db.exec(`insert into pbk_staff.player_contacts values ('${other}', 'alex@example.com')`), { code: "23505" });
    await assert.rejects(db.exec(`insert into pbk_staff.player_contacts values ('${other}', ' Alex@Example.com ')`), { code: "23514" });
    await db.exec("set role authenticated");
    await assert.rejects(importRows([alex]), { code: "42501" });
    await assert.rejects(db.exec("select * from pbk_staff.player_contacts"), { code: "42501" });
    await db.exec("reset role; set role service_role");
    assert.equal((await importRows([alex]))[0].player?.id, legacy);
    await db.exec("reset role");
  });
});

test("a legacy DUPR collision prevents migration without editing either profile", async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(fixture);
  await db.exec(await readFile(oldMigration, "utf8"));
  await db.exec(`update players set dupr_id = ' ab12cd ' where id = '${legacy}'`);
  await assert.rejects(db.exec(await readFile(migration, "utf8")), /collide after normalization/);
  await db.exec("rollback");
  const ids = await db.query("select dupr_id from players order by id");
  assert.deepEqual(ids.rows, [{ dupr_id: "AB12CD" }, { dupr_id: " ab12cd " }, { dupr_id: "XY12ZW" }]);
});

test("carries a valid legacy email forward on its existing UUID", async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(fixture);
  await db.exec(await readFile(oldMigration, "utf8"));
  await db.exec(`
    alter table public.players add column email text;
    update public.players set email = ' Alex+League@Example.com ' where id = '${legacy}';
    update public.players set email = 'unknown address' where id = '${alice}';
  `);
  await db.exec(await readFile(migration, "utf8"));

  const contacts = await db.query("select player_id, email from pbk_staff.player_contacts");
  assert.deepEqual(contacts.rows, [{ player_id: legacy, email: "alex+league@example.com" }]);
  const stored = await db.query("select email from public.players where id = $1", [legacy]);
  assert.deepEqual(stored.rows, [{ email: " Alex+League@Example.com " }]);

  const preview = await db.query<{ result: DbResult[] }>(
    "select public.prepare_player_import($1::jsonb, $2::uuid) as result",
    [JSON.stringify([row({ name: "New name 🏓", email: "alex+league@example.com" })]), actor],
  );
  assert.equal(preview.rows[0].result[0].reason, "email");
  assert.equal(preview.rows[0].result[0].player?.id, legacy);
});

test("a legacy email collision stops migration without rewriting either player", async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(fixture);
  await db.exec(await readFile(oldMigration, "utf8"));
  await db.exec(`
    alter table public.players add column email text;
    update public.players set email = ' Shared@Example.com ' where id = '${legacy}';
    update public.players set email = 'shared@example.com' where id = '${other}';
  `);
  await assert.rejects(db.exec(await readFile(migration, "utf8")), /player emails collide/);
  await db.exec("rollback");
  const stored = await db.query("select id, email from public.players where email is not null order by id");
  assert.deepEqual(stored.rows, [
    { id: legacy, email: " Shared@Example.com " },
    { id: other, email: "shared@example.com" },
  ]);
});
