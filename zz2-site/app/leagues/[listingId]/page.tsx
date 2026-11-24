import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrizeMoney, isUuid, leagueDate, publicWebUrl, registrationLabels, type PublicLeagueStanding } from "../../../lib/league-contract";
import { getPublicLeague } from "../../../lib/league-feed";

export const dynamic = "force-dynamic";

function ResultsTable({ standings, label, showPlayerStats }: { standings: PublicLeagueStanding[]; label: string; showPlayerStats: boolean }) {
  if (standings.length === 0) return <p className="text-sm text-zinc-600">No standings are available yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full min-w-max text-left text-sm tabular-nums" aria-label={label}>
        <thead className="bg-zinc-100">
          <tr>{["Rank", "Player", ...(showPlayerStats ? ["DUPR", "Played"] : []), "Wins", "Losses", "Point diff.",
            ...(showPlayerStats ? ["Points for", "Points against"] : [])].map((column) =>
            <th scope="col" key={column} className="px-3 py-2">{column}</th>,
          )}</tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {standings.map((row) => <tr key={row.position}>
            <td className="px-3 py-2">{row.position}</td>
            <th scope="row" className="px-3 py-2 font-semibold">{row.name}</th>
            {showPlayerStats && <><td className="px-3 py-2">{row.dupr && row.dupr > 0 ? row.dupr.toFixed(2) : "—"}</td><td className="px-3 py-2">{row.gamesPlayed}</td></>}
            <td className="px-3 py-2">{row.wins}</td><td className="px-3 py-2">{row.losses}</td>
            <td className="px-3 py-2">{row.pointDifferential > 0 ? "+" : ""}{row.pointDifferential}</td>
            {showPlayerStats && <><td className="px-3 py-2">{row.pointsFor}</td><td className="px-3 py-2">{row.pointsAgainst}</td></>}
          </tr>)}
        </tbody>
      </table>
    </div>
  );
}

export default async function PublicLeague({ params, searchParams }: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  const { listingId } = await params;
  if (!isUuid(listingId)) notFound();
  const { event } = await searchParams;
  if (event && !isUuid(event)) notFound();
  const feed = await getPublicLeague(listingId, event);
  if (!feed) notFound();
  const { listing, facility, sections: { daily, season, history, playerStats }, events,
    selectedEventId, seasonStandings, dailyStandings, dailyPrizeCents, rounds } = feed;
  const registration = publicWebUrl(listing.registration_url);
  const logo = publicWebUrl(listing.logo_url);
  const section = "space-y-4 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6";
  return (
    <main className="bg-[#f4f7fb] px-6 py-12 text-[#071b3a]">
    <div className="mx-auto max-w-6xl space-y-6">
      <div className={section}>
        {facility && <Link className="text-sm font-semibold underline" href={"/leagues/facilities/" + facility.id}>{facility.name}</Link>}
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element -- Staff supply logos from different external hosts.
          <img src={logo} alt="" width={160} height={80} className="max-h-20 w-auto object-contain" referrerPolicy="no-referrer" />
        )}
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{listing.name}</h1>
        <p>{leagueDate(listing.start_date)} – {leagueDate(listing.end_date)}</p>
        <p className="flex flex-wrap gap-3 text-sm font-semibold">
          {[listing.format, listing.skill_level, listing.pricing, listing.dupr_rated ? "DUPR rated" : null].filter(Boolean).join(" · ")}
        </p>
        {listing.description && <p className="max-w-3xl whitespace-pre-line leading-relaxed text-zinc-700">{listing.description}</p>}
        <div className="flex flex-wrap items-center gap-4">
          <p className="font-semibold">{registrationLabels[listing.registration_status]}</p>
          {registration && ["open", "waitlist"].includes(listing.registration_status) &&
            <a className="rounded-lg bg-yellow-300 px-4 py-2 font-bold hover:bg-yellow-400" href={registration}>
              {listing.registration_status === "waitlist" ? "Join waitlist" : "Register"}
            </a>}
        </div>
      </div>

      {season && <section className={section} aria-labelledby="season-standings">
        <h2 id="season-standings" className="text-2xl font-bold">Season standings</h2>
        <ResultsTable label="Season standings" standings={seasonStandings} showPlayerStats={playerStats} />
      </section>}

      {(daily || history) && <section className={section} aria-labelledby="league-nights">
        <h2 id="league-nights" className="text-2xl font-bold">{history ? "League night history" : "Daily standings"}</h2>
        {!events?.length ? <p className="text-sm text-zinc-600">No completed league nights yet.</p> : <>
          <form className="flex flex-wrap items-end gap-2" action={"/leagues/" + listing.id} method="get">
            <label className="grid gap-1 text-sm font-semibold">League night
              <select name="event" defaultValue={selectedEventId ?? undefined} className="max-w-full rounded border border-zinc-400 px-3 py-2">
                {events.map((entry) => <option key={entry.id} value={entry.id}>
                  {leagueDate(entry.event_date)} · Session {entry.session_number} · {entry.name}
                </option>)}
              </select>
            </label>
            <button className="rounded bg-zinc-900 px-4 py-2 text-sm font-bold text-white hover:bg-zinc-700" type="submit">View results</button>
          </form>
          {daily && <>
            {(history || dailyPrizeCents != null) && <div className="flex flex-wrap items-center justify-between gap-3">
              {history && <h3 className="text-lg font-bold">Daily standings</h3>}
              {dailyPrizeCents != null && <p className="ml-auto rounded-lg bg-yellow-100 px-4 py-2 text-sm font-semibold">
                Prize money <span className="ml-1 font-extrabold tabular-nums">{formatPrizeMoney(dailyPrizeCents)}</span>
              </p>}
            </div>}
            <ResultsTable label="Daily standings" standings={dailyStandings} showPlayerStats={playerStats} />
          </>}
          {history && <div className="space-y-3">
            <h3 className="text-lg font-bold">Match results</h3>
            {rounds.length === 0 && <p className="text-sm text-zinc-600">No completed matches for this league night.</p>}
            {rounds.map((round) => (
              <details key={round.number} className="rounded-lg border border-zinc-200 p-3">
                <summary className="cursor-pointer font-semibold">Round {round.number}</summary>
                <ul className="mt-2 divide-y divide-zinc-200 text-sm">
                  {round.courts.map((court) => <li key={court.number} className="grid gap-1 py-2 sm:grid-cols-[5rem_1fr_auto_1fr]">
                    <span className="font-semibold">Court {court.number}</span>
                    <span>{court.team1.join(" / ")}</span>
                    <span className="font-bold tabular-nums">{court.score1} – {court.score2}</span>
                    <span>{court.team2.join(" / ")}</span>
                  </li>)}
                </ul>
              </details>
            ))}
          </div>}
        </>}
      </section>}
    </div>
    </main>
  );
}
