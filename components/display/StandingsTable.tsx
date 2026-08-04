import { SeasonStanding } from "@/lib/server/statistics";

type StandingsTableProps = {
  standings: SeasonStanding[];
};

function medal(rank: number) {
  switch (rank) {
    case 1:
      return "🥇";
    case 2:
      return "🥈";
    case 3:
      return "🥉";
    default:
      return rank;
  }
}

export function StandingsTable({
  standings,
}: StandingsTableProps) {
  if (standings.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center text-xl text-zinc-400">
        No completed league nights for this season.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
      <table className="w-full">
        <thead className="bg-zinc-950">
          <tr className="text-lg uppercase tracking-wider text-zinc-400">
            <th className="px-6 py-5">Rank</th>
            <th className="px-6 py-5 text-left">Player</th>
            <th className="px-6 py-5 text-center">LN</th>
            <th className="px-6 py-5 text-center">W</th>
            <th className="px-6 py-5 text-center">L</th>
            <th className="px-6 py-5 text-center">Win %</th>
            <th className="px-6 py-5 text-center">+/-</th>
            <th className="px-6 py-5 text-center">DUPR</th>
          </tr>
        </thead>

        <tbody>
          {standings.map((player, index) => (
            <tr
              key={player.playerId}
              className={`border-t border-zinc-800 text-2xl ${
                index === 0
                  ? "bg-yellow-500/15"
                  : index === 1
                  ? "bg-zinc-700/20"
                  : index === 2
                  ? "bg-amber-700/15"
                  : "hover:bg-zinc-800/40"
              }`}
            >
              <td className="px-6 py-5 text-center font-black">
                {medal(player.rank)}
              </td>

              <td className="px-6 py-5 font-bold">
                {player.name}
              </td>

              <td className="px-6 py-5 text-center">
                {player.leagueNights}
              </td>

              <td className="px-6 py-5 text-center font-bold text-green-400">
                {player.wins}
              </td>

              <td className="px-6 py-5 text-center font-bold text-red-400">
                {player.losses}
              </td>

              <td className="px-6 py-5 text-center">
                {player.winPercentage.toFixed(1)}%
              </td>

              <td className="px-6 py-5 text-center font-bold">
                {player.pointDifferential > 0
                  ? `+${player.pointDifferential}`
                  : player.pointDifferential}
              </td>

              <td className="px-6 py-5 text-center">
                {player.dupr.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}