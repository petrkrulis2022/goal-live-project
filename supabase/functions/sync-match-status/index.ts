/**
 * sync-match-status — Sync match status, score, minute from StatsPerform MA1.
 *                     Detects score changes and inserts goal_events from MA3.
 *                     Tracks corners via MA3 typeId=22 events.
 *
 * Queries `matches` rows where `statsperform_match_id IS NOT NULL` and status
 * is not yet finished/cancelled.
 *
 * Per match: calls StatsPerform MA1 for live status/score. When score changes,
 * calls MA3 for goal events and corner counts.
 *
 * Status mapping from StatsPerform matchStatus field:
 *   "Fixture" / "PreMatch" → pre-match
 *   "Playing"              → live
 *   "HalfTime"             → halftime
 *   "FullTime"             → sets legacy FT flag goalserve_finished=true
 *                              (enables admin Settle button)
 *   "Postponed"/"Cancelled"→ cancelled
 *
 * Status transitions are forward-only. The live → finished transition is NEVER
 * done by this function. Settlement is an explicit admin/CRE action via
 * the settle-match edge function.
 *
 * Also updates: current_minute, score_home, score_away, corners_home,
 *               corners_away, corners_last_settled, goalserve_finished (legacy FT flag), updated_at
 *
 * Called by pg_cron every minute via pg_net. Can also be triggered manually:
 *   POST /functions/v1/sync-match-status   (no body required)
 *
 * Env vars:
 *   SUPABASE_URL               — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY  — auto-injected
 *   STATSPERFORM_API_KEY       — StatsPerform trial key
 *   STATSPERFORM_CLIENT_ID     — OAuth client_id
 *   STATSPERFORM_CLIENT_SECRET — OAuth client_secret
 *   STATSPERFORM_BASE_URL      — https://api.statsperform.com/sdapi/v1
 *   STATSPERFORM_OAUTH_URL     — https://api.statsperform.com/realms/apigw/protocol/openid-connect/token
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getSpToken,
  getSpMatchLive,
  getSpMatchEvents,
} from "../_shared/statsperform.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Forward-only transition rules for match status.
const STATUS_ORDER: Record<string, number> = {
  "pre-match": 0,
  live: 1,
  halftime: 2, // halftime can go back to live (2nd half kickoff) — handled specially
  finished: 3,
  cancelled: 4,
};

/** Settle all active NEXT_CORNER bets when a corner is taken by winningTeam.
 * Bets whose outcome matches winningTeam win; all others lose.
 * Note: does NOT filter by current_player_id so it works for bets stored in
 * any format (sequential number OR legacy "home"/"away" string). */
async function settleCornerBets(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  matchId: string,
  winningTeam: "home" | "away",
): Promise<void> {
  const { data: bets } = await supabase
    .from("bets")
    .select("id, odds, current_amount, outcome")
    .eq("match_id", matchId)
    .eq("bet_type", "NEXT_CORNER")
    .eq("status", "active");

  if (!bets || bets.length === 0) return;

  for (const bet of bets) {
    const won = bet.outcome === winningTeam;
    await supabase
      .from("bets")
      .update({
        status: won ? "settled_won" : "settled_lost",
        updated_at: new Date().toISOString(),
      })
      .eq("id", bet.id);
  }
}

/**
 * Settle all active NEXT_GOAL_SCORER bets after a goal is scored.
 * For each goal, bets whose current_player_id matches the scorer (by any
 * candidate ID variant) win; all other active bets in the match lose.
 * This is the server-side complement to the client-side processGoalEvent.
 * It runs regardless of the client-side goal_window_at_placement counter.
 *
 * @param scorerIds — all candidate IDs for the scorer (raw SP, sp_xxx, odds_xxx)
 */
