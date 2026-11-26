import { liveRosterSlideLabels, roundOneSlideType, type RoundOneCourtSlide } from "@/lib/data/tv-roster-slides";

export default function RoundOneCourtDisplay({
  assignments,
  logoUrl,
}: {
  assignments?: RoundOneCourtSlide | null;
  logoUrl?: string | null;
}) {
  const courts = assignments?.courts ?? [];

  return (
    <div className="flex h-full w-full flex-col overflow-auto bg-black px-[2.5vw] py-[2vh] text-white">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b-2 border-yellow-400 pb-[1.5vh]">
        <div className="min-w-0">
          <h1 className="text-[clamp(26px,3.2vw,62px)] font-black leading-tight">
            {liveRosterSlideLabels[roundOneSlideType]}
          </h1>
          <p className="mt-1 text-[clamp(16px,1.7vw,32px)] font-bold text-yellow-400">
            {assignments?.eventName ?? "Event unavailable"}
          </p>
        </div>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="max-h-[9vh] max-w-[18vw] object-contain" />
        )}
      </header>

      {courts.length === 0 ? (
        <p className="m-auto p-8 text-center text-2xl text-zinc-300">Court assignments are pending.</p>
      ) : (
        <ol className="my-[1.5vh] grid flex-1 auto-rows-fr grid-cols-1 gap-[1vh] sm:grid-cols-2 lg:grid-cols-3">
          {courts.map(({ number, teams }) => (
            <li key={number} className="flex flex-col justify-center gap-[0.35vh] rounded-lg border border-zinc-700 bg-zinc-900 px-[1vw] py-[0.5vh]">
              <h2 className="text-[clamp(16px,1.5vw,29px)] font-black leading-tight text-yellow-400">Court {number}</h2>
              <p className="break-words text-[clamp(15px,1.55vw,30px)] font-semibold leading-tight">{teams[0]}</p>
              <p className="break-words text-[clamp(15px,1.55vw,30px)] font-semibold leading-tight">
                <span className="mr-2 text-[0.75em] text-zinc-400">vs.</span>{teams[1]}
              </p>
            </li>
          ))}
        </ol>
      )}
      {courts.length > 0 && (
        <p className="shrink-0 text-[clamp(12px,1.2vw,22px)] text-zinc-300">Follow the event’s court movement rules after Round 1.</p>
      )}
    </div>
  );
}
