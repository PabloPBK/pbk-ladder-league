"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AppLayout } from "../../components/layout/AppLayout";
import { useLeague } from "../../components/providers/LeagueProvider";
import {
  getCurrentRound,
  getEventRound,
  type SavedCurrentRound,
  type SavedRoundCourt,
} from "../../lib/data/currentRound";
import {
  completeLeagueEvent,
  getMatchCenter,
  saveCourtScore,
  type MatchCenterData,
} from "../../lib/data/matchCenter";
import {
  saveCustomCourtPairing,
  undoCourtPairing,
} from "../../lib/data/pairings";
import {
  generateSavedNextRound,
  regenerateLaterRounds,
} from "../../lib/data/rounds";
import {
  swapRoundOnePlayers,
  type RoundOnePlayerLocation,
} from "../../lib/data/roundAssignments";
import type { GeneratedCourt } from "../../types/court";
import type { Player } from "../../types/player";

type ScoreDraft = {
  team1Score: string;
  team2Score: string;
};

type PairingDraft = {
  firstPlayerId: string;
  secondPlayerId: string;
};

type SelectedSwapPlayer = RoundOnePlayerLocation & {
  playerName: string;
};

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

  const [playerA, playerB, playerC, playerD] = convertedPlayers;

  if (!playerA || !playerB || !playerC || !playerD) {
    throw new Error(
      `Court ${savedCourt.courtNumber} has an incomplete player assignment.`,
    );
  }

  return {
    id: savedCourt.courtNumber,
    players: [playerA, playerB, playerC, playerD],
  };
}

function createRoundMatchCenter(
  savedRound: SavedCurrentRound,
  seasonId: string,
): MatchCenterData {
  const courts = savedRound.courts.map((court) => {
    const players = court.players.map((player) => ({
      playerId: player.databasePlayerId,
      name: player.name,
      dupr: player.dupr,
      slotNumber: player.slotNumber,
      teamNumber: player.teamNumber,
    }));

    return {
      databaseCourtId: court.databaseCourtId,
      courtNumber: court.courtNumber,
      pairingIndex: court.pairingIndex,
      team1Score: court.team1Score,
      team2Score: court.team2Score,
      winnerTeam: court.winnerTeam,
      complete: court.complete,
      completedAt: court.completedAt,
      team1: players.filter((player) => player.teamNumber === 1),
      team2: players.filter((player) => player.teamNumber === 2),
    };
  });

  return {
    event: {
      id: savedRound.event.id,
      season_id: seasonId,
      name: savedRound.event.name,
      event_date: savedRound.event.event_date,
      status: savedRound.event.status,
      current_round: savedRound.event.current_round,
    },
    round: savedRound.round,
    courts,
    standings: [],
    roundComplete:
      courts.length > 0 && courts.every((court) => court.complete),
  };
}

