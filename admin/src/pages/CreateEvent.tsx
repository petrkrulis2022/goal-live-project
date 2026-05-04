import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@shared/lib/supabase";
import { contractService } from "../services/contractService";

// ─── Odds API helpers ─────────────────────────────────────────────────────────
const ODDS_API_KEY = "8d90e1a5fa443922e69844377834c0ab";

const SPORT_LABELS: Record<string, string> = {
  soccer_epl: "Premier League",
  soccer_spain_la_liga: "La Liga",
  soccer_italy_serie_a: "Serie A",
  soccer_france_ligue_one: "Ligue 1",
  soccer_uefa_champs_league: "UEFA Champions League",
  soccer_uefa_europa_league: "UEFA Europa League",
  soccer_uefa_europa_conference_league: "UEFA Europa Conference League",
};

const SPORT_COLOR: Record<string, { badge: string }> = {
  soccer_epl: {
    badge: "bg-purple-400/15 text-purple-400 border-purple-400/25",
  },
  soccer_spain_la_liga: {
    badge: "bg-red-400/15 text-red-400 border-red-400/25",
  },
  soccer_italy_serie_a: {
    badge: "bg-blue-400/15 text-blue-400 border-blue-400/25",
  },
  soccer_france_ligue_one: {
    badge: "bg-sky-400/15 text-sky-400 border-sky-400/25",
  },
  soccer_uefa_champs_league: {
    badge: "bg-indigo-400/15 text-indigo-400 border-indigo-400/25",
  },
  soccer_uefa_europa_league: {
    badge: "bg-orange-400/15 text-orange-400 border-orange-400/25",
  },
  soccer_uefa_europa_conference_league: {
    badge: "bg-emerald-400/15 text-emerald-400 border-emerald-400/25",
  },
};

// Module-level cache — survives re-mounts, avoids hammering the Odds API
let _eventsCache: OddsEvent[] | null = null;
let _eventsCacheAt = 0;
const EVENTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface OddsEvent {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;
}

interface SpFixture {
  id: string;
  home: string;
  away: string;
  date: string;
  time: string;
  competition: string;
  competitionCode: string;
}

