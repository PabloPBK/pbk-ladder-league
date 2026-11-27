"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFrontDesk } from "@/components/auth/useFrontDesk";
import { SessionRosterUpload } from "@/components/admin/SessionRosterUpload";
import { LeagueTvControls } from "@/components/admin/LeagueTvControls";
import { getActiveLeagues, getSeasonsForLeague } from "@/lib/data/leagues";
import type { AppliedRow } from "@/lib/data/playerImport";

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
  createOrGetLeagueEvent,
  getActiveLeagueEvent,
  getLeagueEventsForDate,
  type LeagueEventRecord,
} from "@/lib/data/events";
import type { LeagueSessionOption } from "@/lib/data/league-session-schedule";
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
import { isUuid } from "@/lib/data/league-listings";
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
    dupr: player.savedDupr ?? player.dupr,
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
  return (
    <Suspense fallback={<p className="p-6 text-zinc-400">Loading League Night…</p>}>
      <LeagueNightFromUrl />
    </Suspense>
  );
}

function LeagueNightFromUrl() {
  const params = useSearchParams();
  const requestedLeague = params.get("leagueId") ?? "";
  const requestedSeason = params.get("seasonId") ?? "";
  const leagueId = isUuid(requestedLeague) ? requestedLeague : "";
  const seasonId = leagueId && isUuid(requestedSeason) ? requestedSeason : "";
  const resume = params.get("resume") ?? "";
  return <LeagueNight key={`${leagueId}:${seasonId}:${resume}`}
    initialLeagueId={leagueId} initialSeasonId={seasonId} resumeEventId={resume} />;
}

