// ─────────────────────────────────────────────
//  Real Data Service — Supabase Phase 2
// ─────────────────────────────────────────────
import type { IDataService, MatchCallbacks } from "../../types/services.types";
import type { Match, Player, MatchWinnerOdds } from "../../types";
import { supabase, type DbMatch, type DbPlayer } from "../../lib/supabase";

// ── helpers ────────────────────────────────────────────────────────────────

function dbMatchToMatch(row: DbMatch): Match {
  return {
    id: row.external_match_id,
    dbId: row.id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    status: row.status as Match["status"],
    currentMinute: row.current_minute,
    score: { home: row.score_home, away: row.score_away },
    half: row.half as 1 | 2,
    contractAddress: row.contract_address ?? null,
    cornersHome: ((row as Record<string, unknown>).corners_home as number) ?? 0,
    cornersAway: ((row as Record<string, unknown>).corners_away as number) ?? 0,
  };
}

function dbPlayerToPlayer(row: DbPlayer): Player {
  return {
    id: row.external_player_id,
    name: row.name,
    team: row.team,
    number: row.jersey_number ?? 0,
    position: row.position ?? "",
    odds: Number(row.odds),
    isStarter: row.is_starter ?? false,
  };
}

class SupabaseDataService implements IDataService {
  // ── getMatch ─────────────────────────────────
  async getMatch(matchId: string): Promise<Match> {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("external_match_id", matchId)
      .single();
    if (error || !data) throw new Error(`Match not found: ${matchId}`);
    return dbMatchToMatch(data as DbMatch);
  }

  // ── getPlayers ────────────────────────────────
  async getPlayers(matchId: string): Promise<Player[]> {
    // First resolve uuid from external_match_id
    const { data: match, error: me } = await supabase
      .from("matches")
      .select("id")
      .eq("external_match_id", matchId)
      .single();
    if (me || !match) throw new Error(`Match not found: ${matchId}`);

    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("match_id", match.id)
      .order("team")
      .order("odds");
    if (error) throw new Error(error.message);
    return (data as DbPlayer[]).map(dbPlayerToPlayer);
  }

  // ── getMatchWinnerOdds ────────────────────────
  // Reads the dedicated odds columns written by:
  //  • admin panel fetchMatchOdds (live Betfair call → writes odds_home/draw/away)
  //  • pg_cron sync-odds every 60 s for all live matches
  //  • sync-odds edge function when called directly
  // Supabase Realtime pushes changes to these columns to the extension instantly.
  async getMatchWinnerOdds(matchId: string): Promise<MatchWinnerOdds> {
    const { data, error } = await supabase
      .from("matches")
      .select("id, odds_api_config, odds_home, odds_draw, odds_away")
      .eq("external_match_id", matchId)
      .single();
    if (error || !data) throw new Error(`Match not found: ${matchId}`);

    // Corner odds from odds_api_config.corner_odds (admin-set)
    const cfg = (data.odds_api_config ?? {}) as Record<string, unknown>;
    const rawCorner = cfg.corner_odds as
      | { home?: number; away?: number }
      | undefined;
    const cornerOdds =
      rawCorner?.home && rawCorner?.away
        ? { home: rawCorner.home, away: rawCorner.away }
        : undefined;

    // Dedicated columns — written by admin, pg_cron, and sync-odds.
    if (data.odds_home || data.odds_draw || data.odds_away) {
      return {
        home: (data.odds_home as number) ?? 1,
        draw: (data.odds_draw as number) ?? 1,
        away: (data.odds_away as number) ?? 1,
        cornerOdds,
      };
    }

    // Fallback: legacy JSON blob (written by older admin versions).
    const mw = (cfg.match_winner_odds ?? {}) as Record<string, number>;
    return {
      home: mw.home ?? 1,
      away: mw.away ?? 1,
      draw: mw.draw ?? 1,
      cornerOdds,
    };
  }

  // ── subscribeToMatch ────────────────────────
  subscribeToMatch(matchId: string, callbacks: MatchCallbacks): () => void {
    let matchUuid = "";
    let minuteTimer: ReturnType<typeof setInterval> | null = null;
    let cachedPlayers: Awaited<ReturnType<typeof this.getPlayers>> = [];
    // Track previous score to detect goals from the matches UPDATE channel.
    // goal_events Realtime may not be in the publication, so we can't rely on it.
    let prevScoreHome = 0;
    let prevScoreAway = 0;
    // Deduplicate: track match_id+minute combos already fired via goal_events Realtime
    // so we don't double-fire if that eventually starts working too.
    const firedGoalKeys = new Set<string>();

    // Resolve uuid then set up Realtime subscriptions
    supabase
      .from("matches")
      .select("id, current_minute, score_home, score_away")
      .eq("external_match_id", matchId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        matchUuid = data.id;
        // Seed previous score so first Realtime UPDATE doesn't misfire
        prevScoreHome = data.score_home ?? 0;
        prevScoreAway = data.score_away ?? 0;

        // Poll minute every 10s (Supabase Realtime doesn't push every second)
        minuteTimer = setInterval(async () => {
          const { data: m } = await supabase
            .from("matches")
            .select("current_minute, status, score_home, score_away")
            .eq("id", matchUuid)
            .single();
          if (!m) return;
          callbacks.onMinuteTick(m.current_minute);
          callbacks.onScoreUpdate({ home: m.score_home, away: m.score_away });
          if (m.status === "finished") {
            callbacks.onMatchEnd({ home: m.score_home, away: m.score_away });
          }
        }, 10_000);
      });

