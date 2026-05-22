/**
 * Live poller — Bournemouth vs Manchester City
 * Polls soccernew/home every 60s, detects goals.
 * Start this before kick-off (18:30 UTC / 20:30 UTC+2).
 * Run: node scripts/poll-bournemouth-mancity.mjs
 */

const GS_KEY = "edc0ecd4f73c4c1a20f808dea8e5ebf2";
const HOME_URL = `https://www.goalserve.com/getfeed/${GS_KEY}/soccernew/home?json=1`;
const TEAM_A = "Bournemouth";
const TEAM_B = "Manchester City";
const POLL_MS = 60_000;

let prevHome = -1;
let prevAway = -1;
let pollCount = 0;

function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function log(msg) {
  const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

async function poll() {
  pollCount++;
  try {
    const res = await fetch(HOME_URL);
    const text = await res.text();

    // Feed returns HTML before match data is available
    if (!text.trimStart().startsWith("{")) {
      log(
        `#${pollCount} No match data yet (feed not populated) — waiting for kick-off 20:30 UTC+2...`,
      );
      return;
    }

    const data = JSON.parse(text);
    const leagues = toArray(data?.scores?.category);
    let found = false;

    for (const league of leagues) {
      const matches = toArray(league?.matches?.match ?? league?.match);
      for (const m of matches) {
        const home = m?.localteam?.["@name"] ?? "";
        const away = m?.visitorteam?.["@name"] ?? "";

        const isBourMC =
          (home === TEAM_A && away === TEAM_B) ||
          (home === TEAM_B && away === TEAM_A);
        if (!isBourMC) continue;

        found = true;
        const status = m["@status"] ?? "?";
        const timer = m["@timer"] ?? "";
        const goalsH = parseInt(m?.localteam?.["@goals"]) || 0;
        const goalsA = parseInt(m?.visitorteam?.["@goals"]) || 0;

        const scoreStr = `${home} ${goalsH} – ${goalsA} ${away}`;
        const statusStr =
          status === "FT"
            ? "FULL TIME"
            : status === "HT"
              ? "HALF TIME"
              : /^\d+$/.test(status)
                ? `LIVE min ${status}`
                : `Status: ${status}`;

        log(
          `#${pollCount} [${league["@name"] ?? "?"}] ${scoreStr} | ${statusStr}`,
        );

        // Detect goal
        if (prevHome >= 0) {
          if (goalsH > prevHome) {
            const scorer = home;
            log(`🚨🚨🚨 GOAL! ${scorer} SCORED! ${scoreStr}`);
          }
          if (goalsA > prevAway) {
            const scorer = away;
            log(`🚨🚨🚨 GOAL! ${scorer} SCORED! ${scoreStr}`);
          }
        } else if (goalsH >= 0 && goalsA >= 0) {
          // First time we see valid scores, set baseline
          log(`ℹ  Baseline set: ${scoreStr}`);
        }

        prevHome = goalsH;
        prevAway = goalsA;

        if (status === "FT") {
          log(`✅ FINAL SCORE: ${scoreStr} — stopping poller.`);
          process.exit(0);
        }
      }
    }

    if (!found) {
      log(
        `#${pollCount} Match not found in feed yet — waiting for kick-off...`,
      );
    }
  } catch (err) {
    log(`#${pollCount} ERROR: ${err.message}`);
  }
}

log(`=== Bournemouth vs Manchester City poller started ===`);
log(`Polling every ${POLL_MS / 1000}s. Kick-off: 20:30 UTC+2 (18:30 UTC)`);
log(`Press Ctrl+C to stop.\n`);

poll();
setInterval(poll, POLL_MS);
