import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { services } from "../services";
import { mockBettingService } from "../services/mock/mockBettingService";
import {
  mockDataService,
  createDataService,
} from "../services/mock/mockDataService";
import type { Match, Player, MatchWinnerOdds } from "../types";
import type { MatchWinnerOutcome } from "../types";
import { MATCH_ID } from "../data/matchData";
import { MATCH_REGISTRY } from "../data/matchRegistry";

export function useMatchData(matchKey?: string) {
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [mwOdds, setMwOdds] = useState<MatchWinnerOdds>({
    home: 0,
    away: 0,
    draw: 0,
  });
  const [loading, setLoading] = useState(true);
  const goalWindowRef = useRef(0);

  // When a matchKey is provided (extension picker), create a dedicated service
  // instance for that config. Otherwise fall back to the global services.data.
  const { dataService, activeMatchId } = useMemo(() => {
    if (matchKey) {
      const config = MATCH_REGISTRY[matchKey];
      if (config) {
        return {
          dataService: createDataService(config),
          activeMatchId: config.matchId,
        };
      }
    }
    return { dataService: services.data, activeMatchId: MATCH_ID };
  }, [matchKey]);

  useEffect(() => {
    let cancelled = false;
    const matchId = activeMatchId;

    async function init() {
      try {
        const [m, p, mw] = await Promise.all([
          dataService.getMatch(matchId),
          dataService.getPlayers(matchId),
          dataService.getMatchWinnerOdds(matchId),
        ]);
        if (cancelled) return;
        setMatch(m);
        setPlayers(p);
        setMwOdds(mw);
      } catch (err) {
        console.error("[goal.live] Failed to load match data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    const unsub = dataService.subscribeToMatch(matchId, {
      onMinuteTick: (minute) => {
        setMatch((prev) => (prev ? { ...prev, currentMinute: minute } : prev));
      },
      onOddsUpdate: (updatedPlayers, updatedMw) => {
        setPlayers(updatedPlayers);
        setMwOdds(updatedMw);
      },
      onGoal: async (playerId, _playerName, minute, _team) => {
        const gw = goalWindowRef.current;
        goalWindowRef.current = gw + 1;
        setMatch((prev) => (prev ? { ...prev, currentMinute: minute } : prev));
        // Delegate to betting service to process the goal event
        await mockBettingService.processGoalEvent(
          matchId,
          playerId,
          minute,
          gw,
        );
        window.dispatchEvent(new CustomEvent("gl:balanceRefresh"));
      },
      onGoalCorrected: (_originalPlayerId) => {
        // Phase 2+: VAR reversal
      },
      onScoreUpdate: (score) => {
        setMatch((prev) => (prev ? { ...prev, score } : prev));
      },
      onMatchEnd: async (score) => {
        setMatch((prev) =>
          prev ? { ...prev, status: "finished", score } : prev,
        );
        // Determine winner for MATCH_WINNER settlement
        let winner: MatchWinnerOutcome = "draw";
        if (score.home > score.away) winner = "home";
        else if (score.away > score.home) winner = "away";
        await mockBettingService.settleBets(matchId, score, winner);
        window.dispatchEvent(new CustomEvent("gl:balanceRefresh"));
      },
      onStatusChange: (status) => {
        setMatch((prev) => (prev ? { ...prev, status } : prev));
      },
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [dataService, activeMatchId]);

  // Use the cast-to-MockDataService for simulation controls; falls back gracefully
  const localMockService = dataService as typeof mockDataService;

  const startSimulation = useCallback(() => {
    localMockService.startSimulation?.(activeMatchId);
  }, [localMockService, activeMatchId]);

  const resetSimulation = useCallback(() => {
    goalWindowRef.current = 0;
    localMockService.resetSimulation?.(activeMatchId);
    mockBettingService.reset();
    dataService.getMatch(activeMatchId).then(setMatch);
    dataService.getPlayers(activeMatchId).then(setPlayers);
    dataService.getMatchWinnerOdds(activeMatchId).then(setMwOdds);
  }, [localMockService, dataService, activeMatchId]);

  const triggerGoal = useCallback(
    (playerId: string) => {
      localMockService.triggerGoal?.(activeMatchId, playerId);
    },
    [localMockService, activeMatchId],
  );

  return {
    match,
    players,
    mwOdds,
    loading,
    startSimulation,
    resetSimulation,
    triggerGoal,
    currentGoalWindow: goalWindowRef.current,
  };
}
