import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@shared/lib/supabase";
import { contractService } from "../services/contractService";

// ─── Odds API helpers ─────────────────────────────────────────────────────────
const ODDS_API_KEY = "46978d34dc5ac52756dd87ffbf9844b0";

/** Goalserve league ID for each Odds API sport_key */
const SPORT_TO_GS_LEAGUE: Record<string, string> = {
  soccer_epl: "1204",
  soccer_uefa_europa_league: "1007",
  soccer_uefa_europa_conference_league: "1009",
};

const SPORT_LABELS: Record<string, string> = {
  soccer_epl: "Premier League",
  soccer_uefa_europa_league: "UEFA Europa League",
  soccer_uefa_europa_conference_league: "UEFA Europa Conference League",
};

const SPORT_COLOR: Record<string, { badge: string }> = {
  soccer_epl: {
    badge: "bg-purple-400/15 text-purple-400 border-purple-400/25",
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

function formatLocalDateTime(utcIso: string): string {
  const d = new Date(utcIso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function kickoffLabel(utcIso: string): string {
  const d = new Date(utcIso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  // CET = UTC+1 (valid for Feb/March)
  const cetH = (d.getUTCHours() + 1) % 24;
  return `${days[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)} · ${pad(cetH)}:${pad(d.getUTCMinutes())} CET`;
}

function buildViewerUrl(evt: OddsEvent): string {
  const p = new URLSearchParams({
    goalserveLeague: SPORT_TO_GS_LEAGUE[evt.sport_key] ?? "0",
    goalserveStaticId: "0",
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

const EMPTY: FormState = {
  externalMatchId: "",
  homeTeam: "",
  awayTeam: "",
  kickoffAt: "",
  isDemo: false,
  oracleAddress: "",
  poolAmountUsdc: "",
};

type Step =
  | { id: "idle" }
  | { id: "db"; label: "Saving event to database…" }
  | { id: "seed"; label: "Fetching lineup & seeding players…" }
  | { id: "deploy"; label: "Deploying pool contract… (confirm in MetaMask)" }
  | { id: "fund"; label: "Funding pool… (confirm in MetaMask)" }
  | { id: "done"; contractAddress: string; txHash: string };

export default function CreateEvent() {
  const nav = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [step, setStep] = useState<Step>({ id: "idle" });
  const [error, setError] = useState<string | null>(null);

  // ── Tonight's Europa matches ───────────────────────────────────────────────
  const [tonightEvents, setTonightEvents] = useState<OddsEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<OddsEvent | null>(null);

  useEffect(() => {
    async function fetchUpcomingGames() {
      // Return cached result if still fresh
      if (_eventsCache && Date.now() - _eventsCacheAt < EVENTS_CACHE_TTL) {
        setTonightEvents(_eventsCache);
        setEventsLoading(false);
        return;
      }
      try {
        const sports = [
          "soccer_epl",
          "soccer_uefa_europa_league",
          "soccer_uefa_europa_conference_league",
        ];
        const now = Date.now();
        // show games starting from now up to 7 days ahead
        const windowEnd = now + 7 * 24 * 60 * 60 * 1000;

        const results = await Promise.all(
          sports.map((sport) =>
            fetch(
              `/api/odds/sports/${sport}/events?apiKey=${ODDS_API_KEY}&dateFormat=iso`,
            ).then((r) => r.json()),
          ),
        );

        const all: OddsEvent[] = results
          .flat()
          .filter((e: any) => {
            if (!e?.commence_time) return false;
            const t = new Date(e.commence_time).getTime();
            // upcoming: starts from now (allow 2hr grace for live games) to +7 days
            return t >= now - 2 * 60 * 60 * 1000 && t <= windowEnd;
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
        setEventsError("Failed to fetch upcoming games: " + e.message);
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

  // ── Auto-seed players: Goalserve lineup + Odds API odds ──────────────────
  async function autoSeedPlayers(
    matchDbId: string,
    homeTeam: string,
    awayTeam: string,
    sportKey: string,
  ) {
    const gsLeague = SPORT_TO_GS_LEAGUE[sportKey] ?? "1204";

    // 1. Discover Goalserve static_id from live feed
    let staticId = "";
    try {
      const liveRes = await fetch(`/api/goalserve/soccernew/home?json=1`);
      if (liveRes.ok) {
        const liveData = await liveRes.json();
        const homeWord = homeTeam.split(" ")[0].toLowerCase();
        const awayWord = awayTeam.split(" ")[0].toLowerCase();
        const cats: any[] =
          liveData?.scores?.category ??
          (Array.isArray(liveData?.scores) ? liveData.scores : []);
        for (const cat of cats) {
          const matches: any[] = Array.isArray(cat.match)
            ? cat.match
            : cat.match
              ? [cat.match]
              : [];
          const found = matches.find((mm: any) => {
            const lt = (
              mm.localteam?.["@name"] ??
              mm["@localteam"] ??
              ""
            ).toLowerCase();
            const vt = (
              mm.visitorteam?.["@name"] ??
              mm["@visitorteam"] ??
              ""
            ).toLowerCase();
            return lt.includes(homeWord) || vt.includes(awayWord);
          });
          if (found) {
            staticId = found["@static_id"] ?? found["@id"] ?? "";
            break;
          }
        }
      }
    } catch {
      // continue — will try commentaries feed
    }

    // 2. If not found in live feed, try commentaries league feed
    if (!staticId) {
      try {
        const comRes = await fetch(
          `/api/goalserve/commentaries/${gsLeague}.xml?json=1`,
        );
        if (comRes.ok) {
          const comData = await comRes.json();
          const homeWord = homeTeam.split(" ")[0].toLowerCase();
          const awayWord = awayTeam.split(" ")[0].toLowerCase();
          const tourney = comData?.commentaries?.tournament;
          const matchList: any[] = tourney
            ? Array.isArray(tourney.match)
              ? tourney.match
              : tourney.match
                ? [tourney.match]
                : []
            : [];
          const found = matchList.find((mm: any) => {
            const lt = (
              mm.localteam?.["@name"] ??
              mm["@localteam"] ??
              ""
            ).toLowerCase();
            const vt = (
              mm.visitorteam?.["@name"] ??
              mm["@visitorteam"] ??
              ""
            ).toLowerCase();
            return lt.includes(homeWord) || vt.includes(awayWord);
          });
          if (found) {
            staticId = found["@static_id"] ?? found["@id"] ?? "";
          }
        }
      } catch {
        // ignore
      }
    }

    if (!staticId) return; // can't seed without lineup

    // 3. Fetch full lineup
    const lineupRes = await fetch(
      `/api/goalserve/commentaries/match?id=${staticId}&league=${gsLeague}&json=1`,
    );
    if (!lineupRes.ok) return;
    const lineupData = await lineupRes.json();
    const raw =
      lineupData?.commentaries?.tournament?.match ??
      lineupData?.commentaries?.match ??
      null;
    if (!raw) return;
    const matchNode = Array.isArray(raw) ? raw[0] : raw;

    const teamsNode = matchNode.teams ?? {};
    const subsNode = matchNode.substitutes ?? {};

    function normAccent(s: string): string {
      return s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    }

    function parsePlayers(
      node: any,
    ): { num: string; name: string; pos: string }[] {
      if (!node?.player) return [];
      const arr = Array.isArray(node.player) ? node.player : [node.player];
      return arr
        .filter((p: any) => p?.["@name"])
        .map((p: any) => ({
          num: p["@number"] ?? "",
          name: p["@name"] ?? "",
          pos: p["@pos"] ?? "",
        }));
    }

    type SquadEntry = {
      name: string;
      num: string;
      pos: string;
      team: "home" | "away";
      isStarter: boolean;
    };

    const squad: SquadEntry[] = [
      ...parsePlayers(teamsNode.localteam).map((p) => ({
        ...p,
        team: "home" as const,
        isStarter: true,
      })),
      ...parsePlayers(subsNode.localteam).map((p) => ({
        ...p,
        team: "home" as const,
        isStarter: false,
      })),
      ...parsePlayers(teamsNode.visitorteam).map((p) => ({
        ...p,
        team: "away" as const,
        isStarter: true,
      })),
      ...parsePlayers(subsNode.visitorteam).map((p) => ({
        ...p,
        team: "away" as const,
        isStarter: false,
      })),
    ];

    if (squad.length === 0) return;

    // 4. Fetch Odds API scorer odds
    const priceMap = new Map<string, number>();
    try {
      const oddsRes = await fetch(
        `/api/odds/sports/${sportKey}/events/${form.externalMatchId}/odds?apiKey=${ODDS_API_KEY}&markets=player_first_goal_scorer&regions=us,uk,eu&oddsFormat=decimal`,
      );
      if (oddsRes.ok) {
        const oddsData = await oddsRes.json();
        for (const bm of oddsData.bookmakers ?? []) {
          for (const mkt of bm.markets ?? []) {
            if (mkt.key !== "player_first_goal_scorer") continue;
            for (const o of mkt.outcomes ?? []) {
              const n = (o.description ?? o.name ?? "").trim();
              if (n && o.price && n.toLowerCase() !== "no scorer") {
                if (!priceMap.has(n)) priceMap.set(n, o.price);
              }
            }
          }
        }
      }
    } catch {
      // odds optional — seed without them
    }

    // Match odds to each Goalserve player by normalised name/surname
    function oddsFor(gsName: string): number {
      const n = normAccent(gsName);
      const words = n.split(/\s+/);
      const surname = words[words.length - 1];
      const firstName = words[0];
      // 1. exact normalised full name
      for (const [oddsName, price] of priceMap) {
        const on = normAccent(oddsName);
        if (on === n) return price;
      }
      // 2. surname match
      if (surname.length >= 4) {
        for (const [oddsName, price] of priceMap) {
          const on = normAccent(oddsName);
          const os = on.split(/\s+/).pop() ?? "";
          if (os === surname) return price;
          if (on.includes(surname) || n.includes(os)) return price;
        }
      }
      // 3. first-name prefix match (handles nicknames: Savinho ↔ Savio…)
      if (firstName.length >= 4) {
        for (const [oddsName, price] of priceMap) {
          const oddsFirst = normAccent(oddsName).split(/\s+/)[0];
          if (
            oddsFirst.startsWith(firstName.slice(0, 5)) ||
            firstName.startsWith(oddsFirst.slice(0, 5))
          )
            return price;
        }
      }
      return 1; // NOT NULL DEFAULT 1 sentinel
    }

    // 5. Upsert all squad players
    const rows = squad.map(({ name, num, pos, team, isStarter }) => ({
      match_id: matchDbId,
      external_player_id: "gs_" + name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
      name,
      team,
      jersey_number: num ? parseInt(num, 10) || null : null,
      position: pos || null,
      is_starter: isStarter,
      odds: oddsFor(name),
    }));

    await supabase
      .from("players")
      .upsert(rows, { onConflict: "match_id,external_player_id" });
  }

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const busy = step.id !== "idle" && step.id !== "done";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const poolAmount = parseFloat(form.poolAmountUsdc);
    if (!form.poolAmountUsdc || isNaN(poolAmount) || poolAmount <= 0) {
      setError("Enter a valid pool funding amount (USDC).");
      return;
    }

    try {
      // ── Step 1: Save event to Supabase ─────────────────────────────────────
      setStep({ id: "db", label: "Saving event to database…" });
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
        })
        .select()
        .single();

      if (dbErr) throw new Error(dbErr.message);

      // ── Step 1.5: Auto-seed players from Goalserve + Odds API ─────────────
      setStep({ id: "seed", label: "Fetching lineup & seeding players…" });
      await autoSeedPlayers(
        match.id,
        form.homeTeam,
        form.awayTeam,
        selectedEvent?.sport_key ?? "soccer_epl",
      ).catch(() => {
        /* non-fatal — proceed even if seed fails */
      });

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

      {/* ── Tonight's Europa matches picker ─────────────────────────────────── */}
      <div className="bg-gray-900 border border-white/5 rounded-2xl p-5 mb-5 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">🏆</span>
          <h2 className="text-sm font-bold text-white">Upcoming Fixtures</h2>
          <span className="ml-auto text-[10px] text-gray-500 uppercase tracking-wider font-medium">
            EPL · UEL · UECL · next 7 days
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
              return (
                <button
                  key={evt.id}
                  type="button"
                  onClick={() => pickEvent(evt)}
                  className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all duration-150 ${
                    isSelected
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
