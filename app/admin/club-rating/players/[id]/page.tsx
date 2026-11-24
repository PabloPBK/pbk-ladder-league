import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isUuid } from "@/lib/data/league-listings";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type PlayerHistory = {
  player: {
    pbk_player_id: string;
    full_name: string;
    club_rating: number | null;
    rating_status: string;
    period_deadline: string | null;
  };
  rolling_rating: number | null;
  sessions: {
    key: string;
    name: string | null;
    date: string;
    status: string;
    source: "pb_vision" | "verified_archive";
    games: { number: number | null; rating: number }[];
  }[];
};

const directory = "/admin/club-rating/players";
const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
});
const formatDate = (value: string) => dateFormat.format(new Date(value + "T12:00:00Z"));
const formatRating = (rating: number | null) => rating == null ? "—" : Number(rating).toFixed(3);

export default async function ClubRatingPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireStaffUser();
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      redirect("/login?next=" + encodeURIComponent(directory + "/" + id));
    }
    if (error instanceof Error && error.message === "STAFF_ACCESS_DENIED") notFound();
    throw error;
  }
  if (!isUuid(id)) notFound();

  const { data, error } = await supabaseAdmin.rpc("get_club_rating_player_history", { p_player_id: id });
  if (error) throw new Error("Unable to load Club Rating history.", { cause: error });
  if (!data) notFound();
  const { player, rolling_rating, sessions } = data as PlayerHistory;
  const latestScoredSession = sessions.find((session) => session.games.length > 0)?.key;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href={directory} className="text-sm text-zinc-400 hover:text-white">← Club Rating Players</Link>
          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{player.full_name}</h1>
          <p className="mt-1 text-sm text-zinc-400">{player.pbk_player_id} · <span className="capitalize">{player.rating_status.replaceAll("_", " ")}</span></p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <dt className="text-sm text-zinc-400">Official Club Rating</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{formatRating(player.club_rating)}</dd>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <dt className="text-sm text-zinc-400">Last-12 average</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{formatRating(rolling_rating)}</dd>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <dt className="text-sm text-zinc-400">Renewal deadline</dt>
            <dd className="mt-1 text-2xl font-bold">{player.period_deadline ? formatDate(player.period_deadline) : "—"}</dd>
          </div>
        </dl>

        <section className="space-y-3" aria-labelledby="sessions">
          <h2 id="sessions" className="text-xl font-semibold">Sessions and game ratings</h2>
          {sessions.length === 0 && <p className="rounded-xl border border-zinc-800 p-4 text-zinc-400">No Club Rating sessions are on file.</p>}
          {sessions.map((session) => (
            <details key={session.key} open={session.key === latestScoredSession} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <summary className="cursor-pointer rounded font-semibold focus-visible:outline-2 focus-visible:outline-blue-300">
                {formatDate(session.date)} · {session.name ?? "Club Rating session"}
                <span className="ml-2 text-sm font-normal text-zinc-400">
                  · {session.games.length} {session.games.length === 1 ? "game rating" : "game ratings"}
                  {session.source === "verified_archive" ? " · Verified archive" : " · " + session.status.replaceAll("_", " ")}
                </span>
              </summary>
              {session.games.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-400">No game ratings have been recorded for this session.</p>
              ) : (
                <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {session.games.map((game, gameIndex) => (
                    <li key={gameIndex} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
                      <span className="block text-xs text-zinc-400">Game {game.number ?? gameIndex + 1}</span>
                      <span className="font-semibold tabular-nums">{formatRating(game.rating)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </details>
          ))}
        </section>
      </div>
    </main>
  );
}
