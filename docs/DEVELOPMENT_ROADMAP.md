# goal.live — Master Development Plan

**Last Updated:** February 25, 2026
**Status:** Phase 1 ✅ Complete · Phase 2 🔄 In Progress (admin scaffold done, Supabase live ✅)
**Repo:** `petrkrulis2022/goal-live-project` · branch `main` · last commit `e0e818a`

---

## Supporting Docs

| File | Purpose |
|---|---|
| **This file** | The only plan file to follow |
| `MVP_FINAL_SPEC.md` | All design decisions (penalty formula, bet types, UI layout) |
| `ARCHITECTURE.md` | Technical deep-dive (system diagram, data flow) |
| `CONTRACTS_BUILD_PROMPT.md` | Smart contract spec for Phase 3 |
| `CRE_CHAINLINK_INTEGRATION_GUIDE.md` | CRE oracle technical reference (Phase 4) |
| `LIVE_ODDS_CAPTURE_AND_MOCK_CRE_API.md` | Live odds capture pipeline + mock CRE API strategy |
| `CRE_INTEGRATION_FOR_MVP_PROMPTS.md` | OddsAPI capture service code + Google Sheets pipeline |
| `CRE_API_ARCHITECTURE.md` (root) | ML model architecture for in-play odds prediction |

---

## Product in One Paragraph

**goal.live** is a Chrome extension that overlays interactive player buttons on YouTube/Twitch football streams. Users connect a MetaMask wallet, pick a player to score the next goal, and lock in a USDC bet on Ethereum Sepolia. Bets can be changed unlimited times during the match (each change incurs a hybrid penalty: `base[n] × (1 − minute/90)`). Provisional credits are shown instantly when goals occur; final USDC payouts are settled post-match via Chainlink CRE oracle data. An Admin web app lets the platform operator create events, manage the USDC pool, and trigger settlement.

---

## What Is Built (Feb 25, 2026)

### Phase 1 — Chrome Extension ✅

| Component | Status |
|---|---|
| Chrome MV3 extension (Vite + React 18 + TS + Tailwind) | ✅ |
| BettingOverlay, PlayerButton, BetModal, BetChangeModal | ✅ |
| BalanceDisplay, MyBets, SettlementDisplay, TopUpModal, WithdrawModal | ✅ |
| Mock / Real service switcher (`VITE_USE_MOCK`) in `src/services/index.ts` | ✅ |
| `src/data/pre_match_odds.json` — all 22 real Feb 21 players, full markets | ✅ |
| `src/data/live_snapshots.json` — 11 snapshots min 0–90, live odds drift, goal events | ✅ |
| Supabase SQL schema written (4 migration files in `supabase/migrations/`) | ✅ |

### Phase 2 — Admin Web App + Supabase 🔄

| Component | Status |
|---|---|
| `vite.admin.config.ts` — root `admin/`, port 5174, dist `dist-admin/` | ✅ |
| `admin/src/App.tsx` + react-router-dom v7 routing | ✅ |
| `admin/src/components/Layout.tsx` — dark sidebar, green active nav | ✅ |
| `admin/src/pages/Dashboard.tsx` — all matches from Supabase | ✅ |
| `admin/src/pages/CreateEvent.tsx` — inserts match to Supabase | ✅ |
| `admin/src/pages/EventDetail.tsx` — 4-tab view: overview / players / bets / goals | ✅ |
| `admin/src/pages/FundPool.tsx` — contract deploy stub + USDC fund input | ✅ |
| `admin/src/services/contractService.ts` — ethers.js stubs (Phase 3 wires real contract) | ✅ |
| `package.json` scripts: `dev:admin`, `build:admin` | ✅ |
| **Supabase migrations applied to live DB** | ✅ All 4 migrations run, project active |

---

## Phase 2 Remaining — Admin Completion

> Supabase is live ✅ — all 4 migrations applied

Next steps:
1. Set `.env` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` if not done
2. Run `npm run dev:admin` → verify Dashboard loads the seeded Man City vs Newcastle match
3. Build `useAdminWallet.ts` — MetaMask connect + admin guard
4. Build Supabase Edge Functions: `lock-bet`, `settle-match`, `sync-odds`
5. Deploy admin to Netlify/Vercel (admin.goal.live)

---

## Phase 3 — Smart Contracts (Next Up)

**Goal:** Real on-chain betting with Sepolia USDC.
**Full spec:** `docs/CONTRACTS_BUILD_PROMPT.md`

### Hardhat project structure

```
contracts/
  GoalLiveBetting.sol        ← main escrow + bet logic
  interfaces/
    IGoalLiveBetting.sol
  mocks/
    MockUSDC.sol
