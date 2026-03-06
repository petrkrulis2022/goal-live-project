# goal.live — Updated Application Flow

**Date:** March 6, 2026  
**Project:** goal.live Sports Betting Prediction Market  
**Network:** Sepolia Testnet → Mainnet  
**Contract:** `0x5E8Aa6C48008B787B432764A7943e07A68b3c098`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [What CRE Is and Is Not](#2-what-cre-is-and-is-not)
3. [Phase 1 — Admin Creates Match](#3-phase-1--admin-creates-match-pre-match)
4. [Phase 2 — User Deposits & Betting Window](#4-phase-2--user-deposits--betting-window)
5. [Phase 3 — Match Live](#5-phase-3--match-live-kickoff-to-final-whistle)
6. [Phase 4 — Settlement (Automatic via CRE Cron)](#6-phase-4--settlement-automatic-via-cre-cron)
7. [Phase 4b — Settlement (Admin-Initiated via Log Trigger)](#7-phase-4b--settlement-admin-initiated-via-log-trigger)
8. [Phase 4c — Emergency Settlement (Bypass CRE)](#8-phase-4c--emergency-settlement-bypass-cre)
9. [Phase 5 — User Withdraws from Match Pool](#9-phase-5--user-withdraws-from-match-pool)
10. [Phase 6 — Platform Fee Withdrawal](#10-phase-6--platform-fee-withdrawal)
11. [Complete User Journey (End-to-End)](#11-complete-user-journey-end-to-end)
12. [CRE Triggers Reference](#12-cre-triggers-reference)
13. [Smart Contract Functions Reference](#13-smart-contract-functions-reference)
14. [Data Sources Reference](#14-data-sources-reference)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GOAL.LIVE ECOSYSTEM                            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ EXTERNAL DATA SOURCES                                                   │
├─ Goalserve API    Live scores, FT status, goalscorer IDs, match events  │
└─ Goalserve Odds   Pre-match odds (1X2, NGS, O/U, corners, 100+ markets) │
└─────────────────────────────────────────────────────────────────────────┘
           ↓ (outbound HTTP calls from CRE and backend service)

┌─────────────────────────────────────────────────────────────────────────┐
│ CRE WORKFLOW  (Chainlink Decentralised Execution — goal-live-settlement) │
│                                                                         │
│  Trigger A: CRON  (every 60s)                                           │
│    └─ Polls Supabase + Goalserve → detects FT → writes onReport()       │
│                                                                         │
│  Trigger B: LOG  (SettlementRequested event)                            │
│    └─ Admin-initiated → immediate fetch → writes onReport()             │
│                                                                         │
│  Both triggers make OUTBOUND HTTP calls inside the workflow.            │
│  There are NO inbound HTTP triggers in this system.                     │
└─────────────────────────────────────────────────────────────────────────┘
           ↓ (EVM Write via Chainlink KeystoneForwarder)

┌─────────────────────────────────────────────────────────────────────────┐
│ SMART CONTRACT — GoalLiveBetting (Singleton, Sepolia)                   │
│ Address: 0x5E8Aa6C48008B787B432764A7943e07A68b3c098                    │
│                                                                         │
│  Admin functions (onlyOwner):                                           │
│  ├─ createMatch(matchId)         Register match, open for bets          │
│  ├─ fundPool(matchId, amount)    Seed liquidity pool from treasury      │
│  ├─ requestSettlement(matchId)   Emit event → fires Log Trigger B       │
│  ├─ emergencySettle(...)         Manual override (CRE bypass)           │
│  └─ withdrawFees(to)             Collect platform revenue               │
│                                                                         │
│  CRE entry point:                                                       │
│  └─ onReport(metadata, report)   Called by KeystoneForwarder            │
│       └─ _settleMatch(...)       Internal settlement logic              │
│                                                                         │
│  User functions:                                                        │
│  ├─ fundMatch(matchId, amount)         Deposit USDC for this match      │
│  └─ withdraw(matchId)                  Pull payout after settlement     │
│                                                                         │
│  Relayer functions (onlyRelayer — platform wallet, no user action):     │
│  ├─ recordBet(matchId, user, betType, selection, amount, isChange)      │
│  │    Async on-chain bet history commit (user-invisible, platform gas)  │
│  └─ settleUserBalances(matchId, users[], payouts[])                     │
│       Distribute final balances after CRE settles match result          │
│                                                                         │
│  Key events:                                                            │
│  ├─ MatchCreated(matchId, timestamp)                                    │
│  ├─ MatchFunded(matchId, user, amount)                                  │
│  ├─ BetRecorded(matchId, user, betType, selection, amount, isChange)    │
│  ├─ SettlementRequested(matchId, timestamp)                             │
│  ├─ MatchSettled(matchId, goalScorers[], winner, homeGoals, awayGoals)  │
│  ├─ BalancesDistributed(matchId, userCount, totalPaid, platformFees)    │
│  ├─ Withdrawn(matchId, user, amount)                                    │
│  └─ FeesWithdrawn(to, amount)                                           │
└─────────────────────────────────────────────────────────────────────────┘
           ↓ (events read by backend)   ↕ (REST queries)

┌───────────────────────────────┬─────────────────────────────────────────┐
│ SUPABASE (off-chain DB)       │ BACKEND SERVICE (Node.js / Edge Fn)     │
├─ matches                      │ ├─ Listens to contract events           │
├─ live_scores (Goalserve feed) │ ├─ Polls Goalserve every ~15s           │
└─ bet_history (mirror of bets) │ └─ Syncs status to Supabase            │
└───────────────────────────────┴─────────────────────────────────────────┘
           ↕ (reads)

┌─────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (React + Wagmi)                                                │
│ ├─ Match listing + live score  (from Supabase)                         │
│ ├─ Pre-match & live odds       (from Goalserve via backend)            │
│ ├─ Fund a match                (MetaMask: approve once + fundMatch)    │
│ ├─ Place / change bet          (Supabase only — instant, no MetaMask)  │
│ ├─ On-chain bet report         (betHistory[matchId][user] — read only) │
│ ├─ Withdraw payout             (MetaMask: withdraw(matchId))           │
│ └─ P&L dashboard               (matchBalance + Supabase bets)         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. What CRE Is and Is Not

**CRE (Chainlink Runtime Environment)** is a decentralised off-chain execution layer.  
It does NOT trigger when someone calls it over HTTP. Instead:

| Trigger type     | What fires it                      | Used in goal.live             |
| ---------------- | ---------------------------------- | ----------------------------- |
| **Cron trigger** | A clock schedule (e.g. every 60s)  | ✅ Settlement detection       |
| **Log trigger**  | A specific on-chain event          | ✅ Admin-requested settlement |
| HTTP trigger     | An external webhook call (inbound) | ❌ Not used                   |

Inside either trigger the workflow makes **outbound HTTP calls** to Goalserve and Supabase.  
This is different from an HTTP trigger — it is the workflow _calling out_, not being called.

**What CRE does NOT do:**

- It does not loop through user bet positions and resolve them one by one
- It does not push payouts to users automatically
- It does not display anything to users
- It is not a backend server

**What CRE does:**

- Decentralised HTTP consensus: multiple DON nodes each run the same fetch, results are aggregated (median for numbers, identical-match for strings)
- Produces a cryptographically signed report
- Writes that report on-chain via `onReport()` through the Chainlink KeystoneForwarder
- This effectively settles the match atomically: goalscorers recorded, final score stored, `MatchSettled` emitted

---

## 3. Phase 1 — Admin Creates Match (Pre-Match)

**Actor:** goal.live admin / backend service  
**Happens:** ~1 hour before kickoff

```
┌─────────────────────────────────────────────────────────────┐
│                   ADMIN CREATES MATCH                      │
└─────────────────────────────────────────────────────────────┘

1. Admin backend detects upcoming match
   ├─ Source: Goalserve scheduled fixtures feed
   ├─ Example: Wolves vs Liverpool, KO 20:00 UTC Mar 06 2026
   └─ Goalserve static_id: 3834276 (used for all subsequent queries)

2. Admin calls contract:
   └─ createMatch("goalserve:3834276")
        ├─ Registers match as isActive = true
        ├─ Emits: MatchCreated("goalserve:3834276", timestamp)
        └─ Reverts if already active

3. CRE Log Trigger (currently: MatchCreated listener):
   └─ Fires immediately on the MatchCreated event
        ├─ Logs: matchId hash + timestamp
        └─ Purpose: confirms CRE pipeline is awake for this match
           (this trigger will be repurposed to SettlementRequested — see Phase 4b)

4. Admin calls contract:
   └─ fundPool("goalserve:3834276", 10_000_000_000)   // e.g. 10,000 USDC (6 dec)
        ├─ USDC transferred from admin treasury to contract
        ├─ poolSize increases
        └─ This funds all possible winning payouts for this match

5. Admin backend saves match to Supabase:
   └─ matches table: { id, external_match_id, goalserve_static_id, status: "prematch" }

6. Admin backend fetches odds from Goalserve odds feed:
   ├─ URL: getfeed/{API}/getodds/soccer?cat=soccer_10&date_start=DD.MM.YYYY
   ├─ Available pre-match markets (100+ total), key ones:
   │    [1]  Match Winner (1X2)
   │    [2]  Home/Away (no draw)
   │    [4]  Asian Handicap
   │    [5]  Goals Over/Under
   │    [15] Both Teams To Score
   │    [81] Correct Score
   │    [222] Double Chance
   │    [22846] First Goal Scorer
   │    [22847] Last Goal Scorer
   │    [22627] Corners 1x2
   └─ Saves odds snapshot to Supabase: live_scores(type="prematch")

7. Frontend displays Match:
   ├─ Match visible in match listing
   ├─ Odds displayed from Supabase snapshot
   ├─ "Fund Match" button to deposit USDC (MetaMask)
   ├─ Bet buttons enabled after funding (Supabase — no MetaMask)
   └─ Status: "PRE-MATCH — Betting open"
```

---

## 4. Phase 2 — User Deposits & Betting Window

**Actor:** users via frontend + MetaMask wallet  
**Happens:** from match creation until match kickoff (top-up anytime during live)

### V1 Architecture: Match Pool + Supabase Bets

> **V1 Trust Model:** All individual bets are stored in Supabase — user trusts goal.live not to alter records before settlement. The on-chain match pool holds USDC in escrow — the platform cannot touch user deposits until CRE settles the match result. Final payouts are immutably written on-chain. **V2** (on an L2 where gas is ~$0.001/tx) will record every bet and change on-chain for full trustlessness.

---

### Bet Types Available

| Bet Type                   | Selection                    | Description                   |
| -------------------------- | ---------------------------- | ----------------------------- |
| **Next Goal Scorer (NGS)** | playerId (Goalserve integer) | Pick which player scores next |
| **Match Winner (MW)**      | HOME / DRAW / AWAY           | Final result                  |
| **Exact Goals (EG)**       | total goals (0, 1, 2, ...)   | Total goals in match          |

### Step 1: One-Time USDC Approval (once ever per wallet)

```
First time only — no USDC interaction until this is done:
MetaMask: USDC.approve(GoalLiveBetting contract, type(uint256).max)
└─ User signs once. Never asked again for any future match.
```

### Step 2: Fund a Match (MetaMask — once per match or per top-up)

```
User opens "Wolves vs Liverpool" and clicks "Fund this match — 300 USDC"

MetaMask: contract.fundMatch("goalserve:3834276", 300_000_000)
├─ USDC.transferFrom(user, contract, 300 USDC)
├─ matchBalance["goalserve:3834276"][user] += 300_000_000
├─ matchPool["goalserve:3834276"] += 300_000_000
└─ Emits: MatchFunded("goalserve:3834276", user, 300_000_000)

Result: 300 USDC locked in contract escrow for this match only.
Top-up anytime: call fundMatch again with additional amount.
```

### Step 3: Place Bets & Change Picks (Supabase — instant, no MetaMask)

```
User selects bet type → selects player/outcome → enters amount → clicks "Bet"

Frontend → POST /supabase/functions/lock-bet
{
  matchId: "goalserve:3834276",
  betType: "NGS",               // or "MW" or "EG"
  selection: "playerId:55001",  // or "AWAY" or "goals:2"
  amount: 50_000_000,           // 50 USDC in 6-decimal
  odds: 28_000                  // 2.80x in basis points
}

Supabase lock-bet Edge Function:
├─ Validates: user has sufficient remaining budget in Supabase ledger
├─ Inserts: bets table { userId, matchId, betType, selection, amount, odds, status: "active" }
├─ Deducts: user_match_ledger[matchId][user] -= 50 USDC
└─ Returns: { betId, status: "placed" }

User result: instant ✅ — no MetaMask pop-up, no block confirmation wait.

Changing an NGS pick (same instant flow):
├─ POST /lock-bet with { isChange: true, previousBetId, newSelection }
├─ Supabase marks old bet "changed", inserts new bet record
├─ Penalty (10–30% based on match minute) deducted from Supabase ledger
└─ No MetaMask required — instant change
```

### Step 4: Async On-Chain Bet History (background — user never sees this)

```
Seconds after each bet/change, platform relayer wallet submits:

contract.recordBet(
  "goalserve:3834276",   // matchId
  userAddress,           // user wallet
  0,                     // betType: 0=NGS, 1=MW, 2=EG
  keccak256("55001"),    // selection hash (playerId or outcome)
  50_000_000,            // amount
  false                  // isChange
)
├─ Appended to: betHistory["goalserve:3834276"][userAddress][]
└─ Emits: BetRecorded(matchId, user, betType, selection, amount, isChange)

Platform pays the gas. Completely invisible to user.
Purpose: Immutable on-chain audit trail of every bet and change.
Users can query betHistory[matchId][user][] to verify their history.
```

### Summary: MetaMask confirmations per match session

| Action                   | MetaMask?                      | Who pays gas? |
| ------------------------ | ------------------------------ | ------------- |
| USDC approve (once ever) | ✅ Yes — one time only         | User          |
| Fund match               | ✅ Yes — once per match        | User          |
| Place a bet              | ❌ No — Supabase instant       | —             |
| Change a pick            | ❌ No — Supabase instant       | —             |
| Top-up mid-match         | ✅ Yes — if running low        | User          |
| Withdraw payout          | ✅ Yes — once after settlement | User          |
| Record bet on-chain      | ❌ No — background relayer     | Platform      |

---

## 5. Phase 3 — Match Live (Kickoff to Final Whistle)

**Actor:** backend service (NOT CRE)  
**Happens:** every ~15 seconds during match

```
┌─────────────────────────────────────────────────────────────┐
│        BACKEND LIVE SCORE POLLING SERVICE                  │
│        (Regular Node.js/Edge Function — not CRE)           │
└─────────────────────────────────────────────────────────────┘

Every ~15 seconds:
1. HTTP → Goalserve livescores:
   GET getfeed/{API}/soccernew/home?json=1
   └─ Returns all live matches with current score, minute, status

2. Find our match by goalserve_static_id
   └─ { homeGoals: 1, awayGoals: 0, status: "46'", ... }

3. Update Supabase:
   └─ live_scores: { matchId, homeGoals, awayGoals, minute, updatedAt }

4. Frontend reads Supabase (realtime subscription or polling):
   └─ Displays: "Wolves 0 - 1 Liverpool  (46')"

5. Update match status in Supabase:
   ├─ "live" after kickoff
   ├─ "halftime" at HT
   └─ (FT detected by CRE cron, see Phase 4)

Note: The contract does NOT store live scores mid-match.
      Live score display is purely Supabase ↔ frontend.
      The contract only receives the FINAL score at settlement.
```

**What the frontend shows during live play:**

```
Live: Wolves 0 - 1 Liverpool  (46')

Your Active Bets:
├─ NGS: Salah @ 2.80   → ❓ PENDING (Salah has not scored yet)
├─ NGS: Mane  @ 4.50   → ❓ PENDING
└─ MW:  Liverpool @ 1.55 → ✅ WINNING (Liverpool winning 1-0)

[Change Pick] button visible on NGS bets until FT
```

---

## 6. Phase 4 — Settlement (Automatic via CRE Cron)

**Actor:** CRE Workflow — Cron Trigger  
**Frequency:** every 60 seconds  
**File:** `cre/goal-live/goal-live-settlement/main.ts`

This is the **primary settlement path** — fully automatic, no admin action needed.

```
┌─────────────────────────────────────────────────────────────┐
│              CRE CRON TRIGGER (every 60s)                  │
│                                                             │
│  DON nodes each independently run the same logic,          │
│  results are aggregated via consensus before writing.      │
└─────────────────────────────────────────────────────────────┘

Each cycle:

Step 1 — HTTP → Supabase (which matches to check):
  GET https://weryswulejhjkrmervnf.supabase.co/rest/v1/matches
      ?status=in.(live,halftime)
      &select=id,external_match_id,goalserve_static_id,contract_address
  └─ Returns: [{ external_match_id: "goalserve:3834276", goalserve_static_id: "3834276", ... }]
  └─ If empty → return "no-op", job done for this cycle

Step 2 — HTTP → Goalserve livescores feed:
  GET getfeed/{API}/soccernew/home?json=1
  └─ Scans all matches looking for status = "FT" or "AET" or "After ET"
  └─ Cross-references against Supabase match list by static_id
  └─ If no FT match found → return "no-op"

Step 3 — HTTP → Goalserve commentary (goalscorer IDs):
  GET getfeed/{API}/commentaries/match?id={static_id}&league={leagueId}&json=1
  └─ Extracts player IDs who scored (excludes own goals, based on @type)
  └─ scorerIdsStr = "12345,67890" (comma-separated Goalserve integer player IDs)

Step 4 — Consensus aggregation (DON nodes):
  ├─ found:            median (0 or 1)
  ├─ externalMatchId:  identical (must match exactly across nodes)
  ├─ winner:           median (0=HOME, 1=DRAW, 2=AWAY)
  ├─ homeGoals:        median
  ├─ awayGoals:        median
  ├─ scorerIdsStr:     identical (same scorer list across nodes)
  └─ contractAddress:  identical

Step 5 — Encode settlement payload:
  reportData = abi.encode(
    matchId: "goalserve:3834276",
    goalScorers: [12345, 67890],   // uint256[] of Goalserve player IDs
    winner: 2,                      // AWAY (Liverpool won)
    homeGoals: 0,
    awayGoals: 2
  )

Step 6 — Generate signed CRE report:
  runtime.report({ encodedPayload, encoderName: "evm", signingAlgo: "ecdsa" })

Step 7 — EVM Write:
  evmClient.writeReport({
    receiver: "0x5E8Aa6C48008B787B432764A7943e07A68b3c098",
    report: signedReport,
    gasLimit: "800000"
  })
  └─ This calls: KeystoneForwarder.forward() → GoalLiveBetting.onReport()

Step 8 — Contract execution (onReport):
  ├─ Verifies caller = keystoneForwarder
  ├─ Decodes report: (matchId, goalScorers[], winner, homeGoals, awayGoals)
  └─ Calls _settleMatch():
       ├─ Marks goalScorers[i] = true in matches[matchId].goalScorers mapping
       ├─ Sets: finalOutcome, homeGoals, awayGoals, isSettled = true, isActive = false
       └─ Emits: MatchSettled("goalserve:3834276", [12345,67890], 2, 0, 2)

Step 9 — CRE logs txHash, returns it as result

Backend (watching MatchSettled event):
  └─ Updates Supabase: matches.status = "settled"
  └─ Frontend shows: "Match settled — calculating your balance..."
```

Step 10 — Platform relayer calls settleUserBalances (~2–3s after CRE):

```
Backend detects MatchSettled event, reads all bets from Supabase for this matchId:

  For each user who funded this match:
  ├─ Fetch: all bets from Supabase where matchId = "goalserve:3834276" AND user = X
  ├─ Fetch: matchBalance[matchId][user] (how much they deposited on-chain)
  ├─ Compute P&L:
  │    wonBets:    sum(amount × odds / 10_000) for bets where selection matched result
  │    lostBets:   sum(amount) for bets where selection did not match
  │    penalties:  sum(changeAmounts) already deducted in Supabase ledger
  │    platformFee: 2% of gross winnings
  │    finalBalance = deposit - lostBets - penalties + netWinnings
  └─ finalBalance capped at 0 minimum (cannot go negative)

Relayer calls:
  contract.settleUserBalances(
    "goalserve:3834276",
    [alice, bob, carol, ...],       // users who funded this match
    [162_000_000, 0, 95_000_000]    // final balances in USDC wei
  )
  ├─ Sets matchBalance[matchId][user] = finalBalance for each user
  └─ Emits: BalancesDistributed(matchId, userCount, totalPaid, platformFees)

Supabase updated: matches.payout_status = "ready_to_withdraw"
Frontend: "Your balance is ready — withdraw anytime [Withdraw]"
```

**Outcome:** Match is fully settled on-chain. User balances have been computed from Supabase bets  
and written back on-chain. Users call `withdraw(matchId)` to receive their USDC (Phase 5).

---

## 7. Phase 4b — Settlement (Admin-Initiated via Log Trigger)

**Actor:** CRE Workflow — Log Trigger  
**Fires:** immediately when admin calls `requestSettlement(matchId)` on-chain  
**Use case:** CRE cron hasn't fired yet (up to 60s wait), admin wants instant settlement

> **Note:** The `requestSettlement()` function and the Log Trigger watching `SettlementRequested` are the next planned addition to the contract and CRE workflow. The current log trigger watches `MatchCreated` and only logs it.

```
┌─────────────────────────────────────────────────────────────┐
│           ADMIN-INITIATED SETTLEMENT PATH                  │
└─────────────────────────────────────────────────────────────┘

1. Admin (after confirming match is FT on Goalserve dashboard) calls:
   requestSettlement("goalserve:3834276")
   ├─ Contract verifies: isActive = true, isSettled = false
   └─ Emits: SettlementRequested("goalserve:3834276", timestamp)

2. CRE Log Trigger fires IMMEDIATELY on SettlementRequested event:
   ├─ Event data: matchId extracted from topics[1]
   └─ Runs SAME logic as cron (Steps 2–9 above):
        HTTP → Goalserve /soccernew/home  (confirm FT)
        HTTP → Goalserve /commentaries    (get scorer IDs)
        Encode payload → sign → writeReport → onReport()

3. Result: Match settled within ~2 seconds of admin action

When to use this path vs cron:
├─ Cron: default, zero admin effort, up to 60s after FT
└─ Log trigger: when you want instant settlement (e.g. high activity,
                busy match, or cron cycle happened just before FT)
```

Both paths call the same `onReport()` → `_settleMatch()` code.  
The contract has `require(!m.isSettled)` so if cron fires first, `requestSettlement()` call is harmless (the `SettlementRequested` event fires but CRE's `onReport()` call will revert on `"GLB: already settled"`).

---

## 8. Phase 4c — Emergency Settlement (Bypass CRE)

**Actor:** goal.live admin  
**Use case:** Goalserve API is down, CRE unreachable, dispute requires manual input

```
Admin has confirmed final score and scorers from official sources, calls:

contract.emergencySettle(
  "goalserve:3834276",
  [12345, 67890],     // goalscorer playerIds
  MatchOutcome.AWAY,  // Liverpool won
  0,                  // homeGoals
  2                   // awayGoals
)

├─ Callable by onlyOwner (admin multisig)
├─ Same internal _settleMatch() logic as onReport path
└─ Emits: MatchSettled (identical to CRE path)

Use only when CRE has not settled within ~15 minutes of FT.
```

---

## 9. Phase 5 — User Withdraws from Match Pool

**Actor:** users, self-initiated  
**Model:** Pull (user withdraws final balance) — one transaction per match

After `settleUserBalances()` completes, the user's final USDC balance for the match is ready on-chain.
Frontend shows: "Your balance for this match: X USDC — [Withdraw]"

```
User clicks "Withdraw from Match A"

MetaMask: contract.withdraw("goalserve:3834276")
├─ Reads: matchBalance["goalserve:3834276"][user]  (set by settleUserBalances)
├─ Requires: balance > 0
├─ USDC.transfer(user, matchBalance[matchId][user])
├─ Sets: matchBalance[matchId][user] = 0
└─ Emits: Withdrawn(matchId, user, amount)

Frontend: "✅ X USDC returned to your wallet"
```

**Example outcomes:**

```
Alice deposited 300 USDC for Wolves vs Liverpool
  Won: MW Liverpool @ 1.55 on 200 USDC → +110 USDC net win
  Won: NGS Diaz @ 2.80 on 45 USDC (after 10% change penalty) → +81 USDC net win
  Lost: 55 USDC remaining bets
  Platform fee: 2% of gross wins
  finalBalance = 300 - 55 + 191*(1-0.02) = ~372 USDC
  Alice receives: ~372 USDC → profit of +72 USDC on 300 deposited

Bob deposited 100 USDC for Wolves vs Liverpool
  All bets lost
  finalBalance = 0
  Bob receives: 0 USDC
  (100 USDC stays in contract → collectedFees for platform)

Carol deposited 50 USDC but placed no bets
  finalBalance = 50 USDC (full refund)
  Carol receives: 50 USDC
```

---

## 10. Phase 6 — Platform Fee Withdrawal

**Actor:** goal.live admin  
**Timing:** Any time (no time constraint, accumulates across all matches)

```
collectedFees accumulates from:
├─ Difference between user deposits and total payouts per match
├─ 2% platform fee on all winning payouts (deducted at settleUserBalances)
└─ Funded from losing stakes staying in contract pool

Admin calls:
contract.withdrawFees(platformTreasuryAddress)
├─ Transfers entire collectedFees balance to treasury
├─ Resets collectedFees = 0
└─ Emits: FeesWithdrawn(to, amount)
```

---

## 11. Complete User Journey (End-to-End)

**Example match:** Wolves vs Liverpool, March 6, 2026 20:00 UTC

```
T−60min: ADMIN SETUP
├─ Admin calls createMatch("goalserve:3834276")
├─ Admin calls fundPool("goalserve:3834276", 50_000 USDC)  (platform liquidity seed)
├─ Backend saves to Supabase, fetches odds from Goalserve
└─ Frontend shows: "Wolves vs Liverpool — Betting open"

T−55min: USER ALICE SETS UP (first time ever)
└─ MetaMask: USDC.approve(contract, MAX_UINT)   ← once, never again

T−40min: ALICE FUNDS MATCH A
└─ MetaMask: contract.fundMatch("goalserve:3834276", 300_000_000)
     = 300 USDC locked in contract for this match

T−38min: ALICE PLACES BETS (Supabase — instant, no MetaMask)
├─ MW: Liverpool to win @ 1.55 — 200 USDC
└─ NGS: Salah to score @ 2.80 — 50 USDC
     Supabase ledger: 300 - 200 - 50 = 50 USDC remaining

T−15min: USER BOB FUNDS & BETS
├─ MetaMask: contract.fundMatch("goalserve:3834276", 100_000_000)
└─ Supabase: NGS: Wolves striker @ 1.90 — 100 USDC

T−12min: RELAYER COMMITS BETS ON-CHAIN (background)
├─ contract.recordBet(matchId, alice, 1, hash("AWAY"), 200, false)  [MW bet]
├─ contract.recordBet(matchId, alice, 0, hash("55001"), 50, false) [NGS Salah]
└─ contract.recordBet(matchId, bob, 0, hash("44332"), 100, false)  [NGS Wolves]
     Immutable on-chain audit trail established.

T=0: KICKOFF — Backend starts 15s polling
└─ Supabase live_scores updated every 15s via Goalserve feed

T=31min: ALICE CHANGES NGS PICK (Supabase — instant)
├─ Alice switches from Salah to Diaz
├─ Supabase: old bet status="changed", new bet { Diaz, 45 USDC (10% penalty applied) }
└─ Relayer (background): contract.recordBet(matchId, alice, 0, hash("Diaz"), 45, true)

T=67min: LIVERPOOL SCORE (Diaz, 67')
├─ Goalserve feed: score 0-2, Diaz scored
└─ Supabase updated, frontend: "Wolves 0 - 2 Liverpool (67')" — 2 goals

T=90min: FULL TIME
└─ CRE cron fires within next 60s...

T=91min: CRE SETTLES MATCH RESULT ON-CHAIN
├─ Goalserve /home → status="FT", score 0-2
├─ Goalserve /commentaries → scorers: [Diaz (44444)]
├─ DON consensus → writeReport → onReport → _settleMatch
└─ MatchSettled emitted: scorers=[44444], winner=AWAY, home=0, away=2

T=91min+3s: RELAYER DISTRIBUTES BALANCES
├─ Backend reads Supabase bets for "goalserve:3834276"
├─ Computes per user:
│    Alice: MW AWAY ✓ win (200×1.55=310 gross, -6.20 fee = 303.80)
│          + NGS Diaz ✓ win (45×2.80=126 gross, -2.52 fee = 123.48)
│          │ Total won: 427.28 + remaining 50 USDC unbet → finalBalance: ~477 USDC
│    Bob:  NGS Wolves striker ✕ lost → finalBalance: 0
└─ contract.settleUserBalances(matchId, [alice, bob], [477_000_000, 0])
     BalancesDistributed emitted.
     Frontend: "Your match is settled — [Withdraw]"

T=92min: ALICE WITHDRAWS
├─ MetaMask: contract.withdraw("goalserve:3834276")
├─ 477 USDC transferred to Alice's wallet
└─ Profit: +177 USDC on 300 deposited

T=92min: BOB (optional withdraw call)
├─ MetaMask: contract.withdraw("goalserve:3834276")
└─ 0 USDC returned (all lost)

T=next week: ADMIN WITHDRAWS PLATFORM REVENUE
└─ withdrawFees(treasuryAddress)
     = Alice's platform fees (8.72) + Bob's losing stake (100) = 108.72 USDC
```

---

## 12. CRE Triggers Reference

### Trigger A: Cron Trigger

```yaml
type: cron
schedule: "*/60 * * * * *"   # every 60 seconds
file: cre/goal-live/goal-live-settlement/main.ts
handler: onCronTrigger

Outbound HTTP calls made inside:
  1. GET Supabase /matches?status=in.(live,halftime)
  2. GET Goalserve /soccernew/home?json=1
  3. GET Goalserve /commentaries/match?id=...&league=...&json=1

EVM Write:
  KeystoneForwarder → GoalLiveBetting.onReport()
  Contract: 0x5E8Aa6C48008B787B432764A7943e07A68b3c098  (Sepolia)
  Gas limit: 800,000

Result values:
  "no-op"    → no live matches or no FT found this cycle
  "0x..."    → txHash of successful settlement
```

### Trigger B: Log Trigger (admin-initiated, next addition)

```yaml
type: evmLog
event: SettlementRequested(string indexed matchId, uint256 timestamp)
contract: 0x5E8Aa6C48008B787B432764A7943e07A68b3c098
handler: onLogTrigger

Fires: immediately when admin calls requestSettlement(matchId) on-chain

Outbound HTTP calls: 1. GET Goalserve /soccernew/home?json=1   (confirm FT)
  2. GET Goalserve /commentaries/match      (scorer IDs)

EVM Write: Same onReport() path as cron trigger
```

### Current Log Trigger (MatchCreated — diagnostic only)

```yaml
type: evmLog
event: MatchCreated(string indexed matchId, uint256 timestamp)
handler: onLogTrigger (current)

Purpose: Fires when admin runs createMatch() — logs matchId hash to confirm
  CRE DON is alive and monitoring the contract.
Action: No EVM write. Returns matchId hash as string.
```

---

## 13. Smart Contract Functions Reference

| Function                                                      | Caller                 | Purpose                                         |
| ------------------------------------------------------------- | ---------------------- | ----------------------------------------------- |
| `createMatch(matchId)`                                        | Admin (onlyOwner)      | Register match, open for deposits               |
| `fundPool(matchId, amount)`                                   | Admin (onlyOwner)      | Seed platform liquidity for match               |
| `requestSettlement(matchId)`                                  | Admin (onlyOwner)      | Emit SettlementRequested → fires Log Trigger B  |
| `emergencySettle(...)`                                        | Admin (onlyOwner)      | Manual settlement bypassing CRE                 |
| `onReport(metadata, report)`                                  | KeystoneForwarder only | CRE settlement entry (match result only)        |
| `setKeystoneForwarder(addr)`                                  | Admin (onlyOwner)      | Update CRE forwarder address                    |
| `withdrawFees(to)`                                            | Admin (onlyOwner)      | Collect platform revenue (fees + losing stakes) |
| `fundMatch(matchId, amount)`                                  | User                   | Deposit USDC into match pool (MetaMask)         |
| `withdraw(matchId)`                                           | User                   | Pull final payout after settlement              |
| `recordBet(matchId, user, type, selection, amount, isChange)` | Relayer (onlyRelayer)  | Async on-chain bet history commit               |
| `settleUserBalances(matchId, users[], payouts[])`             | Relayer (onlyRelayer)  | Distribute final balances after CRE settles     |

**Key contract constants:**

```
platformFeeRate  = 200 bp  (2%)   deducted from winnings at settleUserBalances

Bet change penalty tiers: tracked in Supabase in V1; enforced on-chain in V2
```

**Key contract state (V1 storage model):**

```solidity
// Match pool balances
mapping(string => mapping(address => uint)) public matchBalance;   // [matchId][user]
mapping(string => uint)                      public matchPool;      // total per match

// On-chain audit trail (async, relayer-written)
struct BetRecord {
    uint8   betType;      // 0=NGS, 1=MW, 2=EG
    bytes32 selection;    // keccak256 of playerId or outcome
    uint    amount;
    uint    timestamp;
    bool    isChange;
}
mapping(string => mapping(address => BetRecord[])) public betHistory;  // [matchId][user]

// Settlement result
mapping(string => mapping(address => bool)) public hasWithdrawn;  // [matchId][user]
```

---

## 14. Data Sources Reference

### Goalserve API (primary data source)

| Feed           | URL pattern                                            | Used for                                  |
| -------------- | ------------------------------------------------------ | ----------------------------------------- |
| Live scores    | `soccernew/home?json=1`                                | CRE: detect FT status, live score display |
| Commentary     | `commentaries/match?id={id}&league={lid}&json=1`       | CRE: extract goal scorer IDs              |
| Inplay mapping | `soccernew/inplay-mapping?json=1`                      | Map pregame IDs ↔ live feed IDs           |
| Pre-match odds | `getodds/soccer?cat=soccer_10&date_start={dd.mm.yyyy}` | Display pre-match odds in UI              |

**Goalserve key market IDs (from odds feed):**

| ID    | Market              |
| ----- | ------------------- |
| 1     | Match Winner (1X2)  |
| 4     | Asian Handicap      |
| 5     | Goals Over/Under    |
| 15    | Both Teams To Score |
| 81    | Correct Score       |
| 222   | Double Chance       |
| 22846 | First Goal Scorer   |
| 22847 | Last Goal Scorer    |
| 22627 | Corners 1X2         |
| 22644 | Corners Over/Under  |

### Supabase (off-chain DB)

| Table               | Used by                          | Contains                                                       |
| ------------------- | -------------------------------- | -------------------------------------------------------------- |
| `matches`           | CRE cron, backend, frontend      | Match list, `goalserve_static_id`, `status`, `payout_status`   |
| `live_scores`       | Backend (write), frontend (read) | Score snapshots every ~15s                                     |
| `bets`              | lock-bet Edge Fn, frontend       | All user bets and changes — authoritative V1 source            |
| `user_match_ledger` | lock-bet Edge Fn                 | Available budget per user per match (mirrors on-chain deposit) |

### What lives on-chain vs off-chain

| Data                                   | Lives on-chain                                    | Lives in Supabase           |
| -------------------------------------- | ------------------------------------------------- | --------------------------- |
| User USDC deposit per match            | ✅ `matchBalance[matchId][user]`                  | Supabase ledger mirror      |
| Bet placement & changes (V1)           | ❌ Not at bet time — V1 trust model               | ✅ Authoritative source     |
| Bet history audit trail                | ✅ `betHistory[matchId][user][]` (relayer, async) | Source data                 |
| Final user payout (post-settlement)    | ✅ `matchBalance[matchId][user]` (after settle)   | `payout_status` flag        |
| Match result (final score, scorers)    | ✅ `matches[matchId]` mapping (via CRE)           | Status flag only            |
| Live score mid-match                   | ❌ Not stored on-chain                            | ✅ Updated every ~15s       |
| Odds                                   | ❌ Not stored on-chain                            | ✅ Snapshots from Goalserve |
| V2: Per-bet on-chain (future, L2 only) | ✅ Every bet locked + changed on-chain            | Mirror only                 |
| Platform fees                          | ✅ `collectedFees`                                | ❌                          |
