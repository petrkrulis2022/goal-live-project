/**
 * Poll Goalserve every 60s for live match scores + corners.
 * Updates Supabase matches table (score_home, score_away, corners_home, corners_away).
 * Also triggers corner bet settlement when corner count increases.
 * Run with: node scripts/poll-live-matches.mjs
 */

const SUPABASE_URL = "https://weryswulejhjkrmervnf.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlcnlzd3VsZWpoamtybWVydm5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyMTI4MSwiZXhwIjoyMDg3NTk3MjgxfQ.iNo5ZaDJMdFixl8sgoNr6uSDH5Wmvkx9c3jSpDgVXtQ";
const GS_KEY = "5dc9cf20aca34682682708de71344f52";
const GS_BASE = "https://www.goalserve.com/getfeed";

const SPORT_TO_GS_LEAGUE = {
  soccer_epl: "1204",
  soccer_uefa_europa_league: "1007",
  soccer_uefa_europa_conference_league: "18853",
  soccer_uefa_champs_league: "1005",
  soccer_germany_bundesliga: "1229",
  soccer_spain_la_liga: "1399",
  soccer_italy_serie_a: "1269",
  soccer_france_ligue_one: "1221",
};

function toArray(val) {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer ?? "return=minimal",
      ...opts.headers,
    },
    method: opts.method ?? "GET",
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase ${path}: ${res.status} ${txt}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function fetchLiveMatches() {
  const rows = await sbFetch(
    `/matches?status=eq.live&select=id,home_team,away_team,goalserve_static_id,score_home,score_away,corners_home,corners_away,corners_last_settled,odds_api_config`,
  );
  return (rows ?? []).map((r) => ({
    id: r.id,
    home: r.home_team,
    away: r.away_team,
    staticId: r.goalserve_static_id ?? "0",
    scoreHome: r.score_home ?? 0,
    scoreAway: r.score_away ?? 0,
    cornersHome: r.corners_home ?? 0,
    cornersAway: r.corners_away ?? 0,
    cornersLastSettled: r.corners_last_settled ?? 0,
    gsLeague:
      r.odds_api_config?.goalserve_league ??
      SPORT_TO_GS_LEAGUE[r.odds_api_config?.sport] ??
      "1204",
  }));
}

async function settleCornerBets(matchId, cornerNumber, winningTeam) {
  const bets = await sbFetch(
    `/bets?match_id=eq.${matchId}&bet_type=eq.NEXT_CORNER&current_player_id=eq.${cornerNumber}&status=eq.active&select=id,outcome`,
    { headers: { Prefer: "return=representation" } },
  );
  if (!bets || bets.length === 0) return 0;
  for (const bet of bets) {
    const won = bet.outcome === winningTeam;
    await sbFetch(`/bets?id=eq.${bet.id}`, {
      method: "PATCH",
      body: {
        status: won ? "settled_won" : "settled_lost",
        updated_at: new Date().toISOString(),
      },
    });
    console.log(
      `    → Bet ${bet.id.slice(0, 8)} corner #${cornerNumber}: ${bet.outcome} vs ${winningTeam} → ${won ? "WON ✓" : "LOST ✗"}`,
    );
  }
  return bets.length;
}

function parseCornersFromStats(stats) {
  const raw =
    // Goalserve actual format: stats.localteam.corners["@total"]
    stats?.localteam?.corners?.["@total"] ??
    stats?.localteam?.corners?.total ??
    // legacy / fallback formats
    stats?.corners?.["@localteam"] ??
    stats?.corners?.["@home"] ??
    stats?.localteam?.["@corners"] ??
    stats?.["@corners"]?.localteam ??
    stats?.corners?.localteam ??
    "";
  const rawAway =
    stats?.visitorteam?.corners?.["@total"] ??
    stats?.visitorteam?.corners?.total ??
    stats?.corners?.["@visitorteam"] ??
    stats?.corners?.["@away"] ??
    stats?.visitorteam?.["@corners"] ??
    stats?.["@corners"]?.visitorteam ??
    stats?.corners?.visitorteam ??
    "";
  const h = parseInt(String(raw), 10);
  const a = parseInt(String(rawAway), 10);
  return { cornersHome: isNaN(h) ? -1 : h, cornersAway: isNaN(a) ? -1 : a };
}

