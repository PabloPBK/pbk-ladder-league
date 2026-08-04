"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { useLeague } from "@/components/providers/LeagueProvider";
import {
  getCurrentRound,
  type SavedRoundCourt,
} from "@/lib/data/currentRound";
import {
  getMatchCenter,
  saveCourtScore,
  type MatchCenterData,
} from "@/lib/data/matchCenter";
import { saveCourtPairing } from "@/lib/data/pairings";
import type { GeneratedCourt } from "@/types/court";
import type { Player } from "@/types/player";

type ScoreDraft = {
  team1Score: string;
  team2Score: string;
};

type ScoreDrafts = Record<number, ScoreDraft>;

function convertSavedCourt(
  savedCourt: SavedRoundCourt,
  runtimePlayerIdByDatabaseId: Map<string, number>,
): GeneratedCourt {
  if (savedCourt.players.length !== 4) {
    throw new Error(
      `Court ${savedCourt.courtNumber} must contain exactly four players.`,
    );
  }

  const convertedPlayers = savedCourt.players.map(
    (savedPlayer): Player => {
      const runtimeId =
        runtimePlayerIdByDatabaseId.get(
          savedPlayer.databasePlayerId,
        );

      if (!runtimeId) {
        throw new Error(
          `No runtime player ID was found for ${savedPlayer.name}.`,
        );
      }

      return {
        id: runtimeId,
        name: savedPlayer.name,
        dupr: Number(savedPlayer.dupr),
        checkedIn: true,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDifferential: 0,
      };
    },
  );

  const [playerA, playerB, playerC, playerD] =
    convertedPlayers;

  if (
    !playerA ||
    !playerB ||
    !playerC ||
    !playerD
  ) {
    throw new Error(
      `Court ${savedCourt.courtNumber} has an incomplete player assignment.`,
    );
  }

  return {
    id: savedCourt.courtNumber,
    players: [
      playerA,
      playerB,
      playerC,
      playerD,
    ],
  };
}

function createPairingOptions(
  court: GeneratedCourt,
) {
  const [a, b, c, d] = court.players;

  return [
    {
      label: "Option 1",
      team1: [a, b] as [Player, Player],
      team2: [c, d] as [Player, Player],
    },
    {
      label: "Option 2",
      team1: [a, c] as [Player, Player],
      team2: [b, d] as [Player, Player],
    },
    {
      label: "Option 3",
      team1: [a, d] as [Player, Player],
      team2: [b, c] as [Player, Player],
    },
  ];
}

