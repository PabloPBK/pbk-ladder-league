"use client";

type RoundControlsProps = {
  currentRound: number;
  roundComplete: boolean;
  isGeneratingNextRound: boolean;
  isCompletingLeagueNight: boolean;
  onGenerateNextRound: () => void;
  onCompleteLeagueNight: () => void;
};

export function RoundControls({
  currentRound,
  roundComplete,
  isGeneratingNextRound,
  isCompletingLeagueNight,
  onGenerateNextRound,
  onCompleteLeagueNight,
}: RoundControlsProps) {
  if (!roundComplete) {
    return (
      <section className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
        <p className="font-semibold text-blue-300">
          Round {currentRound} is in progress.
        </p>

        <p className="mt-1 text-sm text-zinc-300">
          Confirm the pairings in Runner Mode and enter every court result in Match Center to unlock Round {currentRound + 1}.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-green-500/40 bg-green-500/10 p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-green-300">
            Round Complete
          </p>

          <h2 className="mt-1 text-2xl font-bold text-white">
            Round {currentRound} is complete
          </h2>

          <p className="mt-1 text-sm text-zinc-300">
            Generate another ladder round or finish the league night and lock the results.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={isGeneratingNextRound || isCompletingLeagueNight}
            onClick={onGenerateNextRound}
            className="min-h-12 rounded-xl bg-green-600 px-6 py-3 font-bold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {isGeneratingNextRound
              ? `Generating Round ${currentRound + 1}...`
              : `Generate Round ${currentRound + 1}`}
          </button>

          <button
            type="button"
            disabled={isCompletingLeagueNight || isGeneratingNextRound}
            onClick={onCompleteLeagueNight}
            className="min-h-12 rounded-xl bg-purple-600 px-6 py-3 font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {isCompletingLeagueNight
              ? "Finishing League Night..."
              : "Finish League Night"}
          </button>
        </div>
      </div>
    </section>
  );
}