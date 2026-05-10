/**
 * GoalServe API helper — shared across gs-fixtures, gs-lineup,
 * sync-match-status, and settle-match.
 *
 * Base URL: http://www.goalserve.com/getfeed/{apiKey}
 * All responses support ?json=1 suffix.
 *
 * Key endpoints:
 *   soccernew/d0?json=1          → today's fixtures (all leagues)
 *   soccernew/d1?json=1 … d7    → upcoming fixtures (1–7 days ahead)
 *   soccernew/home?json=1        → today's livescores + results (for static_id discovery)
 *   commentaries/match?id={staticId}&league={leagueId}&json=1 → full match data
 *
 * GoalServe League IDs:
 *   1204  → Premier League (EPL)
 *   1005  → UEFA Champions League
 *   1007  → UEFA Europa League
 *   18853 → UEFA Europa Conference League
 *   1229  → Bundesliga
 *   1399  → La Liga
 *   1269  → Serie A
 *   1221  → Ligue 1
 *
 * Match status values (@status field):
 *   "Not Started"  → pre-match
 *   "In Progress"  → live
 *   "Half Time"    → halftime
 *   "Full-time"    → finished
 *   "Postponed"    → cancelled
 *   "Cancelled"    → cancelled
 *
 * Env vars:
 *   GOALSERVE_API_KEY  — GoalServe API key (required)
 */

const GS_BASE = `http://www.goalserve.com/getfeed/${
  Deno.env.get("GOALSERVE_API_KEY") ?? "edc0ecd4f73c4c1a20f808dea8e5ebf2"
}`;

export const SPORT_TO_GS_LEAGUE: Record<string, string> = {
  soccer_epl: "1204",
  soccer_uefa_champs_league: "1005",
  soccer_uefa_europa_league: "1007",
  soccer_uefa_europa_conference_league: "18853",
  soccer_germany_bundesliga: "1229",
  soccer_spain_la_liga: "1399",
  soccer_italy_serie_a: "1269",
  soccer_france_ligue_one: "1221",
};

export const GS_LEAGUE_TO_SPORT: Record<string, string> = Object.fromEntries(
  Object.entries(SPORT_TO_GS_LEAGUE).map(([k, v]) => [v, k]),
);

export const GS_LEAGUE_TO_NAME: Record<string, string> = {
  "1204": "Premier League",
  "1005": "UEFA Champions League",
  "1007": "UEFA Europa League",
  "18853": "UEFA Europa Conference League",
  "1229": "Bundesliga",
  "1399": "La Liga",
  "1269": "Serie A",
  "1221": "Ligue 1",
};

export type GsStatus =
  | "pre-match"
  | "live"
  | "halftime"
  | "finished"
  | "cancelled";

export interface GsFixture {
  /** GoalServe static_id — stable identifier for future queries */
  id: string;
  home: string;
  away: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM — local time from GoalServe feed */
  time: string;
  competition: string;
  competitionCode: string;
  /** GoalServe league ID (e.g. "1204") */
  leagueId: string;
}

export interface GsMatchLiveData {
  staticId: string;
  status: GsStatus;
  /** Current match minute — null when not in play */
  minute: number | null;
  scoreHome: number | null;
  scoreAway: number | null;
  isFullTime: boolean;
  /** Raw match node for downstream parsing (goals, corners, lineups) */
  // deno-lint-ignore no-explicit-any
  raw: any;
}

export interface GsGoalEvent {
  playerName: string;
  team: "home" | "away";
  minute: number;
  extraMin: number;
  isOwnGoal: boolean;
  isPenalty: boolean;
  isVarCancelled: boolean;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
function toArr<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "_");
}

/** Derive a synthetic GoalServe player ID from their name */
export function gsPlayerId(name: string): string {
  return `gs_${normName(name)}`;
}

