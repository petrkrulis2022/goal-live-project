#!/usr/bin/env node
/**
 * poll-football-game.mjs
 * Usage: node scripts/poll-football-game.mjs "HomeTeam" "AwayTeam"
 *
 * Polls Goalserve home feed every 5 seconds.
 * Prints score updates and alerts on goals.
 * Exits when status is FT.
 */

const GS_KEY = "edc0ecd4f73c4c1a20f808dea8e5ebf2";
const HOME_FEED = `https://www.goalserve.com/getfeed/${GS_KEY}/soccernew/home?json=1`;
const POLL_MS = 5_000;

const [homeArg, awayArg] = process.argv.slice(2);
if (!homeArg || !awayArg) {
  console.error(
    'Usage: node scripts/poll-football-game.mjs "HomeTeam" "AwayTeam"',
  );
  process.exit(1);
}

console.log(`\n⚽  Tracking: ${homeArg} vs ${awayArg}`);
console.log("   Polling Goalserve every 5s…\n");

function matchesGame(home, away) {
  const a = homeArg.toLowerCase();
  const b = awayArg.toLowerCase();
  const h = home.toLowerCase();
  const aw = away.toLowerCase();
  return (h.includes(a) || aw.includes(a)) && (h.includes(b) || aw.includes(b));
}

function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

let prevHome = -1;
let prevAway = -1;
let running = true;

async function poll() {
  try {
    const res = await fetch(HOME_FEED);
    const text = await res.text();

    if (!text.trimStart().startsWith("{")) {
      console.log(
        `[${new Date().toLocaleTimeString()}] Feed not ready yet (non-JSON response)`,
      );
      return;
    }

    const data = JSON.parse(text);
    const categories = toArray(data?.scores?.category);
    let found = false;

    for (const cat of categories) {
      const matches = toArray(cat?.matches?.match ?? cat?.match);
      for (const m of matches) {
        const home = m?.localteam?.["@name"] ?? "";
        const away = m?.visitorteam?.["@name"] ?? "";
        if (!matchesGame(home, away)) continue;

        found = true;
        const scoreHome = parseInt(m?.localteam?.["@goals"]) || 0;
        const scoreAway = parseInt(m?.visitorteam?.["@goals"]) || 0;
        const status = m["@status"] ?? "?";
        const ts = new Date().toLocaleTimeString();

        // Detect goals
        if (prevHome >= 0) {
          if (scoreHome > prevHome) {
            console.log(`\n🚨 GOAL! ${home} scores! (${ts})`);
            console.log(
              `   ${home} ${scoreHome}–${scoreAway} ${away}  [${status}']\n`,
            );
          }
          if (scoreAway > prevAway) {
            console.log(`\n🚨 GOAL! ${away} scores! (${ts})`);
            console.log(
              `   ${home} ${scoreHome}–${scoreAway} ${away}  [${status}']\n`,
            );
          }
        }

        prevHome = scoreHome;
        prevAway = scoreAway;

        console.log(
          `[${ts}] ${home} ${scoreHome}–${scoreAway} ${away}  Status: ${status}`,
        );

        if (status === "FT") {
          console.log(
            `\n✅ Full Time: ${home} ${scoreHome}–${scoreAway} ${away}`,
          );
          running = false;
        }
        break;
      }
      if (found) break;
    }

    if (!found) {
      console.log(
        `[${new Date().toLocaleTimeString()}] Game not found in live feed yet…`,
      );
    }
  } catch (e) {
    console.error(`[${new Date().toLocaleTimeString()}] Error: ${e.message}`);
  }
}

// Initial poll + interval
await poll();
const iv = setInterval(async () => {
  if (!running) {
    clearInterval(iv);
    process.exit(0);
  }
  await poll();
}, POLL_MS);
