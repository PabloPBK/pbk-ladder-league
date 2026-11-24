import { getPublicLeagues } from "../../lib/league-feed";
import LeagueDirectory from "./LeagueDirectory";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leagues" };

export default async function LeaguesPage() {
  const feed = await getPublicLeagues();
  if (!feed) throw new Error("The league directory is temporarily unavailable.");
  return <main className="min-h-[70vh] bg-[#f4f7fb] px-6 py-14 text-[#071b3a]">
    <div className="mx-auto max-w-7xl"><LeagueDirectory {...feed} /></div>
  </main>;
}
