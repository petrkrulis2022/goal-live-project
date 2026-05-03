/**
 * sp-fixtures — Return Premier League fixture list with StatsPerform match IDs.
 *
 * Always scoped to Premier League only. Fetches the active PL tournament
 * calendar via OT2, then queries all season matches via MA1, filtering
 * client-side by date if ?date=YYYY-MM-DD is supplied.
 *
 * GET /functions/v1/sp-fixtures
 * GET /functions/v1/sp-fixtures?date=2026-05-03   — matches on that date only
 * GET /functions/v1/sp-fixtures?debug=true         — returns raw OT2 response
 *
 * Returns: SpFixture[]
 *   id              — SP internal match ID
 *   home            — Home team name
 *   away            — Away team name
 *   date            — Date string "YYYY-MM-DD"
 *   time            — Kickoff time "HH:MM:SSZ"
 *   competition     — Competition display name
 *   competitionCode — "EPL"
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
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date"); // YYYY-MM-DD or null
    const debugParam = url.searchParams.get("debug") === "true";

    // Step 1: OT2 — get the active Premier League tournament calendar ID
    const ot2Res = await fetch(
      `${SP_BASE}/soccerdata/tournamentcalendar/active/authorized?_fmt=json`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!ot2Res.ok) {
      const txt = await ot2Res.text();
      throw new Error(`OT2 failed ${ot2Res.status}: ${txt.slice(0, 200)}`);
    }
    // deno-lint-ignore no-explicit-any
    const ot2Data: any = await ot2Res.json();

    if (debugParam) {
      return new Response(JSON.stringify(ot2Data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // OT2 nests calendars under competition[*].tournamentCalendar[*]
    // Find the active Premier League calendar (competitionCode = "EPL")
    // deno-lint-ignore no-explicit-any
    const competitions: any[] = Array.isArray(ot2Data.competition)
      ? ot2Data.competition
      : ot2Data.competition
        ? [ot2Data.competition]
        : [];

    const eplComp = competitions.find((c) => c.competitionCode === "EPL");
    if (!eplComp) {
      throw new Error(
        "Premier League not found in authorized tournament calendars",
      );
    }

    // deno-lint-ignore no-explicit-any
    const eplCalendars: any[] = Array.isArray(eplComp.tournamentCalendar)
      ? eplComp.tournamentCalendar
      : eplComp.tournamentCalendar
        ? [eplComp.tournamentCalendar]
        : [];

    const activeCal =
      eplCalendars.find((c) => c.active === "yes") ?? eplCalendars[0];
    if (!activeCal) {
      throw new Error("No active Premier League tournament calendar found");
    }

    // Step 2: MA1 — fetch all PL matches for the active season, filter by date client-side
    // mt.mDt server-side filter returns error 10202 for this account, so we fetch
    // all season matches (_pgSz=500) and filter locally.
    const spUrl = `${SP_BASE}/soccerdata/match/?tmcl=${activeCal.id}&_fmt=json&_pgSz=500`;

    const res = await fetch(spUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
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

    const fixtures: SpFixture[] = matches
      .map((m) => {
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
      })
      .filter((f) => !dateParam || f.date === dateParam);

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
