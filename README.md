# ⚽ goal.live

**Decentralized Live Football Prediction Market — Chainlink Hackathon 2026**

goal.live is a real-time, decentralized prediction market for live football. Users watch matches, deposit USDC into on-chain match pools, place live bets on next goal scorer and match outcomes, and receive automated on-chain payouts — all settled trustlessly by a **Chainlink CRE (Runtime Environment) Workflow** the moment the final whistle blows.

> Built on **Ethereum Sepolia** · Powered by **Chainlink CRE** · Real match data from **Goalserve** · Off-chain state in **Supabase**

---

## 🏆 Hackathon Category

**Prediction Markets** — Chainlink Hackathon 2026

This project demonstrates automated, verifiable settlement of prediction markets based on real-world football match outcomes, using a live-deployed Chainlink CRE Workflow as the trustless settlement oracle.

---

## 🔗 Chainlink Files Reference

| File                                                                                                                 | Usage                                                                 |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`cre/goal-live/goal-live-settlement/main.ts`](./cre/goal-live/goal-live-settlement/main.ts)                         | **CRE Workflow** — settlement logic, HTTP consensus, EVM write        |
| [`cre/goal-live/goal-live-settlement/workflow.yaml`](./cre/goal-live/goal-live-settlement/workflow.yaml)             | CRE workflow deployment config                                        |
| [`cre/goal-live/goal-live-settlement/config.staging.json`](./cre/goal-live/goal-live-settlement/config.staging.json) | CRE runtime config (Supabase URL, contract address, schedule)         |
| [`cre/goal-live/project.yaml`](./cre/goal-live/project.yaml)                                                         | CRE project settings (RPC endpoints)                                  |
| [`contracts/GoalLiveBetting.sol`](./contracts/GoalLiveBetting.sol)                                                   | Smart contract — `onReport()` receives CRE settlement                 |
| [`test/GoalLiveBetting.t.sol`](./test/GoalLiveBetting.t.sol)                                                         | Foundry tests (37 passing)                                            |
| [`admin/src/services/contractService.ts`](./admin/src/services/contractService.ts)                                   | Admin: deploy contract, `requestSettlement()` (fires CRE Log Trigger) |
| [`src/hooks/useMatchBalance.ts`](./src/hooks/useMatchBalance.ts)                                                     | Frontend: reads on-chain payout state after CRE settles               |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Chrome Extension  (user-facing overlay on streaming sites) │
│  React Admin Panel (match creation, funding, settlement UI) │
└────────────────────┬────────────────────────────────────────┘
                     │ fund / bet / withdraw (MetaMask)
                     │ read live scores/odds (Supabase)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  GoalLiveBetting.sol  (Sepolia)                             │
│  0x4434528dBbD8376BDDb7ca189B7e20cfe4b3c435                │
│                                                             │
│  fundMatch()  recordBet()  settleUserBalances()  withdraw() │
│  ← onReport() called by Chainlink KeystoneForwarder        │
└────────────────────┬────────────────────────────────────────┘
                     │ EVM Write (KeystoneForwarder)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Chainlink CRE Workflow  (goal-live-settlement)             │
│                                                             │
│  Trigger A: CRON every 60s                                 │
│    → polls Supabase + Goalserve → detects FT → settles     │
│                                                             │
│  Trigger B: LOG on SettlementRequested event               │
│    → admin-initiated → immediate fetch + settle            │
│                                                             │
│  DON Consensus: 7 nodes each fetch independently           │
│  Results aggregated (median scores, identical strings)     │
│  Signed report written on-chain via KeystoneForwarder      │
└────────────────────┬────────────────────────────────────────┘
                     │ outbound HTTP
          ┌──────────┴──────────┐
          ▼                     ▼
  Supabase REST            Goalserve API
  (live matches,           (live scores,
   bet records)             FT status,
                            goalscorer IDs)
```

---

## 🎬 How It Works — Step by Step

### 1. Admin Creates a Match

The admin panel deploys a fresh `GoalLiveBetting` contract per match (or registers a match in the singleton), funds it with USDC liquidity from the platform treasury, and saves the match to Supabase.

```
Admin Panel (localhost:5174)
  → Deploy GoalLiveBetting.sol via MetaMask
  → createMatch(externalMatchId)
  → fundPool(matchId, amountUsdc)          ← USDC approve + transfer
  → Supabase: INSERT match row with contract_address
