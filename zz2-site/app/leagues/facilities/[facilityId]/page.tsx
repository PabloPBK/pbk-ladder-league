import { notFound } from "next/navigation";
import { isUuid } from "../../../../lib/league-contract";
import { getPublicLeagues } from "../../../../lib/league-feed";
import LeagueDirectory from "../../LeagueDirectory";

export const dynamic = "force-dynamic";

export default async function FacilityLeagues({ params }: { params: Promise<{ facilityId: string }> }) {
  const { facilityId } = await params;
  if (!isUuid(facilityId)) notFound();
  const feed = await getPublicLeagues(facilityId);
  if (!feed) notFound();
  const facility = feed.facilities.find((venue) => venue.id === facilityId.toLowerCase());
  if (!facility) notFound();
  return <main className="min-h-[70vh] bg-[#f4f7fb] px-6 py-14 text-[#071b3a]">
    <div className="mx-auto max-w-7xl"><LeagueDirectory {...feed} facility={facility} /></div>
  </main>;
}