async function settleNgsBets(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  matchId: string,
  scorerIds: Set<string>,
): Promise<void> {
  const { data: bets } = await supabase
    .from("bets")
    .select("id, current_player_id")
    .eq("match_id", matchId)
    .eq("bet_type", "NEXT_GOAL_SCORER")
    .eq("status", "active");

  if (!bets || bets.length === 0) return;

  for (const bet of bets) {
    const won = scorerIds.has(bet.current_player_id);
    await supabase
      .from("bets")
      .update({
        status: won ? "provisional_win" : "provisional_loss",
        updated_at: new Date().toISOString(),
      })
      .eq("id", bet.id);
  }
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

    // ── Get StatsPerform OAuth token (shared across all match calls) ───────
    let spToken: string;
    try {
      spToken = await getSpToken();
    } catch (tokenErr) {
      return json({ error: `StatsPerform OAuth failed: ${tokenErr}` }, 502);
    }

    // ── Fetch our DB matches that have a StatsPerform ID and are not done ──
    const { data: dbMatches, error: dbErr } = await supabase
      .from("matches")
      .select(
        "id, statsperform_match_id, status, current_minute, score_home, score_away, goalserve_finished, corners_home, corners_away, corners_last_settled",
      )
      .not("status", "in", '("finished","cancelled")')
      .not("statsperform_match_id", "is", null);

    if (dbErr) {
      return json({ error: `DB query failed: ${dbErr.message}` }, 500);
    }

    if (!dbMatches || dbMatches.length === 0) {
      return json({
        success: true,
        message: "No StatsPerform-tracked matches active",
        updated: 0,
      });
    }

    let updatedCount = 0;
    const updatedMatches: {
      id: string;
      old_status: string;
      new_status: string;
      minute: number | null;
    }[] = [];

    for (const dbMatch of dbMatches) {
      // ── Call StatsPerform MA1 for this match ─────────────────────────────
      const spData = await getSpMatchLive(
        dbMatch.statsperform_match_id,
        spToken,
      );
      if (!spData) {
        console.warn(
          `[sync] MA1 returned null for ${dbMatch.statsperform_match_id} — skipping`,
        );
        continue;
      }

      const currentStatus: string = dbMatch.status;
      const newStatus = spData.status;

      // Determine if we should apply a status transition.
      // live → finished is NEVER applied here; admin must trigger settle-match.
      const shouldUpdate = (() => {
        if (currentStatus === newStatus) return false;
        if (currentStatus === "finished" || currentStatus === "cancelled") {
          return false;
        }
        if (currentStatus === "halftime" && newStatus === "live") {
          return true; // second half kickoff
        }
        if (newStatus === "finished") {
          return false; // settlement is admin's job
        }
        return (
          (STATUS_ORDER[newStatus] ?? -1) > (STATUS_ORDER[currentStatus] ?? -1)
        );
      })();

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      let hasChanges = false;

      if (shouldUpdate) {
        updates.status = newStatus;
        hasChanges = true;
      }

      // When StatsPerform signals FullTime, set the flag so the admin Settle
      // button becomes enabled. We do NOT change status here — that's the
      // admin's job via settle-match.
      if (spData.isFullTime && !dbMatch.goalserve_finished) {
        updates.goalserve_finished = true;
        hasChanges = true;
      }

      // Sync minute and score when match is live or halftime
      if (newStatus === "live" || newStatus === "halftime") {
        if (
          spData.minute !== null &&
          spData.minute !== dbMatch.current_minute
        ) {
          updates.current_minute = spData.minute;
          hasChanges = true;
        }
      }

      if (
        spData.scoreHome !== null &&
        spData.scoreHome !== dbMatch.score_home
      ) {
        updates.score_home = spData.scoreHome;
        hasChanges = true;
      }
      if (
        spData.scoreAway !== null &&
        spData.scoreAway !== dbMatch.score_away
      ) {
        updates.score_away = spData.scoreAway;
        hasChanges = true;
      }

      const matchIsLive =
        newStatus === "live" ||
        newStatus === "halftime" ||
        currentStatus === "live" ||
        currentStatus === "halftime";

      if (hasChanges) {
        const { error: updateErr } = await supabase
          .from("matches")
          .update(updates)
          .eq("id", dbMatch.id);

        if (!updateErr) {
          updatedCount++;
          if (shouldUpdate) {
            updatedMatches.push({
              id: dbMatch.id,
              old_status: currentStatus,
              new_status: newStatus,
              minute: spData.minute,
            });
          }
        }
      }

      // ── Fetch MA3 events when match is live (for goals and corners) ───────
      if (matchIsLive) {
        const prevHome = dbMatch.score_home ?? 0;
        const prevAway = dbMatch.score_away ?? 0;
        const newHome =
          updates.score_home != null
            ? (updates.score_home as number)
            : prevHome;
        const newAway =
          updates.score_away != null
            ? (updates.score_away as number)
            : prevAway;

        const homeGoalsDelta = Math.max(0, newHome - prevHome);
        const awayGoalsDelta = Math.max(0, newAway - prevAway);

        // Always fetch MA3 for live matches to get current corner counts.
        const spEvents = await getSpMatchEvents(
          dbMatch.statsperform_match_id,
          spToken,
          spData.homeContestantId,
        );

        console.log(
          `[sync] MA3 ${dbMatch.statsperform_match_id}: goals=${spEvents.goals.length}, cornersH=${spEvents.cornersHome}, cornersA=${spEvents.cornersAway}`,
        );

        // ── Goal event insertion ───────────────────────────────────────────
        if (homeGoalsDelta > 0 || awayGoalsDelta > 0) {
          // deno-lint-ignore no-explicit-any
          const eventsToInsert: any[] = [];
          const rawPayload = {
            score_before: `${prevHome}-${prevAway}`,
            score_after: `${newHome}-${newAway}`,
            statsperform_match_id: dbMatch.statsperform_match_id,
          };

          // Goals attributed to home team (exclude own goals — attributed to opposing side)
          const homeGoalEvents = spEvents.goals.filter(
            (g) => g.team === "home" && !g.isOwnGoal,
          );
          for (let i = 0; i < homeGoalsDelta; i++) {
            const s =
              homeGoalEvents[homeGoalEvents.length - homeGoalsDelta + i];
            eventsToInsert.push({
              match_id: dbMatch.id,
              player_id: s?.playerId ?? "unknown",
              player_name: s?.playerName ?? "Unknown scorer",
              team: "home",
              minute: s?.minute ?? spData.minute ?? 0,
              event_type: "GOAL",
              confirmed: false,
              source: "manual",
              raw_payload: rawPayload,
            });
          }

          // Goals attributed to away team
          const awayGoalEvents = spEvents.goals.filter(
            (g) => g.team === "away" && !g.isOwnGoal,
          );
          for (let i = 0; i < awayGoalsDelta; i++) {
            const s =
              awayGoalEvents[awayGoalEvents.length - awayGoalsDelta + i];
            eventsToInsert.push({
              match_id: dbMatch.id,
              player_id: s?.playerId ?? "unknown",
              player_name: s?.playerName ?? "Unknown scorer",
              team: "away",
              minute: s?.minute ?? spData.minute ?? 0,
              event_type: "GOAL",
              confirmed: false,
              source: "manual",
              raw_payload: rawPayload,
            });
          }

          if (eventsToInsert.length > 0) {
            await supabase.from("goal_events").insert(eventsToInsert);
          }

          // ── Server-side NEXT_GOAL_SCORER settlement ──────────────────────
          // Build all scorer candidate IDs from the MA3 goal events that fired
          // in this sync window, then settle all active NGS bets.
          // This is more reliable than client-side goal_window matching.
          function normForId(s: string): string {
            return (
              s
                .normalize("NFD")
                // deno-lint-ignore no-explicit-any
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]/g, "_")
            );
          }
          const allGoalEvents = [
            ...spEvents.goals
              .filter((g) => g.team === "home" && !g.isOwnGoal)
              .slice(-homeGoalsDelta),
            ...spEvents.goals
              .filter((g) => g.team === "away" && !g.isOwnGoal)
              .slice(-awayGoalsDelta),
          ];
          const scorerIds = new Set<string>();
          for (const g of allGoalEvents) {
            if (g.playerId && g.playerId !== "unknown") {
              scorerIds.add(g.playerId);
              scorerIds.add(`sp_${g.playerId}`);
              if (g.playerName) {
                scorerIds.add(`odds_${normForId(g.playerName)}`);
              }
            }
          }
          await settleNgsBets(supabase, dbMatch.id, scorerIds);

          // Trigger immediate odds refresh after a goal
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-odds`, {
            method: "POST",
            headers: {
              apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ match_id: dbMatch.id }),
          }).catch(() => {}); // fire and forget
        }

        // ── Corner detection + NEXT_CORNER bet settlement ──────────────────
        const prevCornersHome = dbMatch.corners_home ?? 0;
        const prevCornersAway = dbMatch.corners_away ?? 0;
        const prevTotal = prevCornersHome + prevCornersAway;
        const newCornersHome = spEvents.cornersHome;
        const newCornersAway = spEvents.cornersAway;
        const newTotal = newCornersHome + newCornersAway;

        if (newTotal > prevTotal) {
          const homeDelta = Math.max(0, newCornersHome - prevCornersHome);
          const awayDelta = Math.max(0, newCornersAway - prevCornersAway);

          let cornerSeq = prevTotal + 1;
          for (let h = 0; h < homeDelta; h++, cornerSeq++) {
            await settleCornerBets(supabase, dbMatch.id, "home");
          }
          for (let a = 0; a < awayDelta; a++, cornerSeq++) {
            await settleCornerBets(supabase, dbMatch.id, "away");
          }

          await supabase
            .from("matches")
            .update({
              corners_home: newCornersHome,
              corners_away: newCornersAway,
              corners_last_settled: newTotal,
              updated_at: new Date().toISOString(),
            })
            .eq("id", dbMatch.id);
        }
      }
    }

    return json({
      success: true,
      db_matches_checked: dbMatches.length,
      updated: updatedCount,
      status_transitions: updatedMatches,
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
