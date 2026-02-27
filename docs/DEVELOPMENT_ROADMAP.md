# goal.live — Master Development Plan

**Last Updated:** February 27, 2026
**Status:** Phase 1 ✅ · Phase 2 ✅ · Phase 2.5 ✅ Live session infra · **Phase 3 smart contracts in progress**
**Repo:** `petrkrulis2022/goal-live-project` · branch `main` · last commit `1407f01`
**Uncommitted local:** none — all pushed

---

> ## ▶ RESUME HERE — Sepolia Deploy Test (Wolves vs Aston Villa)
>
> **Last completed:** Track E ✅ (`f3edab2`) · EPL + CreateEvent ✅ (`0fda507`) · emergencyWithdrawPool ✅ (`1407f01`)
>
> **Commits:** `78aaee2` (Track 0) → `d45c919` (Track A) → `c0ec412` (Track B+C) → `14bb97b` (Track D) → `f3edab2` (Track E) → `0fda507` (EPL) → `1407f01` (emergency withdraw)
>
> **Immediate next tasks (in order):**
>
> 1. **Start admin** — `npm run dev:admin` (port 5174), MetaMask on Sepolia (chainId 11155111)
> 2. **Create Event** — click "Wolverhampton vs Aston Villa" → enter pool amount → Create Event
> 3. **MetaMask** — confirm deploy tx → confirm USDC approve → confirm fundPool tx
> 4. **Save address** — copy deployed contract address → `VITE_CONTRACT_ADDRESS=<addr>` in `.env.local`
> 5. **Test recovery** — FundPool page Danger Zone → Withdraw Pool → confirm → verify USDC returned
> 6. **After FT** — EventDetail → Oracle tab → Settle Match (enter scorers + final score)

---

## Supporting Docs

| File                                    | Purpose                                                      |
| --------------------------------------- | ------------------------------------------------------------ |
| **This file**                           | The only plan file to follow                                 |
| `MVP_FINAL_SPEC.md`                     | All design decisions (penalty formula, bet types, UI layout) |
| `ARCHITECTURE.md`                       | Technical deep-dive (system diagram, data flow)              |
| `CONTRACTS_BUILD_PROMPT.md`             | Smart contract spec for Phase 3                              |
| `CRE_CHAINLINK_INTEGRATION_GUIDE.md`    | CRE oracle technical reference (Phase 4)                     |
| `LIVE_ODDS_CAPTURE_AND_MOCK_CRE_API.md` | Live odds capture pipeline + mock CRE API strategy           |
| `CRE_INTEGRATION_FOR_MVP_PROMPTS.md`    | OddsAPI capture service code + Google Sheets pipeline        |
| `CRE_API_ARCHITECTURE.md` (root)        | ML model architecture for in-play odds prediction            |

---

## Product in One Paragraph

**goal.live** is a Chrome extension that overlays interactive player buttons on YouTube/Twitch football streams. Users connect a MetaMask wallet, pick a player to score the next goal, and lock in a USDC bet on Ethereum Sepolia. Bets can be changed unlimited times during the match (each change incurs a hybrid penalty: `base[n] × (1 − minute/90)`). Provisional credits are shown instantly when goals occur; final USDC payouts are settled post-match via Chainlink CRE oracle data. An Admin web app lets the platform operator create events, manage the USDC pool, and trigger settlement.

---

## What Is Built (Feb 25, 2026)

### ~~Phase 1 — Chrome Extension~~ ✅ DONE

| Component                                                                                | Status |
| ---------------------------------------------------------------------------------------- | ------ |
| ~~Chrome MV3 extension (Vite + React 18 + TS + Tailwind)~~                               | ✅     |
| ~~BettingOverlay, PlayerButton, BetModal, BetChangeModal~~                               | ✅     |
| ~~BalanceDisplay, MyBets, SettlementDisplay, TopUpModal, WithdrawModal~~                 | ✅     |
| ~~Mock / Real service switcher (`VITE_USE_MOCK`) in `src/services/index.ts`~~            | ✅     |
| ~~`src/data/pre_match_odds.json` — all 22 real Feb 21 players, full markets~~            | ✅     |
| ~~`src/data/live_snapshots.json` — 11 snapshots min 0–90, live odds drift, goal events~~ | ✅     |
| ~~Supabase SQL schema written (4 migration files in `supabase/migrations/`)~~            | ✅     |

