"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { LeagueEventRecord } from "@/lib/data/events";
import {
  getPlayers,
  type DatabasePlayerRecord,
} from "@/lib/data/players";
import { generateNextRound } from "@/lib/ladder/generateNextRound";
import type { GeneratedCourt } from "@/types/court";
import type { Player } from "@/types/player";

export type CourtPairing = {
  pairingIndex: number;
  team1PlayerIds: [number, number];
  team2PlayerIds: [number, number];
};

export type CourtResult = {
  team1Score: number;
  team2Score: number;
  complete: boolean;
};

export type PlayerDatabaseIds = Record<number, string>;

type CourtPairings = Record<number, CourtPairing>;
type CourtResults = Record<number, CourtResult>;

type LeagueContextValue = {
  players: Player[];
  currentRound: number;
  courts: GeneratedCourt[];
  courtPairings: CourtPairings;
  courtResults: CourtResults;
  activeEvent: LeagueEventRecord | null;

  playerDatabaseIds: PlayerDatabaseIds;
  isLoadingPlayers: boolean;
  playerLoadError: string;

  setPlayers: Dispatch<SetStateAction<Player[]>>;
  setCurrentRound: Dispatch<SetStateAction<number>>;
  setActiveEvent: Dispatch<
    SetStateAction<LeagueEventRecord | null>
  >;

  setCourts: (courts: GeneratedCourt[]) => void;

  confirmCourtPairing: (
    courtId: number,
    pairingIndex: number,
  ) => void;

  saveCourtResult: (
    courtId: number,
    team1Score: number,
    team2Score: number,
  ) => void;

  advanceToNextRound: () => void;
  reloadPlayers: () => Promise<void>;
  resetLeague: () => void;
};

const LeagueContext =
  createContext<LeagueContextValue | null>(null);

type LeagueProviderProps = {
  children: ReactNode;
};

function createRuntimePlayer(
  databasePlayer: DatabasePlayerRecord,
  runtimeId: number,
): Player {
  return {
    id: runtimeId,
    name: databasePlayer.name,
    dupr: Number(databasePlayer.dupr),
    checkedIn: false,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDifferential: 0,
  };
}