```

A Goalserve background job also seeds the match with player data (lineup, odds) as soon as it appears in the live feed — typically 1–2 hours before kickoff.

---

### 2. User Deposits into the Match Pool

Before kickoff, users load the Chrome extension overlay while watching the match on any streaming site. They deposit USDC directly into the on-chain match pool — this is their stake for the whole match.

```
User (Chrome Extension)
  → See match: Osasuna vs Mallorca, Pool: $500
  → Click "Fund Match" → MetaMask
      → USDC.approve(contract, amount)    ← tx 1
      → GoalLiveBetting.fundMatch(matchId, amount)  ← tx 2
  → matchBalance[matchId][user] = amount deposited
```

No gas is needed for actual betting — bets are placed as signed Supabase records and only committed on-chain asynchronously by the platform relayer.

---

### 3. User Places Live Bets

During the match, users bet on **Next Goal Scorer** (any player from the live lineup) and **Match Winner**. Bets are pure Supabase writes — instant, gasless, and changeable at any time before the next goal.

```
User (Chrome Extension)
  → Select player: "Budimir to score next" @ 4.5x
  → Click Bet → Supabase: INSERT bet record (instant, no MetaMask)
  → Can change selection freely until the next goal is scored
  → Platform relayer: recordBet() on-chain (async, platform pays gas)
```

Live scores, minute, and odds update every ~10 seconds via Supabase Realtime.

---

### 4. Match Ends — CRE Detects Full Time (Automatic)

This is the core Chainlink integration. The CRE Workflow runs on a DON (Decentralised Oracle Network) — 7 independent nodes each running the same TypeScript workflow on a 60-second cron schedule.

```
CRE Workflow (every 60s on all DON nodes):

  Step 1 → HTTP GET Supabase
           /matches?status=in.(live,halftime)
           → get external_match_id + goalserve_static_id + contract_address

  Step 2 → HTTP GET Goalserve livescores
           /soccernew/home
           → scan for any match with status "FT" or "AET"

  Step 3 → HTTP GET Goalserve commentary
           /commentaries/match?id=<static_id>
           → parse goal scorer player IDs

  DON Consensus:
    → Each of 7 nodes ran steps 1-3 independently
    → winner (median), homeGoals (median), awayGoals (median)
    → goalScorerIds (must be identical across nodes)
    → Aggregated result is accepted only if nodes agree

  CRE signs report:
    → ABI encode: (matchId, goalScorers[], winner, homeGoals, awayGoals)
    → ECDSA sign + keccak256 hash

  EVM Write:
    → KeystoneForwarder.report() → GoalLiveBetting.onReport()
    → Contract: verify signature, store result, emit MatchSettled
```

**CRE workflow source:** [`cre/goal-live/goal-live-settlement/main.ts`](./cre/goal-live/goal-live-settlement/main.ts)

---

### 4b. Admin-Triggered Settlement (Fast Path)

If the admin wants to settle immediately without waiting up to 60s for the next cron tick:

```
Admin Panel
  → Click "Request Settlement"
  → GoalLiveBetting.requestSettlement(matchId)
  → emits: SettlementRequested(matchId, timestamp)

CRE Log Trigger (configured on SettlementRequested event):
  → Fires immediately
  → Runs same Goalserve fetch + settlement logic
  → Settles on-chain in seconds instead of up to 60s
```

---

### 5. Relayer Distributes Payouts

After `MatchSettled` is emitted on-chain, the platform relayer wallet reads the final result and Supabase bet records, calculates each user's P&L, and calls `settleUserBalances()`:

```
Platform Relayer (backend hot wallet):
  → Read MatchSettled event: winner, goalScorers[]
  → Query Supabase: all bets for this matchId
  → Calculate payouts per user based on correct predictions
  → GoalLiveBetting.settleUserBalances(matchId, [users], [payouts])
  → Each user's matchBalance[matchId] updated on-chain
