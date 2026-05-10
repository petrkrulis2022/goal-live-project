/**
 * gs-fixtures — Return fixture list with GoalServe static IDs.
 *
 * Fetches upcoming fixtures from GoalServe for days d0..d7.
 * Defaults to EPL (leagueId=1204) but accepts any league.
 *
 * GET /functions/v1/gs-fixtures
 * GET /functions/v1/gs-fixtures?leagueId=1204         — specific league (default EPL)
 * GET /functions/v1/gs-fixtures?daysAhead=3           — only a specific day offset
 * GET /functions/v1/gs-fixtures?debug=true            — returns raw GoalServe response
 *
 * Returns: GsFixtureResult[]
 *   id              — GoalServe static_id (stable, used for future queries)
 *   home            — Home team name
 *   away            — Away team name
 *   date            — "YYYY-MM-DD"
 *   time            — "HH:MM" (local time from GoalServe)
 *   competition     — Competition display name
 *   competitionCode — e.g. "EPL"
 *   leagueId        — GoalServe league ID string
 */

import {
  getGsFixtures,
  SPORT_TO_GS_LEAGUE,
  GsFixture,
} from "../_shared/goalserve.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const leagueId =
      url.searchParams.get("leagueId") ?? SPORT_TO_GS_LEAGUE["soccer_epl"];
    const daysAheadParam = url.searchParams.get("daysAhead");
    const debugParam = url.searchParams.get("debug") === "true";

    // Debug mode: return raw GoalServe d0 response
    if (debugParam) {
      const GS_BASE = `http://www.goalserve.com/getfeed/${
        Deno.env.get("GOALSERVE_API_KEY") ?? "edc0ecd4f73c4c1a20f808dea8e5ebf2"
      }`;
      const rawRes = await fetch(`${GS_BASE}/soccernew/d0?json=1`, {
        signal: AbortSignal.timeout(15_000),
      });
      const rawData = rawRes.ok
        ? await rawRes.json()
        : { error: `HTTP ${rawRes.status}` };
      return new Response(JSON.stringify(rawData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine which day offsets to query
    let dayOffsets: number[];
    if (daysAheadParam !== null) {
      const n = parseInt(daysAheadParam, 10);
      dayOffsets = isNaN(n) ? [0] : [n];
    } else {
      // Default: fetch today through next 7 days
      dayOffsets = [0, 1, 2, 3, 4, 5, 6, 7];
    }

    // Fetch all days in parallel, filter by league
    const results = await Promise.all(
      dayOffsets.map((d) =>
        getGsFixtures(d, leagueId).catch(() => [] as GsFixture[]),
      ),
    );

    const allFixtures: GsFixture[] = results.flat();

    // Deduplicate by static_id (a match can appear on multiple day feeds)
    const seen = new Set<string>();
    const fixtures: GsFixture[] = [];
    for (const f of allFixtures) {
      if (!f.id || seen.has(f.id)) continue;
      seen.add(f.id);
      fixtures.push(f);
    }

    // Sort by date, then time
    fixtures.sort((a, b) => {
      const dt = a.date.localeCompare(b.date);
      return dt !== 0 ? dt : a.time.localeCompare(b.time);
    });

    return new Response(JSON.stringify(fixtures), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
