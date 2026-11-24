import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { leagueDate } from "@/lib/data/league-listings";
import { getLeagueListings, getListingFacilities, getListingSeasonOptions } from "@/lib/server/league-listings";
import { requireStaffUser } from "@/lib/server/require-auth";
import LeagueListingForm from "./LeagueListingForm";

export const dynamic = "force-dynamic";
const here = "/admin/events/leagues";
const publicLeagues = "https://zz2-pickleball.vercel.app/leagues";

export default async function LeagueEditor({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  try {
    await requireStaffUser();
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") redirect("/login?next=" + here);
    if (error instanceof Error && error.message === "STAFF_ACCESS_DENIED") notFound();
    throw error;
  }
  const { edit } = await searchParams;
  const [listings, facilities, { leagues, seasons }] = await Promise.all([
    getLeagueListings({ published: false }), getListingFacilities(), getListingSeasonOptions(),
  ]);
  const selected = listings.find((listing) => listing.id === edit);
  if (edit && !selected) notFound();
  const names = new Map(facilities.map((facility) => [facility.id, facility.name]));
  return (
    <AppLayout title="League publishing" description="Manage the league listings players see on ZZ2 and facility pages.">
      <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-yellow-400">
        <Link href="/admin/events" className="hover:underline">← Event types</Link>
        <Link href={publicLeagues} className="hover:underline">Public Leagues</Link>
      </div>
      <div className="grid gap-5 text-white lg:grid-cols-[minmax(15rem,1fr)_minmax(0,2fr)]">
        <aside className="h-fit rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">League listings</h2>
            <Link href={here} className="rounded border border-zinc-600 px-3 py-1.5 text-sm font-semibold text-yellow-300">New league</Link>
          </div>
          {listings.length === 0 ? <p className="text-sm text-zinc-400">No league listings yet.</p> : (
            <ul className="divide-y divide-zinc-800">
              {listings.map((listing) => (
                <li key={listing.id} className="py-3">
                  <Link href={here + "?edit=" + listing.id} aria-current={listing.id === edit ? "page" : undefined}
                    className="block font-semibold text-yellow-300 hover:underline">{listing.name}</Link>
                  <p className="text-sm text-zinc-400">{names.get(listing.facility_id)} · {leagueDate(listing.start_date)}</p>
                  <p className="text-sm capitalize">{listing.status}</p>
                  {listing.status === "published" && <div className="mt-1 flex flex-wrap gap-x-3 text-sm">
                    <Link href={publicLeagues + "/" + listing.id} className="underline">Public listing</Link>
                    <Link href={publicLeagues + "/facilities/" + listing.facility_id} className="underline">Facility page</Link>
                  </div>}
                </li>
              ))}
            </ul>
          )}
        </aside>
        <LeagueListingForm key={selected?.id ?? "new"} listing={selected} facilities={facilities} leagues={leagues} seasons={seasons} />
      </div>
    </AppLayout>
  );
}
