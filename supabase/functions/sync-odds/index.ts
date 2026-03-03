/**
 * sync-odds — Fetch live/pre-match odds and update the players table.
 *
 * Supports two modes:
 *
 * ① MANUAL OVERRIDE (admin posts custom odds — no external API call)
 *    POST { match_id, manual_odds: [{ player_id: string, odds: number }] }
 *
 * ② LIVE API SYNC  (fetches from The Odds API)
 *    POST { match_id }
 *    — reads match.odds_api_config.{ api_key, event_id, sport } from DB, or
 *      falls back to ODDS_API_KEY / match.external_match_id env/column.
 *
 * Players are matched by name (case-insensitive, supports "Haaland Erling"
 * ↔ "Erling Haaland" and last-name-only matching).
 *
 * Returns: { success, source, players_updated, updated[] }
 *
 * Env vars needed (in supabase secrets):
 *   SUPABASE_URL              — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected
 *   ODDS_API_KEY              — The Odds API key (fallback if not in match row)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

// Shape returned by The Odds API for player markets
interface OddsApiOutcome {
  name: string;
  description?: string; // player name lives here for player markets
  price: number;
}

interface OddsApiMarket {
  key: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  key: string;
  title: string;
  markets: OddsApiMarket[];
}

interface OddsApiEvent {
  id: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { match_id, manual_odds, h2h_only } = body;

    if (!match_id) {
      return json({ error: "match_id is required" }, 400);
    }

    // ── Fetch match row ───────────────────────────────────────────────────
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("id, external_match_id, odds_api_config")
      .eq("id", match_id)
      .single();

    if (matchErr || !match) {
      return json({ error: "Match not found" }, 404);
    }

    // ── Fetch players for this match (for name-matching in live path) ─────
    const { data: players, error: playersErr } = await supabase
      .from("players")
      .select("id, external_player_id, name")
      .eq("match_id", match_id);

    if (playersErr) {
      return json(
        { error: `players query failed: ${playersErr.message}` },
        500,
      );
    }

    const updated: { player_id: string; name: string; odds: number }[] = [];

    // ════════════════════════════════════════════════════════════════════
    // ① MANUAL OVERRIDE PATH
    // ════════════════════════════════════════════════════════════════════
    if (manual_odds && Array.isArray(manual_odds)) {
      for (const entry of manual_odds as {
        player_id: string;
        odds: number;
      }[]) {
        if (!entry.player_id || entry.odds == null) continue;
        const { error } = await supabase
          .from("players")
          .update({ odds: entry.odds, updated_at: new Date().toISOString() })
          .eq("match_id", match_id)
          .eq("external_player_id", entry.player_id);

        if (!error) {
          const p = (players ?? []).find(
            (pl) => pl.external_player_id === entry.player_id,
          );
          updated.push({
            player_id: entry.player_id,
            name: p?.name ?? entry.player_id,
            odds: entry.odds,
          });
        }
      }

      return json({
        success: true,
        source: "manual",
        players_updated: updated.length,
        updated,
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // ② LIVE ODDS-API PATH
    // ════════════════════════════════════════════════════════════════════
    const config = (match.odds_api_config as Record<string, string>) ?? {};
    const apiKey = config.api_key ?? Deno.env.get("ODDS_API_KEY");
    const eventId = config.event_id ?? match.external_match_id;
    const sport = config.sport ?? "soccer_epl";

    if (!apiKey) {
      return json(
        {
          error:
            "No Odds API key configured. Set match.odds_api_config.api_key or the ODDS_API_KEY secret.",
        },
        422,
      );
    }
    if (!eventId) {
      return json(
        {
          error:
            "No event_id. Set match.odds_api_config.event_id or match.external_match_id.",
        },
        422,
      );
    }

    // ── h2h_only mode: just refresh match-winner odds, skip player stuff ──
    if (h2h_only) {
      const h2hUrl =
        `${ODDS_API_BASE}/sports/${sport}/events/${eventId}/odds` +
        `?apiKey=${apiKey}&regions=uk,eu&markets=h2h&bookmakers=betfair_ex_eu&oddsFormat=decimal`;
      const h2hRes = await fetch(h2hUrl);
      if (!h2hRes.ok) {
        const txt = await h2hRes.text();
        return json({ error: `Odds API h2h ${h2hRes.status}: ${txt}` }, 502);
      }
      const h2hData: OddsApiEvent = await h2hRes.json();
      const bm = h2hData.bookmakers?.[0];
      const mkt = bm?.markets?.find((m: OddsApiMarket) => m.key === "h2h");
      if (!mkt) {
        return json({ error: "h2h market not found in response" }, 404);
      }
      const mwOdds = {
        home:
          mkt.outcomes.find((o: OddsApiOutcome) => o.name === h2hData.home_team)
            ?.price ?? 0,
        draw:
          mkt.outcomes.find((o: OddsApiOutcome) => o.name === "Draw")?.price ??
          0,
        away:
          mkt.outcomes.find((o: OddsApiOutcome) => o.name === h2hData.away_team)
            ?.price ?? 0,
      };
      const existingCfg =
        (match.odds_api_config as Record<string, unknown>) ?? {};
      await supabase
        .from("matches")
        .update({
          odds_api_config: { ...existingCfg, match_winner_odds: mwOdds },
        })
        .eq("id", match_id);
      return json({
        success: true,
        source: "odds_api_h2h",
        bookmaker: bm?.title,
        match_winner: mwOdds,
      });
    }

    // Fetch player_goal_scorer AND h2h markets from The Odds API in parallel
    const [apiRes, h2hApiRes] = await Promise.all([
      fetch(
        `${ODDS_API_BASE}/sports/${sport}/events/${eventId}/odds` +
          `?apiKey=${apiKey}&regions=uk,us&markets=player_goal_scorer&oddsFormat=decimal`,
      ),
      fetch(
        `${ODDS_API_BASE}/sports/${sport}/events/${eventId}/odds` +
          `?apiKey=${apiKey}&regions=uk,eu&markets=h2h&bookmakers=betfair_ex_eu&oddsFormat=decimal`,
      ),
    ]);

    if (!apiRes.ok) {
      const txt = await apiRes.text();
      return json({ error: `Odds API ${apiRes.status}: ${txt}` }, 502);
    }

    const oddsData: OddsApiEvent = await apiRes.json();

    // ── Update match_winner_odds from h2h response (best-effort) ─────────
    let matchWinnerResult: { home: number; draw: number; away: number } | null =
      null;
    if (h2hApiRes.ok) {
      const h2hData: OddsApiEvent = await h2hApiRes.json();
      const bm = h2hData.bookmakers?.[0];
      const mkt = bm?.markets?.find((m: OddsApiMarket) => m.key === "h2h");
      if (mkt) {
        matchWinnerResult = {
          home:
            mkt.outcomes.find(
              (o: OddsApiOutcome) => o.name === h2hData.home_team,
            )?.price ?? 0,
          draw:
            mkt.outcomes.find((o: OddsApiOutcome) => o.name === "Draw")
              ?.price ?? 0,
          away:
            mkt.outcomes.find(
              (o: OddsApiOutcome) => o.name === h2hData.away_team,
            )?.price ?? 0,
        };
        const existingCfg =
          (match.odds_api_config as Record<string, unknown>) ?? {};
        await supabase
          .from("matches")
          .update({
            odds_api_config: {
              ...existingCfg,
              match_winner_odds: matchWinnerResult,
            },
          })
          .eq("id", match_id);
      }
    }

    // ── Average odds across all bookmakers ───────────────────────────────
    const accumulator: Record<string, number[]> = {};

    for (const bookmaker of oddsData.bookmakers ?? []) {
      for (const market of bookmaker.markets ?? []) {
        if (market.key !== "player_goal_scorer") continue;
        for (const outcome of market.outcomes ?? []) {
          // Player name is in 'description' for player markets; fallback to 'name'
          const playerName = (outcome.description ?? outcome.name).trim();
          if (!accumulator[playerName]) accumulator[playerName] = [];
          accumulator[playerName].push(outcome.price);
        }
      }
    }

    const averaged: Record<string, number> = {};
    for (const [name, prices] of Object.entries(accumulator)) {
      averaged[name] = prices.reduce((a, b) => a + b, 0) / prices.length;
    }

    // ── Match API names → DB players ──────────────────────────────────────
    for (const player of players ?? []) {
      // Try multiple name variants: stored ("Haaland Erling"), reversed ("Erling Haaland"), surname only
      const parts = player.name.split(" ");
      const reversed = [...parts].reverse().join(" ");
      const surname = parts[parts.length - 1];
      const variants = [player.name, reversed, surname];

      let matchedOdds: number | null = null;
      for (const variant of variants) {
        const key = Object.keys(averaged).find((k) =>
          k.toLowerCase().includes(variant.toLowerCase()),
        );
        if (key) {
          matchedOdds = averaged[key];
          break;
        }
      }

      if (matchedOdds !== null) {
        const rounded = Math.round(matchedOdds * 100) / 100;
        await supabase
          .from("players")
          .update({ odds: rounded, updated_at: new Date().toISOString() })
          .eq("id", player.id);

        updated.push({
          player_id: player.external_player_id,
          name: player.name,
          odds: rounded,
        });
      }
    }

    return json({
      success: true,
      source: "odds_api",
      event_id: eventId,
      bookmakers_checked: (oddsData.bookmakers ?? []).length,
      players_updated: updated.length,
      updated,
      match_winner: matchWinnerResult,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
