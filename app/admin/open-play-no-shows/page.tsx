import Form from "next/form";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { recentOpenPlayDates } from "@/lib/data/open-play-no-show-schedule";
import { noShowToday } from "@/lib/data/open-play-no-show-billing";
import { noShowFacilityId, noShowFacilityName, noShowStatuses, type NoShowPlayerGroup, type NoShowQueueEntry, type NoShowStatus } from "@/lib/data/open-play-no-shows";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { NoShowImport } from "./NoShowImport";
import { NoShowQueue } from "./NoShowQueue";

export const dynamic = "force-dynamic";

const path = "/admin/open-play-no-shows";
const pageSize = 50;
const maxNameLength = 160;
const labels = { pending: "Pending", charged: "Charged", reversed: "Reversals" };

export default async function OpenPlayNoShows({ searchParams }: {
  searchParams: Promise<{ status?: string; page?: string; q?: string }>;
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
  const status = query.status === "skipped" ? "reversed" : noShowStatuses.find((choice) => choice === query.status) ?? "pending";
  const pageNumber = Number(query.page);
  const page = Number.isSafeInteger(pageNumber) && pageNumber > 0 && pageNumber < 100_000 ? pageNumber : 1;
  const offset = (page - 1) * pageSize;
  const nameSearch = status !== "pending" && typeof query.q === "string"
    ? query.q.replaceAll("\0", "").trim().slice(0, maxNameLength)
    : "";
  const { entries, groups, hasNextPage } = await loadQueue(status, offset, nameSearch);

  return (
    <AppLayout title="Open-play no-shows" description={noShowFacilityName + " · Review PodPlay no-shows and record charge outcomes."}>
      <div className="mx-auto max-w-5xl space-y-6">
        <NoShowImport scheduleDates={recentOpenPlayDates(noShowToday())} />
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-xl font-bold">Daily report</h2>
          <p className="mt-2 text-sm text-zinc-300">Download charges, refunds, exceptions, and notes by the date staff recorded each action (Pacific time).</p>
          <form action="/api/open-play-no-shows/report" className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm font-semibold">
              Report date
              <input type="date" name="date" defaultValue={noShowToday()} required
                className="mt-1 block rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white" />
            </label>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              Download CSV
            </button>
          </form>
        </section>
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-xl font-bold">No-show queue</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Start a review, confirm the player and attendance in PodPlay, and record the outcome here after handling it in your billing system.
          </p>
          <nav aria-label="Review status" className="my-4 flex flex-wrap gap-2">
            {noShowStatuses.map((choice) => (
              <Link key={choice} href={queueHref(choice, nameSearch)} aria-current={status === choice ? "page" : undefined}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold ${status === choice ? "border-blue-400 bg-blue-950 text-blue-200" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`}>
                {labels[choice]}
              </Link>
            ))}
          </nav>
          {status !== "pending" && (
            <Form key={`${status}:${nameSearch}`} action={path} scroll={false} role="search" aria-label="Search no-show records"
              className="mb-4 flex flex-wrap items-end gap-3">
              <input type="hidden" name="status" value={status} />
              <label className="min-w-0 flex-1 text-sm font-semibold sm:max-w-xs">
                Search by player name
                <input type="search" name="q" defaultValue={nameSearch} maxLength={maxNameLength} autoComplete="off"
                  placeholder="Enter a first or last name"
                  className="mt-1 block w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white" />
              </label>
              <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Search</button>
              {nameSearch && <Link href={queueHref(status)} scroll={false} className="px-2 py-2 text-sm font-semibold text-blue-300">Clear search</Link>}
            </Form>
          )}
          {(entries.length > 0 || groups.length > 0) ? (
            <NoShowQueue entries={entries} groups={groups} status={status} userId={user.id} />
          ) : (
            <p className="py-4 text-sm text-zinc-400">{nameSearch ? "No players match that name on this tab." : "No entries on this page."}</p>
          )}
          {(page > 1 || hasNextPage) && (
            <nav aria-label="Queue pages" className="mt-4 flex gap-5 text-sm font-semibold text-blue-300">
              {page > 1 && <Link href={queueHref(status, nameSearch, page - 1)}>← Previous</Link>}
              {hasNextPage && <Link href={queueHref(status, nameSearch, page + 1)}>Next →</Link>}
            </nav>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

function queueHref(status: NoShowStatus, nameSearch = "", page = 1) {
  const params = new URLSearchParams({ status });
  if (status !== "pending" && nameSearch) params.set("q", nameSearch);
  if (page > 1) params.set("page", String(page));
  return `${path}?${params}`;
}

async function loadQueue(status: NoShowStatus, offset: number, nameSearch: string) {
  if (status !== "pending") {
    const { data, error } = await supabaseAdmin.rpc("open_play_no_show_player_groups", {
      report_facility: noShowFacilityId, queue_status: status, group_offset: offset, group_limit: pageSize + 1, name_query: nameSearch,
    });
    if (error) throw new Error("Unable to load the grouped open-play no-show entries.");
    const groups = data as NoShowPlayerGroup[];
    return { entries: [], groups: groups.slice(0, pageSize), hasNextPage: groups.length > pageSize };
  }

  const queue = await supabaseAdmin.from("open_play_no_shows")
    .select("id,session_date,session_time,session_name,player_name,player_email,claimed_by,staff_name,claimed_at,resolved_at,skip_reason,status,charge_cents,reversal_cents,reversed_at,reversal_staff_name,reversal_reason,notes,notes_updated_at,notes_staff_name", { count: "exact" })
    .eq("facility_id", noShowFacilityId).eq("status", status)
    .order("session_date", { ascending: false }).order("session_time", { ascending: false })
    .order("id").range(offset, offset + pageSize - 1);
  if (queue.error) throw new Error("Unable to load the open-play no-show queue.");
  return { entries: queue.data as NoShowQueueEntry[], groups: [], hasNextPage: (queue.count ?? 0) > offset + queue.data.length };
}
