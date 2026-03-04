/**
 * sync-match-status — Sync match status, score, and minute from Goalserve.
 *
 * Fetches `soccernew/home?json=1` (all today's matches) from Goalserve and
 * updates any of our `matches` rows that have a matching `goalserve_static_id`.
 *
 * Status mapping from Goalserve `@status` field:
 *   "FT"          → finished
 *   "HT"          → halftime
 *   "45+2", "90+" → live  (stoppage time — parse base minute)
 *   "13", "67"    → live  (numeric = current minute)
 *   "14:00"       → pre-match  (kickoff time = not started yet)
 *   "Postponed"   → cancelled
 *
 * Status transitions are forward-only (won't regress a 'finished' match back to
 * 'live', etc.) except for the halftime ↔ live second-half flip.
 *
 * Also updates: current_minute, score_home, score_away, updated_at
 *
 * Called by pg_cron every minute via pg_net. Can also be triggered manually:
 *   POST /functions/v1/sync-match-status   (no body required)
 *
 * Env vars:
 *   SUPABASE_URL              — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected
 *   GOALSERVE_API_KEY         — Goalserve feed key
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOALSERVE_BASE = "http://www.goalserve.com/getfeed";
const GOALSERVE_API_KEY = "5dc9cf20aca34682682708de71344f52";

// Forward-only transition rules:
// A match can only move in one direction through the lifecycle.
const STATUS_ORDER: Record<string, number> = {
  "pre-match": 0,
  live: 1,
  halftime: 2, // halftime can go back to live (2nd half) — handled specially
  finished: 3,
  cancelled: 4,
};

function parseGoalserveStatus(raw: string): {
  status: "pre-match" | "live" | "halftime" | "finished" | "cancelled";
  minute: number | null;
} {
  const s = (raw ?? "").trim();

  if (s === "FT" || s === "AET" || s === "Pen" || s === "After ET") {
    return { status: "finished", minute: null };
  }
  if (s === "HT") {
    return { status: "halftime", minute: 45 };
  }
  if (s === "Postponed" || s === "Cancelled" || s === "Abandoned") {
    return { status: "cancelled", minute: null };
  }

  // Numeric or stoppage-time string like "45", "45+2", "90+3"
  const liveMatch = s.match(/^(\d+)(\+\d+)?$/);
  if (liveMatch) {
    const minute =
      parseInt(liveMatch[1], 10) +
      (liveMatch[2] ? parseInt(liveMatch[2].slice(1), 10) : 0);
    return { status: "live", minute };
  }

  // Kickoff time like "14:00", "21:45" or empty = pre-match
  return { status: "pre-match", minute: null };
}

// Flatten Goalserve JSON: category can be array or single object,
// matches.match can be array or single object — normalise both.
function toArray<T>(val: T | T[] | undefined | null): T[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

interface GoalserveMatch {
  "@status": string;
  "@static_id": string;
  "@timer"?: string;
  localteam?: { "@goals": string };
  visitorteam?: { "@goals": string };
}

interface GoalserveCategory {
  matches?: {
    match?: GoalserveMatch | GoalserveMatch[];
  };
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

    const apiKey = Deno.env.get("GOALSERVE_API_KEY") ?? GOALSERVE_API_KEY;

    // ── Fetch today's livescores from Goalserve ────────────────────────────
    const gsUrl = `${GOALSERVE_BASE}/${apiKey}/soccernew/home?json=1`;
    const gsRes = await fetch(gsUrl);

    if (!gsRes.ok) {
      const txt = await gsRes.text();
      return json(
        { error: `Goalserve ${gsRes.status}: ${txt.slice(0, 200)}` },
        502,
      );
    }

    const gsData = await gsRes.json();

    // ── Build static_id → parsed status lookup ─────────────────────────────
    const lookup = new Map<
      string,
      {
        status: string;
        minute: number | null;
        scoreHome: number | null;
        scoreAway: number | null;
      }
    >();

    const categories: GoalserveCategory[] = toArray(gsData?.scores?.category);
    for (const cat of categories) {
      const matches: GoalserveMatch[] = toArray(cat?.matches?.match);
      for (const m of matches) {
        const staticId = m["@static_id"];
        if (!staticId) continue;
        const parsed = parseGoalserveStatus(m["@status"]);
        const scoreHome = parseInt(m?.localteam?.["@goals"] ?? "", 10);
        const scoreAway = parseInt(m?.visitorteam?.["@goals"] ?? "", 10);
        lookup.set(staticId, {
          status: parsed.status,
          minute: parsed.minute,
          scoreHome: isNaN(scoreHome) ? null : scoreHome,
          scoreAway: isNaN(scoreAway) ? null : scoreAway,
        });
      }
    }

    if (lookup.size === 0) {
      return json({
        success: true,
        message: "No matches in Goalserve feed",
        updated: 0,
      });
    }

    // ── Fetch our DB matches that are not yet finished ─────────────────────
    const { data: dbMatches, error: dbErr } = await supabase
      .from("matches")
      .select(
        "id, goalserve_static_id, status, current_minute, score_home, score_away",
      )
      .not("status", "in", '("finished","cancelled")')
      .not("goalserve_static_id", "is", null);

    if (dbErr) {
      return json({ error: `DB query failed: ${dbErr.message}` }, 500);
    }

    let updatedCount = 0;
    const updatedMatches: {
      id: string;
      old_status: string;
      new_status: string;
      minute: number | null;
    }[] = [];

    for (const dbMatch of dbMatches ?? []) {
      const gsInfo = lookup.get(dbMatch.goalserve_static_id);
      if (!gsInfo) continue; // not in today's feed — skip

      const currentStatus: string = dbMatch.status;
      const newStatus = gsInfo.status;

      // Determine if we should apply this transition:
      // - Allow any forward transition
      // - Allow halftime → live (second half starts)
      // - Never go backwards past finished/cancelled
      const shouldUpdate = (() => {
        if (currentStatus === newStatus) {
          // Same status — still update minute/score if changed
          return false; // handled below
        }
        if (currentStatus === "finished" || currentStatus === "cancelled") {
          return false; // never regress from terminal states
        }
        if (currentStatus === "halftime" && newStatus === "live") {
          return true; // second half kickoff
        }
        // Only allow forward progress
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

      // Always sync minute and score when live/halftime
      if (newStatus === "live" || newStatus === "halftime") {
        if (
          gsInfo.minute !== null &&
          gsInfo.minute !== dbMatch.current_minute
        ) {
          updates.current_minute = gsInfo.minute;
          hasChanges = true;
        }
      }
      if (
        gsInfo.scoreHome !== null &&
        gsInfo.scoreHome !== dbMatch.score_home
      ) {
        updates.score_home = gsInfo.scoreHome;
        hasChanges = true;
      }
      if (
        gsInfo.scoreAway !== null &&
        gsInfo.scoreAway !== dbMatch.score_away
      ) {
        updates.score_away = gsInfo.scoreAway;
        hasChanges = true;
      }

      if (!hasChanges) continue;

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
            minute: gsInfo.minute,
          });
        }
      }
    }

    return json({
      success: true,
      goalserve_matches_in_feed: lookup.size,
      db_matches_checked: (dbMatches ?? []).length,
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