async function pollMatch(match) {
  const { id, home, away, staticId, gsLeague } = match;
  if (!staticId || staticId === "0") {
    console.log(`  [${home} vs ${away}] no static_id — skip`);
    return;
  }

  const url = `${GS_BASE}/${GS_KEY}/commentaries/match?id=${staticId}&league=${gsLeague}&json=1`;
  let data;
  try {
    const res = await fetch(url);
    data = await res.json();
  } catch (e) {
    console.error(`  [${home} vs ${away}] fetch error:`, e.message);
    return;
  }

  const raw =
    data?.commentaries?.tournament?.match ?? data?.commentaries?.match ?? null;
  const matchNode = raw ? (Array.isArray(raw) ? raw[0] : raw) : null;
  if (!matchNode) {
    console.log(`  [${home} vs ${away}] no matchNode in response`);
    console.log(
      `  keys:`,
      Object.keys(data?.commentaries ?? data ?? {}).join(", "),
    );
    return;
  }

  const scoreHome =
    parseInt(
      matchNode?.localteam?.["@goals"] ??
        matchNode?.["@localteam_score"] ??
        match.scoreHome,
      10,
    ) || 0;
  const scoreAway =
    parseInt(
      matchNode?.visitorteam?.["@goals"] ??
        matchNode?.["@visitorteam_score"] ??
        match.scoreAway,
      10,
    ) || 0;
  const status = matchNode?.["@status"] ?? "";
  const minute = matchNode?.["@timer"] ?? matchNode?.["@minute"] ?? "?";

  const stats = matchNode?.stats ?? {};
  const { cornersHome, cornersAway } = parseCornersFromStats(stats);

  console.log(`\n  [${home} vs ${away}] ${status} ${minute}'`);
  console.log(
    `  Score: ${scoreHome}-${scoreAway}  |  Corners: ${cornersHome}-${cornersAway} (prev DB: ${match.cornersHome}-${match.cornersAway}, last settled: ${match.cornersLastSettled})`,
  );

  const update = {};

  // Score change
  if (scoreHome !== match.scoreHome || scoreAway !== match.scoreAway) {
    update.score_home = scoreHome;
    update.score_away = scoreAway;
    console.log(
      `  *** GOAL CHANGE: ${match.scoreHome}-${match.scoreAway} → ${scoreHome}-${scoreAway} ***`,
    );
  }

  // Corner change + settlement
  if (cornersHome >= 0 && cornersAway >= 0) {
    const newTotal = cornersHome + cornersAway;
    // Use corners_last_settled as the baseline so we never double-settle
    const lastSettled = match.cornersLastSettled ?? 0;

    if (newTotal > lastSettled) {
      console.log(
        `  *** CORNER CHANGE: settled up to #${lastSettled} → now #${newTotal} ***`,
      );

      // Attribution model: corners 1..cornersHome = home, cornersHome+1..total = away
      // For each new corner number N from lastSettled+1 to newTotal:
      for (let n = lastSettled + 1; n <= newTotal; n++) {
        const team = n <= cornersHome ? "home" : "away";
        console.log(`    Settling corner #${n} → ${team}`);
        await settleCornerBets(id, n, team);
      }

      update.corners_home = cornersHome;
      update.corners_away = cornersAway;
      update.corners_last_settled = newTotal;
    } else if (
      cornersHome !== match.cornersHome ||
      cornersAway !== match.cornersAway
    ) {
      update.corners_home = cornersHome;
      update.corners_away = cornersAway;
    }
  }

  if (Object.keys(update).length > 0) {
    try {
      await sbFetch(`/matches?id=eq.${id}`, { method: "PATCH", body: update });
      console.log(`  ✓ Supabase updated:`, update);
    } catch (e) {
      console.error(`  ✗ Supabase update failed:`, e.message);
    }
  } else {
    console.log(`  no change`);
  }
}

async function poll() {
  const ts = new Date().toLocaleTimeString();
  console.log(`\n[${ts}] polling Goalserve...`);
  let matches;
  try {
    matches = await fetchLiveMatches();
  } catch (e) {
    console.error("  fetchLiveMatches error:", e.message);
    return;
  }
  if (matches.length === 0) {
    console.log("  no live matches in Supabase");
    return;
  }
  for (const m of matches) {
    await pollMatch(m);
  }
}

// Run immediately, then every 60s
poll();
setInterval(poll, 60_000);
console.log("Polling every 60s — Ctrl+C to stop");
