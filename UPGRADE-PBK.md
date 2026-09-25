# PBK Ladder League Upgrade

This build adds three operational upgrades to the current PBK Ladder League application.

## 1. Season management

- Admin can create the next season from the League / Season selector.
- Season number is suggested automatically and the start date can be backdated.
- Creating a new season marks the current active season complete.
- History now shows each league night's season and can filter by season.
- Staff can use **Edit Season** in History to reassign a completed league night to another season in the same league without changing its scores, rounds, or players.

### Season 4 setup

1. Create **Season 4** using its actual start date.
2. Open **History**.
3. Find the first two league nights that already belong to Season 4.
4. Use **Edit Season** and assign each one to Season 4.

## 2. Registration roster, court order, and printing

- Upload the PodPlay registration CSV as before.
- Confirmed/selected players are sorted by rating.
- Staff can move players up or down before import.
- Court placement is visible immediately: players 1-4 = Court 1, 5-8 = Court 2, etc.
- Ratings can be edited, and `0` is supported for an unrated player.
- **Print Court List** prints a clean player-facing court assignment sheet.
- The approved player order is preserved into the league-night setup. Round 1 no longer re-sorts those checked-in players behind the scenes.
- The Admin check-in screen also supports one-night rating overrides, moving checked-in players up/down, and printing the current court list.

## 3. DUPR CSV export

- A persistent **DUPR ID** can be saved for each player on the Weekly Roster / Players screen.
- A completed History event has **Download DUPR CSV**.
- Choose Standard or Rally scoring before export.
- Export is blocked if any participating player is missing a DUPR ID, and the missing names are shown.
- The generated CSV uses the same 22-column structure as the DUPR template supplied for this project.
- Each ladder court/round is one completed game, so its score is placed in Game 1 and Game 2 / Game 3 remain blank on that export row.

## One-time database step before deployment

Run the SQL file below in the Supabase SQL Editor before using the new persistent DUPR ID field:

`supabase/migrations/20260925_seasons_roster_dupr.sql`

It safely adds the `players.dupr_id` field and defensively adds the league-event session fields if they are not already present.

## Deployment

1. Back up or retain the current GitHub branch.
2. Run the SQL migration in Supabase.
3. Commit/push this upgraded project to the existing `PabloPBK/pbk-ladder-league` repository.
4. Let the connected Vercel project deploy the new commit.
5. Log in as staff and test Season creation, History reassignment, roster printing, a completed-event DUPR export, and one normal league-night flow before your next live session.

## Validation performed here

- All project `.ts` / `.tsx` source files were syntax-transpiled successfully.
- The DUPR exporter header was compared to the supplied template and matched all 22 columns exactly.
- A full dependency install / production build could not be completed in this execution environment because npm package retrieval was unavailable. Run `npm ci`, `npm run lint`, and `npm run build` in a networked development/CI environment before production deployment.
