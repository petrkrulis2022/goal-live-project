import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { services } from "../services";
import { realDataService } from "../services/real/dataService";
import type { Match, Player, MatchWinnerOdds } from "../types";
import type { MatchWinnerOutcome } from "../types";
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

  // All matches use the real Supabase data service.
  const { dataService, activeMatchId } = useMemo(() => {
    if (matchKey) {
      const config = MATCH_REGISTRY[matchKey];
      if (config) {
        return { dataService: realDataService, activeMatchId: config.matchId };
      }
      // Not in hardcoded registry — treat matchKey as external_match_id directly
      return { dataService: realDataService, activeMatchId: matchKey };
    }
    // No matchKey — use global services.data (also real)
    return { dataService: services.data, activeMatchId: "" };
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

    // Poll mwOdds every 20s as a browser-side fast-path backup.
    // Server-side pg_cron fires sync-odds every 60s for all live matches
    // regardless, and Supabase Realtime delivers the result instantly.
    const oddsIv = setInterval(() => {
      dataService
        .getMatchWinnerOdds(matchId)
        .then((mw) => {
          if (!cancelled) setMwOdds(mw);
        })
        .catch(() => {});
    }, 20 * 1000);

    const unsub = dataService.subscribeToMatch(matchId, {
      onMinuteTick: (minute) => {
        setMatch((prev) => (prev ? { ...prev, currentMinute: minute } : prev));
      },
      onOddsUpdate: (updatedPlayers, updatedMw) => {
        setPlayers(updatedPlayers);
        setMwOdds(updatedMw);
      },
      onGoal: async (playerId, playerName, minute, _team) => {
        const gw = goalWindowRef.current;
        goalWindowRef.current = gw + 1;
        setMatch((prev) => (prev ? { ...prev, currentMinute: minute } : prev));
        await services.betting.processGoalEvent(
          activeMatchId,
          playerId,
          minute,
          gw,
        );
        window.dispatchEvent(
          new CustomEvent("gl:goalScored", {
            detail: { scorerPlayerId: playerId, scorerPlayerName: playerName },
          }),
        );
        window.dispatchEvent(new CustomEvent("gl:balanceRefresh"));
      },
      onGoalCorrected: (_originalPlayerId) => {
        // Phase 2+: VAR reversal
      },
      onScoreUpdate: (score) => {
        setMatch((prev) => (prev ? { ...prev, score } : prev));
      },
      onCornersUpdate: (cornersHome, cornersAway) => {
        setMatch((prev) =>
          prev ? { ...prev, cornersHome, cornersAway } : prev,
        );
        // Trigger bet refresh so corner settlement (active→settled) is picked up
        window.dispatchEvent(new CustomEvent("gl:balanceRefresh"));
      },
      onMatchEnd: async (score) => {
        setMatch((prev) =>
          prev ? { ...prev, status: "finished", score } : prev,
        );
        let winner: MatchWinnerOutcome = "draw";
        if (score.home > score.away) winner = "home";
        else if (score.away > score.home) winner = "away";
        await services.betting.settleBets(activeMatchId, score, winner);
        window.dispatchEvent(new CustomEvent("gl:balanceRefresh"));
      },
      onStatusChange: (status) => {
        setMatch((prev) => (prev ? { ...prev, status } : prev));
      },
    });

    return () => {
      cancelled = true;
      clearInterval(oddsIv);
      unsub();
    };
  }, [dataService, activeMatchId]);

  // Use the cast-to-MockDataService for simulation controls; falls back gracefully
  const localMockService = dataService as typeof realDataService;

  const startSimulation = useCallback(() => {
    void localMockService;
  }, [localMockService]);

  const resetSimulation = useCallback(() => {
    goalWindowRef.current = 0;
    dataService
      .getMatch(activeMatchId)
      .then(setMatch)
      .catch(() => {});
    dataService
      .getPlayers(activeMatchId)
      .then(setPlayers)
      .catch(() => {});
    dataService
      .getMatchWinnerOdds(activeMatchId)
      .then(setMwOdds)
      .catch(() => {});
  }, [dataService, activeMatchId]);

  const triggerGoal = useCallback((_playerId: string) => {
    /* no-op in real mode */
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
