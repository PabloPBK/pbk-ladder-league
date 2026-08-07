"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ActiveLeagueCard } from "@/components/admin/ActiveLeagueCard";
import { CompletionScreen } from "@/components/admin/CompletionScreen";
import { CourtAssignments } from "../../components/admin/CourtAssignments";
import { LeagueNightSetup } from "@/components/admin/LeagueNightSetup";
import { PlayerCheckIn } from "@/components/admin/PlayerCheckIn";
import { RoundControls } from "../../components/admin/RoundControls";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLeague } from "@/components/providers/LeagueProvider";
import {
  getCurrentRound,
  type SavedRoundCourt,
} from "@/lib/data/currentRound";
import {
  createLeagueEvent,
  getActiveLeagueEvent,
  getLeagueEventsForDate,
} from "@/lib/data/events";
import {
  completeLeagueEvent,
  getMatchCenter,
} from "@/lib/data/matchCenter";
import {
  generateSavedNextRound,
  saveFirstRound,
} from "@/lib/data/rounds";
import { generateInitialCourts } from "@/lib/ladder/generateInitialCourts";
import { deleteLeagueSession } from "@/lib/data/sessionControls";
import type { GeneratedCourt } from "@/types/court";
import type { Player } from "@/types/player";

function getLocalDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 10);
}

