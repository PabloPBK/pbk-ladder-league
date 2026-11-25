import Link from "next/link";
import { leagueDate, publicWebUrl, registrationLabels, type PublishedLeague, type ListingFacility } from "../../lib/league-contract";
import LeagueRegistrationSchedule, { leagueRegistrationToday } from "./LeagueRegistrationSchedule";

export default function LeagueDirectory({ listings, facilities, facility }: {
  listings: PublishedLeague[];
  facilities: ListingFacility[];
  facility?: ListingFacility;
}) {
  const today = leagueRegistrationToday();
  const upcoming = listings.filter((listing) => listing.end_date >= today);
  const past = listings.filter((listing) => listing.end_date < today).reverse();
  const facilityNames = new Map(facilities.map((venue) => [venue.id, venue.name]));
  return (
    <>
      <h1 className="max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">{facility ? facility.name + " leagues" : "Leagues"}</h1>
      {!facility && <nav className="mt-6 flex flex-wrap gap-2" aria-label="Facility league pages">
        {facilities.map((venue) => (
          <Link className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold hover:border-zinc-700"
            key={venue.id} href={"/leagues/facilities/" + venue.id}>{venue.name}</Link>
        ))}
      </nav>}
      <section className="mt-9" aria-labelledby="upcoming-leagues">
        <h2 id="upcoming-leagues" className="mb-4 text-2xl font-bold">Current and upcoming</h2>
        {upcoming.length === 0 ? <p className="rounded-xl border border-zinc-200 bg-white p-5 text-zinc-700">No current or upcoming leagues are published.</p>
          : <ListingCards listings={upcoming} facilityNames={facilityNames} today={today} />}
      </section>
      {past.length > 0 && <section className="mt-9" aria-labelledby="past-leagues">
        <h2 id="past-leagues" className="mb-4 text-2xl font-bold">Past leagues</h2>
        <ListingCards listings={past} facilityNames={facilityNames} today={today} />
      </section>}
    </>
  );
}

function ListingCards({ listings, facilityNames, today }: { listings: PublishedLeague[]; facilityNames: Map<string, string>; today: string }) {
  return <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {listings.map((listing) => {
      const registration = publicWebUrl(listing.registration_url);
      const canRegister = listing.registration_status === "open" || listing.registration_status === "waitlist";
      const hasSessions = Boolean(listing.registration_sessions?.length);
      return (
        <li key={listing.id} className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-zinc-700">{facilityNames.get(listing.facility_id)}</p>
          <h3 className="text-xl font-extrabold"><Link href={"/leagues/" + listing.id} className="underline-offset-4 hover:underline">{listing.name}</Link></h3>
          <p className="text-sm">{leagueDate(listing.start_date)} – {leagueDate(listing.end_date)}</p>
          <p className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-zinc-100 px-3 py-1">{registrationLabels[listing.registration_status]}</span>
            {listing.dupr_rated && <span className="rounded-full bg-yellow-200 px-3 py-1">DUPR rated</span>}
          </p>
          <LeagueRegistrationSchedule listing={listing} today={today} />
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
            <Link href={"/leagues/" + listing.id} className="text-sm font-bold underline-offset-4 hover:underline" aria-label={"View " + listing.name}>
              League details →
            </Link>
            {!hasSessions && registration && canRegister && <a href={registration} className="rounded-md bg-yellow-300 px-3 py-2 text-sm font-bold hover:bg-yellow-400">
              {listing.registration_status === "waitlist" ? "Join waitlist" : "Register"}
            </a>}
          </div>
        </li>
      );
    })}
  </ul>;
}