export default function WalkingPage() {
  const {
    players,
    activeEvent,
    courts,
    setCourts,
    currentRound,
    courtPairings,
    confirmCourtPairing,
    playerDatabaseIds,
    isLoadingPlayers,
  } = useLeague();

  const [isLoadingRound, setIsLoadingRound] =
    useState(false);

  const [savingCourtNumber, setSavingCourtNumber] =
    useState<number | null>(null);

  const [savingScoreCourtNumber, setSavingScoreCourtNumber] =
    useState<number | null>(null);

  const [loadError, setLoadError] =
    useState("");

  const [actionError, setActionError] =
    useState("");

  const [matchCenter, setMatchCenter] =
    useState<MatchCenterData | null>(null);

  const [scoreDrafts, setScoreDrafts] =
    useState<ScoreDrafts>({});

  const runtimePlayerIdByDatabaseId =
    useMemo(() => {
      const idMap = new Map<string, number>();

      Object.entries(playerDatabaseIds).forEach(
        ([runtimeId, databaseId]) => {
          idMap.set(
            databaseId,
            Number(runtimeId),
          );
        },
      );

      return idMap;
    }, [playerDatabaseIds]);

  const eventId = activeEvent?.id ?? "";

  const loadMatchCenter = useCallback(
    async () => {
      if (!eventId) {
        return;
      }

      try {
        const data =
          await getMatchCenter(eventId);

        setMatchCenter(data);

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
        console.error(
          "Unable to refresh Runner Mode:",
          error,
        );
      }
    },
    [eventId],
  );

  useEffect(() => {
    if (
      !activeEvent ||
      isLoadingPlayers ||
      players.length === 0
    ) {
      return;
    }

    const currentEventId = activeEvent.id;
    let cancelled = false;

    async function loadSavedRound() {
      try {
        setIsLoadingRound(true);
        setLoadError("");

        const savedRound =
          await getCurrentRound(currentEventId);

        if (cancelled) {
          return;
        }

        const generatedCourts =
          savedRound.courts.map((savedCourt) =>
            convertSavedCourt(
              savedCourt,
              runtimePlayerIdByDatabaseId,
            ),
          );

        setCourts(generatedCourts);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load the saved round.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRound(false);
        }
      }
    }

    void loadSavedRound();

    return () => {
      cancelled = true;
    };
  }, [
    activeEvent,
    isLoadingPlayers,
    players.length,
    runtimePlayerIdByDatabaseId,
    setCourts,
  ]);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    void loadMatchCenter();

    const intervalId = window.setInterval(() => {
      void loadMatchCenter();
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [eventId, loadMatchCenter]);

  async function handlePairingSelect(
    court: GeneratedCourt,
    pairingIndex: number,
  ) {
    if (!activeEvent || savingCourtNumber !== null) {
      return;
    }

    try {
      setSavingCourtNumber(court.id);
      setActionError("");

      await saveCourtPairing({
        eventId: activeEvent.id,
        courtNumber: court.id,
        pairingIndex,
      });

      confirmCourtPairing(
        court.id,
        pairingIndex,
      );

      await loadMatchCenter();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : `Unable to save Court ${court.id} pairing.`,
      );
    } finally {
      setSavingCourtNumber(null);
    }
  }

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
    if (
      !activeEvent ||
      savingScoreCourtNumber !== null
    ) {
      return;
    }

    const draft = scoreDrafts[courtNumber];

    if (
      !draft ||
      draft.team1Score === "" ||
      draft.team2Score === ""
    ) {
      setActionError(
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

    if (
      !Number.isInteger(team1Score) ||
      !Number.isInteger(team2Score) ||
      team1Score < 0 ||
      team2Score < 0 ||
      team1Score === team2Score
    ) {
      setActionError(
        `Court ${courtNumber} needs two non-negative whole-number scores and cannot end in a tie.`,
      );
      return;
    }

    try {
      setSavingScoreCourtNumber(courtNumber);
      setActionError("");

      await saveCourtScore({
        eventId: activeEvent.id,
        courtNumber,
        team1Score,
        team2Score,
      });

      await loadMatchCenter();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : `Unable to save Court ${courtNumber} score.`,
      );
    } finally {
      setSavingScoreCourtNumber(null);
    }
  }

  if (!activeEvent) {
    return (
      <AppLayout
        title="Runner Mode"
        description="Confirm pairings and enter court scores."
      >
        <div className="mx-auto max-w-md rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-5 text-center">
          <h2 className="text-xl font-bold text-yellow-300">
            No Active League Event
          </h2>

          <p className="mt-2 text-sm text-zinc-300">
            Start or resume a league night from Admin.
          </p>

          <Link
            href="/admin"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Open Admin
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (isLoadingPlayers || isLoadingRound) {
    return (
      <AppLayout
        title="Runner Mode"
        description={`Loading Round ${currentRound}.`}
      >
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-center text-sm text-blue-300">
          Loading saved court assignments...
        </div>
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout
        title="Runner Mode"
        description="Unable to load this round."
      >
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-center text-red-300">
          {loadError}
        </div>
      </AppLayout>
    );
  }

  const confirmedCount = courts.filter(
    (court) => courtPairings[court.id],
  ).length;

  const completedCount =
    matchCenter?.courts.filter(
      (court) => court.complete,
    ).length ?? 0;

  return (
    <AppLayout
      title={`Round ${currentRound} Runner Mode`}
      description="Confirm pairings and enter scores from one compact screen."
    >
      <div className="mx-auto max-w-[1500px]">
        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Courts
            </p>

            <p className="mt-1 text-2xl font-black text-white">
              {courts.length}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Pairings Confirmed
            </p>

            <p className="mt-1 text-2xl font-black text-blue-300">
              {confirmedCount}/{courts.length}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Scores Complete
            </p>

            <p className="mt-1 text-2xl font-black text-green-300">
              {completedCount}/{courts.length}
            </p>
          </div>
        </section>

        {actionError && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {actionError}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {courts.map((court) => {
            const confirmedPairing =
              courtPairings[court.id];

            const savedCourt =
              matchCenter?.courts.find(
                (currentCourt) =>
                  currentCourt.courtNumber ===
                  court.id,
              );

            const scoreDraft =
              scoreDrafts[court.id] ?? {
                team1Score: "",
                team2Score: "",
              };

            if (!confirmedPairing) {
              const pairingOptions =
                createPairingOptions(court);

              return (
                <article
                  key={court.id}
                  className="overflow-hidden rounded-xl border border-yellow-500/30 bg-zinc-900"
                >
                  <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                    <h2 className="font-bold text-yellow-400">
                      Court {court.id}
                    </h2>

                    <span className="rounded-full bg-yellow-500/15 px-2.5 py-1 text-xs font-semibold text-yellow-300">
                      Choose Pairing
                    </span>
                  </header>

                  <div className="grid grid-cols-2 gap-2 border-b border-zinc-800 p-3">
                    {court.players.map((player) => (
                      <div
                        key={player.id}
                        className="truncate rounded-lg bg-zinc-800 px-3 py-2 text-center text-sm font-semibold"
                      >
                        {player.name}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 p-3">
                    {pairingOptions.map(
                      (option, pairingIndex) => (
                        <button
                          key={option.label}
                          type="button"
                          disabled={
                            savingCourtNumber !== null
                          }
                          onClick={() =>
                            void handlePairingSelect(
                              court,
                              pairingIndex,
                            )
                          }
                          className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-left transition hover:border-blue-500 disabled:opacity-60"
                        >
                          <span className="min-w-0 text-sm">
                            <span className="block truncate font-semibold text-blue-300">
                              {option.team1[0].name}
                            </span>
                            <span className="block truncate font-semibold text-blue-300">
                              {option.team1[1].name}
                            </span>
                          </span>

                          <span className="text-xs font-black text-zinc-500">
                            VS
                          </span>

                          <span className="min-w-0 text-right text-sm">
                            <span className="block truncate font-semibold text-yellow-300">
                              {option.team2[0].name}
                            </span>
                            <span className="block truncate font-semibold text-yellow-300">
                              {option.team2[1].name}
                            </span>
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                </article>
              );
            }

            const teamsReady =
              savedCourt?.team1.length === 2 &&
              savedCourt?.team2.length === 2;

            return (
              <article
                key={court.id}
                className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
              >
                <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                  <h2 className="font-bold text-yellow-400">
                    Court {court.id}
                  </h2>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      savedCourt?.complete
                        ? "bg-green-500/15 text-green-300"
                        : "bg-blue-500/15 text-blue-300"
                    }`}
                  >
                    {savedCourt?.complete
                      ? "Final"
                      : "Ready"}
                  </span>
                </header>

                {!teamsReady ? (
                  <div className="p-5 text-center text-sm text-zinc-400">
                    Refreshing confirmed teams...
                  </div>
                ) : (
                  <div className="p-3">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="min-w-0 rounded-lg bg-blue-500/10 px-3 py-2">
                        {savedCourt.team1.map(
                          (player) => (
                            <p
                              key={player.playerId}
                              className="truncate text-sm font-semibold text-blue-200"
                            >
                              {player.name}
                            </p>
                          ),
                        )}
                      </div>

                      <span className="text-xs font-black text-zinc-500">
                        VS
                      </span>

                      <div className="min-w-0 rounded-lg bg-yellow-500/10 px-3 py-2 text-right">
                        {savedCourt.team2.map(
                          (player) => (
                            <p
                              key={player.playerId}
                              className="truncate text-sm font-semibold text-yellow-200"
                            >
                              {player.name}
                            </p>
                          ),
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        disabled={
                          savedCourt.complete ||
                          savingScoreCourtNumber !== null
                        }
                        value={scoreDraft.team1Score}
                        onChange={(event) =>
                          updateScoreDraft(
                            court.id,
                            "team1Score",
                            event.target.value,
                          )
                        }
                        className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-center text-xl font-black outline-none focus:border-blue-500 disabled:opacity-70"
                        aria-label={`Court ${court.id} Team 1 score`}
                      />

                      <span className="pb-2 font-black text-zinc-500">
                        —
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="1"
                        disabled={
                          savedCourt.complete ||
                          savingScoreCourtNumber !== null
                        }
                        value={scoreDraft.team2Score}
                        onChange={(event) =>
                          updateScoreDraft(
                            court.id,
                            "team2Score",
                            event.target.value,
                          )
                        }
                        className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-center text-xl font-black outline-none focus:border-blue-500 disabled:opacity-70"
                        aria-label={`Court ${court.id} Team 2 score`}
                      />

                      <button
                        type="button"
                        disabled={
                          savedCourt.complete ||
                          savingScoreCourtNumber !== null
                        }
                        onClick={() =>
                          void handleSaveScore(court.id)
                        }
                        className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-400"
                      >
                        {savingScoreCourtNumber ===
                        court.id
                          ? "Saving..."
                          : savedCourt.complete
                            ? "Saved"
                            : "Save"}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {courts.length > 0 &&
          completedCount === courts.length && (
            <div className="mt-5 rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-center">
              <p className="font-bold text-green-300">
                Round {currentRound} is complete.
              </p>

              <Link
                href="/admin"
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-green-600 px-5 text-sm font-bold text-white"
              >
                Return to Admin
              </Link>
            </div>
          )}
      </div>
    </AppLayout>
  );
}