function resetPlayerForSetup(player: Player): Player {
  return {
    ...player,
    checkedIn: false,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDifferential: 0,
  };
}

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
      const runtimeId = runtimePlayerIdByDatabaseId.get(
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

export default function AdminPage() {
  const {
    players,
    setPlayers,
    courts,
    setCourts,
    currentRound,
    setCurrentRound,
    activeEvent,
    setActiveEvent,
    playerDatabaseIds,
    isLoadingPlayers,
    playerLoadError,
    resetLeague,
  } = useLeague();

  const [selectedLeagueId, setSelectedLeagueId] =
    useState("");
  const [selectedSeasonId, setSelectedSeasonId] =
    useState("");
  const [eventDate, setEventDate] = useState(
    getLocalDateValue,
  );
  const [sessionNumber, setSessionNumber] =
    useState(1);
  const [sessionNote, setSessionNote] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");
  const [isStartingEvent, setIsStartingEvent] =
    useState(false);
  const [isCheckingEvent, setIsCheckingEvent] =
    useState(false);
  const [isGenerating, setIsGenerating] =
    useState(false);
  const [isGeneratingNextRound, setIsGeneratingNextRound] =
    useState(false);
  const [isCompletingLeagueNight, setIsCompletingLeagueNight] =
    useState(false);
  const [isDeletingSession, setIsDeletingSession] =
    useState(false);
  const [roundSaved, setRoundSaved] =
    useState(false);
  const [roundComplete, setRoundComplete] =
    useState(false);
  const [showCompletionScreen, setShowCompletionScreen] =
    useState(false);
  const [completedEventName, setCompletedEventName] =
    useState("");
  const [availableActiveEvent, setAvailableActiveEvent] =
    useState<Awaited<ReturnType<typeof getActiveLeagueEvent>>>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] =
    useState(true);

  const runtimePlayerIdByDatabaseId = useMemo(() => {
    const idMap = new Map<string, number>();

    Object.entries(playerDatabaseIds).forEach(
      ([runtimeId, databaseId]) => {
        idMap.set(databaseId, Number(runtimeId));
      },
    );

    return idMap;
  }, [playerDatabaseIds]);

  const checkedInCount = useMemo(
    () =>
      players.filter((player) => player.checkedIn)
        .length,
    [players],
  );

  const remainingPlayers = checkedInCount % 4;
  const roundIsGenerated =
    roundSaved && Boolean(activeEvent);

  const canGenerateFirstRound =
    Boolean(activeEvent) &&
    checkedInCount >= 4 &&
    remainingPlayers === 0 &&
    !isGenerating &&
    !roundIsGenerated &&
    !isLoadingPlayers;

  const clearRoundState = useCallback(() => {
    setCourts([]);
    setCurrentRound(1);
    setRoundSaved(false);
    setRoundComplete(false);
  }, [setCourts, setCurrentRound]);

  const restoreEvent = useCallback(
    async (eventId: string) => {
      try {
        const savedRound = await getCurrentRound(eventId);

        const restoredCourts = savedRound.courts.map(
          (savedCourt: SavedRoundCourt) =>
            convertSavedCourt(
              savedCourt,
              runtimePlayerIdByDatabaseId,
            ),
        );

        setCurrentRound(savedRound.round.round_number);
        setCourts(restoredCourts);
        setRoundSaved(true);
        setRoundComplete(false);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "";

        const noSavedRound =
          message.includes("No saved round was found") ||
          message.includes("No courts were found");

        if (!noSavedRound) {
          throw error;
        }

        clearRoundState();
      }
    },
    [
      clearRoundState,
      runtimePlayerIdByDatabaseId,
      setCourts,
      setCurrentRound,
    ],
  );

  const handleLeagueChange = useCallback(
    (leagueId: string) => {
      setSelectedLeagueId(leagueId);
      setSelectedSeasonId("");
      setActiveEvent(null);
      clearRoundState();
      setSessionNumber(1);
      setSessionNote("");
      setErrorMessage("");
      setSuccessMessage("");
    },
    [clearRoundState, setActiveEvent],
  );

  const handleSeasonChange = useCallback(
    (seasonId: string) => {
      setSelectedSeasonId(seasonId);
      setActiveEvent(null);
      clearRoundState();
      setSessionNumber(1);
      setSessionNote("");
      setErrorMessage("");
      setSuccessMessage("");
    },
    [clearRoundState, setActiveEvent],
  );

  useEffect(() => {
    if (
      isLoadingPlayers ||
      runtimePlayerIdByDatabaseId.size === 0
    ) {
      return;
    }

    let cancelled = false;

    async function loadDashboard() {
      try {
        setIsLoadingDashboard(true);
        const event = await getActiveLeagueEvent();

        if (!cancelled) {
          setAvailableActiveEvent(event);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to check for an active league night.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDashboard(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [isLoadingPlayers, runtimePlayerIdByDatabaseId]);

  useEffect(() => {
    if (!selectedSeasonId || !eventDate || activeEvent) {
      return;
    }

    let cancelled = false;

    async function calculateNextSession() {
      try {
        setIsCheckingEvent(true);
        setErrorMessage("");

        const events = await getLeagueEventsForDate({
          seasonId: selectedSeasonId,
          eventDate,
        });

        if (!cancelled) {
          const nextSession =
            events.reduce(
              (highest, currentEvent) =>
                Math.max(
                  highest,
                  currentEvent.session_number,
                ),
              0,
            ) + 1;

          setSessionNumber(Math.max(1, nextSession));
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to calculate the next session number.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsCheckingEvent(false);
        }
      }
    }

    void calculateNextSession();

    return () => {
      cancelled = true;
    };
  }, [selectedSeasonId, eventDate, activeEvent]);

  async function handleResumeLeagueNight() {
    if (!availableActiveEvent) {
      return;
    }

    try {
      setIsCheckingEvent(true);
      setErrorMessage("");
      setSuccessMessage("");

      setActiveEvent(availableActiveEvent);
      setSelectedSeasonId(availableActiveEvent.season_id);
      setEventDate(availableActiveEvent.event_date);
      setSessionNumber(
        availableActiveEvent.session_number ?? 1,
      );
      setSessionNote(
        availableActiveEvent.session_note ?? "",
      );

      await restoreEvent(availableActiveEvent.id);
    } catch (error) {
      setActiveEvent(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to resume the active league night.",
      );
    } finally {
      setIsCheckingEvent(false);
    }
  }

  useEffect(() => {
    if (!activeEvent || !roundSaved) {
      setRoundComplete(false);
      return;
    }

    const eventId = activeEvent.id;
    let cancelled = false;

    async function checkRoundCompletion() {
      try {
        const matchCenter = await getMatchCenter(
          eventId,
        );

        if (!cancelled) {
          setRoundComplete(matchCenter.roundComplete);
        }
      } catch (error) {
        console.error(
          "Unable to check round completion:",
          error,
        );
      }
    }

    void checkRoundCompletion();

    const intervalId = window.setInterval(() => {
      void checkRoundCompletion();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeEvent, roundSaved]);

  async function handleStartLeagueNight() {
    if (!selectedSeasonId || isStartingEvent) {
      return;
    }

    try {
      setIsStartingEvent(true);
      setErrorMessage("");
      setSuccessMessage("");

      const event = await createLeagueEvent({
        seasonId: selectedSeasonId,
        eventDate,
        sessionNumber,
        sessionNote,
      });

      if (event.status === "complete") {
        throw new Error(
          `Session ${sessionNumber} is already complete. Choose another session number.`,
        );
      }

      setActiveEvent(event);
      setAvailableActiveEvent(event);
      setPlayers((currentPlayers) =>
        currentPlayers.map(resetPlayerForSetup),
      );
      clearRoundState();

      setSuccessMessage(
        `${event.name} started. Check players in and generate Round 1.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start the league night.",
      );
    } finally {
      setIsStartingEvent(false);
    }
  }

  function togglePlayerCheckIn(playerId: number) {
    if (!activeEvent || roundIsGenerated) {
      return;
    }

    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.id === playerId
          ? {
              ...player,
              checkedIn: !player.checkedIn,
            }
          : player,
      ),
    );

    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleGenerateFirstRound() {
    if (!activeEvent || roundIsGenerated) {
      return;
    }

    if (checkedInCount < 4) {
      setErrorMessage(
        "At least four players must be checked in.",
      );
      return;
    }

    if (remainingPlayers !== 0) {
      setErrorMessage(
        "The checked-in player count must be divisible by four.",
      );
      return;
    }

    try {
      setIsGenerating(true);
      setErrorMessage("");
      setSuccessMessage("");

      const generatedCourts =
        generateInitialCourts(players);

      const databaseCourts = generatedCourts.map(
        (court) => ({
          courtNumber: court.id,
          players: court.players.map(
            (player, index) => {
              const databasePlayerId =
                playerDatabaseIds[player.id];

              if (!databasePlayerId) {
                throw new Error(
                  `No Supabase player ID was found for ${player.name}.`,
                );
              }

              return {
                databasePlayerId,
                slotNumber: index + 1,
              };
            },
          ),
        }),
      );

      await saveFirstRound({
        eventId: activeEvent.id,
        roundNumber: 1,
        courts: databaseCourts,
      });

      setCurrentRound(1);
      setCourts(generatedCourts);
      setRoundSaved(true);
      setRoundComplete(false);
      setSuccessMessage(
        "Round 1 was generated and saved successfully.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate and save Round 1.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerateNextRound() {
    if (
      !activeEvent ||
      !roundComplete ||
      isGeneratingNextRound ||
      isCompletingLeagueNight
    ) {
      return;
    }

    try {
      setIsGeneratingNextRound(true);
      setErrorMessage("");
      setSuccessMessage("");

      await generateSavedNextRound(activeEvent.id);
      await restoreEvent(activeEvent.id);
      setRoundComplete(false);
      setSuccessMessage(
        `Round ${currentRound + 1} was generated. Open Runner Mode to confirm the new pairings.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate the next round.",
      );
    } finally {
      setIsGeneratingNextRound(false);
    }
  }

  async function handleCompleteLeagueNight() {
    if (
      !activeEvent ||
      !roundComplete ||
      isCompletingLeagueNight
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Finish ${activeEvent.name}? This will lock the results and save the event to History.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsCompletingLeagueNight(true);
      setErrorMessage("");

      const result = await completeLeagueEvent(
        activeEvent.id,
      );

      const finishedEventName =
        result.event?.name ?? activeEvent.name;

      resetLeague();
      setAvailableActiveEvent(null);
      setRoundSaved(false);
      setRoundComplete(false);
      setCompletedEventName(finishedEventName);
      setShowCompletionScreen(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to complete the league night.",
      );
    } finally {
      setIsCompletingLeagueNight(false);
    }
  }

  async function handleDeleteLeagueSession() {
    if (!activeEvent || isDeletingSession) {
      return;
    }

    const confirmation = window.prompt(
      `Delete ${activeEvent.name}? This permanently removes the session, roster, rounds, courts, pairings, and scores. Players, leagues, and seasons will remain. Type DELETE to continue.`,
    );

    if (confirmation !== "DELETE") {
      return;
    }

    try {
      setIsDeletingSession(true);
      setErrorMessage("");
      setSuccessMessage("");

      await deleteLeagueSession(activeEvent.id);

      resetLeague();
      setAvailableActiveEvent(null);
      setSelectedLeagueId("");
      setSelectedSeasonId("");
      setEventDate(getLocalDateValue());
      setSessionNumber(1);
      setSessionNote("");
      setRoundSaved(false);
      setRoundComplete(false);
      setSuccessMessage(
        "The mistaken league session was deleted.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete the league session.",
      );
    } finally {
      setIsDeletingSession(false);
    }
  }

  function handleStartNewLeagueNight() {
    resetLeague();
    setSelectedLeagueId("");
    setSelectedSeasonId("");
    setEventDate(getLocalDateValue());
    setSessionNumber(1);
    setSessionNote("");
    setRoundSaved(false);
    setRoundComplete(false);
    setCompletedEventName("");
    setShowCompletionScreen(false);
    setErrorMessage("");
    setSuccessMessage("");
  }

  if (showCompletionScreen) {
    return (
      <AppLayout
        title="League Night Complete"
        description="The completed event is saved in History and the active session has been cleared."
      >
        <CompletionScreen
          completedEventName={completedEventName}
          onStartNewLeagueNight={
            handleStartNewLeagueNight
          }
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Admin Dashboard"
      description="Start a session, check players in, and run the ladder."
    >
      <div className="mx-auto max-w-6xl">
        {!activeEvent && (
          <>
            {isLoadingDashboard ? (
              <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-blue-300">
                Checking for an active league night...
              </div>
            ) : availableActiveEvent ? (
              <section className="mb-8 rounded-2xl border border-green-500/40 bg-green-500/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-300">
                  Resume current league night
                </p>

                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {availableActiveEvent.name}
                    </h2>

                    <p className="mt-1 text-sm text-zinc-300">
                      {availableActiveEvent.event_date} · Session {availableActiveEvent.session_number ?? 1}
                      {availableActiveEvent.session_note
                        ? ` · ${availableActiveEvent.session_note}`
                        : ""}
                    </p>

                    <p className="mt-1 text-sm text-zinc-400">
                      Round {availableActiveEvent.current_round}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isCheckingEvent}
                    onClick={() =>
                      void handleResumeLeagueNight()
                    }
                    className="min-h-12 rounded-xl bg-green-600 px-6 py-3 font-bold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
                  >
                    {isCheckingEvent
                      ? "Resuming..."
                      : "Resume League Night"}
                  </button>
                </div>
              </section>
            ) : null}

            <LeagueNightSetup
              selectedLeagueId={selectedLeagueId}
              selectedSeasonId={selectedSeasonId}
              eventDate={eventDate}
              sessionNumber={sessionNumber}
              sessionNote={sessionNote}
              isStarting={isStartingEvent}
              errorMessage={errorMessage}
              onLeagueChange={handleLeagueChange}
              onSeasonChange={handleSeasonChange}
              onEventDateChange={setEventDate}
              onSessionNumberChange={setSessionNumber}
              onSessionNoteChange={setSessionNote}
              onStartLeagueNight={() =>
                void handleStartLeagueNight()
              }
            />
          </>
        )}

        {activeEvent && isCheckingEvent && (
          <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-blue-300">
            Restoring the active session...
          </div>
        )}

        {activeEvent && (
          <>
            <ActiveLeagueCard
              event={activeEvent}
              currentRound={currentRound}
              roundIsGenerated={roundIsGenerated}
            />

            {errorMessage && (
              <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="mb-6 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-green-300">
                {successMessage}
              </div>
            )}

            <PlayerCheckIn
              players={players}
              currentRound={currentRound}
              roundIsGenerated={roundIsGenerated}
              isLoadingPlayers={isLoadingPlayers}
              playerLoadError={playerLoadError}
              canGenerateFirstRound={
                canGenerateFirstRound
              }
              isGenerating={isGenerating}
              onTogglePlayer={togglePlayerCheckIn}
              onGenerateFirstRound={() =>
                void handleGenerateFirstRound()
              }
            />

            {roundIsGenerated && (
              <div className="mt-8">
                <RoundControls
                  currentRound={currentRound}
                  roundComplete={roundComplete}
                  isGeneratingNextRound={
                    isGeneratingNextRound
                  }
                  isCompletingLeagueNight={
                    isCompletingLeagueNight
                  }
                  onGenerateNextRound={() =>
                    void handleGenerateNextRound()
                  }
                  onCompleteLeagueNight={() =>
                    void handleCompleteLeagueNight()
                  }
                />

                <CourtAssignments
                  courts={courts}
                  currentRound={currentRound}
                />
              </div>
            )}

            <section className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">
                Session Controls
              </p>

              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Delete Mistaken Session
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                    Permanently removes this active session, its roster, rounds, courts, pairings, and scores. Saved players, leagues, and seasons are not deleted.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isDeletingSession}
                  onClick={() =>
                    void handleDeleteLeagueSession()
                  }
                  className="min-h-12 shrink-0 rounded-xl border border-red-500/50 bg-red-600 px-6 py-3 font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  {isDeletingSession
                    ? "Deleting..."
                    : "Delete Session"}
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}