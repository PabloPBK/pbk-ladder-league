import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { noShowStatuses } from "@/lib/data/open-play-no-shows";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { NoShowImport } from "./NoShowImport";
import { NoShowQueue } from "./NoShowQueue";

export const dynamic = "force-dynamic";

const path = "/admin/open-play-no-shows";
const pageSize = 50;
const labels = { pending: "Pending", charged: "Charged", skipped: "Skipped" };

export default async function OpenPlayNoShows({ searchParams }: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  let user;
  try {
    user = await requireStaffUser();
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") redirect("/login?next=" + path);
    if (error instanceof Error && error.message === "STAFF_ACCESS_DENIED") notFound();
    throw error;
  }

  const query = await searchParams;
  const status = noShowStatuses.find((choice) => choice === query.status) ?? "pending";
  const pageNumber = Number(query.page);
  const page = Number.isSafeInteger(pageNumber) && pageNumber > 0 && pageNumber < 100_000 ? pageNumber : 1;
  const offset = (page - 1) * pageSize;
  const [venues, queue] = await Promise.all([
    supabaseAdmin.from("tournament_facilities").select("id,name").order("name"),
    supabaseAdmin.from("open_play_no_shows")
      .select("id,facility_id,session_date,session_time,session_name,player_name,player_email,status,claimed_by,staff_name,claimed_at,resolved_at,skip_reason", { count: "exact" })
      .eq("status", status).order("session_date", { ascending: false }).order("session_time", { ascending: false })
      .order("id").range(offset, offset + pageSize - 1),
  ]);
  if (venues.error || queue.error) throw new Error("Unable to load the open-play no-show queue.");

  const facilityNames = new Map(venues.data.map((venue) => [venue.id, venue.name]));
  const entries = queue.data.map((entry) => ({
    ...entry, status, facility_name: facilityNames.get(entry.facility_id) ?? "Facility",
  }));

  return (
    <AppLayout title="Open-play no-shows" description="Review PodPlay no-shows and track charges made in your billing system.">
      <div className="mx-auto max-w-5xl space-y-6">
        <NoShowImport facilities={venues.data} />
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-xl font-bold">No-show queue</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Start a review, confirm the player and attendance in PodPlay, and record the outcome here after handling it in your billing system.
          </p>
          <nav aria-label="Review status" className="my-4 flex flex-wrap gap-2">
            {noShowStatuses.map((choice) => (
              <Link key={choice} href={`${path}?status=${choice}`} aria-current={status === choice ? "page" : undefined}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold ${status === choice ? "border-blue-400 bg-blue-950 text-blue-200" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`}>
                {labels[choice]}
              </Link>
            ))}
          </nav>
          {entries.length ? (
            <NoShowQueue entries={entries} userId={user.id} pendingView={status === "pending"} />
          ) : (
            <p className="py-4 text-sm text-zinc-400">No {status} entries on this page.</p>
          )}
          {(page > 1 || (queue.count ?? 0) > offset + entries.length) && (
            <nav aria-label="Queue pages" className="mt-4 flex gap-5 text-sm font-semibold text-blue-300">
              {page > 1 && <Link href={`${path}?status=${status}&page=${page - 1}`}>← Previous</Link>}
              {(queue.count ?? 0) > offset + entries.length && <Link href={`${path}?status=${status}&page=${page + 1}`}>Next →</Link>}
            </nav>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
