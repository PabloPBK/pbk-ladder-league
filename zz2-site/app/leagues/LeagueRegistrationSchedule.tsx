import { leagueDate, publicWebUrl, type PublishedLeague } from "../../lib/league-contract";

const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

export function leagueRegistrationToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

function formatTime(value: string) {
  return timeFormat.format(new Date("2000-01-01T" + value + ":00Z"));
}

export default function LeagueRegistrationSchedule({ listing, today }: { listing: PublishedLeague; today: string }) {
  const sessions = listing.registration_sessions ?? [];
  if (sessions.length === 0) return null;

  const canRegister = listing.registration_status === "open" || listing.registration_status === "waitlist";

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-zinc-700">
        This is a drop-in league. Register for any session that works for you. There’s no season-long commitment.
      </p>
      <ul aria-label="Drop-in sessions" className="divide-y divide-zinc-200 border-y border-zinc-200 text-sm">
        {sessions.map((session, index) => {
          const url = publicWebUrl(session.url);
          const onPodPlay = url && new URL(url).hostname.endsWith(".podplay.app");
          const action = listing.registration_status === "waitlist" ? "Join waitlist" : onPodPlay ? "Register on PodPlay" : "Register";
          const date = leagueDate(session.date);

          return (
            <li key={session.date + "T" + session.start_time} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2.5">
              <div>
                <p className="font-semibold"><time dateTime={session.date}>{date}</time></p>
                <p className="text-zinc-600">{formatTime(session.start_time)} – {formatTime(session.end_time)}</p>
              </div>
              {url && canRegister && session.date >= today && (
                <a href={url} aria-label={`${action} for session ${index + 1} on ${date}`}
                  className="rounded-md bg-yellow-300 px-3 py-2 font-bold hover:bg-yellow-400">
                  {action}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
