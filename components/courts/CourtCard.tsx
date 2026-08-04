type PairingOption = {
  team1: [string, string];
  team2: [string, string];
};

type CourtCardProps = {
  courtNumber: number;
  totalCourts: number;
  players: string[];
  pairings: PairingOption[];
  onSelect: (pairingIndex: number) => void;
};

export function CourtCard({
  courtNumber,
  totalCourts,
  players,
  pairings,
  onSelect,
}: CourtCardProps) {
  return (
    <section className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Current Court
          </p>

          <h2 className="text-xl font-bold text-yellow-400">
            Court {courtNumber}
          </h2>
        </div>

        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300">
          {courtNumber} of {totalCourts}
        </span>
      </header>

      <div className="border-b border-zinc-800 px-4 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Players
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {players.map((player, index) => (
            <div
              key={`${player}-${index}`}
              className="truncate rounded-lg bg-zinc-800 px-3 py-2 text-center text-sm font-semibold text-white"
            >
              {player}
            </div>
          ))}
        </div>
      </div>

      <div className="p-3">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Select Partnership
        </p>

        <div className="grid gap-2">
          {pairings.map((pairing, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onSelect(index)}
              className="grid min-h-16 w-full grid-cols-[28px_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-left transition hover:border-blue-500 hover:bg-zinc-800 focus:border-blue-500"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {index + 1}
              </span>

              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-blue-300">
                  {pairing.team1[0]}
                </span>

                <span className="block truncate text-sm font-semibold text-blue-300">
                  {pairing.team1[1]}
                </span>
              </span>

              <span className="px-1 text-xs font-bold text-zinc-500">
                VS
              </span>

              <span className="min-w-0 text-right">
                <span className="block truncate text-sm font-semibold text-yellow-300">
                  {pairing.team2[0]}
                </span>

                <span className="block truncate text-sm font-semibold text-yellow-300">
                  {pairing.team2[1]}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}