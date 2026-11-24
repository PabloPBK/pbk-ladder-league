import Link from "next/link";
export const dynamic = "force-dynamic";

type Facility = { name: string; city: string | null; state: string | null };
type Event = {
  id: string; name: string; start_date: string; end_date: string;
  description: string | null; logo_url: string | null;
  registration_url: string | null; tournament_facilities: Facility | null;
};

function dateParts(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
function formatDateRange(start: string, end: string) {
  const a = dateParts(start), b = dateParts(end);
  const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  const sameMonth = sameYear && a.getUTCMonth() === b.getUTCMonth();
  if (start === end) return `${month.format(a)} ${a.getUTCDate()}, ${a.getUTCFullYear()}`;
  if (sameMonth) return `${month.format(a)} ${a.getUTCDate()}–${b.getUTCDate()}, ${a.getUTCFullYear()}`;
  if (sameYear) return `${month.format(a)} ${a.getUTCDate()} – ${month.format(b)} ${b.getUTCDate()}, ${a.getUTCFullYear()}`;
  return `${month.format(a)} ${a.getUTCDate()}, ${a.getUTCFullYear()} – ${month.format(b)} ${b.getUTCDate()}, ${b.getUTCFullYear()}`;
}
async function getEvents(): Promise<{ events: Event[]; error: boolean }> {
  const base = process.env.TOURNAMENT_FEED_URL;
  if (!base) return { events: [], error: true };
  try {
    const response = await fetch(base, { next: { revalidate: 60 } });
    if (!response.ok) throw new Error("Tournament feed unavailable");
    const json = await response.json();
    return { events: Array.isArray(json.tournaments) ? json.tournaments : [], error: false };
  } catch {
    return { events: [], error: true };
  }
}

export default async function Tournaments() {
  const { events, error } = await getEvents();
  return <main className="min-h-[70vh] bg-[#f4f7fb] px-6 py-16 text-[#071b3a] sm:py-20">
    <div className="mx-auto max-w-7xl">
      <p className="text-xs font-black uppercase tracking-[.25em] text-[#1350b6]">ZZ2 Tournament Circuit</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">Upcoming Tournaments</h1>
          <p className="mt-4 max-w-2xl text-slate-600">Find your next competition, explore event details, and register in just a few clicks.</p>
        </div>
        {!error && events.length > 0 && <p className="rounded-full border border-[#d8e0ec] bg-white px-4 py-2 text-sm font-bold text-[#1350b6]">{events.length} upcoming {events.length === 1 ? "event" : "events"}</p>}
      </div>
      {error ? <p role="status" className="mt-12 text-slate-600">Tournament listings are temporarily unavailable. Please check back shortly.</p>
        : events.length === 0 ? <p className="mt-12 text-slate-600">No upcoming tournaments published yet.</p>
        : <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {events.map(e => {
            const f = e.tournament_facilities;
            const location = [f?.name, f?.city, f?.state].filter(Boolean).join(", ") || "Location to be announced";
            return <article key={e.id} className="flex flex-col overflow-hidden rounded-2xl border border-[#dce4ee] bg-white shadow-sm transition-shadow hover:shadow-lg sm:flex-row">
              <Link href={`/tournaments/${e.id}`} aria-label={`View ${e.name} details`} className="flex h-48 shrink-0 items-center justify-center bg-[#e9eef6] p-5 sm:h-auto sm:w-[38%]">
                {e.logo_url ? <img src={e.logo_url} alt={`${e.name} event logo`} loading="lazy" className="max-h-40 w-full object-contain" /> : <span className="text-center text-2xl font-black uppercase tracking-widest text-[#143e83]">ZZ2<br/>Pickleball</span>}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col p-6">
                <p className="text-sm font-extrabold text-[#1451b2]">{formatDateRange(e.start_date, e.end_date)}</p>
                <h2 className="mt-2 text-2xl font-black leading-tight">{e.name}</h2>
                <p className="mt-3 text-sm font-semibold text-slate-600">{location}</p>
                {e.description && <p className="mt-3 line-clamp-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{e.description}</p>}
                <div className="mt-auto flex flex-wrap gap-2 pt-6">
                  <Link href={`/tournaments/${e.id}`} className="rounded-md border-2 border-[#1350b6] px-4 py-2.5 text-sm font-black text-[#1350b6] transition hover:bg-[#edf3ff]">Event Details</Link>
                  {e.registration_url && <a href={e.registration_url} target="_blank" rel="noopener noreferrer" className="rounded-md bg-[#ffd22e] px-4 py-2.5 text-sm font-black text-[#071b3a] transition hover:bg-[#ffe36f]">Register Now ↗</a>}
                </div>
              </div>
            </article>;
          })}
        </div>}
    </div>
  </main>;
}