export default function WalkingPage() {
  const {
    players,
    activeEvent,
    setActiveEvent,
    courts,
    setCourts,
    currentRound,
    setCurrentRound,
    playerDatabaseIds,
    isLoadingPlayers,
  } = useLeague();

  const [isLoadingRound, setIsLoadingRound] =
    useState(false);
  const [viewedRoundNumber, setViewedRoundNumber] =
    useState(1);
  const [availableRounds, setAvailableRounds] =
    useState<number[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] =
    useState("");
  const [matchCenter, setMatchCenter] =
    useState<MatchCenterData | null>(null);
  const [scoreDrafts, setScoreDrafts] = useState<
    Record<number, ScoreDraft>
  >({});
  const [pairingDrafts, setPairingDrafts] = useState<
    Record<number, PairingDraft>
  >({});
  const [editingScoreCourts, setEditingScoreCourts] =
    useState<Record<number, boolean>>({});
    const isEditingAnyScore = Object.values(
  editingScoreCourts,
).some(Boolean);
  const [savingCourtNumber, setSavingCourtNumber] =
    useState<number | null>(null);
  const [savingScoreCourtNumber, setSavingScoreCourtNumber] =
    useState<number | null>(null);
  const [isGeneratingNextRound, setIsGeneratingNextRound] =
    useState(false);
    const [isCompletingSession, setIsCompletingSession] =
  useState(false);
  const [isEditingRoundOne, setIsEditingRoundOne] =
    useState(false);
  const [selectedSwapPlayer, setSelectedSwapPlayer] =
    useState<SelectedSwapPlayer | null>(null);
  const [isSavingSwap, setIsSavingSwap] =
    useState(false);

  const runtimePlayerIdByDatabaseId = useMemo(() => {
    const idMap = new Map<string, number>();

    Object.entries(playerDatabaseIds).forEach(
      ([runtimeId, databaseId]) => {
        idMap.set(databaseId, Number(runtimeId));
      },
    );

    return idMap;
  }, [playerDatabaseIds]);

  const eventId = activeEvent?.id ?? "";

  const completedCount =
    matchCenter?.courts.filter((court) => court.complete)
      .length ?? 0;

  const confirmedCount =
    matchCenter?.courts.filter(
      (court) =>
        court.team1.length === 2 &&
        court.team2.length === 2,
    ).length ?? 0;

  const roundOneHasSavedScore =
    matchCenter?.courts.some(
      (court) =>
        court.complete ||
        court.team1Score !== null ||
        court.team2Score !== null,
    ) ?? false;

  const canEditRoundOne =
    currentRound === 1 &&
    viewedRoundNumber === 1 &&
    !roundOneHasSavedScore;

  const applySavedRound = useCallback(
    (savedRound: SavedCurrentRound) => {
      setAvailableRounds(savedRound.availableRounds);
      setViewedRoundNumber(savedRound.round.round_number);
      setCourts(
        savedRound.courts.map((savedCourt) =>
          convertSavedCourt(
            savedCourt,
            runtimePlayerIdByDatabaseId,
          ),
        ),
      );

      const nextMatchCenter = createRoundMatchCenter(
        savedRound,
        activeEvent?.season_id ?? "",
      );
      setMatchCenter(nextMatchCenter);

      const nextScores: Record<number, ScoreDraft> = {};
      const nextPairings: Record<number, PairingDraft> = {};

      nextMatchCenter.courts.forEach((court) => {
        nextScores[court.courtNumber] = {
          team1Score:
            court.team1Score === null ? "" : String(court.team1Score),
          team2Score:
            court.team2Score === null ? "" : String(court.team2Score),
        };

        if (court.team1.length === 2) {
          nextPairings[court.courtNumber] = {
            firstPlayerId: court.team1[0]?.playerId ?? "",
            secondPlayerId: court.team1[1]?.playerId ?? "",
          };
        }
      });

      setScoreDrafts(nextScores);
      setPairingDrafts(nextPairings);
    },
    [activeEvent?.season_id, runtimePlayerIdByDatabaseId, setCourts],
  );
const loadViewedRound = useCallback(
  async (
    roundNumber = viewedRoundNumber,
  ) => {
    if (!eventId) {
      return;
    }

    try {
      const savedRound =
        await getEventRound(
          eventId,
          roundNumber,
        );

      applySavedRound(savedRound);
    } catch (error) {
      console.warn(
        `Round ${roundNumber} could not be loaded. Returning to the current round.`,
        error,
      );

      try {
        const currentSavedRound =
          await getCurrentRound(eventId);

        setCurrentRound(
          currentSavedRound.round
            .round_number,
        );

        applySavedRound(
          currentSavedRound,
        );

        setActionError("");
        setActionMessage(
          `Round ${roundNumber} no longer exists. Returned to Round ${currentSavedRound.round.round_number}.`,
        );
      } catch (currentRoundError) {
        console.error(
          "Unable to load the current round:",
          currentRoundError,
        );

        setActionError(
          currentRoundError instanceof Error
            ? currentRoundError.message
            : "Unable to load the current round.",
        );
      }
    }
  },
  [
    applySavedRound,
    eventId,
    setCurrentRound,
    viewedRoundNumber,
  ],
);
  

  useEffect(() => {
    if (
      !activeEvent ||
      isLoadingPlayers ||
      players.length === 0
    ) {
      return;
    }

    const activeEventId = activeEvent.id;
    let cancelled = false;

    async function loadSavedRound() {
      try {
        setIsLoadingRound(true);
        setLoadError("");

        const savedRound = await getCurrentRound(
          activeEventId,
        );

        if (cancelled) {
          return;
        }

        setCurrentRound(savedRound.round.round_number);
        applySavedRound(savedRound);
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
    applySavedRound,
    runtimePlayerIdByDatabaseId,
    setCourts,
    setCurrentRound,
  ]);

  function updatePairingDraft(
    courtNumber: number,
    field: keyof PairingDraft,
    value: string,
  ) {
    setPairingDrafts((current) => ({
      ...current,
      [courtNumber]: {
        firstPlayerId:
          current[courtNumber]?.firstPlayerId ?? "",
        secondPlayerId:
          current[courtNumber]?.secondPlayerId ?? "",
        [field]: value,
      },
    }));
  }

  async function handleSavePairing(court: GeneratedCourt) {
    if (!activeEvent || savingCourtNumber !== null) {
      return;
    }

    const draft = pairingDrafts[court.id];

    if (
      !draft?.firstPlayerId ||
      !draft.secondPlayerId ||
      draft.firstPlayerId === draft.secondPlayerId
    ) {
      setActionError(
        `Choose two different Team 1 players for Court ${court.id}.`,
      );
      return;
    }

    try {
      setSavingCourtNumber(court.id);
      setActionError("");
      setActionMessage("");

      await saveCustomCourtPairing({
        eventId: activeEvent.id,
        courtNumber: court.id,
        roundNumber: viewedRoundNumber,
        team1PlayerIds: [
          draft.firstPlayerId,
          draft.secondPlayerId,
        ],
      });

      setActionMessage(`Court ${court.id} teams saved.`);
      await loadViewedRound();
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

  async function handleUndoPairing(courtNumber: number) {
    if (!activeEvent || savingCourtNumber !== null) {
      return;
    }

    try {
      setSavingCourtNumber(courtNumber);
      setActionError("");
      setActionMessage("");

      await undoCourtPairing({
        eventId: activeEvent.id,
        courtNumber,
        roundNumber: viewedRoundNumber,
      });

      setPairingDrafts((current) => ({
        ...current,
        [courtNumber]: {
          firstPlayerId: "",
          secondPlayerId: "",
        },
      }));

      setActionMessage(`Court ${courtNumber} pairing undone.`);
      await loadViewedRound();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : `Unable to undo Court ${courtNumber} pairing.`,
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
    setScoreDrafts((current) => ({
      ...current,
      [courtNumber]: {
        team1Score:
          current[courtNumber]?.team1Score ?? "",
        team2Score:
          current[courtNumber]?.team2Score ?? "",
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

  const team1Score = Number(
    draft?.team1Score,
  );

  const team2Score = Number(
    draft?.team2Score,
  );

  if (
    !draft ||
    draft.team1Score === "" ||
    draft.team2Score === "" ||
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
    setSavingScoreCourtNumber(
      courtNumber,
    );

    setActionError("");
    setActionMessage("");

    await saveCourtScore({
      eventId: activeEvent.id,
      courtNumber,
      roundNumber: viewedRoundNumber,
      team1Score,
      team2Score,
    });

    setEditingScoreCourts(
      (current) => ({
        ...current,
        [courtNumber]: false,
      }),
    );

    if (
      viewedRoundNumber < currentRound
    ) {
      let regenerationResult =
        await regenerateLaterRounds({
          eventId: activeEvent.id,
          editedRoundNumber:
            viewedRoundNumber,
        });

      if (
        regenerationResult.requiresConfirmation
      ) {
        const laterRounds =
          regenerationResult
            .laterRoundNumbers
            .join(", ");

        const confirmed =
          window.confirm(
            `Round ${laterRounds} already contains saved scores.\n\nRegenerating will erase those later scores and assignments.\n\nContinue?`,
          );

        if (!confirmed) {
          setActionMessage(
            `Court ${courtNumber} was corrected, but later rounds were not regenerated.`,
          );

          await loadViewedRound(
            viewedRoundNumber,
          );

          return;
        }

        regenerationResult =
          await regenerateLaterRounds({
            eventId: activeEvent.id,
            editedRoundNumber:
              viewedRoundNumber,
            force: true,
          });
      }

      const regeneratedRound =
        await getCurrentRound(
          activeEvent.id,
        );

      setCurrentRound(
        regeneratedRound.round
          .round_number,
      );

      setActiveEvent(
        (currentEvent) =>
          currentEvent
            ? {
                ...currentEvent,
                current_round:
                  regeneratedRound.round
                    .round_number,
              }
            : currentEvent,
      );

      applySavedRound(
        regeneratedRound,
      );

      setPairingDrafts({});
      setScoreDrafts({});
      setEditingScoreCourts({});

      setActionMessage(
        `Score corrected. Round ${regeneratedRound.round.round_number} was rebuilt with the corrected winners and losers.`,
      );

      return;
    }

    setActionMessage(
      `Court ${courtNumber} score saved.`,
    );

    await loadViewedRound(
      viewedRoundNumber,
    );
  } catch (error) {
    setActionError(
      error instanceof Error
        ? error.message
        : `Unable to save Court ${courtNumber} score.`,
    );
  } finally {
    setSavingScoreCourtNumber(
      null,
    );
  }
}
  async function handleRoundOnePlayerSelect(
    selection: SelectedSwapPlayer,
  ) {
    if (!activeEvent || !canEditRoundOne || isSavingSwap) {
      return;
    }

    setActionError("");
    setActionMessage("");

    if (!selectedSwapPlayer) {
      setSelectedSwapPlayer(selection);
      return;
    }

    if (
      selectedSwapPlayer.courtNumber ===
        selection.courtNumber &&
      selectedSwapPlayer.slotNumber === selection.slotNumber
    ) {
      setSelectedSwapPlayer(null);
      return;
    }

    const first = selectedSwapPlayer;
    const second = selection;

    try {
      setIsSavingSwap(true);

      const result = await swapRoundOnePlayers({
        eventId: activeEvent.id,
        first: {
          courtNumber: first.courtNumber,
          slotNumber: first.slotNumber,
        },
        second: {
          courtNumber: second.courtNumber,
          slotNumber: second.slotNumber,
        },
      });

      const savedRound = await getCurrentRound(
        activeEvent.id,
      );

      applySavedRound(savedRound);
      setPairingDrafts({});
      setScoreDrafts({});
      setSelectedSwapPlayer(null);
      setActionMessage(
        `${first.playerName} and ${second.playerName} were swapped. Reconfirm the affected court pairings.`,
      );
      await loadViewedRound();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to swap the selected players.",
      );
    } finally {
      setIsSavingSwap(false);
    }
  }
async function handleCompleteSession() {
  if (
    !activeEvent ||
    viewedRoundNumber !== 6 ||
    completedCount !== courts.length ||
    isCompletingSession
  ) {
    return;
  }

  const confirmed = window.confirm(
    "Complete this league session? This will lock the results and prevent additional rounds from being generated.",
  );

  if (!confirmed) {
    return;
  }

  try {
    setIsCompletingSession(true);
    setActionError("");
    setActionMessage("");

    const result =
      await completeLeagueEvent(
        activeEvent.id,
      );

    setActiveEvent(
      (currentEvent) =>
        currentEvent
          ? {
              ...currentEvent,
              ...result.event,
              status: "complete",
            }
          : currentEvent,
    );

    setActionMessage(
      "Session completed successfully. All six rounds are now locked.",
    );
  } catch (error) {
    setActionError(
      error instanceof Error
        ? error.message
        : "Unable to complete the session.",
    );
  } finally {
    setIsCompletingSession(false);
  }
}
  async function handleGenerateNextRound() {
    if (
  !activeEvent ||
  completedCount !== courts.length ||
  isGeneratingNextRound
) {
  return;
}

    try {
      setIsGeneratingNextRound(true);
      setActionError("");
      setActionMessage("");

      await generateSavedNextRound(activeEvent.id);
      const savedRound = await getCurrentRound(
        activeEvent.id,
      );

      setCurrentRound(savedRound.round.round_number);
      setViewedRoundNumber(savedRound.round.round_number);
      setActiveEvent((current) =>
        current
          ? {
              ...current,
              current_round: savedRound.round.round_number,
            }
          : current,
      );
      setCourts(
        savedRound.courts.map((savedCourt) =>
          convertSavedCourt(
            savedCourt,
            runtimePlayerIdByDatabaseId,
          ),
        ),
      );
      setPairingDrafts({});
      setScoreDrafts({});
      setEditingScoreCourts({});
      setMatchCenter(null);
      setIsEditingRoundOne(false);
      setSelectedSwapPlayer(null);
      setActionMessage(
        `Round ${savedRound.round.round_number} generated.`,
      );
      await loadViewedRound();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to generate the next round.",
      );
    } finally {
      setIsGeneratingNextRound(false);
    }
  }

  if (!activeEvent) {
    return (
      <AppLayout
        title="Runner Mode"
        description="Confirm teams and enter court scores."
      >
        <div className="mx-auto max-w-md rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-5 text-center">
          <h2 className="text-xl font-bold text-yellow-300">
            No Active League Event
          </h2>
          <Link
            href="/admin"
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-6 font-semibold text-white"
          >
            Open Admin
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (isLoadingPlayers || isLoadingRound) {
    return (
      <AppLayout title="Runner Mode">
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5 text-center text-blue-300">
          Loading Round {viewedRoundNumber}...
        </div>
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout title="Runner Mode">
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-center text-red-300">
          {loadError}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={`Round ${viewedRoundNumber} Runner Mode`}
      description="Choose Team 1, enter scores, and correct mistakes without leaving Runner."
    >
      <div className="mx-auto max-w-[1500px]">
        <section className="mb-4 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-white">View or correct a round</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Previous rounds remain editable until the league event is finished.
            </p>
          </div>

          <select
            value={viewedRoundNumber}
            onChange={(event) => {
              const nextRound = Number(event.target.value);
              setActionError("");
              setActionMessage("");
              setEditingScoreCourts({});
              void loadViewedRound(nextRound);
            }}
            className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-950 px-4 font-bold outline-none focus:border-blue-500"
          >
            {availableRounds.map((roundNumber) => (
              <option key={roundNumber} value={roundNumber}>
                Round {roundNumber}{roundNumber === currentRound ? " (Current)" : ""}
              </option>
            ))}
          </select>
        </section>

        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          <StatusCard title="Courts" value={courts.length} />
          <StatusCard
            title="Teams Saved"
            value={`${confirmedCount}/${courts.length}`}
          />
          <StatusCard
            title="Scores Complete"
            value={`${completedCount}/${courts.length}`}
          />
        </section>

        {viewedRoundNumber === 1 && (
          <section className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-white">
                  Emergency Round 1 Player Move
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {canEditRoundOne
                    ? "Enable move mode, then tap two players to swap them."
                    : "Player movement locks after the first score is saved."}
                </p>
              </div>
              <button
                type="button"
                disabled={!canEditRoundOne || isSavingSwap}
                onClick={() => {
                  setIsEditingRoundOne((current) => !current);
                  setSelectedSwapPlayer(null);
                }}
                className="min-h-12 rounded-xl bg-yellow-500 px-5 font-bold text-black disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {isEditingRoundOne ? "Exit Move Mode" : "Move Players"}
              </button>
            </div>
          </section>
        )}

        {actionError && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">
            {actionError}
          </div>
        )}

        {actionMessage && (
          <div className="mb-4 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-green-300">
            {actionMessage}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {courts.map((court) => {
            const savedCourt = matchCenter?.courts.find(
              (item) => item.courtNumber === court.id,
            );
            const teamsReady =
              savedCourt?.team1.length === 2 &&
              savedCourt.team2.length === 2;
            const pairingDraft = pairingDrafts[court.id] ?? {
              firstPlayerId: "",
              secondPlayerId: "",
            };
            const scoreDraft = scoreDrafts[court.id] ?? {
              team1Score: "",
              team2Score: "",
            };
            const team2Players = court.players.filter((player) => {
              const databaseId = playerDatabaseIds[player.id];
              return (
                databaseId !== pairingDraft.firstPlayerId &&
                databaseId !== pairingDraft.secondPlayerId
              );
            });
            const editingScore =
              editingScoreCourts[court.id] ?? false;

            if (isEditingRoundOne && canEditRoundOne) {
              return (
                <article
                  key={court.id}
                  className="overflow-hidden rounded-xl border border-yellow-500/40 bg-zinc-900"
                >
                  <header className="border-b border-zinc-800 px-4 py-2 font-bold text-yellow-400">
                    Court {court.id}
                  </header>
                  <div className="grid grid-cols-2 gap-3 p-3">
                    {court.players.map((player, index) => {
                      const selected =
                        selectedSwapPlayer?.courtNumber === court.id &&
                        selectedSwapPlayer.slotNumber === index + 1;
                      return (
                        <button
                          key={player.id}
                          type="button"
                          disabled={isSavingSwap}
                          onClick={() =>
                            void handleRoundOnePlayerSelect({
                              courtNumber: court.id,
                              slotNumber: index + 1,
                              playerName: player.name,
                            })
                          }
                          className={`min-h-16 rounded-xl border px-3 text-sm font-bold ${
                            selected
                              ? "border-yellow-300 bg-yellow-500/20 text-yellow-200"
                              : "border-zinc-700 bg-zinc-950 text-white"
                          }`}
                        >
                          {player.name}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            }

            return (
              <article
                key={court.id}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
              >
                <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                  <h2 className="text-lg font-black text-yellow-400">
                    Court {court.id}
                  </h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      savedCourt?.complete
                        ? "bg-green-500/15 text-green-300"
                        : teamsReady
                          ? "bg-blue-500/15 text-blue-300"
                          : "bg-yellow-500/15 text-yellow-300"
                    }`}
                  >
                    {savedCourt?.complete
                      ? "Final"
                      : teamsReady
                        ? "Teams Ready"
                        : "Choose Teams"}
                  </span>
                </header>

                {!teamsReady ? (
                  <div className="space-y-2 p-3">
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-300">
                        Team 1
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          value={pairingDraft.firstPlayerId}
                          onChange={(event) =>
                            updatePairingDraft(
                              court.id,
                              "firstPlayerId",
                              event.target.value,
                            )
                          }
                          className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-medium outline-none focus:border-blue-500"
                        >
                          <option value="">Player 1</option>
                          {court.players.map((player) => {
                            const databaseId = playerDatabaseIds[player.id];
                            return (
                              <option
                                key={player.id}
                                value={databaseId}
                                disabled={
                                  databaseId === pairingDraft.secondPlayerId
                                }
                              >
                                {player.name}
                              </option>
                            );
                          })}
                        </select>

                        <select
                          value={pairingDraft.secondPlayerId}
                          onChange={(event) =>
                            updatePairingDraft(
                              court.id,
                              "secondPlayerId",
                              event.target.value,
                            )
                          }
                          className="min-h-14 rounded-xl border border-zinc-700 bg-zinc-950 px-3 font-semibold outline-none focus:border-blue-500"
                        >
                          <option value="">Player 2</option>
                          {court.players.map((player) => {
                            const databaseId = playerDatabaseIds[player.id];
                            return (
                              <option
                                key={player.id}
                                value={databaseId}
                                disabled={
                                  databaseId === pairingDraft.firstPlayerId
                                }
                              >
                                {player.name}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    <div className="rounded-xl bg-yellow-500/10 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-yellow-300">
                        Team 2 — automatic
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {team2Players.length === 2
                          ? `${team2Players[0]?.name} / ${team2Players[1]?.name}`
                          : "Select both Team 1 players"}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={savingCourtNumber !== null}
                      onClick={() => void handleSavePairing(court)}
                      className="min-h-14 w-full rounded-xl bg-blue-600 px-5 font-black text-white transition hover:bg-blue-500 disabled:bg-zinc-700"
                    >
                      {savingCourtNumber === court.id
                        ? "Saving Teams..."
                        : "Save Teams"}
                    </button>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
                      <div className="rounded-lg bg-blue-500/10 p-2">
                        <p className="mb-2 text-xs font-bold uppercase text-blue-300">
                          Team 1
                        </p>
                        {savedCourt.team1.map((player) => (
  <p
    key={player.playerId}
    className="text-sm font-semibold leading-5"
  >
    {player.name}
  </p>
))}
                      </div>
                      <span className="self-center text-xs font-black text-zinc-500">
                        VS
                      </span>
                      <div className="rounded-lg bg-yellow-500/10 p-2">
                        <p className="mb-2 text-xs font-bold uppercase text-yellow-300">
                          Team 2
                        </p>
                        {savedCourt.team2.map((player) => (
  <p
    key={player.playerId}
    className="text-sm font-semibold leading-5"
  >
    {player.name}
  </p>
))}
                      </div>
                    </div>

                    {!savedCourt.complete && (
                      <button
                        type="button"
                        disabled={savingCourtNumber !== null}
                        onClick={() => void handleUndoPairing(court.id)}
                        className="mt-3 min-h-11 w-full rounded-xl border border-yellow-500/40 bg-yellow-500/10 font-bold text-yellow-300 transition hover:bg-yellow-500/15"
                      >
                        Undo Pairing
                      </button>
                    )}

                    <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        disabled={
                          (savedCourt.complete && !editingScore) ||
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
                        className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 text-center text-xl font-black outline-none focus:border-blue-500 disabled:opacity-70"
                        aria-label={`Court ${court.id} Team 1 score`}
                      />
                      <span className="font-black text-zinc-500">—</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        disabled={
                          (savedCourt.complete && !editingScore) ||
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
                        className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 text-center text-xl font-black outline-none focus:border-blue-500 disabled:opacity-70"
                        aria-label={`Court ${court.id} Team 2 score`}
                      />
                    </div>

                    {savedCourt.complete && !editingScore ? (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingScoreCourts((current) => ({
                            ...current,
                            [court.id]: true,
                          }))
                        }
                        className="mt-2 h-10 w-full rounded-lg bg-yellow-500 px-4 text-sm font-bold text-black"
                      >
                        Edit Score
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={savingScoreCourtNumber !== null}
                        onClick={() => void handleSaveScore(court.id)}
                        className="mt-2 h-10 w-full rounded-lg bg-green-600 px-4 text-sm font-bold text-white transition hover:bg-green-500 disabled:bg-zinc-700"
                      >
                        {savingScoreCourtNumber === court.id
                          ? "Saving Score..."
                          : savedCourt.complete
                            ? "Save Corrected Score"
                            : "Save Score"}
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {courts.length > 0 &&
  completedCount === courts.length && (
    <div className="mt-6 rounded-2xl border border-green-500/40 bg-green-500/10 p-5 text-center">
      <p className="text-xl font-black text-green-300">
        Round {viewedRoundNumber} Complete
      </p>

      {viewedRoundNumber === 6 ? (
        <button
          type="button"
          disabled={isCompletingSession}
          onClick={() =>
            void handleCompleteSession()
          }
          className="mt-4 h-12 rounded-xl bg-purple-600 px-8 font-black text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
        >
          {isCompletingSession
            ? "Completing Session..."
            : "Complete Session"}
        </button>
      ) : (
        <button
          type="button"
          disabled={isGeneratingNextRound}
          onClick={() =>
            void handleGenerateNextRound()
          }
          className="mt-4 h-12 rounded-xl bg-green-600 px-8 font-black text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
        >
          {isGeneratingNextRound
            ? "Generating..."
            : `Generate Round ${
                viewedRoundNumber + 1
              }`}
        </button>
      )}
    </div>
  )}
      </div>
    </AppLayout>
  );
}

function StatusCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <p className="mt-1 text-2xl font-black text-white">
        {value}
      </p>
    </div>
  );
}