function LeagueNight({ initialLeagueId, initialSeasonId, resumeEventId }: {
  initialLeagueId: string; initialSeasonId: string; resumeEventId: string;
}) {
  const {
    players,
    setPlayers,
    courts,
    setCourts,
    currentRound,
    setCurrentRound,
    activeEvent: runningEvent,
    prepareCheckIn,
    setActiveEvent,
    playerDatabaseIds,
    isLoadingPlayers,
    playerLoadError,
    resetLeague,
  } = useLeague();

  const [selectedLeagueId, setSelectedLeagueId] =
    useState(initialLeagueId);
  const [selectedSeasonId, setSelectedSeasonId] =
    useState(initialSeasonId);
  const frontDesk = useFrontDesk();
  const locked = Boolean(initialLeagueId && initialSeasonId);
  const returningEventId = locked && runningEvent?.season_id === initialSeasonId && runningEvent.id === resumeEventId
    ? runningEvent.id : "";
  const [openedEventId, setOpenedEventId] = useState(returningEventId);
  const activeEvent = locked && runningEvent?.id !== openedEventId ? null : runningEvent;
  const [leagueContext, setLeagueContext] = useState<{ name: string; season: string }>();
  const [rosterBusy, setRosterBusy] = useState(false);
  const [sessionRoster, setSessionRoster] = useState<AppliedRow[]>([]);
  const [rosterReviewed, setRosterReviewed] = useState(false);
  const [showAllPlayers, setShowAllPlayers] = useState(false);

  const activeSeasonFilter = initialLeagueId ? selectedSeasonId : undefined;
  const [eventDate, setEventDate] = useState(
    getLocalDateValue,
  );
  const [sessionNumber, setSessionNumber] =
    useState(1);
  const [selectedSession, setSelectedSession] = useState<LeagueSessionOption | null>(null);
  const [sessionNote, setSessionNote] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");
  const [isStartingEvent, setIsStartingEvent] =
    useState(false);
  const [isCheckingEvent, setIsCheckingEvent] =
    useState(Boolean(returningEventId));
  const [isCalculatingSession, setIsCalculatingSession] = useState(false);
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

  useEffect(() => {
    if (!locked) return;
    let current = true;
    void Promise.all([getActiveLeagues(), getSeasonsForLeague(initialLeagueId)]).then(([leagues, seasons]) => {
      if (!current) return;
      const league = leagues.find(({ id }) => id === initialLeagueId);
      const season = seasons.find(({ id }) => id === initialSeasonId);
      if (league && season) setLeagueContext({ name: league.name, season: season.name });
      else setErrorMessage("That season doesn’t belong to an available league. Choose it again from Leagues.");
    }).catch(() => { if (current) setErrorMessage("Unable to load this league. Return to Leagues and try again."); });
    return () => { current = false; };
  }, [initialLeagueId, initialSeasonId, locked]);

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

  // Warn before leaving an unfinished league setup, including browser Back.
  const protectSetup = !roundSaved && (rosterBusy || rosterReviewed || Boolean(activeEvent));
  useEffect(() => {
    if (!protectSetup) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const url = window.location.href;
    const marker = "__leagueSetupGuard";
    if (!window.history.state?.[marker]) {
      window.history.pushState({ ...window.history.state, [marker]: true }, "", url);
    }
    const onBack = () => {
      if (window.confirm("Leave this league setup? Unsaved changes may be lost.")) {
        window.history.back();
      } else {
        window.history.pushState({ ...window.history.state, [marker]: true }, "", url);
      }
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("popstate", onBack);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("popstate", onBack);
    };
  }, [protectSetup]);

  const remainingPlayers = checkedInCount % 4;
  const roundIsGenerated =
    roundSaved && Boolean(activeEvent);

  const canGenerateFirstRound =
    Boolean(activeEvent) &&
    !isCheckingEvent &&
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

  useEffect(() => {
    if (!returningEventId || isLoadingPlayers) return;
    let cancelled = false;
    void restoreEvent(returningEventId)
      .catch(() => { if (!cancelled) setErrorMessage("Unable to restore the current round. Choose the session again from Leagues."); })
      .finally(() => { if (!cancelled) setIsCheckingEvent(false); });
    return () => { cancelled = true; };
  }, [returningEventId, isLoadingPlayers, restoreEvent]);

  function workspaceEvent(event: LeagueEventRecord): LeagueEventRecord {
    if (!locked) return event;
    const query = new URLSearchParams({ leagueId: initialLeagueId, seasonId: initialSeasonId, resume: event.id });
    return { ...event, workspaceHref: `/admin?${query}` };
  }

  const handleLeagueChange = useCallback(
    (leagueId: string) => {
      setSelectedLeagueId(leagueId);
      setSelectedSeasonId("");
      setSelectedSession(null);
      if (!runningEvent) clearRoundState();
      setSessionNumber(1);
      setSessionNote("");
      setErrorMessage("");
      setSuccessMessage("");
    },
    [clearRoundState, runningEvent],
  );

  const handleSeasonChange = useCallback(
    (seasonId: string) => {
      setSelectedSeasonId(seasonId);
      setSelectedSession(null);
      if (!runningEvent) clearRoundState();
      setSessionNumber(1);
      setSessionNote("");
      setErrorMessage("");
      setSuccessMessage("");
    },
    [clearRoundState, runningEvent],
  );

  function handleChooseSession(session: LeagueSessionOption | null) {
    setSessionRoster([]);
    setRosterReviewed(false);
    setSelectedSession(session);
    setEventDate(session?.date ?? getLocalDateValue());
    setSessionNumber(session?.number ?? 1);
    setSessionNote(session?.event?.session_note ?? "");
    setErrorMessage("");
    if (locked && leagueContext && !isLoadingPlayers && session?.event && session.event.status !== "complete") {
      void handleResumeLeagueNight(session.event);
    }
  }

  useEffect(() => {
    if (
      locked ||
      isLoadingPlayers ||
      runtimePlayerIdByDatabaseId.size === 0
    ) {
      return;
    }

    let cancelled = false;

    async function loadDashboard() {
      try {
        setIsLoadingDashboard(true);
        const event = activeSeasonFilter === "" ? null : await getActiveLeagueEvent(activeSeasonFilter);

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
  }, [isLoadingPlayers, runtimePlayerIdByDatabaseId, activeSeasonFilter, locked]);

  useEffect(() => {
    if (!selectedSeasonId || !eventDate || activeEvent || selectedSession || locked) {
      setIsCalculatingSession(false);
      return;
    }

    let cancelled = false;

    async function calculateNextSession() {
      try {
        setIsCalculatingSession(true);
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
          setIsCalculatingSession(false);
        }
      }
    }

    void calculateNextSession();

    return () => {
      cancelled = true;
    };
  }, [selectedSeasonId, eventDate, activeEvent, selectedSession, locked]);

  async function handleResumeLeagueNight(session: LeagueEventRecord | null = availableActiveEvent, preserveRoster = false) {
    if (!session || session.status === "complete") {
      return;
    }

    try {
      setIsCheckingEvent(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (locked && session.id !== runningEvent?.id && !preserveRoster) {
        setPlayers((current) => current.map(resetPlayerForSetup));
        setSessionRoster([]);
        setRosterReviewed(false);
      }
      setActiveEvent(workspaceEvent(session));
      setOpenedEventId(session.id);
      setSelectedSeasonId(session.season_id);
      setEventDate(session.event_date);
      setSessionNumber(
        session.session_number ?? 1,
      );
      setSessionNote(
        session.session_note ?? "",
      );

      await restoreEvent(session.id);
    } catch (error) {
      setActiveEvent(null);
      setOpenedEventId("");
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
    if (!selectedSeasonId || isStartingEvent || rosterBusy || (locked && !leagueContext)) {
      return;
    }

    try {
      setIsStartingEvent(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { event, existing } = await createOrGetLeagueEvent({
        seasonId: selectedSeasonId,
        eventDate,
        sessionNumber,
        sessionNote,
        name: leagueContext
          ? `${leagueContext.name} · ${eventDate} · Session ${sessionNumber}${sessionNote.trim() ? ` · ${sessionNote.trim()}` : ""}`
          : undefined,
      });

      if (event.status === "complete") {
        throw new Error(
          `Session ${sessionNumber} is already complete. Choose another session number.`,
        );
      }

      if (existing) {
        await handleResumeLeagueNight(event, locked && rosterReviewed);
        if (locked && rosterReviewed) prepareCheckIn(sessionRoster, true);
        return;
      }

      setActiveEvent(workspaceEvent(event));
      setOpenedEventId(event.id);
      setAvailableActiveEvent(event);
      setPlayers((currentPlayers) =>
        currentPlayers.map(resetPlayerForSetup),
      );
      if (locked && rosterReviewed) prepareCheckIn(sessionRoster, true);
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

  function applySessionRoster(rows: AppliedRow[], replace: boolean) {
    const selected = rows.filter(({ player }) => player);
    setSessionRoster((current) => {
      if (replace) return selected;
      const byPlayer = new Map(current.map((row) => [row.player?.id, row]));
      for (const row of selected) byPlayer.set(row.player?.id, row);
      return [...byPlayer.values()];
    });
    setRosterReviewed(true);
    if (activeEvent) {
      if (replace && !selected.length) setPlayers((current) => current.map(resetPlayerForSetup));
      else prepareCheckIn(selected, replace);
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

  function movePlayerInSetup(playerId: number, direction: "up" | "down") {
    if (roundIsGenerated) return;

    setPlayers((currentPlayers) => {
      const checkedIndexes = currentPlayers
        .map((player, index) => (player.checkedIn ? index : -1))
        .filter((index) => index >= 0);
      const currentIndex = currentPlayers.findIndex((player) => player.id === playerId);
      const checkedPosition = checkedIndexes.indexOf(currentIndex);
      const targetPosition = direction === "up" ? checkedPosition - 1 : checkedPosition + 1;

      if (checkedPosition < 0 || targetPosition < 0 || targetPosition >= checkedIndexes.length) {
        return currentPlayers;
      }

      const targetIndex = checkedIndexes[targetPosition];
      const next = [...currentPlayers];
      [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
      return next;
    });
  }

  function updatePlayerRatingForTonight(playerId: number, rating: number) {
    if (roundIsGenerated) return;
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.id === playerId ? { ...player, dupr: rating } : player,
      ),
    );
  }

  async function handleGenerateFirstRound() {
    if (!activeEvent || roundIsGenerated || rosterBusy || isCheckingEvent) {
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
      setSelectedSession(null);
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
    setSelectedLeagueId(initialLeagueId);
    setSelectedSeasonId(initialSeasonId);
    setSessionRoster([]);
    setRosterReviewed(false);
    setShowAllPlayers(false);
    setSelectedSession(null);
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

  if (frontDesk && !locked) {
    return <AppLayout title="Leagues"><Link className="text-blue-300 underline" href="/leagues">Choose a league and season</Link></AppLayout>;
  }

  if (showCompletionScreen) {
    return (
      <AppLayout
        title={locked ? `${leagueContext?.name ?? "League"} · Session Complete` : "League Night Complete"}
        description="The completed event is saved in History and the active session has been cleared."
      >
        <div className="mx-auto max-w-5xl space-y-6">
          <CompletionScreen
            completedEventName={completedEventName}
            onStartNewLeagueNight={handleStartNewLeagueNight}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={locked ? leagueContext?.name ?? "League Session" : "Admin Dashboard"}
      description={locked ? leagueContext?.season : "Start a session, check players in, and run the ladder."}
      headerAside={locked && <Link className="text-sm text-blue-300 underline" href="/leagues">All leagues</Link>}
    >
      <div className="mx-auto max-w-6xl">
        {!activeEvent && (
          <>
            {!locked && (isLoadingDashboard ? (
              <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-blue-300">
                Checking for an active league night...
              </div>
            ) : availableActiveEvent && (!initialLeagueId || availableActiveEvent.season_id === selectedSeasonId) ? (
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
            ) : null)}

            <LeagueNightSetup
              leagueTitle={leagueContext?.season}
              selectionLocked={locked}
              rosterBusy={rosterBusy || (locked && !leagueContext)}
              rosterUpload={locked && leagueContext && (
                <>
                  <SessionRosterUpload key={`${eventDate}:${sessionNumber}`} onApply={applySessionRoster}
                    onBusyChange={setRosterBusy} disabled={isStartingEvent} />
                  {rosterReviewed && !rosterBusy && <div role="status" className="mt-4 rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-green-300"><strong>Roster Review Complete</strong><p>{sessionRoster.length} players reviewed. Continue to check-in and Round 1 court setup.</p></div>}
                </>
              )}
              selectedLeagueId={selectedLeagueId}
              selectedSeasonId={selectedSeasonId}
              eventDate={eventDate}
              sessionNumber={sessionNumber}
              sessionNote={sessionNote}
              isStarting={isStartingEvent}
              errorMessage={errorMessage}
              onLeagueChange={handleLeagueChange}
              onSeasonChange={handleSeasonChange}
              onEventDateChange={(date) => { setEventDate(date); setSessionRoster([]); setRosterReviewed(false); }}
              onSessionNumberChange={(number) => { setSessionNumber(number); setSessionRoster([]); setRosterReviewed(false); }}
              onSessionNoteChange={setSessionNote}
              sessionNavigation={{
                isCheckingSession: isCheckingEvent || isCalculatingSession || (locked && (!leagueContext || isLoadingPlayers)),
                selectedSession,
                onChooseSession: handleChooseSession,
                onResumeSession: (session) => { if (!locked || leagueContext) void handleResumeLeagueNight(session); },
              }}
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
            {!roundIsGenerated && !isCheckingEvent && locked && (
              <div className="mb-5 no-print">
                <SessionRosterUpload onApply={applySessionRoster} onBusyChange={setRosterBusy} disabled={isGenerating || isCheckingEvent} />
                <button type="button" className="mt-3 text-sm text-blue-300 underline" onClick={() => setShowAllPlayers((value) => !value)}>
                  {showAllPlayers ? "Show roster only" : "Find a saved player"}
                </button>
              </div>
            )}

            <ActiveLeagueCard
              event={activeEvent}
              leagueTitle={locked ? leagueContext?.name : undefined}
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

            {!roundIsGenerated && !isCheckingEvent && <PlayerCheckIn
              players={players}
              rosterOnly={locked && !showAllPlayers}
              rosterPlayerIds={new Set(sessionRoster.flatMap(({ player }) => player ? [player.id] : []))}
              playerDatabaseIds={playerDatabaseIds}
              currentRound={currentRound}
              roundIsGenerated={roundIsGenerated}
              isLoadingPlayers={isLoadingPlayers}
              playerLoadError={playerLoadError}
              canGenerateFirstRound={
                canGenerateFirstRound && !rosterBusy
              }
              isGenerating={isGenerating}
              onTogglePlayer={togglePlayerCheckIn}
              onGenerateFirstRound={() =>
                void handleGenerateFirstRound()
              }
              onMovePlayer={movePlayerInSetup}
              onRatingChange={updatePlayerRatingForTonight}
            />}

            {roundIsGenerated && (
              <div className="mt-8">
                <LeagueTvControls eventId={activeEvent.id} />
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
                  eventId={activeEvent.id}
                  currentRound={currentRound}
                />
              </div>
            )}

            {frontDesk === false && <section className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
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
            </section>}
          </>
        )}
      </div>
    </AppLayout>
  );
}
