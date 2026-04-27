/**
 * StatsPerform API helper — shared across sync-match-status and settle-match.
 *
 * OAuth: POST to OAUTH_URL?apikey={key} with client_credentials body.
 * MA1:  GET /soccerdata/match/{matchId}?live=yes&_fmt=json
 * MA3:  GET /soccerdata/matchevent/?fx={matchId}&_fmt=json
 *
 * Event typeIds (Opta standard):
 *   16 = Goal
 *   22 = Corner awarded
 *   Own goal qualifier = qualifierId 55
 *
 * Status mapping (MA1 liveData.matchDetails.matchStatus):
 *   "Fixture" / "PreMatch" → "pre-match"
 *   "Playing"              → "live"
 *   "HalfTime"             → "halftime"
 *   "FullTime"             → "finished"
 *   "Postponed"/"Cancelled"→ "cancelled"
 *
 * Env vars:
 *   STATSPERFORM_API_KEY       — trial API key
 *   STATSPERFORM_CLIENT_ID     — OAuth client_id
 *   STATSPERFORM_CLIENT_SECRET — OAuth client_secret
 *   STATSPERFORM_BASE_URL      — https://api.statsperform.com/sdapi/v1
 *   STATSPERFORM_OAUTH_URL     — https://api.statsperform.com/realms/apigw/protocol/openid-connect/token
 */

const SP_BASE =
  Deno.env.get("STATSPERFORM_BASE_URL") ??
  "https://api.statsperform.com/sdapi/v1";

const SP_OAUTH =
  Deno.env.get("STATSPERFORM_OAUTH_URL") ??
  "https://api.statsperform.com/realms/apigw/protocol/openid-connect/token";

const SP_API_KEY = Deno.env.get("STATSPERFORM_API_KEY") ?? "";
const SP_CLIENT_ID = Deno.env.get("STATSPERFORM_CLIENT_ID") ?? "";
const SP_CLIENT_SECRET = Deno.env.get("STATSPERFORM_CLIENT_SECRET") ?? "";

// Per-invocation token cache (edge functions are single-invocation processes)
let _cachedToken: { token: string; expiresAt: number } | null = null;

// ── OAuth ─────────────────────────────────────────────────────────────────────

/**
 * Get a valid OAuth bearer token.
 * Result is cached in memory for the lifetime of this edge function invocation.
 */
export async function getSpToken(): Promise<string> {
  const now = Date.now();
  if (_cachedToken && now < _cachedToken.expiresAt - 30_000) {
    return _cachedToken.token;
  }

  const url = `${SP_OAUTH}?apikey=${SP_API_KEY}`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: SP_CLIENT_ID,
    client_secret: SP_CLIENT_SECRET,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(
      `StatsPerform OAuth failed ${res.status}: ${txt.slice(0, 200)}`,
    );
  }

  // deno-lint-ignore no-explicit-any
  const data: any = await res.json();
  const token: string = data.access_token;
  const expiresIn: number = data.expires_in ?? 3600;
  _cachedToken = { token, expiresAt: now + expiresIn * 1_000 };
  return token;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type SpStatus =
  | "pre-match"
  | "live"
  | "halftime"
  | "finished"
  | "cancelled";

export interface SpMatchLiveData {
  matchId: string;
  status: SpStatus;
  /** Current match minute — null when not in play */
  minute: number | null;
  scoreHome: number | null;
  scoreAway: number | null;
  homeContestantId: string;
  awayContestantId: string;
  /** true when StatsPerform reports FullTime (periodId >= 5 or matchStatus "FullTime") */
  isFullTime: boolean;
}

export interface SpGoalEvent {
  playerId: string;
  playerName: string;
  team: "home" | "away";
  minute: number;
  isOwnGoal: boolean;
}

export interface SpMatchEvents {
  goals: SpGoalEvent[];
  /** Total corners awarded per team (count of typeId=22 events) */
  cornersHome: number;
  cornersAway: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
function toArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function parseSpStatusStr(
  matchStatus: string,
  periodId: number,
  matchTime?: number,
): { status: SpStatus; minute: number | null } {
  switch (matchStatus) {
    case "FullTime":
    case "Full-time":
      return { status: "finished", minute: null };
    case "HalfTime":
      return { status: "halftime", minute: 45 };
    case "Playing":
      return {
        status: "live",
        minute: matchTime != null && !isNaN(matchTime) ? matchTime : null,
      };
    case "PreMatch":
    case "Fixture":
    case "":
      return { status: "pre-match", minute: null };
    case "Postponed":
    case "Cancelled":
    case "Abandoned":
      return { status: "cancelled", minute: null };
    default:
      // Fall back on periodId: 1=H1, 2=H2 → live; 3=HT; ≥5=FT
      if (periodId >= 5) return { status: "finished", minute: null };
      if (periodId === 3) return { status: "halftime", minute: 45 };
      if (periodId === 1 || periodId === 2) {
        return {
          status: "live",
          minute: matchTime != null && !isNaN(matchTime) ? matchTime : null,
        };
      }
      return { status: "pre-match", minute: null };
  }
}

// ── MA1: single-match live data ───────────────────────────────────────────────

/**
 * MA1 — fetch live status + score for a single match.
 * Returns null on HTTP error or if the match is not found in the response.
 */
export async function getSpMatchLive(
  matchId: string,
  token: string,
): Promise<SpMatchLiveData | null> {
  const url = `${SP_BASE}/soccerdata/match/${matchId}?live=yes&_fmt=json`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    console.warn(`[statsperform] MA1 ${matchId} → HTTP ${res.status}`);
    return null;
  }

