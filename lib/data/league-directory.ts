import type { LeagueRecord, SeasonRecord } from "./leagues";

export type DirectoryLeague = Pick<LeagueRecord, "id" | "name" | "active"> & {
  seasons: Pick<SeasonRecord, "id" | "name" | "status" | "start_date" | "end_date">[];
};

export type DirectoryEvent = { id: string; name: string; event_date: string | null };

type DirectoryEntry = { label: string; href: string; date: string | null };

export type LeagueDirectory = { current: DirectoryEntry[]; past: DirectoryEntry[] };

export const rosterWorkspace = "/admin/tv-manager/rosters";

export function buildLeagueDirectory(
  leagues: DirectoryLeague[],
  events: DirectoryEvent[],
  today: string,
): LeagueDirectory {
  const current: DirectoryEntry[] = [];
  const past: DirectoryEntry[] = [];

  for (const league of leagues) {
    const name = league.name.trim();
    const leagueQuery = new URLSearchParams({ leagueId: league.id });

    if (league.seasons.length === 0) {
      const entries = league.active ? current : past;
      entries.push({ label: name, href: `${league.active ? "/admin" : "/history"}?${leagueQuery}`, date: null });
    }

    for (const season of league.seasons) {
      const completed = !league.active || season.status === "complete" || season.status === "archived"
        || Boolean(season.end_date && season.end_date < today);
      const query = new URLSearchParams({ leagueId: league.id, seasonId: season.id });
      const entries = completed ? past : current;
      entries.push({
        label: `${name} · ${season.name.trim()}`,
        href: `${completed ? "/history" : "/admin"}?${query}`,
        date: completed ? season.end_date ?? season.start_date : season.start_date,
      });
    }
  }

  for (const event of events) {
    const entries = event.event_date && event.event_date < today ? past : current;
    entries.push({
      label: event.name.trim(),
      href: `${rosterWorkspace}?${new URLSearchParams({ event: event.id })}`,
      date: event.event_date,
    });
  }

  const byName = (a: DirectoryEntry, b: DirectoryEntry) =>
    a.label.localeCompare(b.label, undefined, { numeric: true });
  current.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || byName(a, b));
  past.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || byName(a, b));

  return { current, past };
}
