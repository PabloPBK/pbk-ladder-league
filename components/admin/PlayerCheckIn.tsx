import type { Player } from "@/types/player";

type PlayerCheckInProps = {
  players: Player[];
  currentRound: number;
  roundIsGenerated: boolean;
  isLoadingPlayers: boolean;
  playerLoadError: string;
  canGenerateFirstRound: boolean;
  isGenerating: boolean;

  onTogglePlayer: (playerId: number) => void;
  onGenerateFirstRound: () => void;
};

export function PlayerCheckIn({
  players,
  currentRound,
  roundIsGenerated,
  isLoadingPlayers,
  playerLoadError,
  canGenerateFirstRound,
  isGenerating,
  onTogglePlayer,
  onGenerateFirstRound,
}: PlayerCheckInProps) {
  const checkedInPlayers = players.filter(
    (player) => player.checkedIn,
  );

  const checkedInCount = checkedInPlayers.length;

  const courtCount = Math.floor(
    checkedInCount / 4,
  );

  const remainingPlayers =
    checkedInCount % 4;

  return (
    <>
      {isLoadingPlayers && (
        <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-blue-300">
          Loading players from Supabase...
        </div>
      )}

      {playerLoadError && (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">
          {playerLoadError}
        </div>
      )}

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-400">
            Checked In
          </p>

          <p className="mt-1 text-3xl font-bold text-white">
            {checkedInCount}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-400">
            Courts Needed
          </p>

          <p className="mt-1 text-3xl font-bold text-blue-400">
            {courtCount}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-400">
            Player Count
          </p>

          <p
            className={`mt-2 font-semibold ${
              remainingPlayers === 0
                ? "text-green-400"
                : "text-yellow-400"
            }`}
          >
            {remainingPlayers === 0
              ? checkedInCount >= 4
                ? "Ready"
                : "Need at least 4"
              : `${remainingPlayers} player${
                  remainingPlayers === 1
                    ? ""
                    : "s"
                } over a full court`}
          </p>
        </div>
      </section>

      <section className="mb-5 flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            Registered Players
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
            {roundIsGenerated
              ? `Round ${currentRound} is saved. Player check-ins are locked.`
              : "Tap a player to check them in or out."}
          </p>
        </div>

        <button
          type="button"
          disabled={
            !canGenerateFirstRound ||
            roundIsGenerated
          }
          onClick={onGenerateFirstRound}
          className="min-h-12 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {roundIsGenerated
            ? `Round ${currentRound} Generated ✓`
            : isGenerating
              ? "Saving Round 1..."
              : "Generate 1st Round"}
        </button>
      </section>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            disabled={roundIsGenerated}
            onClick={() =>
              onTogglePlayer(player.id)
            }
            className={`flex min-h-16 items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
              player.checkedIn
                ? "border-green-500/50 bg-green-500/10"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
            } ${
              roundIsGenerated
                ? "cursor-not-allowed opacity-70"
                : ""
            }`}
          >
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-white">
                {player.name}
              </h3>

              <p className="mt-0.5 text-sm text-zinc-400">
                DUPR {player.dupr.toFixed(2)}
              </p>
            </div>

            <span
              className={`ml-3 shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                player.checkedIn
                  ? "bg-green-500/20 text-green-400"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {player.checkedIn
                ? "Checked In"
                : "Absent"}
            </span>
          </button>
        ))}
      </section>
    </>
  );
}