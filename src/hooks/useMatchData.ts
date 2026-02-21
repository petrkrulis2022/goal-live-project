import { useState, useEffect, useCallback, useRef } from "react";
import { services } from "../services";
import { mockBettingService } from "../services/mock/mockBettingService";
import { mockDataService } from "../services/mock/mockDataService";
import type { Match, Player, MatchWinnerOdds } from "../types";
import type { MatchWinnerOutcome } from "../types";
import { MOCK_MATCH_ID } from "../data/mockMatchData";

export function useMatchData() {
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [mwOdds, setMwOdds] = useState<MatchWinnerOdds>({
    home: 0,
    away: 0,
    draw: 0,
  });
  const [loading, setLoading] = useState(true);
  const goalWindowRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const matchId = MOCK_MATCH_ID;

    async function init() {
      try {
        const [m, p, mw] = await Promise.all([
          services.data.getMatch(matchId),
          services.data.getPlayers(matchId),
          services.data.getMatchWinnerOdds(matchId),
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

    const unsub = services.data.subscribeToMatch(matchId, {
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
  }, []);

  const startSimulation = useCallback(() => {
    mockDataService.startSimulation(MOCK_MATCH_ID);
  }, []);

  const resetSimulation = useCallback(() => {
    goalWindowRef.current = 0;
    mockDataService.resetSimulation(MOCK_MATCH_ID);
    mockBettingService.reset();
    // Re-fetch initial state
    services.data.getMatch(MOCK_MATCH_ID).then(setMatch);
    services.data.getPlayers(MOCK_MATCH_ID).then(setPlayers);
    services.data.getMatchWinnerOdds(MOCK_MATCH_ID).then(setMwOdds);
  }, []);

  const triggerGoal = useCallback((playerId: string) => {
    mockDataService.triggerGoal?.(MOCK_MATCH_ID, playerId);
  }, []);

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
