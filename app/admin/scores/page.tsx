"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { useLeague } from "@/components/providers/LeagueProvider";
import {
  getMatchCenter,
  saveCourtScore,
  type MatchCenterData,
} from "@/lib/data/matchCenter";

type ScoreDraft = {
  team1Score: string;
  team2Score: string;
};

type ScoreDrafts = Record<number, ScoreDraft>;

export default function ScoresPage() {
  const { activeEvent } = useLeague();

  const [matchCenter, setMatchCenter] =
    useState<MatchCenterData | null>(null);

  const [scoreDrafts, setScoreDrafts] =
    useState<ScoreDrafts>({});

  const [isLoading, setIsLoading] =
    useState(false);

  const [
    savingCourtNumber,
    setSavingCourtNumber,
  ] = useState<number | null>(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  const eventId = activeEvent?.id ?? "";

  const loadMatchCenter = useCallback(
    async (showLoading = false) => {
      if (!eventId) {
        return;
      }

      try {
        if (showLoading) {
          setIsLoading(true);
        }

        const data =
          await getMatchCenter(eventId);

        setMatchCenter(data);
        setErrorMessage("");

        setScoreDrafts((currentDrafts) => {
          const nextDrafts = {
            ...currentDrafts,
          };

          data.courts.forEach((court) => {
            if (
              !nextDrafts[court.courtNumber] ||
              court.complete
            ) {
              nextDrafts[court.courtNumber] = {
                team1Score:
                  court.team1Score === null
                    ? ""
                    : String(court.team1Score),
                team2Score:
                  court.team2Score === null
                    ? ""
                    : String(court.team2Score),
              };
            }
          });

          return nextDrafts;
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load Match Center.",
        );
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [eventId],
  );

  useEffect(() => {
    if (!eventId) {
      return;
    }

    void loadMatchCenter(true);

    const intervalId = window.setInterval(() => {
      void loadMatchCenter(false);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [eventId, loadMatchCenter]);

  function updateScoreDraft(
    courtNumber: number,
    field: keyof ScoreDraft,
    value: string,
  ) {
    setScoreDrafts((currentDrafts) => ({
      ...currentDrafts,
      [courtNumber]: {
        team1Score:
          currentDrafts[courtNumber]
            ?.team1Score ?? "",
        team2Score:
          currentDrafts[courtNumber]
            ?.team2Score ?? "",
        [field]: value,
      },
    }));
  }

  async function handleSaveScore(
    courtNumber: number,
  ) {
    if (!eventId) {
      return;
    }

    const draft =
      scoreDrafts[courtNumber];

    if (
      draft?.team1Score === "" ||
      draft?.team2Score === ""
    ) {
      setErrorMessage(
        `Enter both scores for Court ${courtNumber}.`,
      );
      return;
    }

    const team1Score = Number(
      draft.team1Score,
    );

    const team2Score = Number(
      draft.team2Score,
    );

    try {
      setSavingCourtNumber(courtNumber);
      setErrorMessage("");

      await saveCourtScore({
        eventId,
        courtNumber,
        team1Score,
        team2Score,
      });

      await loadMatchCenter(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save the court score.",
      );
    } finally {
      setSavingCourtNumber(null);
    }
  }

  if (!activeEvent) {
    return (
      <AppLayout
        title="Match Center"
        description="Enter scores and watch the standings update live."
      >
        <div className="mx-auto max-w-lg rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-6 text-center">
          <h2 className="text-xl font-bold text-yellow-300">
            No Active League Event
          </h2>

          <p className="mt-2 text-sm text-zinc-300">
            Open the Admin page and restore the
            current league event first.
          </p>

          <Link
            href="/admin"
            className="mt-5 flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white"
          >
            Return to Admin
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (isLoading && !matchCenter) {
    return (
      <AppLayout
        title="Match Center"
        description="Loading the current round."
      >
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-6 text-center text-blue-300">
          Loading scores and standings...
        </div>
      </AppLayout>
    );
  }

  const roundNumber =
    matchCenter?.round.round_number ?? 1;

  return (
    <AppLayout
      title={`Match Center — Round ${roundNumber}`}
      description="Compact score entry with live standings."
    >
      <div className="mx-auto max-w-[1500px]">
        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {matchCenter?.roundComplete && (
          <div className="mb-4 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-300">
            Round {roundNumber} is complete.
            Every court has a saved score.
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Court Scores
                </h2>

                <p className="text-sm text-zinc-400">
                  Scores save directly to Supabase.
                </p>
              </div>

              <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-300">
                {matchCenter?.courts.length ?? 0}{" "}
                courts
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {matchCenter?.courts.map((court) => {
                const draft =
                  scoreDrafts[court.courtNumber] ?? {
                    team1Score: "",
                    team2Score: "",
                  };

                const isSaving =
                  savingCourtNumber ===
                  court.courtNumber;

                const teamsReady =
                  court.team1.length === 2 &&
                  court.team2.length === 2;

                return (
                  <article
                    key={court.databaseCourtId}
                    className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
                  >
                    <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
                      <h3 className="font-bold text-yellow-400">
                        Court {court.courtNumber}
                      </h3>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          court.complete
                            ? "bg-green-500/15 text-green-300"
                            : "bg-blue-500/15 text-blue-300"
                        }`}
                      >
                        {court.complete
                          ? "Complete"
                          : "In Progress"}
                      </span>
                    </header>

                    {!teamsReady ? (
                      <div className="px-4 py-5 text-center text-sm text-yellow-300">
                        Confirm teams in Walking Mode.
                      </div>
                    ) : (
                      <div className="p-3">
                        <div className="grid grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] items-center gap-2">
                          <div className="min-w-0 rounded-lg bg-blue-500/10 px-3 py-2">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-blue-300">
                              Team 1
                            </p>

                            {court.team1.map((player) => (
                              <p
                                key={player.playerId}
                                className="truncate text-sm font-semibold text-white"
                              >
                                {player.name}
                              </p>
                            ))}
                          </div>

                          <div className="text-center text-xs font-bold text-zinc-500">
                            VS
                          </div>

                          <div className="min-w-0 rounded-lg bg-yellow-500/10 px-3 py-2">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-yellow-300">
                              Team 2
                            </p>

                            {court.team2.map((player) => (
                              <p
                                key={player.playerId}
                                className="truncate text-sm font-semibold text-white"
                              >
                                {player.name}
                              </p>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2">
                          <label className="block">
                            <span className="mb-1 block text-xs text-zinc-400">
                              Team 1
                            </span>

                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={draft.team1Score}
                              onChange={(event) =>
                                updateScoreDraft(
                                  court.courtNumber,
                                  "team1Score",
                                  event.target.value,
                                )
                              }
                              className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-center text-xl font-bold text-white outline-none focus:border-blue-500"
                            />
                          </label>

                          <span className="pb-2 text-sm font-bold text-zinc-500">
                            —
                          </span>

                          <label className="block">
                            <span className="mb-1 block text-xs text-zinc-400">
                              Team 2
                            </span>

                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={draft.team2Score}
                              onChange={(event) =>
                                updateScoreDraft(
                                  court.courtNumber,
                                  "team2Score",
                                  event.target.value,
                                )
                              }
                              className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-center text-xl font-bold text-white outline-none focus:border-blue-500"
                            />
                          </label>

                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              void handleSaveScore(
                                court.courtNumber,
                              )
                            }
                            className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                          >
                            {isSaving
                              ? "Saving..."
                              : court.complete
                                ? "Update"
                                : "Save"}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section>
            <div className="sticky top-4 rounded-xl border border-zinc-800 bg-zinc-900">
              <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <div>
                  <h2 className="font-bold text-white">
                    Live Standings
                  </h2>

                  <p className="text-xs text-zinc-400">
                    Refreshes every 3 seconds
                  </p>
                </div>

                <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-300">
                  Live
                </span>
              </header>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400">
                      <th className="px-2 py-2 text-left">
                        #
                      </th>

                      <th className="px-2 py-2 text-left">
                        Player
                      </th>

                      <th className="px-2 py-2 text-center">
                        W
                      </th>

                      <th className="px-2 py-2 text-center">
                        L
                      </th>

                      <th className="px-2 py-2 text-center">
                        PF
                      </th>

                      <th className="px-2 py-2 text-center">
                        PA
                      </th>

                      <th className="px-2 py-2 text-right">
                        +/-
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {matchCenter?.standings.map(
                      (standing) => (
                        <tr
                          key={standing.playerId}
                          className="border-b border-zinc-800 last:border-0"
                        >
                          <td className="px-2 py-2 font-bold text-yellow-400">
                            {standing.rank}
                          </td>

                          <td className="max-w-32 truncate px-2 py-2 font-semibold text-white">
                            {standing.name}
                          </td>

                          <td className="px-2 py-2 text-center text-green-400">
                            {standing.wins}
                          </td>

                          <td className="px-2 py-2 text-center text-red-400">
                            {standing.losses}
                          </td>

                          <td className="px-2 py-2 text-center">
                            {standing.pointsFor}
                          </td>

                          <td className="px-2 py-2 text-center">
                            {standing.pointsAgainst}
                          </td>

                          <td
                            className={`px-2 py-2 text-right font-semibold ${
                              standing.pointDifferential >
                              0
                                ? "text-green-400"
                                : standing.pointDifferential <
                                    0
                                  ? "text-red-400"
                                  : "text-zinc-400"
                            }`}
                          >
                            {standing.pointDifferential >
                            0
                              ? "+"
                              : ""}
                            {
                              standing.pointDifferential
                            }
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}