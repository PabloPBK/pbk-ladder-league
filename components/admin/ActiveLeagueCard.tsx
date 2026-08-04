import type { LeagueEventRecord } from "@/lib/data/events";

type ActiveLeagueCardProps = {
  event: LeagueEventRecord;
  currentRound: number;
  roundIsGenerated: boolean;
};

export function ActiveLeagueCard({
  event,
  currentRound,
  roundIsGenerated,
}: ActiveLeagueCardProps) {
  return (
    <section className="mb-8 rounded-2xl border border-blue-500/40 bg-blue-500/10 p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-300">
        Active League Event
      </p>

      <h2 className="mt-2 text-2xl font-bold text-white">
        {event.name}
      </h2>

      <div className="mt-3 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
        <p>
          <span className="text-zinc-500">Date:</span>{" "}
          {event.event_date}
        </p>

        <p>
          <span className="text-zinc-500">Session:</span>{" "}
          {event.session_number}
        </p>

        {event.session_note && (
          <p className="sm:col-span-2">
            <span className="text-zinc-500">Note:</span>{" "}
            {event.session_note}
          </p>
        )}
      </div>

      <p className="mt-3 break-all text-xs text-zinc-500">
        Event ID: {event.id}
      </p>

      {roundIsGenerated ? (
        <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 p-3 font-semibold text-green-300">
          Round {currentRound} is saved in Supabase.
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 font-semibold text-yellow-300">
          League night started. Check players in and generate Round 1.
        </div>
      )}
    </section>
  );
}