/**
 * sp-fixtures — Return upcoming SP fixture list with StatsPerform match IDs.
 *
 * Calls SP MA1 feed (/soccerdata/match/?live=yes) and returns a simplified
 * list suitable for team-name matching in the admin CreateEvent flow.
 *
 * GET /functions/v1/sp-fixtures
 *
 * Returns: SpFixture[]
 *   id              — SP internal match ID (e.g. "59t89i9irkl7koxyl46cva4us")
 *   home            — Home team name
 *   away            — Away team name
 *   date            — Date string "YYYY-MM-DD"
 *   time            — Kickoff time "HH:MM:SSZ"
 *   competition     — Competition display name
 *   competitionCode — Competition code (e.g. "EPL")
 */

import { getSpToken } from "../_shared/statsperform.ts";

const SP_BASE =
  Deno.env.get("STATSPERFORM_BASE_URL") ??
  "https://api.statsperform.com/sdapi/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SpFixture {
  id: string;
  home: string;
  away: string;
  date: string;
  time: string;
  competition: string;
  competitionCode: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = await getSpToken();
    const res = await fetch(`${SP_BASE}/soccerdata/match/?live=yes&_fmt=json`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`SP MA1 failed ${res.status}: ${txt.slice(0, 200)}`);
    }

    // deno-lint-ignore no-explicit-any
    const data: any = await res.json();
    // deno-lint-ignore no-explicit-any
    const matches: any[] = Array.isArray(data.match)
      ? data.match
      : data.match
        ? [data.match]
        : [];

    const fixtures: SpFixture[] = matches.map((m) => {
      // deno-lint-ignore no-explicit-any
      const contestants: any[] = Array.isArray(m.matchInfo?.contestant)
        ? m.matchInfo.contestant
        : m.matchInfo?.contestant
          ? [m.matchInfo.contestant]
          : [];
      const home =
        contestants.find((c) => c.position === "home") ?? contestants[0];
      const away =
        contestants.find((c) => c.position === "away") ?? contestants[1];
      return {
        id: m.matchInfo?.id ?? "",
        home: home?.name ?? "",
        away: away?.name ?? "",
        date: (m.matchInfo?.date ?? "").replace("Z", ""),
        time: m.matchInfo?.time ?? "",
        competition:
          m.matchInfo?.competition?.knownName ??
          m.matchInfo?.competition?.name ??
          "",
        competitionCode: m.matchInfo?.competition?.competitionCode ?? "",
      };
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
