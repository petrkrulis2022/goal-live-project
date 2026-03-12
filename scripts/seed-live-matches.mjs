/**
 * Generic player seeder — seeds ALL active (non-finished) matches in Supabase.
 * Fetches Goalserve lineups + Odds API scorer odds and upserts into Supabase.
 * Run with: node scripts/seed-live-matches.mjs
 */

const SUPABASE_URL = "https://weryswulejhjkrmervnf.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlcnlzd3VsZWpoamtybWVydm5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyMTI4MSwiZXhwIjoyMDg3NTk3MjgxfQ.iNo5ZaDJMdFixl8sgoNr6uSDH5Wmvkx9c3jSpDgVXtQ";
const ODDS_API_KEY = "46978d34dc5ac52756dd87ffbf9844b0";
const GS_KEY = "5dc9cf20aca34682682708de71344f52";

// sport key → Goalserve league id
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

// Fetch all active non-finished matches from Supabase
async function fetchActiveMatches() {
  const rows = await sbFetch(
    `/matches?status=not.in.(finished,cancelled)&select=id,home_team,away_team,external_match_id,goalserve_static_id,odds_api_config`,
  );
  return (rows ?? []).map((r) => ({
    externalId: r.external_match_id,
    home: r.home_team,
    away: r.away_team,
    sport: r.odds_api_config?.sport ?? "soccer_epl",
    gsLeague:
      r.odds_api_config?.goalserve_league ??
      SPORT_TO_GS_LEAGUE[r.odds_api_config?.sport] ??
      "1204",
    // pre-fill from DB if already known
    _dbId: r.id,
    _staticId: r.goalserve_static_id ?? "0",
  }));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function norm(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function oddsForPlayer(gsName, normPriceMap) {
  const n = norm(gsName);
  const words = n.split(/\s+/);
  const surname = words[words.length - 1];
  const firstName = words[0];
  if (normPriceMap.has(n)) return normPriceMap.get(n);
  if (surname.length >= 4) {
    for (const [oddsNorm, price] of normPriceMap) {
      const oddsSurname = oddsNorm.split(/\s+/).pop() ?? "";
      if (
        oddsSurname === surname ||
        oddsNorm.includes(surname) ||
        n.includes(oddsSurname)
      )
        return price;
    }
  }
  if (firstName.length >= 4) {
    for (const [oddsNorm, price] of normPriceMap) {
      const oddsFirst = oddsNorm.split(/\s+/)[0];
      if (
        oddsFirst.startsWith(firstName.slice(0, 5)) ||
        firstName.startsWith(oddsFirst.slice(0, 5))
      )
        return price;
    }
  }
  return null;
}

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer ?? "return=representation",
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase ${path}: ${res.status} ${txt}`);
  }
  const ct = res.headers.get("content-type") ?? "";
  if (res.status === 204 || !ct.includes("json")) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function toArr(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function parsePlayers(node) {
  if (!node?.player) return [];
  return toArr(node.player)
    .filter((p) => p?.["@name"])
    .map((p) => ({
      num: p["@number"] ?? p["@num"] ?? "",
      name: p["@name"] ?? "",
      pos: p["@pos"] ?? "",
    }));
}

// ── Per-match seeding ────────────────────────────────────────────────────────

async function seedMatch(m) {
  console.log(`\n═══ ${m.home} vs ${m.away} ══════════════════════════`);

  // 1. Get DB match id (use pre-fetched values if available)
  let matchDbId = m._dbId;
  let staticId = m._staticId ?? "0";
  if (!matchDbId) {
    const rows = await sbFetch(
      `/matches?external_match_id=eq.${m.externalId}&select=id,goalserve_static_id`,
    );
    if (!rows.length) {
      console.log("  ✗ Not found in DB — skipping");
      return;
    }
    matchDbId = rows[0].id;
    staticId = rows[0].goalserve_static_id ?? "0";
  }
  console.log(`  DB id=${matchDbId}  gs_static_id=${staticId}`);

  // 2. Fetch Odds API scorer odds
  console.log(`  Fetching Odds API scorer odds (${m.sport})…`);
  let priceMap = new Map();
  let teamMap = new Map();
  try {
    const oddsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/${m.sport}/events/${m.externalId}/odds?apiKey=${ODDS_API_KEY}&markets=player_first_goal_scorer&regions=us,uk,eu,au&oddsFormat=decimal`,
    );
    const oddsData = await oddsRes.json();
    if (oddsData.message) {
      console.log(`  ✗ Odds API error: ${oddsData.message}`);
    } else {
      const normHome = norm(m.home);
      const normAway = norm(m.away);
      for (const bm of oddsData.bookmakers ?? []) {
        for (const mkt of bm.markets ?? []) {
          if (mkt.key !== "player_first_goal_scorer") continue;
          for (const o of mkt.outcomes ?? []) {
            const pName = (o.description ?? o.name ?? "").trim();
            if (!pName || pName.toLowerCase() === "no scorer") continue;
            if (!priceMap.has(pName)) priceMap.set(pName, o.price);
            if (!teamMap.has(pName) && o.name && o.name !== pName) {
              const tNorm = norm(o.name);
              if (normHome && tNorm.includes(normHome.split(" ")[0]))
                teamMap.set(pName, "home");
              else if (normAway && tNorm.includes(normAway.split(" ")[0]))
                teamMap.set(pName, "away");
            }
          }
        }
      }
      console.log(`  Odds API: ${priceMap.size} players with scorer odds`);
    }
  } catch (e) {
    console.log(`  ✗ Odds API fetch failed: ${e.message}`);
  }

  // 3. Fetch Goalserve lineup
  let squad = []; // { name, num, pos, team, isStarter }

  // Discover static_id if missing
  if (staticId === "0") {
    console.log(`  Discovering Goalserve static_id…`);
    try {
      // Try live feed first
      const liveRes = await fetch(
        `https://www.goalserve.com/getfeed/${GS_KEY}/soccernew/home?json=1`,
      );
      const liveData = await liveRes.json();
      const homeWord = m.home.split(" ")[0].toLowerCase();
      const awayWord = m.away.split(" ")[0].toLowerCase();
      const cats = liveData?.newscores?.category ?? [];
      let found = null;
      for (const cat of toArr(cats)) {
        for (const mm of toArr(cat.match)) {
          const lt = (mm?.localteam?.["@name"] ?? "").toLowerCase();
          const vt = (mm?.visitorteam?.["@name"] ?? "").toLowerCase();
          if (lt.includes(homeWord) || vt.includes(awayWord)) {
            found = mm;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        // Try commentaries league feed
        const comRes = await fetch(
          `https://www.goalserve.com/getfeed/${GS_KEY}/commentaries/${m.gsLeague}.xml?json=1`,
        );
        const comData = await comRes.json();
        const tourney = comData?.commentaries?.tournament;
        for (const mm of toArr(tourney?.match)) {
          const lt = (mm?.localteam?.["@name"] ?? "").toLowerCase();
          const vt = (mm?.visitorteam?.["@name"] ?? "").toLowerCase();
          if (lt.includes(homeWord) || vt.includes(awayWord)) {
            found = mm;
            break;
          }
        }
      }
      if (found) {
        staticId = found["@static_id"] ?? found["@id"] ?? "0";
        console.log(`  Discovered static_id=${staticId}`);
        if (staticId !== "0") {
          await sbFetch(`/matches?id=eq.${matchDbId}`, {
            method: "PATCH",
            prefer: "return=minimal",
            body: JSON.stringify({ goalserve_static_id: staticId }),
          }).catch(() => {});
        }
      } else {
        console.log(`  ✗ Could not discover Goalserve static_id`);
      }
    } catch (e) {
      console.log(`  ✗ Goalserve discovery error: ${e.message}`);
    }
  }

  if (staticId && staticId !== "0") {
    console.log(
      `  Fetching Goalserve lineup (id=${staticId}, league=${m.gsLeague})…`,
    );
    try {
      const gsRes = await fetch(
        `https://www.goalserve.com/getfeed/${GS_KEY}/commentaries/match?id=${staticId}&league=${m.gsLeague}&json=1`,
      );
      const gsData = await gsRes.json();
      const raw =
        gsData?.commentaries?.tournament?.match ??
        gsData?.commentaries?.match ??
        null;
      const matchNode = Array.isArray(raw) ? raw[0] : raw;

      if (matchNode) {
        const teamsNode = matchNode.teams ?? {};
        const subsNode = matchNode.substitutes ?? {};
        const statsNode = matchNode.player_stats ?? {};

        const hasTeams =
          teamsNode.localteam?.player || teamsNode.visitorteam?.player;

        if (hasTeams) {
          squad = [
            ...parsePlayers(teamsNode.localteam).map((p) => ({
              ...p,
              team: "home",
              isStarter: true,
            })),
            ...parsePlayers(subsNode.localteam).map((p) => ({
              ...p,
              team: "home",
              isStarter: false,
            })),
            ...parsePlayers(teamsNode.visitorteam).map((p) => ({
              ...p,
              team: "away",
              isStarter: true,
            })),
            ...parsePlayers(subsNode.visitorteam).map((p) => ({
              ...p,
              team: "away",
              isStarter: false,
            })),
          ];
          console.log(`  Goalserve lineup: ${squad.length} players`);
        } else if (statsNode?.localteam?.player) {
          // Fallback: live player_stats
          const allHome = toArr(statsNode.localteam.player)
            .filter((p) => p?.["@name"])
            .map((p) => ({
              num: p["@number"] ?? "",
              name: p["@name"] ?? "",
              pos: p["@pos"] ?? "",
              isSubst: p["@isSubst"] === "True",
            }));
          const allAway = toArr(statsNode.visitorteam?.player)
            .filter((p) => p?.["@name"])
            .map((p) => ({
              num: p["@number"] ?? "",
              name: p["@name"] ?? "",
              pos: p["@pos"] ?? "",
              isSubst: p["@isSubst"] === "True",
            }));
          squad = [
            ...allHome.map((p) => ({
              ...p,
              team: "home",
              isStarter: !p.isSubst,
            })),
            ...allAway.map((p) => ({
              ...p,
              team: "away",
              isStarter: !p.isSubst,
            })),
          ];
          console.log(
            `  Goalserve live stats fallback: ${squad.length} players`,
          );
        } else {
          console.log(`  Goalserve: no lineup data in response`);
        }
      }
    } catch (e) {
      console.log(`  ✗ Goalserve lineup error: ${e.message}`);
    }
  }

  // 4. Build rows: prefer Goalserve squad, fall back to Odds API names
  let playerRows = [];

  if (squad.length > 0) {
    // Goalserve squad → match Odds API prices
    const normPriceMap = new Map();
    for (const [n, price] of priceMap) normPriceMap.set(norm(n), price);

    playerRows = squad.map(({ name, num, pos, team, isStarter }) => ({
      match_id: matchDbId,
      external_player_id: "gs_" + norm(name).replace(/[^a-z0-9]/g, "_"),
      name,
      team,
      jersey_number: num ? parseInt(num, 10) || null : null,
      position: pos || null,
      is_starter: isStarter,
      odds: oddsForPlayer(name, normPriceMap) ?? 1,
    }));

    const withOdds = playerRows.filter((r) => r.odds > 1).length;
    console.log(`  → ${playerRows.length} players, ${withOdds} with odds`);
  } else if (priceMap.size > 0) {
    // Odds API fallback: seed directly from scorer market names
    playerRows = [...priceMap.entries()].map(([playerName, price]) => ({
      match_id: matchDbId,
      external_player_id: "odds_" + norm(playerName).replace(/[^a-z0-9]/g, "_"),
      name: playerName,
      team: teamMap.get(playerName) ?? "home",
      jersey_number: null,
      position: null,
      is_starter: true,
      odds: price,
    }));
    console.log(
      `  → ${playerRows.length} players from Odds API (no Goalserve lineup)`,
    );
  } else {
    console.log(`  ✗ No data from either source — skipping upsert`);
    return;
  }

  // 5. Delete existing players and upsert fresh
  await sbFetch(`/players?match_id=eq.${matchDbId}`, {
    method: "DELETE",
    prefer: "return=minimal",
  });

  // Upsert in chunks of 50
  for (let i = 0; i < playerRows.length; i += 50) {
    const chunk = playerRows.slice(i, i + 50);
    await sbFetch(`/players`, {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(chunk),
    });
  }
  console.log(`  ✓ Upserted ${playerRows.length} players into Supabase`);

  // Print sample for verification
  const sample = playerRows.filter((r) => r.odds > 1).slice(0, 5);
  if (sample.length) {
    console.log("  Sample odds:");
    for (const r of sample)
      console.log(`    ${r.name} (${r.team}) → ${r.odds}×`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching all active matches from Supabase…");
  const matches = await fetchActiveMatches();
  if (!matches.length) {
    console.log("No active matches found.");
    return;
  }
  console.log(`Found ${matches.length} active match(es) to seed.`);
  for (const m of matches) {
    await seedMatch(m);
  }
  console.log("\n✓ Done");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
