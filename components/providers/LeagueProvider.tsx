"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import type { AppliedRow } from "@/lib/data/playerImport";
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
  prepareCheckIn: (rows: AppliedRow[], replaceSelection: boolean) => void;
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
    savedDupr: Number(databasePlayer.dupr),
    duprId: databasePlayer.dupr_id ?? null,
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
    dupr: player.savedDupr ?? player.dupr,
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

const leagueStaffPages = new Set(["/admin", "/admin/players", "/admin/scores", "/setup", "/walking"]);

export function LeagueProvider({
  children,
}: LeagueProviderProps) {
  const needsPlayers = leagueStaffPages.has(usePathname());
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

  // Court components use numeric IDs within a browser session. Allocate them
  // from UUIDs so a refresh or rating change cannot move a selection to a different player.
  const runtimeIds = useRef(new Map<string, number>());
  const playerLoadVersion = useRef(0);

  const toRuntimePlayers = useCallback((records: DatabasePlayerRecord[]) => {
    const newIds: PlayerDatabaseIds = {};
    const mapped = records.map((record) => {
      let runtimeId = runtimeIds.current.get(record.id);
      if (runtimeId === undefined) {
        runtimeId = runtimeIds.current.size + 1;
        runtimeIds.current.set(record.id, runtimeId);
        newIds[runtimeId] = record.id;
      }
      return createRuntimePlayer(record, runtimeId);
    });
    if (Object.keys(newIds).length > 0) {
      setPlayerDatabaseIds((current) => ({ ...current, ...newIds }));
    }
    return mapped;
  }, []);

  const reloadPlayers = useCallback(async () => {
    const version = ++playerLoadVersion.current;
    try {
      setIsLoadingPlayers(true);
      setPlayerLoadError("");
      const records = await getPlayers();
      if (version !== playerLoadVersion.current) return;

      const refreshed = toRuntimePlayers(records);
      const byId = new Map(refreshed.map((player) => [player.id, player]));
      setPlayers((current) => {
        const checkedIn = current.flatMap((player) => {
          const latest = byId.get(player.id);
          return player.checkedIn && latest
            ? [{ ...latest, checkedIn: true, dupr: player.dupr }]
            : [];
        });
        const checkedIds = new Set(checkedIn.map((player) => player.id));
        return [...checkedIn, ...refreshed.filter((player) => !checkedIds.has(player.id))];
      });
    } catch (error) {
      if (version !== playerLoadVersion.current) return;
      setPlayerLoadError(error instanceof Error ? error.message : "Unable to load players.");
    } finally {
      if (version === playerLoadVersion.current) setIsLoadingPlayers(false);
    }
  }, [toRuntimePlayers]);

  const prepareCheckIn = useCallback((rows: AppliedRow[], replaceSelection: boolean) => {
    const resolved = rows.flatMap(({ player, rating }) => player ? [{ player, rating }] : []);
    if (resolved.length === 0) return;
    const refreshed = toRuntimePlayers(resolved.map(({ player }) => player));
    const selected = refreshed.map((player, index) => ({
      ...player,
      checkedIn: true,
      dupr: resolved[index].rating ?? player.dupr,
    }));
    const selectedById = new Map(selected.map((player) => [player.id, player]));

    setPlayers((current) => {
      if (replaceSelection) {
        return [
          ...selected,
          ...current.filter((player) => !selectedById.has(player.id))
            .map((player) => player.checkedIn ? { ...player, checkedIn: false, dupr: player.savedDupr ?? player.dupr } : player),
        ];
      }

      const checkedIn = current.filter((player) => player.checkedIn);
      const checkedIds = new Set(checkedIn.map((player) => player.id));
      return [
        ...checkedIn.map((player) => selectedById.get(player.id) ?? player),
        ...selected.filter((player) => !checkedIds.has(player.id)),
        ...current.filter((player) => !player.checkedIn && !selectedById.has(player.id)),
      ];
    });
  }, [toRuntimePlayers]);

  useEffect(() => {
    if (!needsPlayers) return;
    let canceled = false;
    queueMicrotask(() => {
      if (!canceled) void reloadPlayers();
    });
    return () => { canceled = true; };
  }, [needsPlayers, reloadPlayers]);

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
      prepareCheckIn,
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
      prepareCheckIn,
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