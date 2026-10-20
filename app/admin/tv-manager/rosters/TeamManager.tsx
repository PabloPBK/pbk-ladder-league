"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type RatingMethod = "dupr_doubles" | "dupr_singles" | "club_rating";

type Player = {
  id: string;
  full_name: string;
  club_rating: number | null;
  dupr_doubles: number | null;
  dupr_singles: number | null;
};

type Team = {
  id: string;
  player1: Player;
  player2: Player;
  combined_rating: number | null;
  created_at: string;
};

type TeamResponse = {
  event_id: string;
  event_type: "partnered" | "individual";
  rating_method: RatingMethod;
  teams: Team[];
  free_agents: Player[];
};

type Props = {
  eventId: string;
  eventName: string;
  eventType: "partnered" | "individual";
  ratingMethod: RatingMethod;
  playersVersion?: number;
};

const ratingNames: Record<RatingMethod, string> = {
  dupr_doubles: "DUPR Doubles",
  dupr_singles: "DUPR Singles",
  club_rating: "Club Rating",
};

function ratingLabel(value: number | null | undefined) {
  return value == null ? "NR" : Number(value).toFixed(2);
}

const selectClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white";

export default function TeamManager({
  eventId,
  eventName,
  eventType,
  ratingMethod,
  playersVersion = 0,
}: Props) {
  const [data, setData] = useState<TeamResponse | null>(null);
  const [player1Id, setPlayer1Id] = useState("");
  const [player2Id, setPlayer2Id] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadTeams = useCallback(async () => {
    if (!eventId || eventType !== "partnered") {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/roster-teams?event_id=${encodeURIComponent(eventId)}`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load teams");
      }

      setData(result as TeamResponse);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load teams"
      );
    } finally {
      setLoading(false);
    }
  }, [eventId, eventType]);

  useEffect(() => {
    setPlayer1Id("");
    setPlayer2Id("");
    setData(null);
    setError("");
    setSuccess("");
  }, [eventId]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams, ratingMethod, playersVersion]);

  async function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !eventId ||
      !player1Id ||
      !player2Id ||
      player1Id === player2Id ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/roster-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          player1_id: player1Id,
          player2_id: player2Id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to create team");
      }

      setPlayer1Id("");
      setPlayer2Id("");
      await loadTeams();
      setSuccess("Team created successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create team"
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeTeam(team: Team) {
    const confirmed = window.confirm(
      `Remove the partnership between ${team.player1.full_name} and ${team.player2.full_name}?\n\nBoth players will return to Free Agents. Their registrations and ratings will be preserved.`
    );

    if (!confirmed) return;

    setRemovingId(team.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/roster-teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          team_id: team.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to remove partnership");
      }

      await loadTeams();
      setSuccess("Partnership removed. Both players are now Free Agents.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove partnership"
      );
    } finally {
      setRemovingId(null);
    }
  }

  if (eventType !== "partnered") {
    return null;
  }

  const teams = data?.teams ?? [];
  const freeAgents = data?.free_agents ?? [];
  const method = data?.rating_method ?? ratingMethod;

  const availableSecondPlayers = freeAgents.filter(
    (player) => player.id !== player1Id
  );

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-yellow-400">
            Teams & Free Agents
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            {eventName} — ranked using {ratingNames[method]}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadTeams()}
          disabled={loading || saving || removingId !== null}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh Teams"}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          role="status"
          className="mt-5 rounded-lg border border-green-800 bg-green-950 p-3 text-sm text-green-200"
        >
          {success}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-4">
          <p className="text-sm text-zinc-400">Teams</p>
          <p className="mt-2 text-3xl font-black text-white">
            {teams.length}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-4">
          <p className="text-sm text-zinc-400">Free Agents</p>
          <p className="mt-2 text-3xl font-black text-white">
            {freeAgents.length}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-4">
          <p className="text-sm text-zinc-400">Total Players</p>
          <p className="mt-2 text-3xl font-black text-white">
            {teams.length * 2 + freeAgents.length}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-zinc-700 bg-zinc-950 p-5">
        <h3 className="text-lg font-bold text-white">
          Create a Team
        </h3>
        <p className="mt-2 text-sm text-zinc-400">
          Choose two unassigned players. Each player can belong to only
          one team at a time.
        </p>

        <form onSubmit={createTeam} className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="team-player-1"
                className="mb-2 block text-sm font-semibold text-white"
              >
                First Player
              </label>
              <select
                id="team-player-1"
                value={player1Id}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setPlayer1Id(nextId);

                  if (nextId === player2Id) {
                    setPlayer2Id("");
                  }
                }}
                disabled={loading || saving}
                className={selectClass}
              >
                <option value="">Select first player</option>
                {freeAgents.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.full_name} —{" "}
                    {ratingLabel(player[method])}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="team-player-2"
                className="mb-2 block text-sm font-semibold text-white"
              >
                Second Player
              </label>
              <select
                id="team-player-2"
                value={player2Id}
                onChange={(e) => setPlayer2Id(e.target.value)}
                disabled={loading || saving}
                className={selectClass}
              >
                <option value="">Select second player</option>
                {availableSecondPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.full_name} —{" "}
                    {ratingLabel(player[method])}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={
              loading ||
              saving ||
              freeAgents.length < 2 ||
              !player1Id ||
              !player2Id ||
              player1Id === player2Id
            }
            className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Creating Team..." : "+ Create Team"}
          </button>
        </form>

        {!loading && freeAgents.length < 2 && (
          <p className="mt-4 text-sm text-zinc-400">
            At least two Free Agents are required to create a team.
          </p>
        )}
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-bold text-white">
          Ranked Teams ({teams.length})
        </h3>

        <p className="mt-2 text-sm text-zinc-400">
          Teams are ranked by combined {ratingNames[method]}.
          If either player has no rating, the team is NR.
        </p>

        {loading ? (
          <p className="mt-4 text-zinc-400">Loading teams...</p>
        ) : teams.length === 0 ? (
          <p className="mt-4 text-zinc-400">
            No teams created yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="border-b border-zinc-700 text-zinc-400">
                <tr>
                  <th className="py-3 pr-3">Rank</th>
                  <th className="px-3">Player 1</th>
                  <th className="px-3">Player 2</th>
                  <th className="px-3">Combined Rating</th>
                  <th className="pl-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {teams.map((team, index) => (
                  <tr
                    key={team.id}
                    className="border-b border-zinc-800"
                  >
                    <td className="py-4 pr-3 font-bold text-yellow-400">
                      {team.combined_rating == null
                        ? "NR"
                        : index + 1}
                    </td>

                    <td className="px-3 font-semibold text-white">
                      {team.player1.full_name}
                      <span className="ml-2 text-xs font-normal text-zinc-400">
                        ({ratingLabel(team.player1[method])})
                      </span>
                    </td>

                    <td className="px-3 font-semibold text-white">
                      {team.player2.full_name}
                      <span className="ml-2 text-xs font-normal text-zinc-400">
                        ({ratingLabel(team.player2[method])})
                      </span>
                    </td>

                    <td className="px-3 font-bold text-white">
                      {ratingLabel(team.combined_rating)}
                    </td>

                    <td className="pl-3">
                      <button
                        type="button"
                        onClick={() => void removeTeam(team)}
                        disabled={removingId !== null || saving}
                        className="font-semibold text-red-400 hover:underline disabled:opacity-50"
                      >
                        {removingId === team.id
                          ? "Removing..."
                          : "Remove Partnership"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-bold text-white">
          Free Agents ({freeAgents.length})
        </h3>

        <p className="mt-2 text-sm text-zinc-400">
          Registered players who have not been assigned a partner.
        </p>

        {loading ? (
          <p className="mt-4 text-zinc-400">Loading Free Agents...</p>
        ) : freeAgents.length === 0 ? (
          <p className="mt-4 text-zinc-400">
            No Free Agents remaining.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[450px] text-left text-sm">
              <thead className="border-b border-zinc-700 text-zinc-400">
                <tr>
                  <th className="py-3 pr-3">Player</th>
                  <th className="px-3">
                    {ratingNames[method]}
                  </th>
                  <th className="pl-3">Status</th>
                </tr>
              </thead>

              <tbody>
                {freeAgents.map((player) => (
                  <tr
                    key={player.id}
                    className="border-b border-zinc-800"
                  >
                    <td className="py-3 pr-3 font-semibold text-white">
                      {player.full_name}
                    </td>
                    <td className="px-3">
                      {ratingLabel(player[method])}
                    </td>
                    <td className="pl-3 text-yellow-400">
                      Free Agent
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
