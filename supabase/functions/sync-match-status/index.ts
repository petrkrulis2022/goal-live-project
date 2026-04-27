/**
 * sync-match-status — StatsPerform edition with auto-trigger settlement (Sepolia)
 *
 * Identical to the statsperform-hedera sync-match-status EXCEPT: on FullTime,
 * fires settle-match (Sepolia) instead of settle-match-hedera.
 *
 * This enables fully automatic settlement on the Sepolia (EVM) chain without
 * requiring admin intervention or CRE.
 *
 * Queries `matches` rows where `statsperform_match_id IS NOT NULL` and status
 * is not yet finished/cancelled.
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

const STATUS_ORDER: Record<string, number> = {
  "pre-match": 0,
  live: 1,
  halftime: 2,
  finished: 3,
  cancelled: 4,
};

async function settleCornerBets(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  matchId: string,
  cornerNumber: number,
  winningTeam: "home" | "away",
): Promise<void> {
  const { data: bets } = await supabase
    .from("bets")
    .select("id, odds, current_amount, outcome")
    .eq("match_id", matchId)
    .eq("bet_type", "NEXT_CORNER")
    .eq("current_player_id", String(cornerNumber))
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let spToken: string;
    try {
      spToken = await getSpToken();
    } catch (tokenErr) {
      return json({ error: `StatsPerform OAuth failed: ${tokenErr}` }, 502);
    }

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
    const autoTriggered: string[] = [];

    for (const dbMatch of dbMatches) {
      const spData = await getSpMatchLive(dbMatch.statsperform_match_id, spToken);
      if (!spData) continue;

      const currentStatus: string = dbMatch.status;
      const newStatus = spData.status;

      const shouldUpdate = (() => {
        if (currentStatus === newStatus) return false;
        if (currentStatus === "finished" || currentStatus === "cancelled") return false;
        if (currentStatus === "halftime" && newStatus === "live") return true;
        if (newStatus === "finished") return false;
        return (STATUS_ORDER[newStatus] ?? -1) > (STATUS_ORDER[currentStatus] ?? -1);
      })();

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      let hasChanges = false;

      if (shouldUpdate) {
        updates.status = newStatus;
        hasChanges = true;
      }

      const justBecameFullTime = spData.isFullTime && !dbMatch.goalserve_finished;
      if (justBecameFullTime) {
        updates.goalserve_finished = true;
        hasChanges = true;
      }

      if (newStatus === "live" || newStatus === "halftime") {
        if (spData.minute !== null && spData.minute !== dbMatch.current_minute) {
          updates.current_minute = spData.minute;
          hasChanges = true;
        }
      }

      if (spData.scoreHome !== null && spData.scoreHome !== dbMatch.score_home) {
        updates.score_home = spData.scoreHome;
        hasChanges = true;
      }
      if (spData.scoreAway !== null && spData.scoreAway !== dbMatch.score_away) {
        updates.score_away = spData.scoreAway;
        hasChanges = true;
      }

      const matchIsLive =
        newStatus === "live" || newStatus === "halftime" ||
        currentStatus === "live" || currentStatus === "halftime";

      if (hasChanges) {
        await supabase.from("matches").update(updates).eq("id", dbMatch.id);
        updatedCount++;
      }

      if (matchIsLive) {
        const prevHome = dbMatch.score_home ?? 0;
        const prevAway = dbMatch.score_away ?? 0;
        const newHome = updates.score_home != null ? (updates.score_home as number) : prevHome;
        const newAway = updates.score_away != null ? (updates.score_away as number) : prevAway;
        const homeGoalsDelta = Math.max(0, newHome - prevHome);
        const awayGoalsDelta = Math.max(0, newAway - prevAway);

        const spEvents = await getSpMatchEvents(
          dbMatch.statsperform_match_id,
          spToken,
          spData.homeContestantId,
        );

        if (homeGoalsDelta > 0 || awayGoalsDelta > 0) {
          // deno-lint-ignore no-explicit-any
          const eventsToInsert: any[] = [];
          const rawPayload = {
            score_before: `${prevHome}-${prevAway}`,
            score_after: `${newHome}-${newAway}`,
            statsperform_match_id: dbMatch.statsperform_match_id,
          };

          const homeGoalEvents = spEvents.goals.filter((g) => g.team === "home" && !g.isOwnGoal);
          for (let i = 0; i < homeGoalsDelta; i++) {
            const s = homeGoalEvents[homeGoalEvents.length - homeGoalsDelta + i];
            eventsToInsert.push({
              match_id: dbMatch.id,
              player_id: s?.playerId ?? "unknown",
              player_name: s?.playerName ?? "Unknown scorer",
              team: "home",
              minute: s?.minute ?? spData.minute ?? 0,
              event_type: "GOAL",
              confirmed: false,
              source: "statsperform",
              raw_payload: rawPayload,
            });
          }

          const awayGoalEvents = spEvents.goals.filter((g) => g.team === "away" && !g.isOwnGoal);
          for (let i = 0; i < awayGoalsDelta; i++) {
            const s = awayGoalEvents[awayGoalEvents.length - awayGoalsDelta + i];
            eventsToInsert.push({
              match_id: dbMatch.id,
              player_id: s?.playerId ?? "unknown",
              player_name: s?.playerName ?? "Unknown scorer",
              team: "away",
              minute: s?.minute ?? spData.minute ?? 0,
              event_type: "GOAL",
              confirmed: false,
              source: "statsperform",
              raw_payload: rawPayload,
            });
          }

          if (eventsToInsert.length > 0) {
            await supabase.from("goal_events").insert(eventsToInsert);
          }

          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-odds`, {
            method: "POST",
            headers: {
              apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ match_id: dbMatch.id }),
          }).catch(() => {});
        }

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
            await settleCornerBets(supabase, dbMatch.id, cornerSeq, "home");
          }
          for (let a = 0; a < awayDelta; a++, cornerSeq++) {
            await settleCornerBets(supabase, dbMatch.id, cornerSeq, "away");
          }
          await supabase.from("matches").update({
            corners_home: newCornersHome,
            corners_away: newCornersAway,
            corners_last_settled: newTotal,
            updated_at: new Date().toISOString(),
          }).eq("id", dbMatch.id);
        }
      }

      // ── Auto-trigger settle-match (Sepolia) when FullTime is first detected ─
      if (justBecameFullTime) {
        console.log(
          `[sync-match-status] FullTime detected for ${dbMatch.id} (SP: ${dbMatch.statsperform_match_id}) — auto-triggering settle-match`,
        );

        fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/settle-match`, {
          method: "POST",
          headers: {
            apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ match_id: dbMatch.id }),
        }).catch((err) => {
          console.error("[sync-match-status] settle-match fire-and-forget error:", err);
        });

        autoTriggered.push(dbMatch.id);
      }
    }

    return json({
      success: true,
      db_matches_checked: dbMatches.length,
      updated: updatedCount,
      auto_triggered_settlement: autoTriggered,
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