  // deno-lint-ignore no-explicit-any
  const data: any = await res.json();
  const matches = toArray(data?.match);
  if (matches.length === 0) return null;

  // deno-lint-ignore no-explicit-any
  const m: any = matches[0];
  const info = m?.matchInfo ?? {};
  const liveData = m?.liveData ?? {};
  const details = liveData?.matchDetails ?? {};

  const contestants = toArray(info?.contestant ?? []);
  // deno-lint-ignore no-explicit-any
  const home = contestants.find((c: any) => c.position === "home") ?? {};
  // deno-lint-ignore no-explicit-any
  const away = contestants.find((c: any) => c.position === "away") ?? {};

  const matchStatus: string = details?.matchStatus ?? "Fixture";
  const periodId: number = parseInt(String(details?.periodId ?? "0"), 10) || 0;
  const matchTime: number | undefined =
    details?.matchTime != null
      ? parseInt(String(details.matchTime), 10)
      : undefined;

  const { status, minute } = parseSpStatusStr(matchStatus, periodId, matchTime);

  // Score can appear in details.scores.total, details.scores.ft, or details.score
  const scoreNode =
    details?.scores?.total ?? details?.scores?.ft ?? details?.score ?? null;

  const rawScoreHome =
    scoreNode?.home != null ? parseInt(String(scoreNode.home), 10) : null;
  const rawScoreAway =
    scoreNode?.away != null ? parseInt(String(scoreNode.away), 10) : null;

  return {
    matchId: (info?.id as string) ?? matchId,
    status,
    minute: minute != null && !isNaN(minute) ? minute : null,
    scoreHome:
      rawScoreHome != null && !isNaN(rawScoreHome) ? rawScoreHome : null,
    scoreAway:
      rawScoreAway != null && !isNaN(rawScoreAway) ? rawScoreAway : null,
    homeContestantId: (home as { id?: string })?.id ?? "",
    awayContestantId: (away as { id?: string })?.id ?? "",
    isFullTime:
      matchStatus === "FullTime" ||
      matchStatus === "Full-time" ||
      periodId >= 5,
  };
}

// ── MA3: match events ─────────────────────────────────────────────────────────

/**
 * MA3 — fetch all events for a match and extract goals + corners.
 * Returns empty arrays on HTTP error (non-fatal — callers handle gracefully).
 *
 * @param homeContestantId — used to attribute events to home vs away team
 */
export async function getSpMatchEvents(
  matchId: string,
  token: string,
  homeContestantId: string,
): Promise<SpMatchEvents> {
  const empty: SpMatchEvents = { goals: [], cornersHome: 0, cornersAway: 0 };

  const url = `${SP_BASE}/soccerdata/matchevent/?fx=${matchId}&_fmt=json`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    console.warn(`[statsperform] MA3 ${matchId} → HTTP ${res.status}`);
    return empty;
  }

  // deno-lint-ignore no-explicit-any
  const data: any = await res.json();
  const rawEvents = toArray(
    data?.matchEventFeed?.event ?? data?.liveData?.event ?? [],
  );

  const goals: SpGoalEvent[] = [];
  let cornersHome = 0;
  let cornersAway = 0;

  for (const ev of rawEvents) {
    const typeId: number = parseInt(String(ev?.typeId ?? "0"), 10);
    const minute: number = parseInt(String(ev?.timeMin ?? "0"), 10) || 0;
    const contestantId: string = ev?.contestantId ?? "";
    const team: "home" | "away" =
      contestantId === homeContestantId ? "home" : "away";

    if (typeId === 16) {
      // Goal — check qualifiers for own goal (qualifierId 55 in Opta spec)
      const quals = toArray(ev?.qualifier ?? []);
      // deno-lint-ignore no-explicit-any
      const isOwnGoal = quals.some((q: any) => String(q?.qualifierId) === "55");
      goals.push({
        playerId: String(ev?.playerId ?? "unknown"),
        playerName: String(ev?.playerName ?? "Unknown scorer"),
        team,
        minute,
        isOwnGoal,
      });
    } else if (typeId === 22) {
      // Corner awarded
      if (team === "home") cornersHome++;
      else cornersAway++;
    }
  }

  return { goals, cornersHome, cornersAway };
}