function parseGsStatus(
  rawStatus: string,
  timerStr: string,
): { status: GsStatus; minute: number | null } {
  switch (rawStatus) {
    case "Full-time":
    case "AET":
    case "After ET":
    case "After Pen.":
      return { status: "finished", minute: null };
    case "Half Time":
    case "HT":
      return { status: "halftime", minute: 45 };
    case "In Progress": {
      const min = parseInt(timerStr, 10);
      return { status: "live", minute: isNaN(min) ? null : min };
    }
    case "Postponed":
    case "Cancelled":
    case "Abandoned":
    case "Suspended":
      return { status: "cancelled", minute: null };
    default: {
      // Numeric timer string means "In Progress" even if status text differs
      const min = parseInt(timerStr, 10);
      if (!isNaN(min)) return { status: "live", minute: min };
      return { status: "pre-match", minute: null };
    }
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * Fetch all soccer fixtures for a given day offset (0 = today, 1 = tomorrow, etc.)
 * Optionally filter to a specific league ID.
 */
export async function getGsFixtures(
  daysAhead: number,
  leagueIdFilter?: string,
): Promise<GsFixture[]> {
  const dayParam = daysAhead === 0 ? "d0" : `d${daysAhead}`;
  const url = `${GS_BASE}/soccernew/${dayParam}?json=1`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new Error(`GoalServe fixtures fetch failed: HTTP ${res.status}`);
  }
  // deno-lint-ignore no-explicit-any
  const data: any = await res.json();

  const fixtures: GsFixture[] = [];

  // Response shape: { soccernew: { league: [...] | {} } } or { leagues: [...] }
  // deno-lint-ignore no-explicit-any
  const leagues: any[] = toArr(
    data?.soccernew?.league ??
      data?.scores?.league ??
      data?.leagues ??
      data?.league,
  );

  for (const league of leagues) {
    const leagueId: string = String(league["@id"] ?? league.id ?? "");
    if (leagueIdFilter && leagueId !== leagueIdFilter) continue;

    const leagueName: string = league["@name"] ?? league.name ?? "";
    const sportKey = GS_LEAGUE_TO_SPORT[leagueId] ?? "soccer";
    const compCode = sportKey.split("_").slice(1).join("_").toUpperCase();
    const compName = GS_LEAGUE_TO_NAME[leagueId] ?? leagueName;

    // deno-lint-ignore no-explicit-any
    const matches: any[] = toArr(league.match ?? league.matches);
    for (const m of matches) {
      const staticId: string = String(
        m["@static_id"] ?? m["@id"] ?? m.static_id ?? m.id ?? "",
      );
      if (!staticId) continue;

      const home: string = m.localteam?.["@name"] ?? m.localteam?.name ?? "";
      const away: string =
        m.visitorteam?.["@name"] ?? m.visitorteam?.name ?? "";
      const dateStr: string = m["@date"] ?? m.date ?? "";
      const timeStr: string = m["@time"] ?? m.time ?? "";

      fixtures.push({
        id: staticId,
        home,
        away,
        date: dateStr,
        time: timeStr,
        competition: compName,
        competitionCode: compCode,
        leagueId,
      });
    }
  }

  return fixtures;
}

// ── Live match data ───────────────────────────────────────────────────────────

/**
 * Fetch live match data from GoalServe commentaries feed.
 * Returns null if the match is not found or the request fails.
 */
export async function getGsMatchLive(
  staticId: string,
  leagueId: string,
): Promise<GsMatchLiveData | null> {
  const url = `${GS_BASE}/commentaries/match?id=${staticId}&league=${leagueId}&json=1`;

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    console.warn(
      `[goalserve] commentaries fetch error for ${staticId}: ${err}`,
    );
    return null;
  }

  if (!res.ok) {
    console.warn(
      `[goalserve] commentaries HTTP ${res.status} for staticId=${staticId}`,
    );
    return null;
  }

  // deno-lint-ignore no-explicit-any
  let data: any;
  try {
    data = await res.json();
  } catch {
    console.warn(`[goalserve] commentaries JSON parse error for ${staticId}`);
    return null;
  }

  // Response shape: { commentaries: { tournament: { match: {...} | [...] } } }
  // deno-lint-ignore no-explicit-any
  const tournament = data?.commentaries?.tournament;
  if (!tournament) {
    console.warn(`[goalserve] no tournament in commentaries for ${staticId}`);
    return null;
  }

  // deno-lint-ignore no-explicit-any
  const matchRaw: any[] = toArr(tournament.match);
  // deno-lint-ignore no-explicit-any
  const m: any =
    matchRaw.find(
      (x) => String(x["@static_id"] ?? x["@id"] ?? "") === staticId,
    ) ?? matchRaw[0];

  if (!m) {
    console.warn(
      `[goalserve] match node not found in commentary for ${staticId}`,
    );
    return null;
  }

  const rawStatus: string = m["@status"] ?? "";
  const timerStr: string = m["@timer"] ?? m["@minute"] ?? "";
  const { status, minute } = parseGsStatus(rawStatus, timerStr);

  const scoreHome: number | null =
    m.localteam?.["@goals"] != null
      ? parseInt(String(m.localteam["@goals"]), 10)
      : null;
  const scoreAway: number | null =
    m.visitorteam?.["@goals"] != null
      ? parseInt(String(m.visitorteam["@goals"]), 10)
      : null;

  return {
    staticId,
    status,
    minute,
    scoreHome: isNaN(scoreHome as number) ? null : (scoreHome as number),
    scoreAway: isNaN(scoreAway as number) ? null : (scoreAway as number),
    isFullTime: status === "finished",
    raw: m,
  };
}

// ── Parse goals from commentary match node ────────────────────────────────────

/**
 * Parse goal events from a GoalServe commentary match node.
 * Excludes VAR-cancelled goals.
 */
