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
  onMovePlayer: (playerId: number, direction: "up" | "down") => void;
  onRatingChange: (playerId: number, rating: number) => void;
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
  onMovePlayer,
  onRatingChange,
}: PlayerCheckInProps) {
  const checkedInPlayers = players.filter((player) => player.checkedIn);
  const checkedInCount = checkedInPlayers.length;
  const courtCount = Math.floor(checkedInCount / 4);
  const remainingPlayers = checkedInCount % 4;

  return (
    <>
      {isLoadingPlayers && <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-blue-300">Loading players from Supabase...</div>}
      {playerLoadError && <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">{playerLoadError}</div>}

      <section className="mb-6 grid gap-3 sm:grid-cols-3 no-print">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs uppercase tracking-wide text-zinc-400">Checked In</p><p className="mt-1 text-3xl font-bold text-white">{checkedInCount}</p></div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs uppercase tracking-wide text-zinc-400">Courts Needed</p><p className="mt-1 text-3xl font-bold text-blue-400">{courtCount}</p></div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs uppercase tracking-wide text-zinc-400">Player Count</p><p className={`mt-2 font-semibold ${remainingPlayers === 0 ? "text-green-400" : "text-yellow-400"}`}>{remainingPlayers === 0 ? checkedInCount >= 4 ? "Ready" : "Need at least 4" : `${remainingPlayers} player${remainingPlayers === 1 ? "" : "s"} over a full court`}</p></div>
      </section>

      <section className="mb-5 flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <div>
          <h2 className="text-xl font-bold text-white">Player Setup & Court Order</h2>
          <p className="mt-1 text-sm text-zinc-400">Check players in, adjust tonight&apos;s rating if needed, and move players up/down. Every four checked-in players form the next court.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={checkedInCount < 4 || remainingPlayers !== 0} onClick={() => window.print()} className="min-h-12 rounded-xl border border-zinc-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Print Court List</button>
          <button type="button" disabled={!canGenerateFirstRound || roundIsGenerated} onClick={onGenerateFirstRound} className="min-h-12 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400">{roundIsGenerated ? `Round ${currentRound} Generated ✓` : isGenerating ? "Saving Round 1..." : "Generate 1st Round"}</button>
        </div>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 no-print">
        {players.map((player, index) => (
          <article key={player.id} className={`rounded-xl border p-4 ${player.checkedIn ? "border-green-500/50 bg-green-500/10" : "border-zinc-800 bg-zinc-900"}`}>
            <div className="flex items-start justify-between gap-3">
              <button type="button" disabled={roundIsGenerated} onClick={() => onTogglePlayer(player.id)} className="min-w-0 flex-1 text-left disabled:cursor-not-allowed">
                <h3 className="truncate font-semibold text-white">{player.name}</h3>
                <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${player.checkedIn ? "bg-green-500/20 text-green-400" : "bg-zinc-800 text-zinc-400"}`}>{player.checkedIn ? "Checked In" : "Absent"}</span>
              </button>
              {player.checkedIn && <span className="rounded-lg bg-blue-500/15 px-2 py-1 text-xs font-bold text-blue-300">#{checkedInPlayers.findIndex((p) => p.id === player.id) + 1}</span>}
            </div>

            {player.checkedIn && !roundIsGenerated && (
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2 border-t border-zinc-800 pt-3">
                <label>
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Tonight&apos;s Rating</span>
                  <input type="number" min="0" max="8" step="0.01" value={player.dupr} onChange={(event) => onRatingChange(player.id, Math.max(0, Math.min(8, Number(event.target.value) || 0)))} className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white" />
                </label>
                <div>
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Order</span>
                  <div className="flex gap-1">
                    <button type="button" disabled={index === 0} onClick={() => onMovePlayer(player.id, "up")} className="h-10 rounded-lg border border-zinc-700 px-3 text-white disabled:opacity-30">↑</button>
                    <button type="button" disabled={index === players.length - 1} onClick={() => onMovePlayer(player.id, "down")} className="h-10 rounded-lg border border-zinc-700 px-3 text-white disabled:opacity-30">↓</button>
                  </div>
                </div>
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="court-assignment-print hidden print:block">
        <h1>PBK Ladder League — Court Assignments</h1>
        <p>{checkedInCount} players • {courtCount} courts</p>
        <div className="print-court-grid">
          {Array.from({ length: courtCount }, (_, courtIndex) => {
            const courtPlayers = checkedInPlayers.slice(courtIndex * 4, courtIndex * 4 + 4);
            return (
              <div key={courtIndex} className="print-court-card">
                <h2>Court {courtIndex + 1}</h2>
                <ol>{courtPlayers.map((player) => <li key={player.id}><strong>{player.name}</strong><span>{player.dupr > 0 ? player.dupr.toFixed(2) : "Unrated"}</span></li>)}</ol>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