hardhat.config.ts
scripts/
  deploy.ts
test/
  GoalLiveBetting.test.ts
```

### `GoalLiveBetting.sol` function surface

```solidity
// Admin / operator
function createMatch(string matchId, uint256 kickoffTime) external onlyOwner;
function setOracle(address oracle) external onlyOwner;
function fundPool(uint256 amount) external onlyOwner;         // USDC approve + transfer in
function withdrawPlatformFees() external onlyOwner;

// User flow (called by extension or Supabase Edge Function)
function lockBet(bytes32 betId, address bettor, string playerId, uint256 amount, uint256 odds) external;
function changeBet(bytes32 betId, string newPlayerId, uint256 penaltyAmount) external;

// Oracle settlement (called by Chainlink CRE oracle)
function settleMatch(string matchId, string[] scorerIds) external onlyOracle;

// Views
function getPoolStats() external view returns (uint256 totalBalance, uint256 totalLocked, uint256 available, uint256 fees);
function getBet(bytes32 betId) external view returns (Bet memory);
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

| Panel | Contents |
|---|---|
| Oracle | Current oracle address, `setOracle(newAddress)` MetaMask button, oracle status (ping) |
| Odds API | Configured provider, test connection, manual odds override, "Sync odds → players table" Edge Fn |
| Pool Status | `usdc.balanceOf(contractAddress)`, totalLocked, available, fees, Fund Pool button (approve + `fundPool()`), "Collect fees" (`withdrawPlatformFees()`) |
| Settlement | CRE result payload preview, winning player list, "Settle Match" → `settleMatch()`, post-settle stats |

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

## Phase 4 — Chainlink CRE Integration

**Goal:** Replace mock match data with verified on-chain sports data.
**Full reference:** `docs/CRE_CHAINLINK_INTEGRATION_GUIDE.md`

### Five data pillars

| Pillar | Data | Timing | Now (mock) | Phase 4 (real) |
|---|---|---|---|---|
| Pre-game odds | Player goalscorer odds | Hours before kickoff | `pre_match_odds.json` | CRE HTTP + cron |
| Player lineups | Starting 11 | 15 min pre-kick | Seeded in Supabase | CRE HTTP |
| Live goal events | Player, minute | Real-time | Manual insert to `goal_events` | CRE webhook |
| Live odds updates | Volatile, 1-2s freq | Very high | Static JSON snapshots | Chainlink Data Streams (pull) |
| Official result | Final scorers | Post-match | Hardcoded in seed | CRE HTTP |

### CRE workflow structure (Phase 4)

```yaml
name: goal-live-match-oracle
triggers:
  - type: Cron
    schedule: "*/1 * * * *"     # every minute during live match
  - type: Webhook
    path: /goal-event             # fired by Opta/Sportmonks on goal
capabilities:
  - http                          # fetch from data provider
  - threshold-encryption          # protect API key in workflow
  - evm-write                     # write result to GoalLiveBetting contract
```

### Mock vs Real CRE decision

| Scenario | Approach |
|---|---|
| Demo / current | Mock oracle — manual insert to `goal_events` table in Supabase |
| Testnet with live match | CRE HTTP + webhook from Opta/Sportmonks |
| Production | Full CRE workflow, Chainlink-verified settlement |

For demo, swap mock oracle by just inserting rows into `goal_events` via admin SQL or admin panel. The contract's `settleMatch()` reads from this table via the Supabase Edge Function.

### Service abstraction (already in place)

```typescript
// src/services/index.ts
import { VITE_USE_MOCK } from '../utils/env'
export const services = {
  data: VITE_USE_MOCK ? new MockDataService() : new RealDataService(),
  betting: VITE_USE_MOCK ? new MockBettingService() : new RealBettingService(),
  wallet: VITE_USE_MOCK ? new MockWalletService() : new RealWalletService(),
}
// Phase 4: RealDataService calls CRE instead of Supabase static
```

---

