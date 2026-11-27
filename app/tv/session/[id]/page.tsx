import { notFound } from "next/navigation";

import DailyStandingsDisplay from "@/components/tv/DailyStandingsDisplay";
import { LeagueCourtDisplay } from "@/components/tv/LeagueCourtDisplay";
import { isUuid } from "@/lib/data/league-listings";

export default async function SessionTVPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const [{ id }, { view }] = await Promise.all([params, searchParams]);
  if (!isUuid(id) || (view !== "courts" && view !== "standings")) notFound();

  return view === "courts"
    ? <LeagueCourtDisplay eventId={id} />
    : <DailyStandingsDisplay fixedEventId={id} />;
}