function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatLocalDateTime(utcIso: string): string {
  const d = new Date(utcIso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function kickoffLabel(utcIso: string): string {
  const d = new Date(utcIso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)} · ${pad(d.getHours())}:${pad(d.getMinutes())} local`;
}

function buildViewerUrl(evt: OddsEvent): string {
  const p = new URLSearchParams({
    oddsEventId: evt.id,
    sport: evt.sport_key,
    home: evt.home_team,
    away: evt.away_team,
    competition: SPORT_LABELS[evt.sport_key] ?? evt.sport_key,
    kickoff: kickoffLabel(evt.commence_time),
  });
  return `http://localhost:5177/?${p.toString()}`;
}

interface FormState {
  externalMatchId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  isDemo: boolean;
  oracleAddress: string;
  poolAmountUsdc: string;
}

// Platform wallet = oracle (signs settleMatch on-chain via ORACLE_PRIVATE_KEY in edge fn)
const PLATFORM_ORACLE = "0xcb443c2db4025128964397CCb5BC4F4E8ab6A665";

const EMPTY: FormState = {
  externalMatchId: "",
  homeTeam: "",
  awayTeam: "",
  kickoffAt: "",
  isDemo: false,
  oracleAddress: PLATFORM_ORACLE,
  poolAmountUsdc: "",
};

type Step =
  | { id: "idle" }
  | { id: "db"; label: "Saving event to database…" }
  | { id: "seed"; label: "Seeding players from Odds API…" }
  | { id: "deploy"; label: "Deploying pool contract… (confirm in MetaMask)" }
  | { id: "fund"; label: "Funding pool… (confirm in MetaMask)" }
  | { id: "done"; contractAddress: string; txHash: string };

export default function CreateEvent() {
  const nav = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [step, setStep] = useState<Step>({ id: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [seedWarning, setSeedWarning] = useState<string | null>(null);

  // ── Premier League fixtures picker ────────────────────────────────────────
  const [tonightEvents, setTonightEvents] = useState<OddsEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<OddsEvent | null>(null);
  // IDs of fixtures already in the DB — shown as disabled in the picker
  const [existingMatchIds, setExistingMatchIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    supabase
      .from("matches")
      .select("external_match_id")
      .then(({ data }) => {
        if (data) {
          setExistingMatchIds(
            new Set(
              data.map(
                (r: { external_match_id: string }) => r.external_match_id,
              ),
            ),
          );
        }
      });
  }, []);

  useEffect(() => {
    async function fetchUpcomingGames() {
      // Return cached result if still fresh
      if (_eventsCache && Date.now() - _eventsCacheAt < EVENTS_CACHE_TTL) {
        setTonightEvents(_eventsCache);
        setEventsLoading(false);
        return;
      }
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const res = await fetch(`${supabaseUrl}/functions/v1/sp-fixtures`, {
          headers: { Authorization: `Bearer ${anonKey}` },
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) {
          throw new Error(`sp-fixtures failed (${res.status})`);
        }

        const fixtures: SpFixture[] = await res.json();
        if (!Array.isArray(fixtures)) {
          throw new Error("sp-fixtures returned non-array response");
        }

        const now = Date.now();
        // show games starting from now up to 7 days ahead
        const windowEnd = now + 7 * 24 * 60 * 60 * 1000;

        const all: OddsEvent[] = fixtures
          .map((f) => ({
            id: f.id,
            sport_key: "soccer_epl",
            home_team: f.home,
            away_team: f.away,
            commence_time: `${f.date}T${f.time}`,
          }))
          .filter((e) => {
            const t = new Date(e.commence_time).getTime();
            // upcoming: starts from now (allow 2hr grace for live games) to +7 days
            return (
              Number.isFinite(t) &&
              t >= now - 2 * 60 * 60 * 1000 &&
              t <= windowEnd
            );
          })
          .sort(
            (a: OddsEvent, b: OddsEvent) =>
              new Date(a.commence_time).getTime() -
              new Date(b.commence_time).getTime(),
          );

        _eventsCache = all;
        _eventsCacheAt = Date.now();
        setTonightEvents(all);
      } catch (e: any) {
        setEventsError("Failed to fetch Premier League fixtures: " + e.message);
      } finally {
        setEventsLoading(false);
      }
    }
    fetchUpcomingGames();
  }, []);

  function pickEvent(evt: OddsEvent) {
    setSelectedEvent(evt);
    setForm((f) => ({
      ...f,
      homeTeam: evt.home_team,
      awayTeam: evt.away_team,
      kickoffAt: formatLocalDateTime(evt.commence_time),
      externalMatchId: evt.id,
    }));
  }

  // ── Resolve The Odds API event id for this fixture (team + kickoff match) ─
  async function lookupOddsEventId(
    sportKey: string,
    homeTeam: string,
    awayTeam: string,
    kickoffIso: string,
  ): Promise<string | null> {
    try {
      const res = await fetch(
        `/api/odds/sports/${sportKey}/events?apiKey=${ODDS_API_KEY}&dateFormat=iso`,
      );
      if (!res.ok) return null;
      const events: OddsEvent[] = await res.json();
      if (!Array.isArray(events)) return null;

      const targetHome = normName(homeTeam);
      const targetAway = normName(awayTeam);
      const kickoffTs = new Date(kickoffIso).getTime();

      // Prefer same teams + kickoff within 12h window.
      const candidates = events.filter((e) => {
        const homeOk = normName(e.home_team) === targetHome;
        const awayOk = normName(e.away_team) === targetAway;
        if (!homeOk || !awayOk) return false;
        const t = new Date(e.commence_time).getTime();
        return (
          Number.isFinite(t) && Math.abs(t - kickoffTs) <= 12 * 60 * 60 * 1000
        );
      });

      if (candidates.length > 0) {
        candidates.sort(
          (a, b) =>
            Math.abs(new Date(a.commence_time).getTime() - kickoffTs) -
            Math.abs(new Date(b.commence_time).getTime() - kickoffTs),
        );
        return candidates[0].id;
      }

      // Final fallback: exact team names regardless of kickoff.
      const byTeams = events.find(
        (e) =>
          normName(e.home_team) === targetHome &&
          normName(e.away_team) === targetAway,
      );
      return byTeams?.id ?? null;
    } catch {
      return null;
    }
  }

  async function seedMatchWinnerOdds(
    matchDbId: string,
    sportKey: string,
    oddsEventId: string | null,
  ): Promise<boolean> {
    if (!oddsEventId) return false;

    try {
      const res = await fetch(
        `/api/odds/sports/${sportKey}/events/${oddsEventId}/odds?apiKey=${ODDS_API_KEY}&markets=h2h&bookmakers=betfair_ex_eu&oddsFormat=decimal`,
      );
      if (!res.ok) return false;

      const data = await res.json();
      if (data?.message) return false;

      const bm = data?.bookmakers?.[0];
      const market = (bm?.markets ?? []).find(
        (m: { key: string }) => m.key === "h2h",
      );
      if (!market) return false;

      const home =
        market.outcomes?.find(
          (o: { name: string; price: number }) => o.name === data.home_team,
        )?.price ?? null;
      const draw =
        market.outcomes?.find(
          (o: { name: string; price: number }) => o.name === "Draw",
        )?.price ?? null;
      const away =
        market.outcomes?.find(
          (o: { name: string; price: number }) => o.name === data.away_team,
        )?.price ?? null;

      const { data: existing } = await supabase
        .from("matches")
        .select("odds_api_config")
        .eq("id", matchDbId)
        .single();

      const cfg =
        (existing?.odds_api_config as Record<string, unknown> | null) ?? {};
      const mergedCfg = {
        ...cfg,
        sport: sportKey,
        event_id: oddsEventId,
        match_winner_odds: {
          home: home ?? 0,
          draw: draw ?? 0,
          away: away ?? 0,
        },
      };

      await supabase
        .from("matches")
        .update({
          odds_api_config: mergedCfg,
          odds_home: home,
          odds_draw: draw,
          odds_away: away,
        })
        .eq("id", matchDbId);

      return true;
    } catch {
      return false;
    }
  }

  async function seedPlayersFromSpLineup(
    matchDbId: string,
    spMatchId: string,
  ): Promise<number> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/sp-lineup?matchId=${encodeURIComponent(spMatchId)}`,
        {
          headers: { Authorization: `Bearer ${anonKey}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) return 0;

      const lineup: Array<{
        id: string;
        name: string;
        team: "home" | "away";
        jersey: number | null;
        position: string | null;
        isStarter: boolean;
      }> = await res.json();

      if (!Array.isArray(lineup) || lineup.length === 0) return 0;

      const rows = lineup
        .filter((p) => p.id && p.name)
        .map((p) => ({
          match_id: matchDbId,
          external_player_id: `sp_${p.id}`,
          name: p.name,
          team: p.team,
          jersey_number: p.jersey,
          position: p.position,
          is_starter: !!p.isStarter,
          // Placeholder until scorer market opens; sync-odds/re-seed will overwrite.
          // Position-based placeholder odds (used when Odds API scorer market unavailable)
          odds: (() => {
            const pos = (p.position ?? "").toLowerCase();
            if (pos.includes("goalkeeper")) return 1;
            if (pos.includes("striker") || pos === "forward") return 5;
            if (pos.includes("attacking")) return 8;
            if (pos.includes("midfielder")) return 13;
            if (pos.includes("defender")) return 18;
            if (pos.includes("substitute")) return 12;
            return p.isStarter ? 6.5 : 12;
          })(),
        }));

      if (rows.length === 0) return 0;

      const { error } = await supabase
        .from("players")
        .upsert(rows, { onConflict: "match_id,external_player_id" });
      if (error) return 0;

      return rows.length;
    } catch {
      return 0;
    }
  }

  // ── Seed players from Odds API scorer market (primary path) ──────────────
  async function seedPlayersFromOddsApi(
    matchDbId: string,
    homeTeam: string,
    awayTeam: string,
    sportKey: string,
    oddsEventId: string | null,
    spMatchId?: string | null,
  ): Promise<number> {
    try {
      if (!oddsEventId) return 0;

      const res = await fetch(
        `/api/odds/sports/${sportKey}/events/${oddsEventId}/odds?apiKey=${ODDS_API_KEY}&markets=player_first_goal_scorer&regions=us,uk,eu&oddsFormat=decimal`,
      );
      if (!res.ok) return 0;
      const data = await res.json();
      if (data.message) return 0; // quota / API error

      const homeWord = normName(homeTeam).split(" ")[0] ?? "";
      const awayWord = normName(awayTeam).split(" ")[0] ?? "";
      const priceMap = new Map<
        string,
        { price: number; teamHint: "home" | "away" | null }
      >();

      for (const bm of data.bookmakers ?? []) {
        for (const mkt of bm.markets ?? []) {
          if (mkt.key !== "player_first_goal_scorer") continue;
          for (const o of mkt.outcomes ?? []) {
            const pName: string = (o.description ?? o.name ?? "").trim();
            if (!pName || pName.toLowerCase() === "no scorer") continue;
            let teamHint: "home" | "away" | null = null;
            const outName = normName(String(o.name ?? ""));
            if (homeWord && outName.includes(homeWord)) teamHint = "home";
            else if (awayWord && outName.includes(awayWord)) teamHint = "away";

            if (!priceMap.has(pName)) {
              priceMap.set(pName, { price: o.price, teamHint });
            }
          }
        }
      }

      if (priceMap.size === 0) return 0;

      // ── Team assignment: fetch SP lineup and only keep resolved players ─
      const teamMap = new Map<string, "home" | "away">();
      const spId = spMatchId ?? null;
      if (spId) {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
          const luRes = await fetch(
            `${supabaseUrl}/functions/v1/sp-lineup?matchId=${encodeURIComponent(spId)}`,
            {
              headers: { Authorization: `Bearer ${anonKey}` },
              signal: AbortSignal.timeout(8_000),
            },
          );
          if (luRes.ok) {
            const lineup: Array<{ name: string; team: "home" | "away" }> =
              await luRes.json();
            for (const pl of lineup) {
              const n = normName(pl.name);
              // map by normalised name and also by surname for fuzzy matching
              teamMap.set(n, pl.team);
              const surname = n.split(" ").pop() ?? "";
              if (surname.length >= 4 && !teamMap.has(surname))
                teamMap.set(surname, pl.team);
            }
          }
        } catch {
          /* SP lineup unavailable — fall through */
        }
      }

      function resolveTeam(playerName: string): "home" | "away" | null {
        const n = normName(playerName);
        if (teamMap.has(n)) return teamMap.get(n)!;
        // surname fallback
        const surname = n.split(" ").pop() ?? "";
        if (surname.length >= 4 && teamMap.has(surname))
          return teamMap.get(surname)!;
        return null;
      }

      const rows = [...priceMap.entries()]
        .map(([playerName, oddsInfo]) => {
          // Prefer SP lineup mapping; otherwise use odds feed hint; final fallback home.
          const team =
            resolveTeam(playerName) ??
            oddsInfo.teamHint ??
            (homeWord ? "home" : "away");

          return {
            match_id: matchDbId,
            external_player_id:
              "odds_" + normName(playerName).replace(/[^a-z0-9]/g, "_"),
            name: playerName,
            team,
            jersey_number: null,
            position: null,
            is_starter: true,
            odds: oddsInfo.price,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (rows.length === 0) return 0;

      await supabase
        .from("players")
        .upsert(rows, { onConflict: "match_id,external_player_id" });
      return rows.length;
    } catch {
      return 0;
    }
  }

  // ── Look up StatsPerform match ID by fuzzy team-name matching ─────────────
  async function lookupSpMatchId(
    homeTeam: string,
    awayTeam: string,
  ): Promise<string | null> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/sp-fixtures`, {
        headers: { Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      const fixtures: Array<{ id: string; home: string; away: string }> =
        await res.json();
      if (!Array.isArray(fixtures)) return null;

      function normName(s: string): string {
        return s
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();
      }

      const normHome = normName(homeTeam);
      const normAway = normName(awayTeam);

      const match = fixtures.find((f) => {
        const fHome = normName(f.home);
        const fAway = normName(f.away);
        if (fHome === normHome && fAway === normAway) return true;
        // first-word match handles "Manchester City" ↔ "Man City" partially
        const homeWord = normHome.split(" ")[0];
        const awayWord = normAway.split(" ")[0];
        return fHome.startsWith(homeWord) && fAway.startsWith(awayWord);
      });

      return match?.id ?? null;
    } catch {
      return null;
    }
  }

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const busy = step.id !== "idle" && step.id !== "done";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSeedWarning(null);

    const poolAmount = parseFloat(form.poolAmountUsdc);
    if (!form.poolAmountUsdc || isNaN(poolAmount) || poolAmount <= 0) {
      setError("Enter a valid pool funding amount (USDC).");
      return;
    }

    try {
      // ── Step 1: Save event to Supabase ─────────────────────────────────────
      setStep({ id: "db", label: "Saving event to database…" });
      const sportKey = selectedEvent?.sport_key ?? "soccer_epl";
      const { error: dbErr, data: match } = await supabase
        .from("matches")
        .insert({
          external_match_id: form.externalMatchId,
          home_team: form.homeTeam,
          away_team: form.awayTeam,
          kickoff_at: new Date(form.kickoffAt).toISOString(),
          status: "pre-match",
          is_demo: form.isDemo,
          oracle_address: form.oracleAddress || null,
          contract_address: null,
          current_minute: 0,
          score_home: 0,
          score_away: 0,
          half: 1,
          odds_api_config: { sport: sportKey },
        })
        .select()
        .single();

      if (dbErr) throw new Error(dbErr.message);

      // ── Step 1.5: Use selected SP match ID (fallback to fuzzy lookup) ─
      const spMatchId =
        selectedEvent?.sport_key === "soccer_epl"
          ? selectedEvent.id
          : await lookupSpMatchId(form.homeTeam, form.awayTeam).catch(
              () => null,
            );
      if (spMatchId) {
        await supabase
          .from("matches")
          .update({ statsperform_match_id: spMatchId })
          .eq("id", match.id);
      }

      // ── Step 1.6: Seed players from Odds API scorer market ─────────────────
      setStep({ id: "seed", label: "Seeding players from Odds API…" });
      const oddsEventId = await lookupOddsEventId(
        sportKey,
        form.homeTeam,
        form.awayTeam,
        new Date(form.kickoffAt).toISOString(),
      );

      if (!oddsEventId) {
        setSeedWarning(
          "Could not resolve Odds API event id for this fixture yet. Match odds/scorer odds may be unavailable until Odds API lists this event.",
        );
      }

      if (oddsEventId) {
        const { data: existing } = await supabase
          .from("matches")
          .select("odds_api_config")
          .eq("id", match.id)
          .single();
        const cfg =
          (existing?.odds_api_config as Record<string, unknown> | null) ?? {};
        await supabase
          .from("matches")
          .update({
            odds_api_config: { ...cfg, sport: sportKey, event_id: oddsEventId },
          })
          .eq("id", match.id);
      }

      await seedMatchWinnerOdds(match.id, sportKey, oddsEventId).catch(
        () => false,
      );

      const seededCount = await seedPlayersFromOddsApi(
        match.id,
        form.homeTeam,
        form.awayTeam,
        sportKey,
        oddsEventId,
        spMatchId,
      ).catch(() => 0);

      const fallbackSeededCount =
        seededCount === 0 && spMatchId
          ? await seedPlayersFromSpLineup(match.id, spMatchId).catch(() => 0)
          : 0;

      if (seededCount === 0 && fallbackSeededCount === 0) {
        setSeedWarning(
          'No scorer market available yet. Lineups/odds were not seeded. Use "Re-seed Players" later when the market opens.',
        );
      } else if (seededCount === 0 && fallbackSeededCount > 0) {
        setSeedWarning(
          `Scorer market is not open yet. Seeded ${fallbackSeededCount} players from StatsPerform lineup with placeholder odds; re-seed later for live scorer odds.`,
        );
      }

      // ── Step 2: Deploy escrow contract (MetaMask) ──────────────────────────
      setStep({
        id: "deploy",
        label: "Deploying pool contract… (confirm in MetaMask)",
      });
      const contractAddress = await contractService.deployContract(
        form.externalMatchId,
      );

      // Save contract address back
      await supabase
        .from("matches")
        .update({ contract_address: contractAddress })
        .eq("id", match.id);

      // ── Step 3: Fund the pool (MetaMask) ───────────────────────────────────
      setStep({ id: "fund", label: "Funding pool… (confirm in MetaMask)" });
      const txHash = await contractService.fundPool(
        form.externalMatchId,
        poolAmount,
      );

      // ── Done ───────────────────────────────────────────────────────────────
      setStep({ id: "done", contractAddress, txHash });

      // Navigate after a short pause so the user can see the success state
      setTimeout(() => nav(`/events/${match.external_match_id}`), 2000);
    } catch (e: unknown) {
      setStep({ id: "idle" });
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Create Event</h1>
        <p className="text-gray-500 text-sm mt-1">
          Creates the match, deploys the pool contract and funds it — all in one
          flow.
        </p>
      </div>

      {/* ── Premier League fixtures picker ─────────────────────────────────── */}
      <div className="bg-gray-900 border border-white/5 rounded-2xl p-5 mb-5 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">🏆</span>
          <h2 className="text-sm font-bold text-white">
            Premier League Fixtures
          </h2>
          <span className="ml-auto text-[10px] text-gray-500 uppercase tracking-wider font-medium">
            EPL · next 7 days
          </span>
        </div>

        {eventsLoading && (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-4 justify-center">
            <span className="w-3.5 h-3.5 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
            Loading upcoming fixtures…
          </div>
        )}

        {eventsError && (
          <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {eventsError}
          </div>
        )}

        {!eventsLoading && !eventsError && tonightEvents.length === 0 && (
          <div className="text-gray-600 text-sm text-center py-4">
            No upcoming fixtures found in the next 7 days.
          </div>
        )}

        {tonightEvents.length > 0 && (
          <div className="space-y-2">
            {tonightEvents.map((evt) => {
              const colors = SPORT_COLOR[evt.sport_key] ?? {
                badge: "bg-gray-700/50 text-gray-400 border-gray-600/30",
              };
              const isSelected = selectedEvent?.id === evt.id;
              const alreadyCreated = existingMatchIds.has(evt.id);
              return (
                <button
                  key={evt.id}
                  type="button"
                  onClick={() => !alreadyCreated && pickEvent(evt)}
                  disabled={alreadyCreated}
                  className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all duration-150 ${
                    alreadyCreated
                      ? "border-white/3 bg-gray-950/40 opacity-45 cursor-not-allowed"
                      : isSelected
                        ? "border-green-500/50 bg-green-500/8"
                        : "border-white/5 bg-gray-950 hover:border-white/10 hover:bg-gray-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${colors.badge}`}
                    >
                      {SPORT_LABELS[evt.sport_key] ?? evt.sport_key}
                    </span>
                    {alreadyCreated && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-gray-700/40 text-gray-500 border-gray-600/20">
                        Already created
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-gray-500 font-mono">
                      {kickoffLabel(evt.commence_time)}
                    </span>
                    {isSelected && (
                      <span className="text-green-400 text-xs font-bold">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">
                      {evt.home_team}
                    </span>
                    <span className="text-xs text-gray-600 font-medium">
                      vs
                    </span>
                    <span className="text-sm font-semibold text-white text-right">
                      {evt.away_team}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedEvent && (
          <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-3">
            <div className="text-xs text-gray-500 flex-1">
              <span className="text-green-400 font-semibold">✓ Selected</span> —
              form auto-filled below
            </div>
            <a
              href={buildViewerUrl(selectedEvent)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-semibold rounded-lg hover:bg-blue-500/25 transition-colors"
            >
              ▶ Open Live Viewer
            </a>
          </div>
        )}
      </div>

      {/* Progress indicator (shown while processing) */}
      {busy && (
        <StepProgress
          step={step as Exclude<Step, { id: "idle" } | { id: "done" }>}
        />
      )}
      {step.id === "done" && (
        <SuccessBanner
          contractAddress={step.contractAddress}
          txHash={step.txHash}
        />
      )}

      <div className="bg-gray-900 border border-white/5 rounded-2xl p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Match details ─────────────────────────────────────────────── */}
          <Field label="External Match ID" required>
            <input
              className={INPUT}
              placeholder="match_city_newcastle_20260221"
              value={form.externalMatchId}
              onChange={(e) => set("externalMatchId", e.target.value)}
              disabled={busy}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Home Team" required>
              <input
                className={INPUT}
                placeholder="Man City"
                value={form.homeTeam}
                onChange={(e) => set("homeTeam", e.target.value)}
                disabled={busy}
                required
              />
            </Field>
            <Field label="Away Team" required>
              <input
                className={INPUT}
                placeholder="Newcastle"
                value={form.awayTeam}
                onChange={(e) => set("awayTeam", e.target.value)}
                disabled={busy}
                required
              />
            </Field>
          </div>

          <Field label="Kickoff (local time)" required>
            <input
              className={INPUT}
              type="datetime-local"
              value={form.kickoffAt}
              onChange={(e) => set("kickoffAt", e.target.value)}
              disabled={busy}
              required
            />
          </Field>

          {/* ── Pool funding ──────────────────────────────────────────────── */}
          <div className="border-t border-white/5 pt-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center text-xs text-green-400 font-bold">
                $
              </div>
              <p className="text-sm font-semibold text-white">Pool Funding</p>
              <span className="ml-auto text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full font-medium uppercase tracking-wide">
                MetaMask
              </span>
            </div>

            <Field label="Initial Pool Amount (USDC)" required>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                  $
                </span>
                <input
                  className={INPUT + " pl-7"}
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="5000.00"
                  value={form.poolAmountUsdc}
                  onChange={(e) => set("poolAmountUsdc", e.target.value)}
                  disabled={busy}
                  required
                />
              </div>
            </Field>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              This amount is deducted from the goal.live admin wallet and
              transferred into the deployed escrow contract. MetaMask will open{" "}
              <strong className="text-gray-500">twice</strong> — once to deploy
              the contract, once to fund it.
            </p>
          </div>

          {/* ── Optional ─────────────────────────────────────────────────── */}
          <div className="border-t border-white/5 pt-5 space-y-4">
            <p className="text-xs text-gray-600 uppercase tracking-wider font-medium">
              Optional
            </p>
            <Field label="Oracle Address" hint="Leave blank to assign later">
              <input
                className={INPUT}
                placeholder="0x…"
                value={form.oracleAddress}
                onChange={(e) => set("oracleAddress", e.target.value)}
                disabled={busy}
              />
            </Field>

            <label className="flex items-center gap-3 text-sm text-gray-400 cursor-pointer select-none">
              <div
                className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${form.isDemo ? "bg-green-500" : "bg-gray-700"}`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${form.isDemo ? "left-4" : "left-0.5"}`}
                />
              </div>
              <input
                type="checkbox"
                checked={form.isDemo}
                onChange={(e) => set("isDemo", e.target.checked)}
                disabled={busy}
                className="sr-only"
              />
              <span>
                Demo event{" "}
                <span className="text-gray-600">(uses local replay data)</span>
              </span>
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-lg">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {seedWarning && !error && (
            <div className="flex items-start gap-2 text-yellow-300 text-sm bg-yellow-500/10 border border-yellow-500/20 px-3 py-2.5 rounded-lg">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{seedWarning}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={busy || step.id === "done"}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm shadow-lg shadow-green-500/20"
            >
              {busy ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Processing…
                </>
              ) : (
                "Create Event + Deploy Pool"
              )}
            </button>
            <button
              type="button"
              onClick={() => nav("/dashboard")}
              disabled={busy}
              className="px-5 py-3 bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700 disabled:opacity-40 transition-colors text-sm border border-white/5"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Step progress banner ────────────────────────────────────────────────────

const STEP_ORDER = ["db", "seed", "deploy", "fund"] as const;
type ActiveStep = (typeof STEP_ORDER)[number];

const STEP_LABELS: Record<ActiveStep, string> = {
  db: "Save to database",
  seed: "Seed players",
  deploy: "Deploy contract",
  fund: "Fund pool",
};

function StepProgress({ step }: { step: { id: ActiveStep; label: string } }) {
  const current = STEP_ORDER.indexOf(step.id);
  return (
    <div className="bg-gray-900 border border-white/5 rounded-2xl p-4 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-4 h-4 border-2 border-green-400/40 border-t-green-400 rounded-full animate-spin shrink-0" />
        <span className="text-sm text-white font-medium">{step.label}</span>
      </div>
      <div className="flex items-center gap-1">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                i < current
                  ? "text-green-400"
                  : i === current
                    ? "text-white"
                    : "text-gray-600"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                  i < current
                    ? "bg-green-500 border-green-500 text-black"
                    : i === current
                      ? "border-green-400 text-green-400"
                      : "border-gray-700 text-gray-600"
                }`}
              >
                {i < current ? "✓" : i + 1}
              </div>
              {STEP_LABELS[s]}
            </div>
            {i < STEP_ORDER.length - 1 && (
              <div
                className={`flex-1 h-px mx-2 ${i < current ? "bg-green-500/40" : "bg-gray-800"}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Success banner ──────────────────────────────────────────────────────────

function SuccessBanner({
  contractAddress,
  txHash,
}: {
  contractAddress: string;
  txHash: string;
}) {
  return (
    <div className="bg-green-500/8 border border-green-500/20 rounded-2xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-green-400 text-lg">✓</span>
        <span className="text-green-400 font-semibold text-sm">
          Event created and pool funded!
        </span>
        <span className="ml-auto text-xs text-gray-500 animate-pulse">
          redirecting…
        </span>
      </div>
      <div className="space-y-1.5 text-xs font-mono">
        <div>
          <span className="text-gray-600">Contract </span>
          <span className="text-green-400">{contractAddress}</span>
        </div>
        <div>
          <span className="text-gray-600">Fund tx </span>
          <span className="text-gray-400">
            {txHash.slice(0, 18)}…{txHash.slice(-6)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
        {label}
        {required && (
          <span className="text-green-400 text-sm leading-none">*</span>
        )}
        {hint && (
          <span className="ml-1 text-gray-600 normal-case font-normal tracking-normal">
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

const INPUT =
  "w-full bg-gray-950 border border-white/8 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/30 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