```

---

### 6. User Claims Payout

The Chrome extension polls the user's on-chain `matchBalance` every 15 seconds. Once balances are settled, a **"Claim"** button appears:

```
User (Chrome Extension)
  → BalanceDisplay shows: "⛓ Payout $47.50" (green, pulsing)
  → Click "Claim" → MetaMask
  → GoalLiveBetting.withdraw(matchId)
  → USDC transferred to user wallet
  → BalanceDisplay shows: "⛓ withdrawn ✓"
```

**Frontend hook:** [`src/hooks/useMatchBalance.ts`](./src/hooks/useMatchBalance.ts)

---

## 📦 Project Structure

```
goal.live/
├── contracts/
│   └── GoalLiveBetting.sol          # Main smart contract (V1)
├── test/
│   └── GoalLiveBetting.t.sol        # Foundry tests (37 passing)
├── cre/
│   └── goal-live/
│       ├── project.yaml             # CRE project config
│       ├── secrets.yaml             # CRE secrets (not committed)
│       └── goal-live-settlement/
│           ├── main.ts              # ← CRE Workflow (core Chainlink file)
│           ├── workflow.yaml        # CRE workflow deployment settings
│           └── config.staging.json  # Runtime config
├── src/                             # Chrome extension (user frontend)
│   ├── components/
│   │   ├── BettingOverlay.tsx       # Main overlay component
│   │   └── BalanceDisplay.tsx       # On-chain balance + Claim button
│   ├── hooks/
│   │   ├── useMatchBalance.ts       # Polls on-chain payout state
│   │   └── usePoolBalance.ts        # Reads match pool size
│   └── services/
│       └── matchContract.ts         # User-side withdraw/fundMatch
├── admin/
│   └── src/
│       ├── pages/
│       │   ├── CreateEvent.tsx      # Deploy + fund contract flow
│       │   ├── EventDetail.tsx      # Manage match, trigger settlement
│       │   └── Dashboard.tsx        # All matches overview
│       └── services/
│           └── contractService.ts   # Admin contract interactions
└── supabase/
    ├── functions/
    │   └── lock-bet/               # Edge function: validate + lock bets
    └── migrations/                 # DB schema
```

---

## 🚀 Running Locally

### Prerequisites

- Node.js 20+, Bun, Foundry
- MetaMask with Sepolia ETH + USDC
- Supabase project (or use the existing staging instance)

### Admin Panel

```bash
npm install
npm run dev:admin          # → http://localhost:5174
```

### Chrome Extension

```bash
npm run build              # builds dist/ + dist-content/
# Chrome → Extensions → Load Unpacked → select dist/
```

### Smart Contract (Foundry)

```bash
forge build
forge test                 # 37 tests, all passing
```

### CRE Workflow (Chainlink CRE CLI)

```bash
cd cre/goal-live/goal-live-settlement
# Deploy workflow to CRE network:
cre workflow deploy --settings staging-settings
# Or simulate locally:
cre workflow simulate --settings staging-settings
```

---

## 🔑 Key Design Decisions

**Why CRE for settlement?**
Traditional prediction markets rely on a single centralized oracle or admin key to report results. CRE distributes this across a DON — 7 nodes independently fetch live scores and must reach consensus before any settlement report is accepted. No single party can manipulate the outcome.

**Why Supabase for bets (not on-chain)?**
Live betting requires instant, free bet changes. Writing every bet change to a blockchain would be impractical (cost + latency). Supabase provides instant UX; the relayer commits a cryptographic audit trail on-chain asynchronously. The final payout is always on-chain.

**Why a match pool (not individual bet escrow)?**
Users deposit once per match (`fundMatch`) rather than locking funds per individual bet. This allows unlimited bet changes during the match at zero cost, while keeping the collateral fully on-chain and non-custodial.

---

## 🌐 Deployed Contracts (Sepolia Testnet)

| Contract                    | Address                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| GoalLiveBetting V1          | [`0x4434528dBbD8376BDDb7ca189B7e20cfe4b3c435`](https://sepolia.etherscan.io/address/0x4434528dBbD8376BDDb7ca189B7e20cfe4b3c435) |
| Chainlink KeystoneForwarder | `0x15fc6ae953e024d975e77382eeec56a9101f9f88`                                                                                    |
| USDC (Circle Sepolia)       | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`                                                                                    |
