#!/usr/bin/env node
/**
 * poll-hockey-wc.mjs
 * Usage: node scripts/poll-hockey-wc.mjs <gameId> "HomeTeam" "AwayTeam"
 *
 * Polls Goalserve hockey home feed every 5 seconds.
 * Detects new goals via composite key deduplication.
 * Prints scorer, assists, period, and power-play info.
 * Prints a periodic score heartbeat and exits when the game is finished.
 */

const GOALSERVE_KEY = "edc0ecd4f73c4c1a20f808dea8e5ebf2";
const BASE_URL = `https://www.goalserve.com/getfeed/${GOALSERVE_KEY}/hockey`;
const POLL_MS = 5_000;

const [gameIdArg, homeArg, awayArg] = process.argv.slice(2);
if (!gameIdArg) {
  console.error(
    'Usage: node scripts/poll-hockey-wc.mjs <gameId> "HomeTeam" "AwayTeam"',
  );
  process.exit(1);
}

const GAME_ID = String(gameIdArg);
const HOME = homeArg ?? "Home";
const AWAY = awayArg ?? "Away";

console.log(`\n🏒  Tracking game #${GAME_ID}: ${HOME} vs ${AWAY}`);
console.log("   Polling Goalserve every 5s…\n");

const seenKeys = new Set();
let running = true;
let pollCount = 0;
let heartbeatCount = 0;
let lastScoreHome = null;
let lastScoreAway = null;

function ts() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function periodLabel(periodKey) {
  const key = String(periodKey).toLowerCase();
  if (key.includes("first")) return "P1";
  if (key.includes("second")) return "P2";
  if (key.includes("third")) return "P3";
  if (key.includes("overtime")) return "OT";
  if (key.includes("penalt")) return "SO";
  return String(periodKey);
}

function isFinished(status) {
  const normalized = String(status ?? "").toLowerCase();
  return (
    normalized.includes("finished") ||
    normalized === "ft" ||
    normalized.includes("after ot") ||
    normalized.includes("after so")
  );
}

function isLive(status, timer) {
  const normalized = String(status ?? "").toLowerCase();
  return (
    String(timer ?? "").trim() !== "" ||
    (normalized !== "" &&
      !normalized.includes("not started") &&
      !normalized.includes("finished") &&
      normalized !== "ft" &&
      !normalized.includes("after ot") &&
      !normalized.includes("after so"))
  );
}

function flattenEvents(match) {
  const entries = [];
  const events = match?.events ?? {};
  for (const [periodKey, payload] of Object.entries(events)) {
    const raw = payload?.event;
    if (Array.isArray(raw)) {
      for (const event of raw) entries.push({ periodKey, event });
    } else if (raw) {
      entries.push({ periodKey, event: raw });
    }
  }
  return entries;
}

function goalKey(periodKey, event) {
  return [
    periodLabel(periodKey),
    event.min ?? "",
    event.player ?? "",
    event.type ?? "",
    event.comment ?? "",
    event.result ?? "",
  ].join("|");
}

async function getGame() {
  const res = await fetch(`${BASE_URL}/home?json=1`);
  if (!res.ok) throw new Error(`Goalserve returned ${res.status}`);

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const snippet = text.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(
      `Goalserve did not return JSON. Response starts with: ${snippet}`,
    );
  }
  const categories = Array.isArray(data?.scores?.category)
    ? data.scores.category
    : [];

  for (const category of categories) {
    const matches = Array.isArray(category.match)
      ? category.match
      : category.match
        ? [category.match]
        : [];
    for (const match of matches) {
      if (String(match?.id ?? match?.fix_id ?? "") === GAME_ID) {
        return match;
      }
    }
  }

  return null;
}

async function pollOnce() {
  pollCount++;
  try {
    const game = await getGame();
    if (!game) {
      if (pollCount <= 3)
        console.error(`[${ts()}] Match ${GAME_ID} not found yet`);
      return;
    }

    const scoreHome = Number(game.localteam?.totalscore ?? 0) || 0;
    const scoreAway = Number(game.awayteam?.totalscore ?? 0) || 0;
    const status = game.status ?? "";
    const timer = game.timer ?? "";
    const live = isLive(status, timer);
    const finished = isFinished(status);

    if (
      heartbeatCount === 0 ||
      scoreHome !== lastScoreHome ||
      scoreAway !== lastScoreAway
    ) {
      console.log(
        `[${ts()}] Score: ${HOME} ${scoreHome}–${scoreAway} ${AWAY}  Status: ${status || (timer ? `Live ${timer}'` : "Not Started")}`,
      );
      heartbeatCount++;
      lastScoreHome = scoreHome;
      lastScoreAway = scoreAway;
    }

    if (live) {
      for (const { periodKey, event } of flattenEvents(game)) {
        const key = goalKey(periodKey, event);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        if (String(event.type ?? "").toLowerCase() !== "goal") continue;

        const minute = event.min ?? "?";
        const period = periodLabel(periodKey);
        const team =
          event.team === "localteam"
            ? HOME
            : event.team === "visitorteam"
              ? AWAY
              : (event.team ?? "?");
        const players = event.player ? [event.player] : [];
        const assists = (event.assist ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        const comment = event.comment ?? event.result ?? "";
        const isPP =
          comment.toLowerCase().includes("power") ||
          comment.toLowerCase().includes("pp");
        const isSH =
          comment.toLowerCase().includes("shorthanded") ||
          comment.toLowerCase().includes("short");

        console.log(`\n🚨 GOAL! [${ts()}] ${period} ${minute}'`);
        console.log(
          `   Team:    ${team}${isPP ? " 🔴 POWER PLAY" : ""}${isSH ? " ⚡ SHORT-HANDED" : ""}`,
        );
        if (players.length > 0) console.log(`   Scorer:  ${players[0]}`);
        if (assists.length > 0)
          console.log(`   Assists: ${assists.join(", ")}`);
        if (comment) console.log(`   Comment: ${comment}`);
        console.log();
      }
    }

    if (pollCount % 12 === 0) {
      console.log(`[${ts()}] ♥ Alive — ${seenKeys.size} events seen so far`);
    }

    if (finished) {
      console.log(
        `\n✅ Game over! Final: ${HOME} ${scoreHome}–${scoreAway} ${AWAY}  (${status})`,
      );
      running = false;
    }
  } catch (e) {
    console.error(`[${ts()}] Poll error: ${e.message}`);
  }
}

await pollOnce();

const intervalId = setInterval(async () => {
  if (!running) {
    clearInterval(intervalId);
    process.exit(0);
  }
  await pollOnce();
}, POLL_MS);