function resetPlayerForNewEvent(
  player: Player,
): Player {
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

function createPairing(
  court: GeneratedCourt,
  pairingIndex: number,
): CourtPairing {
  const [playerA, playerB, playerC, playerD] =
    court.players;

  if (!playerA || !playerB || !playerC || !playerD) {
    throw new Error(
      `Court ${court.id} must contain four players.`,
    );
  }

  const options: CourtPairing[] = [
    {
      pairingIndex: 0,
      team1PlayerIds: [playerA.id, playerB.id],
      team2PlayerIds: [playerC.id, playerD.id],
    },
    {
      pairingIndex: 1,
      team1PlayerIds: [playerA.id, playerC.id],
      team2PlayerIds: [playerB.id, playerD.id],
    },
    {
      pairingIndex: 2,
      team1PlayerIds: [playerA.id, playerD.id],
      team2PlayerIds: [playerB.id, playerC.id],
    },
  ];

  const selectedPairing = options[pairingIndex];

  if (!selectedPairing) {
    throw new Error(
      `Pairing ${pairingIndex} is invalid.`,
    );
  }

  return selectedPairing;
}

export function LeagueProvider({
  children,
}: LeagueProviderProps) {
  const [players, setPlayers] = useState<Player[]>([]);

  const [playerDatabaseIds, setPlayerDatabaseIds] =
    useState<PlayerDatabaseIds>({});

  const [isLoadingPlayers, setIsLoadingPlayers] =
    useState(true);

  const [playerLoadError, setPlayerLoadError] =
    useState("");

  const [currentRound, setCurrentRound] =
    useState(1);

  const [courts, setCourtsState] =
    useState<GeneratedCourt[]>([]);

  const [courtPairings, setCourtPairings] =
    useState<CourtPairings>({});

  const [courtResults, setCourtResults] =
    useState<CourtResults>({});

  const [activeEvent, setActiveEvent] =
    useState<LeagueEventRecord | null>(null);

  const reloadPlayers = useCallback(async () => {
    try {
      setIsLoadingPlayers(true);
      setPlayerLoadError("");

      const databasePlayers = await getPlayers();

      const runtimePlayers = databasePlayers.map(
        (databasePlayer, index) =>
          createRuntimePlayer(
            databasePlayer,
            index + 1,
          ),
      );

      const databaseIds =
        databasePlayers.reduce<PlayerDatabaseIds>(
          (idMap, databasePlayer, index) => {
            idMap[index + 1] = databasePlayer.id;
            return idMap;
          },
          {},
        );

      setPlayers(runtimePlayers);
      setPlayerDatabaseIds(databaseIds);
    } catch (error) {
      console.error(
        "Unable to load players:",
        error,
      );

      setPlayers([]);
      setPlayerDatabaseIds({});

      setPlayerLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load players.",
      );
    } finally {
      setIsLoadingPlayers(false);
    }
  }, []);

  useEffect(() => {
    void reloadPlayers();
  }, [reloadPlayers]);

  const setCourts = useCallback(
    (newCourts: GeneratedCourt[]) => {
      setCourtsState(newCourts);
      setCourtPairings({});
      setCourtResults({});
    },
    [],
  );

  const confirmCourtPairing = useCallback(
    (courtId: number, pairingIndex: number) => {
      const court = courts.find(
        (currentCourt) =>
          currentCourt.id === courtId,
      );

      if (!court) {
        throw new Error(
          `Court ${courtId} was not found.`,
        );
      }

      const pairing = createPairing(
        court,
        pairingIndex,
      );

      setCourtPairings((currentPairings) => ({
        ...currentPairings,
        [courtId]: pairing,
      }));
    },
    [courts],
  );

  const saveCourtResult = useCallback(
    (
      courtId: number,
      team1Score: number,
      team2Score: number,
    ) => {
      if (
        !Number.isInteger(team1Score) ||
        !Number.isInteger(team2Score)
      ) {
        throw new Error(
          "Scores must be whole numbers.",
        );
      }

      if (team1Score < 0 || team2Score < 0) {
        throw new Error(
          "Scores cannot be negative.",
        );
      }

      if (team1Score === team2Score) {
        throw new Error(
          "The final score cannot be tied.",
        );
      }

      const pairing = courtPairings[courtId];

      if (!pairing) {
        throw new Error(
          `Court ${courtId} does not have a confirmed pairing.`,
        );
      }

      if (courtResults[courtId]?.complete) {
        throw new Error(
          `Court ${courtId} already has a completed result.`,
        );
      }

      const team1Won = team1Score > team2Score;

      const team1PlayerIds = new Set(
        pairing.team1PlayerIds,
      );

      const team2PlayerIds = new Set(
        pairing.team2PlayerIds,
      );

      setPlayers((currentPlayers) =>
        currentPlayers.map((player) => {
          if (team1PlayerIds.has(player.id)) {
            return {
              ...player,
              wins:
                player.wins + (team1Won ? 1 : 0),
              losses:
                player.losses + (team1Won ? 0 : 1),
              pointsFor:
                player.pointsFor + team1Score,
              pointsAgainst:
                player.pointsAgainst + team2Score,
              pointDifferential:
                player.pointDifferential +
                team1Score -
                team2Score,
            };
          }

          if (team2PlayerIds.has(player.id)) {
            return {
              ...player,
              wins:
                player.wins + (team1Won ? 0 : 1),
              losses:
                player.losses + (team1Won ? 1 : 0),
              pointsFor:
                player.pointsFor + team2Score,
              pointsAgainst:
                player.pointsAgainst + team1Score,
              pointDifferential:
                player.pointDifferential +
                team2Score -
                team1Score,
            };
          }

          return player;
        }),
      );

      setCourtResults((currentResults) => ({
        ...currentResults,
        [courtId]: {
          team1Score,
          team2Score,
          complete: true,
        },
      }));
    },
    [courtPairings, courtResults],
  );

  const advanceToNextRound = useCallback(() => {
    if (courts.length === 0) {
      throw new Error(
        "There are no courts to advance.",
      );
    }

    const courtWithoutPairing = courts.find(
      (court) => !courtPairings[court.id],
    );

    if (courtWithoutPairing) {
      throw new Error(
        `Court ${courtWithoutPairing.id} does not have a confirmed pairing.`,
      );
    }

    const incompleteCourt = courts.find(
      (court) =>
        !courtResults[court.id]?.complete,
    );

    if (incompleteCourt) {
      throw new Error(
        `Court ${incompleteCourt.id} does not have a completed result.`,
      );
    }

    const nextCourts = generateNextRound(
      courts,
      courtPairings,
      courtResults,
    );

    setCourtsState(nextCourts);

    setCurrentRound(
      (previousRound) => previousRound + 1,
    );

    setCourtPairings({});
    setCourtResults({});
  }, [courts, courtPairings, courtResults]);

  const resetLeague = useCallback(() => {
    setPlayers((currentPlayers) =>
      currentPlayers.map(resetPlayerForNewEvent),
    );

    setCurrentRound(1);
    setCourtsState([]);
    setCourtPairings({});
    setCourtResults({});
    setActiveEvent(null);
  }, []);

  const value = useMemo<LeagueContextValue>(
    () => ({
      players,
      currentRound,
      courts,
      courtPairings,
      courtResults,
      activeEvent,
      playerDatabaseIds,
      isLoadingPlayers,
      playerLoadError,
      setPlayers,
      setCurrentRound,
      setActiveEvent,
      setCourts,
      confirmCourtPairing,
      saveCourtResult,
      advanceToNextRound,
      reloadPlayers,
      resetLeague,
    }),
    [
      players,
      currentRound,
      courts,
      courtPairings,
      courtResults,
      activeEvent,
      playerDatabaseIds,
      isLoadingPlayers,
      playerLoadError,
      setCourts,
      confirmCourtPairing,
      saveCourtResult,
      advanceToNextRound,
      reloadPlayers,
      resetLeague,
    ],
  );

  return (
    <LeagueContext.Provider value={value}>
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  const context = useContext(LeagueContext);

  if (!context) {
    throw new Error(
      "useLeague must be used inside LeagueProvider.",
    );
  }

  return context;
}