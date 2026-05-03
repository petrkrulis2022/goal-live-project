/**
 * sp-lineup — Return confirmed lineup for a StatsPerform match.
 *
 * Calls SP MA1 feed for a specific match and extracts the lineUp array,
 * returning each player with team assignment (home/away), jersey number,
 * position, and starter status.
 *
 * GET /functions/v1/sp-lineup?matchId={spMatchId}
 *
 * Returns: SpLineupPlayer[]
 *   id          — SP player ID
 *   name        — Full name (firstName + lastName)
 *   team        — "home" | "away"
 *   jersey      — Shirt number (number | null)
 *   position    — Position string (e.g. "Midfielder")
 *   isStarter   — true if status is "Start"
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

interface SpLineupPlayer {
  id: string;
  name: string;
  team: "home" | "away";
  jersey: number | null;
  position: string | null;
  isStarter: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const matchId = url.searchParams.get("matchId");

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
    const token = await getSpToken();
    // Try MA1 with lineups=yes (correct per Postman collection docs):
    //   /soccerdata/match/?fx={matchId}&live=yes&lineups=yes
    // Also try path-style and without lineups as fallbacks
    let m: unknown = null;
    const attempts = [
      `${SP_BASE}/soccerdata/match/?fx=${matchId}&live=yes&lineups=yes&_fmt=json`,
      `${SP_BASE}/soccerdata/match/?fx=${matchId}&live=yes&_fmt=json`,
      `${SP_BASE}/soccerdata/match/${matchId}?live=yes&lineups=yes&_fmt=json`,
      `${SP_BASE}/soccerdata/match/${matchId}?_fmt=json`,
    ];
    for (const url of attempts) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      // deno-lint-ignore no-explicit-any
      const data: any = await res.json();
      // Per-match endpoint returns the match directly OR wrapped in data.match
      // deno-lint-ignore no-explicit-any
      let candidate: any = data.match ?? data;
      if (Array.isArray(candidate)) candidate = candidate[0];
      // Validate it's actually a match object
      if (candidate?.matchInfo?.id) {
        m = candidate;
        break;
      }
    }
    if (!m) throw new Error("Match not found in SP response");

    // Build contestantId → home|away map
    // deno-lint-ignore no-explicit-any
    const contestants: any[] = Array.isArray((m as any).matchInfo?.contestant)
      ? (m as any).matchInfo.contestant
      : (m as any).matchInfo?.contestant
        ? [(m as any).matchInfo.contestant]
        : [];

    const sideMap = new Map<string, "home" | "away">();
    for (const c of contestants) {
      if (c.id) sideMap.set(c.id, c.position === "home" ? "home" : "away");
    }

    // Extract lineups
    // deno-lint-ignore no-explicit-any
    const lineUps: any[] = Array.isArray((m as any).liveData?.lineUp)
      ? (m as any).liveData.lineUp
      : (m as any).liveData?.lineUp
        ? [(m as any).liveData.lineUp]
        : [];

    const players: SpLineupPlayer[] = [];
    for (const lu of lineUps) {
      const team: "home" | "away" = sideMap.get(lu.contestantId) ?? "home";
      // deno-lint-ignore no-explicit-any
      const luPlayers: any[] = Array.isArray(lu.player)
        ? lu.player
        : lu.player
          ? [lu.player]
          : [];
      for (const p of luPlayers) {
        const firstName: string = p.firstName ?? "";
        const lastName: string = p.lastName ?? p.matchName ?? "";
        const name = [firstName, lastName].filter(Boolean).join(" ").trim();
        players.push({
          id: p.playerId ?? p.id ?? "",
          name,
          team,
          jersey: p.shirtNumber != null ? Number(p.shirtNumber) : null,
          position: p.position ?? p.formationPlace ?? null,
          isStarter: p.status === "Start",
        });
      }
    }

    // If MA1 lineups came back empty, fall back to TM3 Squads per contestant
    // deno-lint-ignore no-explicit-any
    const squadDebug: any[] = [];
    if (players.length === 0 && contestants.length > 0) {
      for (const c of contestants) {
        if (!c.id) continue;
        const side: "home" | "away" = sideMap.get(c.id) ?? "away";
        const sqRes = await fetch(
          `${SP_BASE}/soccerdata/squads/?ctst=${c.id}&detailed=yes&_fmt=json`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10_000),
          },
        );
        if (!sqRes.ok) {
          squadDebug.push({
            ctst: c.id,
            name: c.name,
            status: sqRes.status,
            error: await sqRes.text().then((t) => t.slice(0, 200)),
          });
          continue;
        }
        // deno-lint-ignore no-explicit-any
        const sqData: any = await sqRes.json();
        // deno-lint-ignore no-explicit-any
        let squadList: any[] = [];
        if (Array.isArray(sqData.squad)) squadList = sqData.squad;
        else if (sqData.squad) squadList = [sqData.squad];
        squadDebug.push({
          ctst: c.id,
          name: c.name,
          status: sqRes.status,
          topLevelKeys: Object.keys(sqData),
          squadCount: squadList.length,
          firstSquadKeys: squadList[0] ? Object.keys(squadList[0]) : [],
        });
        // squad → person[] (TM3 uses "person" not "player")
        for (const sq of squadList) {
          // deno-lint-ignore no-explicit-any
          const sqPlayers: any[] = Array.isArray(sq.person)
            ? sq.person
            : sq.person
              ? [sq.person]
              : Array.isArray(sq.player)
                ? sq.player
                : sq.player
                  ? [sq.player]
                  : [];
          for (const p of sqPlayers) {
            const firstName: string = p.firstName ?? p.name?.first ?? "";
            const lastName: string =
              p.lastName ?? p.name?.last ?? p.matchName ?? p.knownName ?? "";
            const combined = [firstName, lastName]
              .filter(Boolean)
              .join(" ")
              .trim();
            const name = combined || (p.name ?? "");
            players.push({
              id: p.id ?? p.playerId ?? "",
              name,
              team: side,
              jersey: p.shirtNumber != null ? Number(p.shirtNumber) : null,
              position: p.position ?? null,
              isStarter: false, // Squad feed doesn't know who starts
            });
          }
        }
      }
    }

    // Debug mode: return raw SP match info
    if (url.searchParams.get("debug") === "true") {
      // deno-lint-ignore no-explicit-any
      const dbg: any = m;
      return new Response(
        JSON.stringify({
          matchStatus: dbg?.liveData?.matchDetails?.matchStatus,
          periodId: dbg?.liveData?.matchDetails?.periodId,
          liveDataKeys: Object.keys(dbg?.liveData ?? {}),
          lineUpCount: lineUps.length,
          contestantCount: contestants.length,
          contestants: contestants.map((c) => ({
            id: c.id,
            name: c.name,
            position: c.position,
          })),
          squadDebug,
          players,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
