/**
 * Dual live poller — Bournemouth vs Man City  +  Chelsea vs Tottenham
 * Polls soccernew/home every 60s and prints both scores side by side.
 * Run: node scripts/poll-both-games.mjs
 */

const GS_KEY = "edc0ecd4f73c4c1a20f808dea8e5ebf2";
const HOME_URL = `https://www.goalserve.com/getfeed/${GS_KEY}/soccernew/home?json=1`;
const POLL_MS = 10_000;

const GAMES = [
  {
    label: "GAME 1 🟡",
    teams: ["Bournemouth", "Manchester City"],
    kickoff: "20:30 UTC+2",
    prevHome: -1,
    prevAway: -1,
    finished: false,
  },
  {
    label: "GAME 2 🔵",
    teams: ["Chelsea", "Tottenham"],
    kickoff: "21:15 UTC+2",
    prevHome: -1,
    prevAway: -1,
    finished: false,
  },
];

let pollCount = 0;

function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function ts() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function matchesGame(home, away, game) {
  const [a, b] = game.teams;
  return (
    (home.includes(a) || away.includes(a)) &&
    (home.includes(b) || away.includes(b))
  );
}

async function poll() {
  pollCount++;
  const allFinished = GAMES.every((g) => g.finished);
  if (allFinished) {
    console.log(`\n[${ts()}] Both matches finished. Bye!`);
    process.exit(0);
  }

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
    console.log(`  ⏳ Feed not populated yet — matches not loaded into API.`);
    console.log(
      `     GAME 1 kicks off ${GAMES[0].kickoff} | GAME 2 kicks off ${GAMES[1].kickoff}`,
    );
    return;
  }

  const leagues = toArray(feedData?.scores?.category);

  for (const game of GAMES) {
    if (game.finished) {
      console.log(`  ${game.label}  ✅ Already finished — no longer tracking.`);
      continue;
    }

    let found = false;

    for (const league of leagues) {
      const matches = toArray(league?.matches?.match ?? league?.match);
      for (const m of matches) {
        const home = m?.localteam?.["@name"] ?? "";
        const away = m?.visitorteam?.["@name"] ?? "";
        if (!matchesGame(home, away, game)) continue;

        found = true;
        const status = m["@status"] ?? "?";
        const goalsH = parseInt(m?.localteam?.["@goals"]);
        const goalsA = parseInt(m?.visitorteam?.["@goals"]);
        const safeH = isNaN(goalsH) ? 0 : goalsH;
        const safeA = isNaN(goalsA) ? 0 : goalsA;

        const scoreStr = `${home} ${safeH} – ${safeA} ${away}`;
        const statusStr =
          status === "FT"
            ? "FULL TIME"
            : status === "HT"
              ? "HALF TIME"
              : /^\d+$/.test(status)
                ? `min ${status}'`
                : `(${status})`;

        console.log(`  ${game.label}  ${scoreStr}  |  ${statusStr}`);

        // Goal detection
        if (game.prevHome >= 0) {
          if (safeH > game.prevHome) {
            console.log(
              `  ${game.label}  🚨🚨🚨 GOAL! ${home} scored! → ${scoreStr}`,
            );
          }
          if (safeA > game.prevAway) {
            console.log(
              `  ${game.label}  🚨🚨🚨 GOAL! ${away} scored! → ${scoreStr}`,
            );
          }
        } else {
          console.log(`  ${game.label}  ℹ  Baseline: ${scoreStr}`);
        }

        game.prevHome = safeH;
        game.prevAway = safeA;

        if (status === "FT") {
          console.log(`  ${game.label}  ✅ FINAL: ${scoreStr}`);
          game.finished = true;
        }
      }
    }

    if (!found) {
      console.log(
        `  ${game.label}  ⏳ Not in feed yet — kick-off ${game.kickoff}`,
      );
    }
  }
}

console.log(`\n${"═".repeat(60)}`);
console.log(`  DUAL LIVE MATCH TRACKER — May 19 2026`);
console.log(`  GAME 1 🟡  Bournemouth vs Manchester City  (20:30 UTC+2)`);
console.log(`  GAME 2 🔵  Chelsea vs Tottenham Hotspur   (21:15 UTC+2)`);
console.log(`  Polling every ${POLL_MS / 1000}s · Ctrl+C to stop`);
console.log(`${"═".repeat(60)}\n`);

poll();
setInterval(poll, POLL_MS);