    // Realtime: match row changes (status, score, minute)
    const matchChannel = supabase
      .channel(`match:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `external_match_id=eq.${matchId}`,
        },
        (payload) => {
          const row = payload.new as DbMatch;
          callbacks.onMinuteTick(row.current_minute);
          callbacks.onScoreUpdate({
            home: row.score_home,
            away: row.score_away,
          });
          callbacks.onStatusChange(row.status as Match["status"]);
          if (row.status === "finished") {
            callbacks.onMatchEnd({
              home: row.score_home,
              away: row.score_away,
            });
          }
          // Detect goals from score increase (goal_events Realtime may not be enabled
          // in the publication, so this is the reliable path for onGoal).
          const deltaHome = Math.max(0, row.score_home - prevScoreHome);
          const deltaAway = Math.max(0, row.score_away - prevScoreAway);
          if (deltaHome > 0 || deltaAway > 0) {
            const capturedPrevHome = prevScoreHome;
            const capturedPrevAway = prevScoreAway;
            const capturedMinute = row.current_minute;
            const capturedUuid = matchUuid;
            prevScoreHome = row.score_home;
            prevScoreAway = row.score_away;
            // Wait 1.5s so sync-match-status can insert goal_events, then query scorers.
            setTimeout(async () => {
              let homeEvents: Array<{
                player_id: string;
                player_name: string;
                minute: number;
              }> = [];
              let awayEvents: Array<{
                player_id: string;
                player_name: string;
                minute: number;
              }> = [];
              if (capturedUuid) {
                const { data: evts } = await supabase
                  .from("goal_events")
                  .select("id, player_id, player_name, minute, team")
                  .eq("match_id", capturedUuid)
                  .eq("event_type", "GOAL")
                  .gte("minute", Math.max(0, capturedMinute - 10))
                  .order("minute", { ascending: false })
                  .limit(10);
                if (evts) {
                  homeEvents = evts
                    .filter((e: { team: string }) => e.team === "home")
                    .slice(0, deltaHome);
                  awayEvents = evts
                    .filter((e: { team: string }) => e.team === "away")
                    .slice(0, deltaAway);
                }
              }
              for (let i = 0; i < deltaHome; i++) {
                const e = homeEvents[i];
                const key = `home-${capturedPrevHome + i + 1}`;
                if (firedGoalKeys.has(key)) continue;
                firedGoalKeys.add(key);
                callbacks.onGoal(
                  e?.player_id ?? "unknown",
                  e?.player_name ?? "Unknown scorer",
                  e?.minute ?? capturedMinute,
                  "home",
                );
              }
              for (let i = 0; i < deltaAway; i++) {
                const e = awayEvents[i];
                const key = `away-${capturedPrevAway + i + 1}`;
                if (firedGoalKeys.has(key)) continue;
                firedGoalKeys.add(key);
                callbacks.onGoal(
                  e?.player_id ?? "unknown",
                  e?.player_name ?? "Unknown scorer",
                  e?.minute ?? capturedMinute,
                  "away",
                );
              }
            }, 1500);
          } else {
            // Keep trackers in sync even when no goal (in case we missed an update)
            prevScoreHome = row.score_home;
            prevScoreAway = row.score_away;
          }
          // Propagate corner count changes so client can react to corner settlements
          if (
            (row.corners_home ?? 0) + (row.corners_away ?? 0) > 0 &&
            callbacks.onCornersUpdate
          ) {
            callbacks.onCornersUpdate(
              row.corners_home ?? 0,
              row.corners_away ?? 0,
            );
          }
          // If pg_cron sync-odds wrote new odds columns, deliver them instantly
          // without waiting for the next 20s browser poll.
          if (row.odds_home || row.odds_draw || row.odds_away) {
            const mw: MatchWinnerOdds = {
              home: row.odds_home ?? 0,
              draw: row.odds_draw ?? 0,
              away: row.odds_away ?? 0,
              egOdds:
                (row.exact_goals_odds as Record<string, number>) ?? undefined,
            };
            if (cachedPlayers.length > 0) {
              callbacks.onOddsUpdate(cachedPlayers, mw);
            }
          }
        },
      )
      .subscribe();

    // Realtime: player odds changes
    const playersChannel = supabase
      .channel(`players:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "players",
        },
        async () => {
          // Refetch all players when any odds change; update cache for matchChannel
          const players = await this.getPlayers(matchId);
          cachedPlayers = players;
          const mwOdds = await this.getMatchWinnerOdds(matchId);
          callbacks.onOddsUpdate(players, mwOdds);
        },
      )
      .subscribe();

    // Realtime: new goal events (belt-and-suspenders — goal_events may not be in the
    // Realtime publication; the primary goal-detection path is the matchChannel score check above).
    const goalsChannel = supabase
      .channel(`goals:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "goal_events",
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            player_id: string;
            player_name: string;
            minute: number;
            team: "home" | "away";
            event_type: string;
          };
          if (row.event_type === "GOAL") {
            // Use score-based key to deduplicate with the matchChannel path.
            // We don't know the goal number here without querying, so just fire and
            // let processGoalEvent dedup via DB idempotency (it overwrites the same bet).
            callbacks.onGoal(
              row.player_id,
              row.player_name,
              row.minute,
              row.team,
            );
          } else if (row.event_type === "VAR_OVERTURNED") {
            callbacks.onGoalCorrected(row.player_id);
          }
        },
      )
      .subscribe();

    // Return unsubscribe fn
    return () => {
      if (minuteTimer) clearInterval(minuteTimer);
      supabase.removeChannel(matchChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(goalsChannel);
    };
  }
}

export const realDataService = new SupabaseDataService();