## Phase 5 — Live Odds ML / CRE API

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
  pre_match_odds: number;           // e.g. 1.52
  current_stats: {
    minute: number;                 // 0–90
    score: { home: number; away: number };
    shots_on_target: { home: number; away: number };
    xg: { home: number; away: number };
    possession: { home: number };   // 0–100
    player_shots: number;
    player_xg: number;
    player_touches_in_box: number;
  };
}
interface PredictResponse {
  predicted_odds: number;
  confidence: number;               // 0–1
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

### Phase 2 — Admin + Supabase
- [x] Supabase SQL schema (4 migration files)
- [x] Admin Vite config + entry
- [x] Admin routing + layout
- [x] Dashboard, CreateEvent, EventDetail, FundPool pages
- [x] contractService.ts stub
- [x] package.json dev:admin / build:admin
- [x] Apply migrations to live Supabase DB ✅
- [ ] `useAdminWallet.ts` — MetaMask admin guard (compare to `contract.owner()`)
- [ ] Supabase Edge Functions: `lock-bet`, `settle-match`, `sync-odds`
- [ ] Deploy admin to Netlify / Vercel (admin.goal.live)

### Phase 3 — Smart Contracts
- [ ] Hardhat project init (`contracts/`)
- [ ] `GoalLiveBetting.sol` full implementation
- [ ] `MockUSDC.sol` for tests
- [ ] Hardhat tests (penalty formula, payout logic, settlement)
- [ ] Deploy to Sepolia
- [ ] Wire `contractService.ts` with real ABI + address
- [ ] Wire `bettingService.ts` → `lockBet()` / `changeBet()`
- [ ] Extension: real MetaMask flow end-to-end
- [ ] Admin: real `createMatch`, `fundPool`, `settleMatch` buttons work
- [ ] `npm run build:all` script

### Phase 4 — Chainlink CRE
- [ ] CRE workflow YAML
- [ ] CRE cron for pre-game odds
- [ ] CRE webhook for live goal events
- [ ] CRE settlement trigger → calls `settleMatch()`
- [ ] Swap MockOracle for real CRE address on contract
- [ ] World ID integration (3 checkpoints: bet / complete / withdraw)

### Phase 5 — Live Odds ML API
- [ ] `OddsCapture` TS service (poll The Odds API → Google Sheets)
- [ ] Google Sheets → MatchProfile JSON export script
- [ ] Python RF model training (`model_training.py`)
- [ ] Express CRE API server (`/api/v1/predict-odds`)
- [ ] Wire extension to use predicted odds
- [ ] Deploy CRE API (Vercel serverless or Railway)

---

## Tech Stack Reference

| Layer | Tech | Notes |
|---|---|---|
| Extension UI | React 18 + Vite + TS + Tailwind | Chrome MV3, `src/` |
| Admin UI | React 18 + Vite + TS + Tailwind | Standalone SPA, `admin/`, port 5174 |
| Database | Supabase (PostgreSQL) | Project ID: `weryswulejhjkrmervnf` |
| Realtime | Supabase Realtime / WebSocket | Match state updates |
| Blockchain | Ethereum Sepolia | USDC testnet |
| Contracts | Solidity 0.8.x + Hardhat + OpenZeppelin | Phase 3 |
| Oracle | Chainlink CRE (Opta / Sportmonks node) | Phase 4 (mocked now) |
| Wallet | ethers.js v6 + MetaMask | Extension + admin |
| Auth | World ID (@worldcoin/idkit) | Phase 4+ |
| ML / CRE API | Python scikit-learn RF + Node Express | Phase 5 |
| Hosting | Netlify / Vercel | admin.goal.live |

## Npm Scripts

```bash
npm run dev            # Extension dev (port 5173)
npm run build          # Build extension + content script
npm run build:ext      # Content script only
npm run dev:admin      # Admin SPA dev (port 5174)
npm run build:admin    # Build admin to dist-admin/
# TODO Phase 3:
npm run build:all      # extension + admin combined
```

## Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=https://weryswulejhjkrmervnf.supabase.co
VITE_SUPABASE_ANON_KEY=...

# Feature flags
VITE_USE_MOCK=true              # false = real Supabase + contract

# Phase 3+
VITE_CONTRACT_ADDRESS=...
VITE_ORACLE_ADDRESS=...
VITE_USDC_ADDRESS=...           # Sepolia USDC

# Phase 5 – Live Odds Capture
ODDS_API_KEY=284c2661be564a872e91d8a4bb885ac9
```

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Bet type | Next Goal Scorer only | Single market simplifies MVP |
| Blockchain | Ethereum Sepolia | Testnet USDC available |
| Currency | USDC | Stable, no memecoin complexity |
| Penalty | `base[n] × (1 − min/90)` | Time-decay + progressive |
| Settlement | Two-phase (provisional → final post-match) | Handles VAR / goal corrections |
| Admin auth | MetaMask address vs `contract.owner()` | No separate login, crypto-native |
| CRE strategy | Mock oracle now, real CRE in Phase 4 | Flexible on data availability |
| Admin build | Separate Vite config | Zero risk to extension build |
| Wallet lib | ethers.js v6 (not wagmi) | Consistent across extension + admin |
| Odds pipeline | OddsAPI → Sheets → JSON → RF model | Replayable, no live timing dependency |