// deno-lint-ignore no-explicit-any
export function parseGsGoals(m: any): GsGoalEvent[] {
  const goals: GsGoalEvent[] = [];

  for (const side of ["localteam", "visitorteam"] as const) {
    const team: "home" | "away" = side === "localteam" ? "home" : "away";
    // deno-lint-ignore no-explicit-any
    const goalPlayers: any[] = toArr(m?.summary?.[side]?.goals?.player);
    for (const p of goalPlayers) {
      const isVarCancelled =
        String(p["@var_cancelled"] ?? "False").toLowerCase() === "true";
      if (isVarCancelled) continue; // skip cancelled goals

      goals.push({
        playerName: p["@name"] ?? "",
        team,
        minute: parseInt(String(p["@minute"] ?? "0"), 10) || 0,
        extraMin: parseInt(String(p["@extra_min"] ?? "0"), 10) || 0,
        isOwnGoal: String(p["@owngoal"] ?? "False").toLowerCase() === "true",
        isPenalty: String(p["@penalty"] ?? "False").toLowerCase() === "true",
        isVarCancelled: false, // already filtered above
      });
    }
  }

  return goals;
}

// ── Parse corners from commentary match node ──────────────────────────────────

export interface GsCorners {
  home: number;
  away: number;
}

// deno-lint-ignore no-explicit-any
export function parseGsCorners(m: any): GsCorners {
  // Primary: stats.localteam.corners["@total"] / stats.visitorteam.corners["@total"]
  const stats = m?.stats;

  const rawHome =
    stats?.localteam?.corners?.["@total"] ??
    stats?.localteam?.corners?.total ??
    stats?.corners?.["@localteam"] ??
    stats?.corners?.["@home"] ??
    stats?.localteam?.["@corners"] ??
    stats?.["@corners"]?.localteam ??
    stats?.corners?.localteam ??
    null;

  const rawAway =
    stats?.visitorteam?.corners?.["@total"] ??
    stats?.visitorteam?.corners?.total ??
    stats?.corners?.["@visitorteam"] ??
    stats?.corners?.["@away"] ??
    stats?.visitorteam?.["@corners"] ??
    stats?.["@corners"]?.visitorteam ??
    stats?.corners?.visitorteam ??
    null;

  return {
    home: rawHome != null ? parseInt(String(rawHome), 10) || 0 : 0,
    away: rawAway != null ? parseInt(String(rawAway), 10) || 0 : 0,
  };
}

// ── Parse lineups from commentary match node ──────────────────────────────────

export interface GsLineupPlayer {
  /** Synthetic ID: "gs_<normalized_name>" */
  id: string;
  name: string;
  team: "home" | "away";
  jersey: number | null;
  position: string | null;
  isStarter: boolean;
}

// deno-lint-ignore no-explicit-any
export function parseGsLineup(m: any): GsLineupPlayer[] {
  const players: GsLineupPlayer[] = [];

  for (const side of ["localteam", "visitorteam"] as const) {
    const team: "home" | "away" = side === "localteam" ? "home" : "away";

    // Starters: teams.localteam.player[]
    // deno-lint-ignore no-explicit-any
    const starters: any[] = toArr(m?.teams?.[side]?.player);
    for (const p of starters) {
      const name: string = p["@name"] ?? p.name ?? "";
      if (!name) continue;
      players.push({
        id: gsPlayerId(name),
        name,
        team,
        jersey:
          p["@number"] != null ? parseInt(String(p["@number"]), 10) : null,
        position: gsPositionFromCode(p["@pos"] ?? ""),
        isStarter: true,
      });
    }

    // Substitutes: substitutes.localteam.player[]
    // deno-lint-ignore no-explicit-any
    const subs: any[] = toArr(m?.substitutes?.[side]?.player);
    for (const p of subs) {
      const name: string = p["@name"] ?? p.name ?? "";
      if (!name) continue;
      players.push({
        id: gsPlayerId(name),
        name,
        team,
        jersey:
          p["@number"] != null ? parseInt(String(p["@number"]), 10) : null,
        position: "Substitute",
        isStarter: false,
      });
    }
  }

  return players;
}

/** Map GoalServe single-letter position code to readable label */
function gsPositionFromCode(code: string): string | null {
  switch ((code ?? "").toUpperCase()) {
    case "G":
    case "GK":
      return "Goalkeeper";
    case "D":
    case "DF":
      return "Defender";
    case "M":
    case "MF":
      return "Midfielder";
    case "F":
    case "FW":
      return "Forward";
    case "S":
      return "Substitute";
    default:
      return code || null;
  }
}

/** Normalize a player name to a synthetic GoalServe ID (for bet matching) */
export function normForGsId(name: string): string {
  return gsPlayerId(name);
}