### ~~Phase 2 — Admin Web App + Supabase~~ ✅ COMPLETE

| Component                                                                                        | Status                                                    |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| ~~`vite.admin.config.ts` — root `admin/`, port 5174, dist `dist-admin/`~~                        | ✅ done                                                   |
| ~~`admin/src/App.tsx` + react-router-dom v7 routing~~                                            | ✅ done                                                   |
| ~~`admin/src/components/Layout.tsx` — dark sidebar, wallet chip, animated ping~~                 | ✅ done (restyled)                                        |
| ~~`admin/src/pages/Dashboard.tsx` — all matches from Supabase, skeleton loading~~                | ✅ done (restyled)                                        |
| ~~`admin/src/pages/CreateEvent.tsx` — 3-step: DB insert → deploy contract → fund pool~~          | ✅ done (3-step flow)                                     |
| ~~`admin/src/pages/EventDetail.tsx` — 4-tab view: overview / players / bets / goals~~            | ✅ done (restyled)                                        |
| ~~`admin/src/pages/FundPool.tsx` — contract deploy stub + USDC fund input~~                      | ✅ done (restyled)                                        |
| ~~`admin/src/services/contractService.ts` — `SIMULATION_MODE=true`, MetaMask opens for auth~~    | ✅ done (real ethers.js commented in for Phase 3 drop-in) |
| ~~`admin/src/hooks/useAdminWallet.ts` — MetaMask connect, admin address guard~~                  | ✅ done                                                   |
| ~~`admin/tsconfig.json` — vite/client types + `@`/`@shared` aliases~~                            | ✅ committed `3826c83`                                    |
| ~~`admin/styles/admin.css` — body reset, Inter font, scrollbar, focus rings~~                    | ✅ done (local, not pushed)                               |
| ~~`tailwind.config.js` — `admin/**` added to content (was missing → no Tailwind classes gen'd)~~ | ✅ done (local)                                           |
| ~~`admin/index.html` — Google Fonts: Inter 400–800 + JetBrains Mono~~                            | ✅ done (local)                                           |
| ~~`package.json` scripts: `dev:admin`, `build:admin`~~                                           | ✅ done                                                   |
| ~~Supabase migrations applied to live DB~~                                                       | ✅ All 4 migrations run, project active                   |
| ~~Supabase Edge Functions: `lock-bet`, `settle-match`, `sync-odds`~~                             | ✅ deployed to `weryswulejhjkrmervnf`                     |
| Deploy admin to Netlify / Vercel (admin.goal.live)                                               | ⏸ deferred (admin still evolving)                         |

---

## Phase 2 Remaining

> Supabase is live ✅ — all 4 migrations applied. Admin UI fully working locally.

~~1. Set `.env` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`~~ ✅
~~2. Run `npm run dev:admin` → verified, Dashboard loads~~ ✅
~~3. Build `useAdminWallet.ts` — MetaMask connect + admin guard~~ ✅
~~4. Push local uncommitted changes~~ ✅ (`b5de08f`)
~~5. Build Supabase Edge Functions: `lock-bet`, `settle-match`, `sync-odds`~~ ✅
~~6. Deploy Edge Functions~~ ✅ live on `weryswulejhjkrmervnf` · `ODDS_API_KEY` secret set

**Phase 2 complete. Deploy admin to Netlify/Vercel deferred until Phase 3 is wired.**

---

## Phase 2.5 — Live Match Session (Feb 26, 2026) ✅ COMPLETE

Work done during the Plzeň vs Panathinaikos UECL live session (match ended 2–1).

| Component                                                                          | Status | Commit    |
| ---------------------------------------------------------------------------------- | ------ | --------- |
| Odds API: switch to `bookmakers=betfair_ex_eu` only (1 credit/call)                | ✅     | `2108d60` |
| Fallback odds: home 3.00 / draw 2.02 / away 5.30 (Betfair at 1–1)                  | ✅     | `2108d60` |
| 3rd Scorer tab rename (score reached 1–1 mid-session)                              | ✅     | `20265cd` |
| Czech bookie goalscorer odds updated to live snapshot                              | ✅     | `cbaaeb4` |
| `src/data/matchData.ts` — renamed from `mockMatchData.ts`, MOCK\_ prefixes removed | ✅     | `f7e8053` |
| `src/data/matchRegistry.ts` — typed multi-match config registry                    | ✅     | `2bfd99b` |
| `MockDataService` — constructor accepts `MatchConfig`, instance-based              | ✅     | `2bfd99b` |
| `createDataService(config)` factory export                                         | ✅     | `2bfd99b` |
| `useMatchData(matchKey?)` — creates per-match service from registry                | ✅     | `2bfd99b` |
| `BettingOverlay` — accepts `matchKey?: string` prop                                | ✅     | `2bfd99b` |
| `extension/content-script.tsx` — reads `chrome.storage.local` for matchKey         | ✅     | `2bfd99b` |
| `extension/popup.html` — dark-theme match picker, LIVE badge, Select/Clear         | ✅     | `2bfd99b` |
| MV3 inline script fix — moved popup logic to external `popup.js`                   | ✅     | `82b6a10` |
| `chrome.runtime.onMessage` listener — popup triggers re-injection on click         | ✅     | `24ecb77` |
| React `ErrorBoundary` in content-script — crashes surface as red banner            | ✅     | `24ecb77` |
| `build:ext` now copies fresh CSS to `dist/content-styles.css`                      | ✅     | `0ca2e09` |
| Odds API polling disabled (`fetchOdds` commented out)                              | ✅     | `8da24da` |
| Overlay confirmed working on tvgo.t-mobile.cz                                      | ✅     | —         |

---

## Phase 3 — Smart Contracts 🔄 IN PROGRESS

**Goal:** Real on-chain betting with Sepolia USDC. Admin manually settles from EventDetail Oracle tab.
**Full spec:** `docs/CONTRACTS_BUILD_PROMPT.md` (updated Feb 27 with MATCH_WINNER + EXACT_GOALS)

**Bet types in contract:** MATCH_WINNER (home/draw/away) + NEXT_GOAL_SCORER + EXACT_GOALS (total goals 0–5+)
**Settlement trigger:** Admin-manual from EventDetail → Oracle tab → calls `settleMatch()` on chain
**Timer display:** Static Goalserve `@timer` value shown in MatchLive and overlay, updated every 30s poll

### Foundry project structure

```
contracts/
  GoalLiveBetting.sol        ← main escrow + bet logic (NGS + MATCH_WINNER + EXACT_GOALS)
  MockOracle.sol             ← thin oracle wrapper (owner-only goal/settle relay)
  mocks/
    MockUSDC.sol
foundry.toml               ← via_ir=true, OZ remapping, solc 0.8.24
script/
  Deploy.s.sol               ← forge script deploy, writes deployments/<network>.json
test/
  GoalLiveBetting.t.sol      ← 31 Solidity tests (30/30 unit + 1 fuzz) ✅
lib/
  forge-std/                 ← installed via `forge install --no-git`
deployments/
  sepolia.json               ← contract + oracle addresses written post-deploy
```

### `GoalLiveBetting.sol` function surface

```solidity
// ── Enums ──────────────────────────────────────────────────────────────────
enum BetType { NEXT_GOAL_SCORER, MATCH_WINNER, EXACT_GOALS }
enum Outcome { HOME, DRAW, AWAY }   // only used for MATCH_WINNER

// ── Admin / operator ────────────────────────────────────────────────────────
// ── Singleton model: ONE contract deployment for ALL matches ──────────────────
// Contract address stored in localStorage['gl_contract_address'] or VITE_CONTRACT_ADDRESS

// ── Admin / operator ────────────────────────────────────────────────────────
function createMatch(string calldata matchId) external onlyOwner;
function setOracle(address oracle) external onlyOwner;
function fundPool(string calldata matchId, uint256 amount) external;  // USDC approve first
function withdrawFees(address to) external onlyOwner;
function emergencyWithdrawPool(string calldata matchId, address to) external onlyOwner; // drains pool, sets isActive=false

// ── Bet locking (called by admin/backend per player action) ─────────────────
function lockBetNGS(string calldata matchId, uint256 betId, uint256 playerId, uint256 amount) external;
function lockBetMW(string calldata matchId, MatchOutcome outcome, uint256 betId, uint256 amount) external;
function lockBetEG(string calldata matchId, uint8 exactGoals, uint256 betId, uint256 amount) external;

// ── Oracle / admin settlement ────────────────────────────────────────────────
// Called by admin from EventDetail → Oracle tab (Phase 3)
// Called by Chainlink CRE DON (Phase 4)
function settleMatch(
    string calldata matchId,
    uint256[] calldata scorerIds,  // for NGS resolution
    MatchOutcome winner,           // 0=HOME, 1=DRAW, 2=AWAY
    uint8 homeGoals,               // for EXACT_GOALS resolution
    uint8 awayGoals
) external onlyOracle;

// ── Views ────────────────────────────────────────────────────────────────────
function getMatchPool(string calldata matchId) external view returns (uint256 poolSize, bool isActive, bool isSettled);
function claimPayout(string calldata matchId, uint256 betId) external nonReentrant;
```

### Penalty formula (must match frontend)

```
penalty = base[changeCount] × (1 − minute / 90)
base = { 1st: 3%, 2nd: 5%, 3rd: 8%, 4th: 12%, 5th+: 15% }
```

### Wire-up after deploy

1. Copy ABI to `admin/src/services/contractService.ts` — replace stub bodies with ethers.js calls
2. Set `VITE_CONTRACT_ADDRESS` in `.env`
3. Update `src/services/real/bettingService.ts` → call `lockBet()` / `changeBet()`
4. Add `useAdminWallet.ts` hook (MetaMask connect, compare address to `contract.owner()`, redirect `/unauthorized` if mismatch)

### Admin app — Phase 3 completions

These pages are scaffolded but need real contract wiring:

**Dashboard (`/dashboard`)**

- Platform wallet balance + pool USDC balance from `getPoolStats()`
- Quick stats: total locked USDC, total paid out, platform fees

**Create Event (`/events/new`)**

- On submit → call `createMatch()` on contract via MetaMask → insert row in Supabase
- Oracle address pre-filled with deployed oracle address, editable
- Odds API provider selection + API key (stored in Supabase only, never in contract)

**Event Detail (`/events/:matchId`) — 4 panels**

| Panel       | Contents                                                                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oracle      | Current oracle address, `setOracle(newAddress)` MetaMask button, oracle status (ping)                                                                 |
| Odds API    | Configured provider, test connection, manual odds override, "Sync odds → players table" Edge Fn                                                       |
| Pool Status | `usdc.balanceOf(contractAddress)`, totalLocked, available, fees, Fund Pool button (approve + `fundPool()`), "Collect fees" (`withdrawPlatformFees()`) |
| Settlement  | CRE result payload preview, winning player list, "Settle Match" → `settleMatch()`, post-settle stats                                                  |

**Fund Pool (`/events/:matchId/fund`)**

- Current escrow balance
- Deposit USDC (MetaMask approve + `fundPool()`)
- Historical funding log
- Liquidity health: "Pool can cover X max simultaneous payouts"

### Supabase Edge Functions (Phase 3)

```
supabase/functions/
  lock-bet/        ← bet placed → write bets table + call lockBet() on contract
  settle-match/    ← post-match → read goal_events → call settleMatch() on contract
  sync-odds/       ← admin trigger → fetch odds from provider → update players table
```

---

## Phase 4 — Chainlink CRE Integration ❌ NOT STARTED

**Goal:** Replace mock match data with verified on-chain sports data.
**Full reference:** `docs/CRE_CHAINLINK_INTEGRATION_GUIDE.md`

### Five data pillars

| Pillar            | Data                   | Timing               | Now (mock)                     | Phase 4 (real)                |
| ----------------- | ---------------------- | -------------------- | ------------------------------ | ----------------------------- |
| Pre-game odds     | Player goalscorer odds | Hours before kickoff | `pre_match_odds.json`          | CRE HTTP + cron               |
| Player lineups    | Starting 11            | 15 min pre-kick      | Seeded in Supabase             | CRE HTTP                      |
| Live goal events  | Player, minute         | Real-time            | Manual insert to `goal_events` | CRE webhook                   |
| Live odds updates | Volatile, 1-2s freq    | Very high            | Static JSON snapshots          | Chainlink Data Streams (pull) |
| Official result   | Final scorers          | Post-match           | Hardcoded in seed              | CRE HTTP                      |

### CRE workflow structure (Phase 4)

```yaml
name: goal-live-match-oracle
triggers:
  - type: Cron
    schedule: "*/1 * * * *" # every minute during live match
  - type: Webhook
    path: /goal-event # fired by Opta/Sportmonks on goal
capabilities:
  - http # fetch from data provider
  - threshold-encryption # protect API key in workflow
  - evm-write # write result to GoalLiveBetting contract
```

### Mock vs Real CRE decision

| Scenario                | Approach                                                       |
| ----------------------- | -------------------------------------------------------------- |
| Demo / current          | Mock oracle — manual insert to `goal_events` table in Supabase |
| Testnet with live match | CRE HTTP + webhook from Opta/Sportmonks                        |
| Production              | Full CRE workflow, Chainlink-verified settlement               |

For demo, swap mock oracle by just inserting rows into `goal_events` via admin SQL or admin panel. The contract's `settleMatch()` reads from this table via the Supabase Edge Function.

### Service abstraction (already in place)

```typescript
// src/services/index.ts
import { VITE_USE_MOCK } from "../utils/env";
export const services = {
  data: VITE_USE_MOCK ? new MockDataService() : new RealDataService(),
  betting: VITE_USE_MOCK ? new MockBettingService() : new RealBettingService(),
  wallet: VITE_USE_MOCK ? new MockWalletService() : new RealWalletService(),
};
// Phase 4: RealDataService calls CRE instead of Supabase static
```

---

## Phase 5 — Live Odds ML / CRE API ❌ NOT STARTED

**Goal:** Real in-play odds modelling from captured bookmaker data → serve as CRE prediction feed.
**References:** `docs/LIVE_ODDS_CAPTURE_AND_MOCK_CRE_API.md` · `CRE_API_ARCHITECTURE.md` (root)

### Pipeline

```
The Odds API (polled every 30s during live match)
  └─ OddsCapture TypeScript service
       └─ Google Sheets (180+ rows per 90-min match)
            └─ Post-match: Sheets → MatchProfile JSON
                 └─ Python model training (Random Forest regressor)
                      └─ CRE API: POST /api/v1/predict-odds
```

### Match data already captured (Feb 21 City vs Newcastle)

- `src/data/pre_match_odds.json` — all 22 real players, full markets (`will_score`, `wont_score`, `score_2plus`, `score_3plus`)
- `src/data/live_snapshots.json` — 11 snapshots (min 0, 17, 30, 38, 45, 54, 65, 71, 80, 84, 90), live odds drift, cumulative stats, goal events

### Predict endpoint contract

```typescript
// POST /api/v1/predict-odds
interface PredictRequest {
  player: string;
  pre_match_odds: number; // e.g. 1.52
  current_stats: {
    minute: number; // 0–90
    score: { home: number; away: number };
    shots_on_target: { home: number; away: number };
    xg: { home: number; away: number };
    possession: { home: number }; // 0–100
    player_shots: number;
    player_xg: number;
    player_touches_in_box: number;
  };
}
interface PredictResponse {
  predicted_odds: number;
  confidence: number; // 0–1
  factors: {
    time_decay: number;
    shots_effect: number;
    xg_effect: number;
    score_effect: number;
  };
}
```

---

## Full Checklist by Phase

### ~~Phase 1 — Chrome Extension~~ ✅ COMPLETE

- [x] ~~Chrome MV3 extension (Vite + React 18 + TS + Tailwind)~~
- [x] ~~BettingOverlay, PlayerButton, BetModal, BetChangeModal~~
- [x] ~~BalanceDisplay, MyBets, SettlementDisplay, TopUpModal, WithdrawModal~~
- [x] ~~Mock / Real service switcher (`VITE_USE_MOCK`)~~
- [x] ~~`pre_match_odds.json` — 22 real players, full markets~~
- [x] ~~`live_snapshots.json` — 11 snapshots, odds drift, goal events~~
- [x] ~~Supabase SQL schema (4 migration files)~~

### Phase 2 — Admin + Supabase 🔄

- [x] ~~Supabase SQL schema (4 migration files)~~
- [x] ~~Admin Vite config + entry (`vite.admin.config.ts`)~~
- [x] ~~Admin routing + layout (react-router-dom v7)~~
- [x] ~~Dashboard, CreateEvent, EventDetail, FundPool pages~~
- [x] ~~Full admin UI restyle (dark theme, Inter font, ambient glow, pill tabs)~~
- [x] ~~`admin/styles/admin.css` — body reset, font import, scrollbar~~
- [x] ~~`tailwind.config.js` — `admin/**` added to content scan~~
- [x] ~~`admin/tsconfig.json` — vite/client types + path aliases~~
- [x] ~~`useAdminWallet.ts` — MetaMask admin guard (compares to hardcoded admin address, redirects `/unauthorized`)~~
- [x] ~~`contractService.ts` — `SIMULATION_MODE=true`, MetaMask opens for auth, txs simulated~~
- [x] ~~CreateEvent 3-step flow: DB insert → deploy contract → fund pool~~
- [x] ~~package.json `dev:admin` / `build:admin` scripts~~
- [x] ~~Apply migrations to live Supabase DB~~
- [x] ~~**Push local uncommitted changes**~~ ← done (`b5de08f`)
- [x] ~~Supabase Edge Functions: `lock-bet`, `settle-match`, `sync-odds`~~ ← `supabase/functions/`
- [x] ~~Deploy Edge Functions via Supabase CLI~~ ← live on `weryswulejhjkrmervnf`
- [ ] Deploy admin to Netlify / Vercel (admin.goal.live) — deferred until Phase 3 wired

### Phase 3 — Smart Contracts ✅

**Track A — Contracts** ✅ `d45c919`

> Switched from Hardhat to **Foundry** (forge 1.5.1) — avoids ESM/CJS conflicts with Node v23,
> 10–50× faster tests, no TypeScript toolchain required for test execution.

- [x] Foundry project init: `foundry.toml` (`via_ir=true`, OZ remapping, solc 0.8.24)
- [x] `GoalLiveBetting.sol` — NGS + MATCH_WINNER + EXACT_GOALS
- [x] `MockOracle.sol` — owner-only relay
- [x] `MockUSDC.sol` for local tests
- [x] `script/Deploy.s.sol` → writes `deployments/<network>.json`
- [x] Foundry tests (`test/GoalLiveBetting.t.sol`): 30/30 unit + 1 fuzz ✅
- [ ] Deploy to Sepolia → real contract + oracle addresses
- [ ] Wire `contractService.ts` with real ABI + `SIMULATION_MODE = false`
- [ ] Wire `bettingService.ts` → `lockBet()` / `changeBet()`
- [ ] Admin: `createMatch`, `fundPool`, `settleMatch` work end-to-end on Sepolia

**Track B — Timer** ✅ `c0ec412`

- [x] Surface Goalserve `@timer` in MatchLive (port 5176) score header — green animated badge
- [x] Verify overlay `match.currentMinute` advances during replay (already via mock tick)

**Track C — Replay Mode** ✅ `c0ec412`

- [x] `matchData.ts`: reset to minute 0, score 0–0 for replay start
- [x] `steadyOdds: boolean` option in `MockDataService` (skip odds fluctuation)
- [x] `matchRegistry.ts`: `steadyOdds: true` on PLZEN_PANAT config
- [x] Rebuild extension

**Track D — Exact Goals Bet** ✅ `14bb97b`

- [x] Add `"EXACT_GOALS"` to `BetType` in `src/types/index.ts`
- [x] Add `goalsTarget?: number` to `Bet` interface
- [x] `BettingOverlay`: Exact Goals bar (0 1 2 3 4 5+) with pre-set odds — fixed strip below top bar
- [x] `mockBettingService.settleBets`: resolve EXACT_GOALS bets (5+ = ≥5)
- [x] `GoalLiveBetting.sol`: EXACT_GOALS already handled in `settleMatch` (Track A)

**Track E — contractService real ethers v6** ✅ `f3edab2`

- [x] ~~`admin/src/services/glb.artifact.ts` — generated from `forge build --force`, 52 ABI entries, bytecode 23404 chars~~
- [x] ~~`contractService.ts` — full ethers v6 rewrite (BrowserProvider + JsonRpcSigner), singleton deploy model~~
- [x] ~~`deployContract(externalMatchId)` — factory.deploy singleton + createMatch in one tx~~
- [x] ~~`fundPool(matchId, amountUsdc)` — USDC.approve + contract.fundPool~~
- [x] ~~`settleMatchOnChain(_, matchId, scorers[], winner, homeGoals, awayGoals)`~~
- [x] ~~`FundPool.tsx` — `fundPool(match.external_match_id, ...)` (was passing contract_address)~~
- [x] ~~`EventDetail.tsx` — `settleMatchOnChain` gets winner/homeGoals/awayGoals from match score~~
- [x] ~~`matchData.ts` — fixed `"in-progress"` → `"pre-match"`~~
- [x] ~~`docs/CHAINLINK_DEV_QUESTIONS.md` — 6 sharp questions for CRE dev session~~
- [x] ~~`docs/WORLDCOIN_SEPOLIA_NOTES.md` — WorldCoin Sepolia investigation~~

**Track F — EPL support + Wolves/Villa** ✅ `0fda507`

- [x] ~~`CreateEvent.tsx` — `soccer_epl` + `soccer_uefa_europa_league` + `soccer_uefa_europa_conference_league`, 7-day window, purple EPL badge~~
- [x] ~~`matchRegistry.ts` — `WOLVES_VILLA` entry (Odds API ID: `b9ade3f715e4c344543f672014bc2188`, KO 2026-02-27T20:00 UTC)~~
- [x] ~~`popup.js` — Wolves/Villa pre-match card, `m.score ?? "vs"` null-safe display~~

**Track G — emergencyWithdrawPool** ✅ `1407f01`

- [x] ~~`GoalLiveBetting.sol` — `emergencyWithdrawPool(matchId, to)` owner-only, drains pool, sets `isActive=false`, emits `PoolEmergencyWithdrawn`~~
- [x] ~~`glb.artifact.ts` regenerated after emergencyWithdraw added (52 entries, 23404 chars)~~
- [x] ~~`contractService.ts` — `emergencyWithdrawPool(matchId, to?)` method~~
- [x] ~~`FundPool.tsx` — Danger Zone section: two-step confirm, clears Supabase `contract_address=null` on success~~

- [ ] `npm run build:all` script

### Phase 4 — Chainlink CRE ❌

- [ ] CRE workflow YAML (`name: goal-live-match-oracle`)
- [ ] CRE Cron DON for pre-game odds (HTTP trigger → Goalserve/Odds API)
- [ ] CRE webhook for live goal events (log trigger on `BetLocked` → update odds)
- [ ] CRE settlement cron: watches for Full-time status → calls `settleMatch()`
- [ ] Data Streams: custom Betfair odds stream for live MW odds
- [ ] Swap `MockOracle` address for real CRE DON address on contract
- [ ] See `docs/CHAINLINK_DEV_QUESTIONS.md` for session prep questions
- [ ] World ID integration (3 checkpoints: fund account / game end / withdraw)

### Phase 5 — Live Odds ML API ❌

- [ ] `OddsCapture` TS service (poll The Odds API → Google Sheets)
- [ ] Google Sheets → MatchProfile JSON export script
- [ ] Python RF model training (`model_training.py`)
- [ ] Express CRE API server (`/api/v1/predict-odds`)
- [ ] Wire extension to use predicted odds
- [ ] Deploy CRE API (Vercel serverless or Railway)

---

## Tech Stack Reference

| Layer        | Tech                                     | Notes                               |
| ------------ | ---------------------------------------- | ----------------------------------- |
| Extension UI | React 18 + Vite + TS + Tailwind          | Chrome MV3, `src/`                  |
| Admin UI     | React 18 + Vite + TS + Tailwind          | Standalone SPA, `admin/`, port 5174 |
| Database     | Supabase (PostgreSQL)                    | Project ID: `weryswulejhjkrmervnf`  |
| Realtime     | Supabase Realtime / WebSocket            | Match state updates                 |
| Blockchain   | Ethereum Sepolia                         | USDC testnet                        |
| Contracts    | Solidity 0.8.24 + Foundry + OpenZeppelin | Phase 3 (`d45c919`)                 |
| Oracle       | Chainlink CRE (Opta / Sportmonks node)   | Phase 4 (mocked now)                |
| Wallet       | ethers.js v6 + MetaMask                  | Extension + admin                   |
| Auth         | World ID (@worldcoin/idkit)              | Phase 4+                            |
| ML / CRE API | Python scikit-learn RF + Node Express    | Phase 5                             |
| Hosting      | Netlify / Vercel                         | admin.goal.live                     |

## Npm Scripts

```bash
npm run dev              # Extension dev (port 5173)
npm run build            # Build extension + content script
npm run build:ext        # Content script + CSS → dist/ (also copies content-styles.css)
npm run dev:admin        # Admin SPA dev (port 5174)
npm run build:admin      # Build admin to dist-admin/
npm run dev:matchlive    # MatchLive viewer dev (port 5176) — Plzeň/Panat fixed
npm run dev:matchlive2   # MatchLive viewer dev (port 5177) — dynamic
# TODO Phase 3:
npm run build:all        # extension + admin combined
npm run test:contracts   # forge test -vv
npm run deploy:sepolia   # forge script script/Deploy.s.sol --rpc-url $RPC --broadcast --verify
npm run anvil            # local anvil node (chain-id 31337)
```

## Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=https://weryswulejhjkrmervnf.supabase.co
VITE_SUPABASE_ANON_KEY=...

# Feature flags
VITE_USE_MOCK=true              # false = real Supabase + contract
VITE_USE_REAL_WALLET=true       # true = MetaMask bridge (extension)

# Wallet
VITE_PLATFORM_WALLET=0xc3d06cf4247C1BaB07EDEB8CE6991d750F6Eb3E5

# Phase 3+ (set after Sepolia deploy)
VITE_CONTRACT_ADDRESS=...       # written to deployments/sepolia.json after deploy
VITE_ORACLE_ADDRESS=...         # MockOracle address
VITE_USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238  # Sepolia USDC (Circle)

# Foundry / deploy (read from .env.local — never commit PRIVATE_KEY)
VITE_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
PRIVATE_KEY=your_deployer_private_key
ETHERSCAN_API_KEY=your_etherscan_key

# Odds API (disabled during off-session — re-enable 30min before kickoff)
ODDS_API_KEY=069be437bad9795678cdc1c1cee711c3
```

## Key Design Decisions

| Decision                     | Choice                                              | Reason                                    |
| ---------------------------- | --------------------------------------------------- | ----------------------------------------- |
| Bet types                    | NGS + MATCH_WINNER + EXACT_GOALS                    | All three in single contract Phase 3      |
| Blockchain                   | Ethereum Sepolia                                    | Testnet USDC available                    |
| Currency                     | USDC (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`) | Stable, Circle Sepolia                    |
| Penalty                      | `base[n] × (1 − min/90)`                            | Time-decay + progressive                  |
| Settlement                   | Two-phase (provisional → final post-match)          | Handles VAR / goal corrections            |
| Settlement trigger (Phase 3) | Admin manually via EventDetail Oracle tab           | No auto-trigger until Chainlink (Phase 4) |
| Admin auth                   | MetaMask address vs `contract.owner()`              | No separate login, crypto-native          |
| CRE strategy                 | Mock oracle now, real CRE in Phase 4                | Flexible on data availability             |
| Admin build                  | Separate Vite config                                | Zero risk to extension build              |
| Wallet lib                   | ethers.js v6 (not wagmi)                            | Consistent across extension + admin       |
| Odds pipeline                | OddsAPI → Sheets → JSON → RF model                  | Replayable, no live timing dependency     |
| Match picker                 | `chrome.storage.local` + `matchRegistry.ts`         | Extensible to N matches, no re-build      |
| Replay odds                  | `steadyOdds: true` in MatchConfig                   | Fixed odds throughout match replay        |
| Odds source                  | Betfair Exchange only (`betfair_ex_eu`)             | 1 credit/call vs 12 bookmakers            |
| Timer display                | Static Goalserve `@timer`, 30s poll                 | No JS animation needed for replay         |
| WorldCoin                    | Investigate Sepolia support first                   | Implement only if testnet proofs work     |
