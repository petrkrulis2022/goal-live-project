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
  // Calls sync-odds (h2h_only) to get a fresh quote from The Odds API,
  // which also writes the result back to DB. Falls back to the cached DB
  // value if the edge function call fails (quota exceeded, network, etc.).
  async getMatchWinnerOdds(matchId: string): Promise<MatchWinnerOdds> {
    const { data, error } = await supabase
      .from("matches")
      .select("id, odds_api_config, odds_home, odds_draw, odds_away")
      .eq("external_match_id", matchId)
      .single();
    if (error || !data) throw new Error(`Match not found: ${matchId}`);

    // Try to get a fresh quote via the sync-odds edge function.
    try {
      const res = await fetch(
        `https://weryswulejhjkrmervnf.supabase.co/functions/v1/sync-odds`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey:
              "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlcnlzd3VsZWpoamtybWVydm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjEyODEsImV4cCI6MjA4NzU5NzI4MX0.fxMn2LMdoFuYAln-34WUo1uUiWjSnlSzJlDS-sepdtc",
          },
          body: JSON.stringify({ match_id: data.id, h2h_only: true }),
        },
      );
      if (res.ok) {
        const json = await res.json();
        const mw = json.match_winner as Record<string, number> | undefined;
        if (mw && (mw.home || mw.draw || mw.away)) {
          return {
            home: mw.home ?? 1,
            away: mw.away ?? 1,
            draw: mw.draw ?? 1,
          };
        }
      }
    } catch {
      // Fall through to cached value
    }

    // Fallback: dedicated columns (written by pg_cron + every successful sync-odds call)
    // These are more reliable than the legacy odds_api_config JSON blob.
    if (data.odds_home || data.odds_draw || data.odds_away) {
      return {
        home: (data.odds_home as number) ?? 1,
        draw: (data.odds_draw as number) ?? 1,
        away: (data.odds_away as number) ?? 1,
      };
    }

    // Final fallback: legacy JSON blob.
    const cfg = (data.odds_api_config ?? {}) as Record<string, unknown>;
    const mw = (cfg.match_winner_odds ?? {}) as Record<string, number>;
    return {
      home: mw.home ?? 1,
      away: mw.away ?? 1,
      draw: mw.draw ?? 1,
    };
  }

  // ── subscribeToMatch ────────────────────────
  subscribeToMatch(matchId: string, callbacks: MatchCallbacks): () => void {
    let matchUuid = "";
    let minuteTimer: ReturnType<typeof setInterval> | null = null;
    let cachedPlayers: Awaited<ReturnType<typeof this.getPlayers>> = [];

    // Resolve uuid then set up Realtime subscriptions
    supabase
      .from("matches")
      .select("id, current_minute")
      .eq("external_match_id", matchId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        matchUuid = data.id;

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

    // Realtime: new goal events
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
            player_id: string;
            player_name: string;
            minute: number;
            team: "home" | "away";
            event_type: string;
          };
          if (row.event_type === "GOAL") {
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
