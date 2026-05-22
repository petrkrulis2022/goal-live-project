/**
 * Live poller — Freiburg vs Aston Villa (UEFA Europa League Final)
 * Polls soccernew/home every 5s and prints the live score.
 * Run: node scripts/poll-freiburg-villa.mjs
 * Kicks off: 21:00 UTC+2 (19:00 UTC) — May 20 2026
 */

const GS_KEY = "edc0ecd4f73c4c1a20f808dea8e5ebf2";
const HOME_URL = `https://www.goalserve.com/getfeed/${GS_KEY}/soccernew/home?json=1`;
const POLL_MS = 5_000;

const MATCH = {
  teams: ["Freiburg", "Aston Villa"],
  kickoff: "21:00 UTC+2",
  prevHome: -1,
  prevAway: -1,
  finished: false,
};

let pollCount = 0;

function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function ts() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function matchesGame(home, away) {
  const [a, b] = MATCH.teams;
  return (
    (home.includes(a) || away.includes(a)) &&
    (home.includes(b) || away.includes(b))
  );
}

async function poll() {
  if (MATCH.finished) {
    console.log(`\n[${ts()}] Match finished. Bye!`);
    process.exit(0);
  }

  pollCount++;

  let feedData = null;
  let feedError = null;

  try {
    const res = await fetch(HOME_URL);
    const text = await res.text();
    if (text.trimStart().startsWith("{")) {
      feedData = JSON.parse(text);
    }
  } catch (e) {
    feedError = e.message;
  }

  console.log(
    `\n━━━ Poll #${pollCount} @ ${ts()} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  );

  if (feedError) {
    console.log(`  ⚠  Feed error: ${feedError}`);
    return;
  }

  if (!feedData) {
    console.log(
      `  ⏳ Feed not populated yet — waiting for kick-off (${MATCH.kickoff}).`,
    );
    return;
  }

  const leagues = toArray(feedData?.scores?.category);
  let found = false;

  for (const league of leagues) {
    const matches = toArray(league?.matches?.match ?? league?.match);
    for (const m of matches) {
      const home = m?.localteam?.["@name"] ?? "";
      const away = m?.visitorteam?.["@name"] ?? "";
      if (!matchesGame(home, away)) continue;

      found = true;
      const status = m["@status"] ?? "?";
      const goalsH = parseInt(m?.localteam?.["@goals"]);
      const goalsA = parseInt(m?.visitorteam?.["@goals"]);
      const safeH = isNaN(goalsH) ? 0 : goalsH;
      const safeA = isNaN(goalsA) ? 0 : goalsA;

      const scoreStr = `${home} ${safeH} – ${safeA} ${away}`;
      const statusStr =
        status === "FT"
          ? "FULL TIME ✅"
          : status === "HT"
            ? "HALF TIME ⏸"
            : /^\d+$/.test(status)
              ? `min ${status}'`
              : `(${status})`;

      console.log(`  ⚽  ${scoreStr}  |  ${statusStr}`);

      // Goal detection
      if (MATCH.prevHome >= 0) {
        if (safeH > MATCH.prevHome) {
          console.log(`\n  🚨🚨🚨  GOAL!!!  ${home} scored!  →  ${scoreStr}\n`);
        }
        if (safeA > MATCH.prevAway) {
          console.log(`\n  🚨🚨🚨  GOAL!!!  ${away} scored!  →  ${scoreStr}\n`);
        }
      } else {
        console.log(`  ℹ  Baseline established: ${scoreStr}`);
      }

      MATCH.prevHome = safeH;
      MATCH.prevAway = safeA;

      if (status === "FT") {
        console.log(`\n  🏆  FINAL RESULT: ${scoreStr}`);
        MATCH.finished = true;
        clearInterval(interval);
        process.exit(0);
      }
    }
  }

  if (!found) {
    console.log(`  ⏳ Match not in feed yet — kick-off ${MATCH.kickoff}`);
  }
}

console.log(`\n${"═".repeat(60)}`);
console.log(`  UEFA EUROPA LEAGUE FINAL — May 20 2026`);
console.log(`  🔴  Freiburg  vs  Aston Villa  🟣`);
console.log(`  Kick-off: ${MATCH.kickoff}  |  Poll interval: 5s`);
console.log(`${"═".repeat(60)}\n`);

// Run first poll immediately, then every 5s
poll();
const interval = setInterval(poll, POLL_MS);
