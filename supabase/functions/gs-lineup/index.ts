/**
 * gs-lineup — Return confirmed lineup for a GoalServe match.
 *
 * Fetches the GoalServe commentaries/match feed and extracts starters +
 * substitutes with their team assignment (home/away), jersey number,
 * position, and starter status.
 *
 * GET /functions/v1/gs-lineup?matchId={staticId}
 * GET /functions/v1/gs-lineup?matchId={staticId}&leagueId=1204
 * GET /functions/v1/gs-lineup?matchId={staticId}&leagueId=1204&debug=true
 *
 * Returns: GsLineupPlayer[]
 *   id          — "gs_<normalized_name>" — synthetic stable ID
 *   name        — Player display name as returned by GoalServe
 *   team        — "home" | "away"
 *   jersey      — Shirt number (number | null)
 *   position    — Readable position string (e.g. "Midfielder") | null
 *   isStarter   — true if in the starting 11
 */

import {
  getGsMatchLive,
  parseGsLineup,
  SPORT_TO_GS_LEAGUE,
  GsLineupPlayer,
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

  const url = new URL(req.url);
  const matchId = url.searchParams.get("matchId");
  const leagueId =
    url.searchParams.get("leagueId") ?? SPORT_TO_GS_LEAGUE["soccer_epl"];
  const debugParam = url.searchParams.get("debug") === "true";

  if (!matchId) {
    return new Response(
      JSON.stringify({ error: "matchId query param required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const liveData = await getGsMatchLive(matchId, leagueId);

    if (!liveData) {
      return new Response(
        JSON.stringify({
          error: `Match not found in GoalServe for staticId=${matchId} leagueId=${leagueId}`,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Debug mode — return raw match node for inspection
    if (debugParam) {
      return new Response(
        JSON.stringify({
          status: liveData.status,
          scoreHome: liveData.scoreHome,
          scoreAway: liveData.scoreAway,
          rawKeys: Object.keys(liveData.raw ?? {}),
          teamsKeys: Object.keys(liveData.raw?.teams ?? {}),
          substitutesKeys: Object.keys(liveData.raw?.substitutes ?? {}),
          statsKeys: Object.keys(liveData.raw?.stats ?? {}),
          summaryKeys: Object.keys(liveData.raw?.summary ?? {}),
          raw: liveData.raw,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const players: GsLineupPlayer[] = parseGsLineup(liveData.raw);

    return new Response(JSON.stringify(players), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
