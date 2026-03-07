# goal.live Application Flow: Complete User & Platform Architecture

**Date:** March 5, 2026  
**Project:** goal.live Sports Betting Prediction Market  
**Network:** Sepolia Testnet + Mainnet  
**Duration:** From pre-match odds capture to automatic user P&L resolution

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Phase 1: Pre-Match (1 hour before kickoff)](#phase-1-pre-match-1-hour-before-kickoff)
3. [Phase 2: User Betting Window](#phase-2-user-betting-window)
4. [Phase 3: Match Live (Kickoff to Final Whistle)](#phase-3-match-live-kickoff-to-final-whistle)
5. [Phase 4: Post-Match Settlement & Automatic Resolution](#phase-4-post-match-settlement--automatic-resolution)
6. [Complete User Journey](#complete-user-journey)
7. [HTTP Triggers Deep Dive](#http-triggers-deep-dive)
8. [Log Triggers Deep Dive](#log-triggers-deep-dive)
9. [CRE Workflow Orchestration](#cre-workflow-orchestration)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        GOAL.LIVE ECOSYSTEM                              │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ EXTERNAL DATA SOURCES (Real, No Simulation)                             │
├─ The Odds API           (Real bookmaker odds: H/D/A, goalscorer, etc.)  │
├─ Goalserve API          (Real live scores, goalscorers, match events)   │
└─ ESPN/Stats API         (Real match statistics)                         │
└─────────────────────────────────────────────────────────────────────────┘

                            ↓ (HTTP Requests)

┌─────────────────────────────────────────────────────────────────────────┐
│ CRE JOBS (Chainlink Functions - Automated Workflows)                   │
├─ HTTP Job #1: Pre-Match Odds Capture                                   │
├─ HTTP Job #2: Live Odds & Score Polling (Every 15 seconds)            │
├─ HTTP Job #3: Final Settlement Detection                               │
└─ Log Trigger Job #4: Automatic User Resolution (Event-driven)          │
└─────────────────────────────────────────────────────────────────────────┘

                            ↓ (Function calls)

┌─────────────────────────────────────────────────────────────────────────┐
│ SMART CONTRACT (Singleton - Sepolia)                                    │
│ Address: 0xF553228655C6993Bbd446E5B7009Dd830c424EA2                    │
├─ createMatch() - Called by HTTP Job #1                                  │
├─ recordLiveOdds() - Called by HTTP Job #2                               │
├─ settleMatch() - Called by HTTP Job #3                                  │
├─ resolveUserPosition() - Called by Log Trigger Job #4                   │
├─ placeUserPosition() - Called directly by user (frontend)               │
└─────────────────────────────────────────────────────────────────────────┘

                    ↓ (Events)    ↓ (Read/Write)

┌────────────────────────────┬──────────────────────────────────────────┐
│ SUPABASE (Database)        │ FRONTEND (React/Next.js UI)              │
├─ matches table            │ ├─ Match listing                          │
├─ user_positions table     │ ├─ Place bets                             │
├─ user_balances table      │ ├─ View odds (updates every 15s)         │
├─ live_odds table          │ ├─ Bet history                           │
└─ payout_history table     │ └─ Realized P&L dashboard                │
┴────────────────────────────┴──────────────────────────────────────────┘
```

---

## Phase 1: Pre-Match (1 hour before kickoff)

### T-60 min: Match Scheduled, Odds Available

**What happens:**

1. **Backend discovers upcoming match** (from sports API, manual input, or Supabase schedule)
   - Match: Manchester City vs Newcastle
   - Kickoff time: 20:00 UTC
   - Match ID: `man-city-vs-newcastle-21-feb-2026`

2. **HTTP Job #1 is triggered** (scheduled on the hour, every hour)

   ```
   name: goal-live-capture-prematch-odds
   schedule: "0 * * * *"  (every hour)
   ```

3. **Job #1 execution (runs on CRE infrastructure):**

```
┌─────────────────────────────────────────────────────────────┐
│                  HTTP JOB #1                               │
│           Pre-Match Odds Capture                           │
│                                                             │
│  1. Query backend for matches kicking off in ~1 hour       │
│  2. For each match:                                        │
│     ├─ Fetch H/D/A odds from The Odds API                 │
│     ├─ Fetch first goalscorer odds (all players)          │
│     ├─ Fetch exact goals odds (1 goal, 2 goals, etc.)     │
│     └─ Send to backend → contract.createMatch()           │
│  3. Contract stores on-chain:                              │
│     ├─ matches[matchIdHash]                               │
│     ├─ preMatchOdds_home = 1.52                           │
│     ├─ preMatchOdds_draw = 4.20                           │
│     ├─ preMatchOdds_away = 6.50                           │
│     ├─ preMatchOdds_firstGoalscorer = {...}  (JSON)        │
│     └─ preMatchOdds_exactGoals = {...}  (JSON)             │
│  4. Backend saves to Supabase:                             │
│     ├─ matches table                                       │
│     └─ live_odds table (snapshot)                          │
│                                                             │
│  Result: Match visible in UI with odds                     │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow (Pre-Match)

```
The Odds API (Real)
├─ Home: 1.52
├─ Draw: 4.20
├─ Away: 6.50
└─ Goalscorer: {
     "Erling Haaland": 1.52,
     "Phil Foden": 2.8,
     "Jack Grealish": 3.2,
     "Alexander Isak": 3.5
   }

        ↓ (HTTP Request via CRE)

HTTP Job #1 (CRE)
├─ Fetches odds
├─ Validates data
└─ Prepares transaction

        ↓ (Contract Call)

Singleton Contract
├─ createMatch(matchId, odds)
├─ Stores: matches[matchIdHash] = Match struct
└─ Event: MatchCreated(matchId)

        ↓ (Backend notification)

Supabase
├─ Insert matches table
├─ Insert live_odds snapshot
└─ Status: PREMATCH

        ↓ (Real-time sync)

Frontend (React)
├─ Query Supabase for matches
├─ Display odds
├─ Enable betting UI
└─ Users see: "Place your bets"
```

---

## Phase 2: User Betting Window

### T-45 min to T+5 min: Users Place Bets

**Platforms involved:**

- **Frontend:** React/Next.js UI
- **Smart Contract:** Receives user bets via user's wallet (MetaMask, etc.)
- **Supabase:** Stores user position data

### User Places Bet (Example)

**User (Player) Action:**

```
Frontend UI:
├─ Browse matches
├─ See odds for Manchester City vs Newcastle
├─ Select bet type: "First Goalscorer"
├─ Select player: "Erling Haaland"
├─ Select amount: 100 USDC
├─ Click "Place Bet"

MetaMask popup:
├─ Shows contract call: placeUserPosition()
├─ Shows: matchId, outcome, amount, odds
└─ User clicks "Confirm"

Transaction sent to contract:
├─ Function: contract.placeUserPosition(
│    matchId: "man-city-vs-newcastle",
│    outcomeType: "first_goalscorer",
│    outcome: "Erling Haaland",
│    amount: 100,
│    odds: 1.52
│  )
└─ Contract receives 100 USDC (escrow)

Contract stores:
├─ userPositions[userAddress][matchId] = {
│    userId: userAddress,
│    matchId,
│    outcomeType: "first_goalscorer",
│    outcome: "Erling Haaland",
│    amountWagered: 100,
│    odds: 1.52,
│    resolved: false,
│    placedAt: blockTimestamp
│  }
└─ Event: UserPositionCreated(userAddress, matchId, 100, 1.52)

Backend receives event:
├─ Listens to UserPositionCreated event
├─ Stores in Supabase: user_positions table
│    {
│      userId: userAddress,
│      matchId,
│      outcome: "Erling Haaland",
│      amountWagered: 100,
│      odds: 1.52,
│      resolved: false
│    }
└─ Updates user balance (deducts 100 from available)

Frontend updates:
├─ Shows: "Bet placed! ✅"
├─ Displays bet: "Haaland scores first @ 1.52 odds, $100 wagered"
├─ Updates user balance: was $500, now $400 (in escrow)
└─ User sees bet in "Active Bets" section
```

**Multiple users can place bets simultaneously:**

```
User A: Bet "City wins" @ 1.35, 200 USDC
User B: Bet "First scorer = Haaland" @ 1.52, 100 USDC
User C: Bet "Draw" @ 4.20, 50 USDC
User D: Bet "Exact goals = 3" @ 4.50, 75 USDC
User E: Bet "Second scorer = Foden" @ 2.8, 150 USDC
...and so on
```

### Contract State After Bets (Pre-Match)

```
matches[man-city-vs-newcastle] = {
  matchId: "man-city-vs-newcastle",
  homeTeam: "Manchester City",
  awayTeam: "Newcastle United",
  kickoffTime: 1708453200,
  preMatchOdds_home: 1.52,
  preMatchOdds_draw: 4.20,
  preMatchOdds_away: 6.50,
  preMatchOdds_firstGoalscorer: JSON,
  preMatchOdds_exactGoals: JSON,

  isLive: false,
  homeGoals: 0,
  awayGoals: 0,

  isSettled: false
}

userPositions[User A][man-city-vs-newcastle] = [
  { outcomeType: "home", outcome: "City", odds: 1.35, amountWagered: 200, resolved: false },
  { outcomeType: "home", outcome: "City", odds: 1.35, amountWagered: 100, resolved: false }
]

userPositions[User B][man-city-vs-newcastle] = [
  { outcomeType: "first_goalscorer", outcome: "Haaland", odds: 1.52, amountWagered: 100, resolved: false }
]

userPositions[User C][man-city-vs-newcastle] = [
  { outcomeType: "draw", outcome: "Draw", odds: 4.20, amountWagered: 50, resolved: false }
]
```

---

## Phase 3: Match Live (Kickoff to Final Whistle)

### T=0 (20:00 UTC): Match Starts

**What happens:**

1. **HTTP Job #2 starts firing** (every 15 seconds)

   ```
   name: goal-live-capture-live-odds
   schedule: "*/15 09-22 * * *"  (every 15 seconds, 9am-10pm UTC)
   ```

2. **Every 15 seconds for the next 90+ minutes:**

```
┌─────────────────────────────────────────────────────────────┐
│                  HTTP JOB #2                               │
│          Live Odds & Score Polling                         │
│         (Runs ~240 times per 60-min match)                 │
│                                                             │
│  1. Get all ACTIVE matches                                 │
│  2. For each active match:                                 │
│     ├─ Fetch live score from Goalserve                     │
│     │  └─ homeGoals: 1, awayGoals: 0, minute: 15          │
│     ├─ Fetch live odds from The Odds API                   │
│     │  └─ H/D/A, updated goalscorer odds                   │
│     ├─ Call contract.recordLiveOdds()                      │
│     │  └─ Store: homeGoals, awayGoals, lastUpdate         │
│     └─ Check if match finished                             │
│        └─ If status = MATCH_ENDED → stop polling          │
│  3. Store snapshot in Supabase: live_odds table            │
│     ├─ timestamp                                           │
│     ├─ score: { home: 1, away: 0 }                         │
│     ├─ odds: { home: 1.25, draw: 7.5, away: 25.0 }       │
│     └─ goalscorer odds (updated)                           │
│  4. Emit contract event: LiveOddsRecorded()                │
│                                                             │
│  Result: UI refreshed every 15 seconds                     │
└─────────────────────────────────────────────────────────────┘
```

### Timeline During Match

```
Minute 0 (Kickoff)
├─ Score: 0-0
├─ H/D/A odds: 1.65 | 4.20 | 6.50
└─ First Goalscorer: Haaland 2.10, Foden 4.50, Isak 8.00

        ↓ Poll every 15 seconds

Minute 15 (Haaland scores @ 12')
├─ Score: 1-0
├─ H/D/A odds: 1.25 | 7.50 | 25.00  (City much more likely now)
├─ First Goalscorer market CLOSES (Haaland already scored)
├─ Second Goalscorer market OPENS: Foden 2.20, Grealish 3.80, Isak 15.0
└─ Exact Goals: 1 goal 3.20, 2 goals 2.10, 3 goals 4.50

        ↓ Poll every 15 seconds

Minute 30
├─ Score: 1-0 (no new goals)
├─ H/D/A odds: 1.20 | 8.50 | 30.00
└─ All odds unchanged (no new events)

        ↓ Poll every 15 seconds

Minute 45 (Foden scores @ 34')
├─ Score: 2-0
├─ H/D/A odds: 1.08 | 15.00 | 50.00
├─ Second Goalscorer market CLOSES (Foden already scored)
├─ Third Goalscorer market OPENS: Grealish 1.90, Stones 8.00, Isak 25.0
└─ Exact Goals: 2 goals 3.80, 3 goals 2.20, 4 goals 5.50

        ↓ Poll every 15 seconds continuing...

Minute 60 (No new goals)
├─ Score: 2-0
├─ H/D/A odds: 1.06 | 18.00 | 60.00
└─ Waiting for more goals...

        ↓ Poll every 15 seconds continuing...

Minute 75 (Grealish scores @ 67')
├─ Score: 3-0
├─ H/D/A odds: 1.02 | 25.00 | 100.00
├─ Third Goalscorer market CLOSES
├─ Fourth Goalscorer market OPENS (if supported)
└─ Exact Goals: 3 goals 4.50, 4 goals 2.10, 5 goals 8.00

Full Time (90+ minutes)
├─ Final Score: 3-1 (Isak scored for Newcastle @ 55')
└─ Status: MATCH_ENDED (HTTP Job #2 detects this)
```

### Data Continuously Updated in Supabase

```
live_odds table (inserted every 15 seconds):
├─ matchId | timestamp           | homeGoals | awayGoals | odds_json
├─ man-... | 2026-02-21T20:00:00Z| 0         | 0         | {h:1.65, d:4.2, a:6.5}
├─ man-... | 2026-02-21T20:00:15Z| 0         | 0         | {h:1.65, d:4.2, a:6.5}
├─ man-... | 2026-02-21T20:00:30Z| 0         | 0         | {h:1.65, d:4.2, a:6.5}
├─ man-... | 2026-02-21T20:00:45Z| 1         | 0         | {h:1.25, d:7.5, a:25}  ← Haaland scored!
├─ man-... | 2026-02-21T20:01:00Z| 1         | 0         | {h:1.25, d:7.5, a:25}
└─ man-... | 2026-02-21T20:00:00Z| ...       | ...       | ...
     (continues every 15 seconds)
```

### Frontend Updates in Real-Time

**User sees on their screen (updates every 15 seconds):**

```
Live Match: Man City 1 - 0 Newcastle (12')

Live Odds:
├─ Home Win: 1.25 ↓ (was 1.65)
├─ Draw: 7.50 ↑ (was 4.20)
└─ Away Win: 25.00 ↑ (was 6.50)

Goal Scorers:
├─ First Goalscorer [CLOSED]: Erling Haaland ✅
├─ Second Goalscorer [LIVE]:
│  ├─ Phil Foden: 2.20
│  ├─ Jack Grealish: 3.80
│  └─ Alexander Isak: 15.00
└─ Exact Goals:
   ├─ 1 Goal: 3.20 ✓ (possible now)
   ├─ 2 Goals: 2.10
   ├─ 3 Goals: 4.50
   └─ 4+ Goals: 5.50

Your Active Bets:
├─ ✅ WINNING: First Scorer = Haaland @ 1.52 (potential +$52)
├─ ❓ PENDING: City Wins @ 1.35 (could still WIN)
└─ ❌ LOSING: Exact Goals = 2 @ 4.50 (at risk)
```

---

## Phase 4: Post-Match Settlement & Automatic Resolution

### T=90 min: Match Ends (Final Whistle)

**Final Score:** Manchester City 3 - 1 Newcastle  
**Goalscorers:** Haaland (12'), Foden (34'), Grealish (67'), Isak (55')

### Step 1: HTTP Job #3 Detects Completion

```
┌─────────────────────────────────────────────────────────────┐
│                  HTTP JOB #3                               │
│         Final Settlement Detection                         │
│      (Runs every 30 seconds after 90+ min)                 │
│                                                             │
│  1. Poll Goalserve for finished matches                    │
│  2. Check status: MATCH_ENDED? YES                         │
│  3. Fetch final details:                                   │
│     ├─ Final score: 3-1                                    │
│     ├─ Goalscorers: [Haaland, Foden, Grealish, Isak]     │
│     └─ Events: red cards, own goals (if any)               │
│  4. Call contract.settleMatch():                           │
│     ├─ matchId: man-city-vs-newcastle                      │
│     ├─ homeGoals: 3                                        │
│     ├─ awayGoals: 1                                        │
│     ├─ firstGoalscorer: Haaland                            │
│     ├─ secondGoalscorer: Foden                             │
│     ├─ thirdGoalscorer: Grealish                           │
│     └─ totalGoals: 4                                       │
│  5. Contract stores final state                            │
│  6. Contract emits: MatchSettled event                     │
│                                                             │
│  Result: Log Trigger #4 is fired automatically             │
└─────────────────────────────────────────────────────────────┘
```

### Step 2: CRE Log Trigger Catches Settlement Event

**The critical moment:**

```
MatchSettled event emitted:
├─ event: MatchSettled(
│    matchId: "man-city-vs-newcastle",
│    homeGoals: 3,
│    awayGoals: 1,
│    firstGoalscorer: "0x1234..." (Haaland's address),
│    secondGoalscorer: "0x5678..." (Foden's address),
│    thirdGoalscorer: "0x9abc..." (Grealish's address)
│  )
└─ Network: Sepolia

        ↓ (Log Trigger is automatically fired)

┌─────────────────────────────────────────────────────────────┐
│          CRE LOG TRIGGER #4                                │
│      Automatic User Position Resolution                    │
│                                                             │
│  Triggered by: MatchSettled event                          │
│  Execution: IMMEDIATELY (1-2 seconds after event)         │
│  Frequency: ONCE PER MATCH                                 │
│                                                             │
│  What happens:                                              │
│  1. Access: matches[matchId].finalScore, goalscorers       │
│  2. Query Supabase: userPositions WHERE resolv
ed=false     │
│  3. For EACH user position:                                │
│     ├─ Determine WIN/LOSS                                  │
│     ├─ Calculate payout & P&L                              │
│     ├─ Update contract (immutable log)                     │
│     └─ Update Supabase + user balance                      │
│  4. All positions resolved in SINGLE execution             │
│                                                             │
│  Result: Every user's P&L calculated & credited           │
└─────────────────────────────────────────────────────────────┘
```

### Step 3: Detailed Resolution Logic

**Log Trigger processes ALL user positions:**

```
User A: Bet "City wins" @ 1.35, $200 wagered
├─ Condition: homeGoals (3) > awayGoals (1)?
├─ Result: ✅ YES → WIN
├─ Payout: 200 × 1.35 = 270
├─ P&L: 270 - 200 = +70
└─ Update: resolved=true, isWon=true, payout=270, realizedPnL=+70

User B: Bet "First scorer = Haaland" @ 1.52, $100 wagered
├─ Condition: firstGoalscorer == Haaland?
├─ Result: ✅ YES → WIN
├─ Payout: 100 × 1.52 = 152
├─ P&L: 152 - 100 = +52
└─ Update: resolved=true, isWon=true, payout=152, realizedPnL=+52

User C: Bet "Draw" @ 4.20, $50 wagered
├─ Condition: homeGoals (3) == awayGoals (1)?
├─ Result: ❌ NO → LOSS
├─ Payout: 0 (lost entire bet)
├─ P&L: 0 - 50 = -50
└─ Update: resolved=true, isWon=false, payout=0, realizedPnL=-50

User D: Bet "Exact Goals = 3" @ 4.50, $75 wagered
├─ Condition: totalGoals (4) == 3?
├─ Result: ❌ NO (it was 4 goals) → LOSS
├─ Payout: 0
├─ P&L: 0 - 75 = -75
└─ Update: resolved=true, isWon=false, payout=0, realizedPnL=-75

User E: Bet "Second scorer = Foden" @ 2.8, $150 wagered
├─ Condition: secondGoalscorer == Foden?
├─ Result: ✅ YES → WIN
├─ Payout: 150 × 2.8 = 420
├─ P&L: 420 - 150 = +270
└─ Update: resolved=true, isWon=true, payout=420, realizedPnL=+270

User F: Bet "Second scorer = Grealish" @ 3.5, $100 wagered
├─ Condition: secondGoalscorer == Grealish?
├─ Result: ❌ NO (Foden scored second, not Grealish) → LOSS
├─ Payout: 0
├─ P&L: 0 - 100 = -100
└─ Update: resolved=true, isWon=false, payout=0, realizedPnL=-100
```

### Step 4: Contract Updates

**For each user position, contract records (immutable):**

```solidity
Event: UserPositionResolved(
  indexed user: address,
  indexed matchId: bytes32,
  isWon: bool,
  realizedPnL: int256
)

Example emissions:
├─ UserPositionResolved(User A, man-city-vs-newcastle, true, +70)
├─ UserPositionResolved(User B, man-city-vs-newcastle, true, +52)
├─ UserPositionResolved(User C, man-city-vs-newcastle, false, -50)
├─ UserPositionResolved(User D, man-city-vs-newcastle, false, -75)
├─ UserPositionResolved(User E, man-city-vs-newcastle, true, +270)
└─ UserPositionResolved(User F, man-city-vs-newcastle, false, -100)
```

### Step 5: Supabase Updates (Immediate)

**user_positions table (all positions updated simultaneously):**

```
Before resolution:
│ userId | matchId | outcome | amountWagered | odds | resolved | payout | realizedPnL │ resolvedAt
├─ UserA│ man-... │ "City"  │ 200           │ 1.35 │ false    │ null   │ null        │ null
├─ UserB│ man-... │ "Haal.."│ 100           │ 1.52 │ false    │ null   │ null        │ null
└─ ...  │ ...     │ ...     │ ...           │ ...  │ ...      │ ...    │ ...         │ ...

After resolution (Log Trigger runs):
│ userId | matchId | outcome | amountWagered | odds | resolved | payout | realizedPnL │ resolvedAt
├─ UserA│ man-... │ "City"  │ 200           │ 1.35 │ true     │ 270    │ +70         │ 2026-02-21T21:40:15Z
├─ UserB│ man-... │ "Haal.."│ 100           │ 1.52 │ true     │ 152    │ +52         │ 2026-02-21T21:40:15Z
├─ UserC│ man-... │ "Draw"  │ 50            │ 4.20 │ true     │ 0      │ -50         │ 2026-02-21T21:40:15Z
└─ ...  │ ...     │ ...     │ ...           │ ...  │ ...      │ ...    │ ...         │ ...
```

**user_balances table (updated immediately after):**

```
Before:
│ userId | balance
├─ UserA│ 1700 (had $200 + $2000 available)
├─ UserB│ 1900
├─ UserC│ 1950
└─ ...  │ ...

After (Log Trigger credits winnings):
│ userId | balance
├─ UserA│ 1970 (1700 + 270 payout)  [+70 profit]
├─ UserB│ 2052 (1900 + 152 payout)  [+52 profit]
├─ UserC│ 1950 (1950 + 0 payout)    [-50 loss, kept wagered amount returned? No, lost it]
└─ ...  │ ...
```

Actually, let me reconsider the balance calculation. When user places bet:

- Balance goes DOWN by wagered amount (bet is held in escrow)
- After resolution:
  - If WON: Balance goes UP by full payout amount (which includes original + profit)
  - If LOST: Balance stays same (wagered amount lost)

Or more accurately:

- Available balance decreases when bet is placed
- After resolution:
  - Payout is added back (whether 0 or full amount)

Let me show correct logic:

```
User A initial balance: $2000

Places $200 bet:
├─ Available balance: $1800 (escrow holds $200)
├─ Total: $2000 (same, just split)

Bet WON, payout = $270:
├─ Add payout: $1800 + $270 = $2070
├─ Total: $2070 (profit of $70)

User C initial balance: $2000

Places $50 bet:
├─ Available balance: $1950

Bet LOST, payout = $0:
├─ Add payout: $1950 + $0 = $1950
├─ Total: $1950 (loss of $50)
```

### Step 6: Frontend Updates (Real-Time)

**User sees their dashboard update immediately (within 1-2 seconds):**

```
USER A Dashboard (Winner):

Previous:
├─ Active Bets: 2
├─ Potential Wins: $500
└─ Available Balance: $1800

After Settlement:
├─ Completed Bets: ✅ City wins @ 1.35, $200 wagered
├─ Result: WIN (+$70)
├─ Claimed Payout: $270
├─ New Balance: $2070
└─ Message: "Congratulations! You won $70! Your winnings have been credited to your account."

Option to Withdraw: [Withdraw $2070]
```

```
USER C Dashboard (Loser):

Previous:
├─ Active Bets: 1
├─ Potential Wins: $210 (if won)
└─ Available Balance: $1950

After Settlement:
├─ Completed Bets: ❌ Draw @ 4.20, $50 wagered
├─ Result: LOSS (-$50)
├─ Payout: $0 (lost bet)
├─ New Balance: $1950
└─ Message: "Sorry, your bet did not win. Try again next match!"
```

---

## Complete User Journey

### Example: User B's Complete Journey

**Time: T-55 minutes (before match)**

```
1. USER B opens frontend
   ├─ Sees "Man City vs Newcastle" match
   ├─ Kicks off in ~55 minutes
   └─ Pre-match odds displayed

2. USER B decides to bet
   ├─ Clicks: "First Goalscorer"
   ├─ Selects: "Erling Haaland"
   ├─ Enters amount: 100 USDC
   ├─ Sees odds: 1.52
   └─ Potential payout: 152

3. USER B reviews and clicks "Place Bet"
   ├─ MetaMask popup
   ├─ Transaction: contract.placeUserPosition(
   │    matchId: "man-city-vs-newcastle",
   │    outcome: "Haaland",
   │    amount: 100,
   │    odds: 1.52
   │  )
   └─ User signs transaction

4. Contract receives bet
   ├─ Stores in userPositions[]
   ├─ Escrow: 100 USDC locked
   ├─ Event: UserPositionCreated()
   └─ Supabase: user_positions inserted

5. Frontend shows confirmation
   ├─ "✅ Bet placed successfully!"
   ├─ Balance: $1900 → $1800 (100 escrow)
   └─ Bet visible in "Active Bets"
```

**Time: T=0 (Kickoff at 20:00 UTC)**

```
6. HTTP Job #2 starts firing (every 15 seconds)
   ├─ Fetches live score
   ├─ Fetches live odds
   ├─ Updates contract
   └─ Frontend refreshes

7. USER B watches match live
   ├─ Sees score: 0-0 at kickoff
   ├─ Odds: Haaland still 2.10 for first
   ├─ Status: ⏳ WAITING
   └─ Potential: +52
```

**Time: T=12 min (Haaland scores!)**

```
8. HTTP Job #2 detects goal
   ├─ Goalserve says: Haaland scored @ 12'
   ├─ New score: 1-0
   ├─ Updates contract
   ├─ First Goalscorer market CLOSES

9. Frontend updates for USER B
   ├─ Score: 1-0
   ├─ Odds: Haaland first scorer market CLOSED
   ├─ Status: ✅ WINNING
   ├─ Your bet: "Haaland scores first"
   └─ Potential payout: Still 152 (locked in)

10. USER B celebrates
    ├─ Haaland scored!
    ├─ Just need match to finish without major issues
    ├─ Current leading 1-0
    └─ Status: ✅ ON TRACK TO WIN
```

**Time: T=90+ min (Final Whistle)**

```
11. HTTP Job #3 detects match ended
    ├─ Final score: 3-1
    ├─ Goalscorers: Haaland, Foden, Grealish, Isak
    ├─ Calls contract.settleMatch()
    └─ Emits MatchSettled event

12. Log Trigger #4 is automatically fired
    ├─ Processes all user positions
    ├─ For USER B:
    │  ├─ Condition: firstGoalscorer == Haaland?
    │  ├─ Result: ✅ YES
    │  ├─ Payout: 100 × 1.52 = 152
    │  ├─ P&L: +52
    │  └─ Updates contract + Supabase
    └─ Balance updated: $1800 + 152 = $1952

13. USER B's frontend updates automatically
    ├─ Notification: "✅ Your bet WON!"
    ├─ Bet result: "Haaland scores first @ 1.52"
    ├─ Payout: 152
    ├─ Profit: +52
    ├─ New balance: $1952
    └─ Option: [Withdraw]
```

---

## HTTP Triggers Deep Dive

### HTTP Trigger Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 HTTP TRIGGER (CRE Job)                     │
│                                                             │
│  Polling-based: Runs on schedule                           │
│  Stateless: Each execution is independent                  │
│  Idempotent: Safe to run multiple times                    │
│  External API: Fetches real data from The Odds API, etc.  │
└─────────────────────────────────────────────────────────────┘
```

### Job #1: Pre-Match Odds Capture (HTTP)

```
Schedule: "0 * * * *"  (Every hour)

Execution flow:
├─ 1. Backend queries: "Any matches kickoff in next hour?"
├─ 2. Get match list: [
│      { matchId, eventId, kickoffTime, homeTeam, awayTeam }
│    ]
├─ 3. For each match:
│    ├─ API call: The Odds API
│    │  └─ GET /v4/sports/soccer_epl/odds?eventId=...
│    ├─ Response: {
│    │    h2h: { home: 1.52, draw: 4.20, away: 6.50 },
│    │    player_goal_scorer: { Haaland: 1.52, Foden: 2.8, ... },
│    │    exact_goals: { "1 goal": 4.20, "2 goals": 1.90, ... }
│    │  }
│    ├─ Prepare contract argument
│    └─ Send transaction to contract via RPC
├─ 4. Contract call: createMatch()
├─ 5. Supabase insert: matches table
└─ 6. Result: Match visible in UI with odds

Idempotency:
├─ If runs twice for same match
├─ Creates duplicate entry? NO
├─ Backend checks: Match already exists?
│  └─ If yes: Skip or update
│  └─ If no: Create
└─ Result: Safe to retry
```

### Job #2: Live Odds Polling (HTTP)

```
Schedule: "*/15 09-22 * * *"  (Every 15 seconds, 9am-10pm UTC)

Execution flow (repeats ~240 times per 60-min match):
├─ 1. Get all ACTIVE matches (status: LIVE)
├─ 2. For each active match:
│    ├─ API call 1: Goalserve (real live score)
│    │  └─ GET /getmatch?matchId=... → { score, status, goals, events }
│    ├─ API call 2: The Odds API (real live odds)
│    │  └─ GET /odds?eventId=... → { h2h, goalscorer_odds, exact_goals }
│    ├─ Contract call: recordLiveOdds()
│    ├─ Supabase insert: live_odds snapshot
│    ├─ Check: status == MATCH_ENDED?
│    │  └─ If YES: Trigger Job #3 (settlement)
│    │  └─ If NO: Continue polling
│    └─ Emit: LiveOddsRecorded event
└─ 3. Result: UI refreshed every 15 seconds

Rate limiting:
├─ The Odds API: Check rate limits
├─ Goalserve: Check rate limits
├─ Contract: Check gas prices
└─ Supabase: No issues (write rate OK)

Error handling:
├─ API timeout? Retry with backoff
├─ Contract call failed? Log and try next cycle
├─ Supabase down? Cache locally, retry later
└─ Result: Resilient to transient failures
```

### Job #3: Final Settlement (HTTP)

```
Schedule: "*/30 09-22 * * *"  (Every 30 seconds)

Execution flow:
├─ 1. Query backend: "Any matches with status = MATCH_ENDED?"
├─ 2. Get finished match list
├─ 3. For each finished match:
│    ├─ Check: Already settled?
│    │  └─ Query contract: isSettled[matchId]?
│    │  └─ If YES: Skip (already processed)
│    │  └─ If NO: Continue
│    ├─ API call: Goalserve (final match details)
│    │  └─ GET /getmatch?matchId=...&include=goals,events
│    ├─ Extract:
│    │  ├─ finalScore: { home: 3, away: 1 }
│    │  ├─ goalscorers: [...{ minute, player }...]
│    │  └─ events: [...{ type, minute }...]
│    ├─ Contract call: settleMatch()
│    │  └─ Passes: matchId, finalScore, goalscorers
│    ├─ Contract stores final state
│    ├─ Contract emits: MatchSettled event
│    └─ Supabase update: matches.status = SETTLED
└─ 4. Result: Log Trigger is fired automatically

Idempotency:
├─ Contract check: isSettled already true?
├─ If YES: Revert (contract prevents double-settle)
├─ If NO: Process
└─ Result: Safe to retry
```

---

## Log Triggers Deep Dive

### Log Trigger Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              LOG TRIGGER (CRE Automation)                  │
│                                                             │
│  Event-driven: Fires only when target event is emitted     │
│  Stateful: Tracks which events have been processed         │
│  Single-fire: Each event triggers job once                 │
│  Internal: Reacts to contract state                        │
└─────────────────────────────────────────────────────────────┘
```

### Job #4: Automatic User Resolution (Log Trigger)

```
Trigger: MatchSettled event emitted from contract

Event signature:
├─ event: MatchSettled(
│    bytes32 indexed matchId,
│    uint8 homeGoals,
│    uint8 awayGoals,
│    address firstGoalscorer,
│    address secondGoalscorer,
│    address thirdGoalscorer
│  )

When it fires:
├─ Every time MatchSettled is emitted
├─ Immediately after contract.settleMatch() is called (Job #3)
├─ Once per match (MatchSettled emitted once)
├─ Fires automatically with NO additional setup

Execution flow:
├─ 1. Capture event data:
│    ├─ matchId: "man-city-vs-newcastle"
│    ├─ homeGoals: 3
│    ├─ awayGoals: 1
│    ├─ firstGoalscorer: 0x1234... (Haaland)
│    ├─ secondGoalscorer: 0x5678... (Foden)
│    └─ thirdGoalscorer: 0x9abc... (Grealish)
│
├─ 2. Fetch unresolved positions from Supabase:
│    ├─ Query: SELECT * FROM user_positions
│    │         WHERE matchId = "man-city-vs-newcastle"
│    │         AND resolved = false
│    ├─ Returns: [
│    │    { userId: A, outcome: "City", odds: 1.35, amount: 200, ... },
│    │    { userId: B, outcome: "Haaland", odds: 1.52, amount: 100, ... },
│    │    { userId: C, outcome: "Draw", odds: 4.20, amount: 50, ... },
│    │    { userId: D, outcome: "exact_3_goals", odds: 4.50, amount: 75, ... },
│    │    ...all unresolved positions...
│    │  ]
│
├─ 3. Process each position in a loop:
│
│    Position 1 (User A - Home bet):
│    ├─ Determine win/loss:
│    │  └─ homeGoals (3) > awayGoals (1)? YES → WIN
│    ├─ Calculate payout:
│    │  └─ 200 × 1.35 = 270
│    ├─ Calculate P&L:
│    │  └─ 270 - 200 = +70
│    ├─ Update contract:
│    │  └─ resolveUserPosition(A, matchId, true, +70)
│    ├─ Update Supabase:
│    │  └─ UPDATE user_positions SET resolved=true, payout=270, realizedPnL=70
│    └─ Credit balance:
│       └─ user_balances.amount += 270
│
│    Position 2 (User B - First goalscorer):
│    ├─ Determine win/loss:
│    │  └─ firstGoalscorer (0x1234) == prediction (0x1234)? YES → WIN
│    ├─ Calculate payout:
│    │  └─ 100 × 1.52 = 152
│    ├─ Calculate P&L:
│    │  └─ 152 - 100 = +52
│    ├─ Update contract:
│    │  └─ resolveUserPosition(B, matchId, true, +52)
│    ├─ Update Supabase:
│    │  └─ UPDATE user_positions SET resolved=true, payout=152, realizedPnL=52
│    └─ Credit balance:
│       └─ user_balances.amount += 152
│
│    Position 3 (User C - Draw):
│    ├─ Determine win/loss:
│    │  └─ homeGoals (3) == awayGoals (1)? NO → LOSS
│    ├─ Calculate payout:
│    │  └─ 0 (lost)
│    ├─ Calculate P&L:
│    │  └─ 0 - 50 = -50
│    ├─ Update contract:
│    │  └─ resolveUserPosition(C, matchId, false, -50)
│    ├─ Update Supabase:
│    │  └─ UPDATE user_positions SET resolved=true, payout=0, realizedPnL=-50
│    └─ Credit balance:
│       └─ user_balances.amount += 0  (no payout)
│
│    ...continue for all positions...
│
├─ 4. Update frontend (real-time notification):
│    ├─ Frontend polls Supabase or uses WebSocket
│    ├─ Sees: resolved=true for all positions
│    ├─ Calculates: Total P&L = sum of realizedPnL
│    └─ Shows: Results dashboard with all outcomes
│
└─ 5. Result: ALL positions resolved simultaneously in single job execution

Idempotency & Safety:
├─ Query check: ".eq("resolved", false)"
├─ If job runs twice:
│  ├─ First run: Finds unresolved positions, processes them
│  ├─ All marked as resolved=true
│  ├─ Second run: Query returns EMPTY (all already resolved)
│  └─ Script exits gracefully (no work to do)
├─ Contract check: "require(!position.resolved)"
│  └─ If somehow called twice, contract reverts
└─ Result: Safe from double-settlement
```

---

## CRE Workflow Orchestration

### Complete End-to-End CRE Flow

```
Timeline of a complete match lifecycle:

T-60 min (Pre-Match)
└─ HTTP Job #1 fires (scheduled)
   ├─ Fetches odds from The Odds API
   ├─ Calls contract.createMatch()
   ├─ Data saved to Supabase
   └─ UI shows match with odds

   Execution time: ~5-10 seconds

T-5 min to T+5 min (Users Place Bets)
└─ Users click "Place Bet" manually
   ├─ Each user transaction via MetaMask
   ├─ Contract receives and stores position
   ├─ Supabase updated
   └─ UI shows active bets

   No CRE involvement

T=0 (Kickoff)
└─ HTTP Job #2 starts firing (every 15 seconds)
   ├─ First execution at T+0: Polls score and odds
   ├─ Updates contract with live score
   ├─ Updates Supabase with snapshot
   ├─ Frontend refreshes
   │
   ├─ Executes every 15 seconds:
   │  ├─ T+15s: Updates again
   │  ├─ T+30s: Updates again
   │  ├─ T+45s: Updates again
   │  ├─ T+60s: Updates again (continue...)
   │  └─ ... continues until match finishes
   │
   └─ Approximately 240 executions per 60-min match

T=Goal (e.g., 12 min)
└─ HTTP Job #2 detects goal
   ├─ Goalserve reports: Haaland scored
   ├─ Updates contract: homeGoals = 1
   ├─ Live odds update: "First goalscorer market now CLOSED"
   ├─ Supabase records the goal
   └─ Frontend shows updated odds instantly

   (Next polling cycle in 15 seconds)

T=90+ min (Match Finishes)
└─ HTTP Job #2 detects status = MATCH_ENDED
   ├─ Stops polling (no more updates)
   ├─ Notes: Match finished
   └─ HTTP Job #3 will pick it up

   (Job #2 stops for this match)

[Typically 30 seconds later]

T=90+30 min (Settlement Detection)
└─ HTTP Job #3 fires (every 30 seconds)
   ├─ Finds completed match in queue
   ├─ Fetches final stats from Goalserve
   ├─ Calls contract.settleMatch()
   │  └─ Passes: final score, goalscorers
   ├─ Contract stores final state
   ├─ Contract emits MatchSettled event
   └─ Supabase updated: status = SETTLED

   Execution time: ~3-5 seconds

   [Log Trigger is automatically fired]

T=90+31 min (Automatic Resolution)
└─ Log Trigger #4 catches MatchSettled event
   └─ Automatic execution within 1-2 seconds:
      ├─ Fetches all unresolved positions
      ├─ For each position:
      │  ├─ Determine if WON/LOST
      │  ├─ Calculate payout
      │  ├─ Update contract (immutable)
      │  ├─ Update Supabase
      │  └─ Credit user balance
      ├─ All positions resolved in single execution
      └─ Users see results in dashboard

   Execution time: ~2-3 seconds per 100 positions

T=90+35 min (Complete)
└─ Match fully resolved
   ├─ All users know their P&L
   ├─ Balances updated
   ├─ Contract immutable log created
   ├─ Can view detailed history
   └─ Can withdraw winnings immediately

Total CRE executions per match:
├─ Job #1: 1 execution (pre-match)
├─ Job #2: ~240 executions (every 15 seconds)
├─ Job #3: 1 execution (final settlement)
└─ Job #4: 1 execution (auto-resolution)
   = 243 total CRE actions

Total execution time on-chain:
├─ Pre-match: ~5 seconds
├─ Live polling: ~240 × 1 second = 4 minutes cumulative
├─ Settlement: ~5 seconds
├─ Resolution: ~3 seconds
└─ Total: ~4.2 minutes of actual compute (spread over ~2 hours)
```

---

## Data Flow Diagram (Complete)

```
┌───────────────────────────────────────────────────────────────────┐
│                        EXTERNAL WORLD                             │
│                                                                   │
│ ┌─────────────────┐    ┌──────────────────┐    ┌──────────────┐ │
│ │ The Odds API    │    │  Goalserve API   │    │ ESPN / Stats │ │
│ │                 │    │                  │    │     API      │ │
│ │ Real odds data  │    │ Real match data  │    │ Real stats   │ │
│ │ (no mocking)    │    │ (no mocking)     │    │ (no mocking) │ │
│ └────────┬────────┘    └────────┬─────────┘    └──────┬───────┘ │
└───────────┼────────────────────┼──────────────────────┼───────────┘
            │                    │                      │
            └─────── HTTP Requests (CRE Jobs #1,#2,#3) ─┘
                                 │
                    ┌────────────▼────────────┐
                    │   CRE JOBS (Chainlink  │
                    │    Functions/Runner)   │
                    │                        │
                    │ Job #1: Pre-Match (1x) │
                    │ Job #2: Live Poll (240x)
                    │ Job #3: Settlement (1x)│
                    │ Job #4: Resolution (1x)│
                    └─────┬──────────────────┘
                          │
                 ┌────────▼────────┐
                 │  Smart Contract │
                 │ (Singleton on   │
                 │   Sepolia)      │
                 │                 │
                 │ Functions:      │
                 │ createMatch()   │
                 │ recordOdds()    │
                 │ settleMatch()   │
                 │ resolveBet()    │
                 │                 │
                 │ State:          │
                 │ matches[]       │
                 │ users[]         │
                 │ positions[]     │
                 │                 │
                 │ Events:         │
                 │ MatchCreated    │
                 │ LiveOddsRecorded│
                 │ MatchSettled ◄──┼─── Log Trigger catches this
                 │ BetResolved     │
                 └────┬──────────┬─┘
                      │          │
        ┌─────────────▼─┐   ┌────▼──────────┐
        │   Supabase    │   │   Frontend    │
        │ (Database)    │   │  (React/UI)   │
        │               │   │               │
        │ Tables:       │   │ Components:   │
        │ matches       │   │ Match list    │
        │ user_pos.     │◄──┤ Bet placement │
        │ user_bal.     │───┤ Live odds     │
        │ live_odds     │   │ P&L dashboard │
        │ payout_hist.  │   │ Withdrawal    │
        └───────────────┘   └───────────────┘
```

---

## Key Distinctions

| Aspect                | HTTP Trigger                | Log Trigger                  |
| --------------------- | --------------------------- | ---------------------------- |
| **Trigger**           | Scheduled (time-based)      | Event-based                  |
| **Frequency**         | Recurring (every X seconds) | Once per event               |
| **Jobs in goal.live** | #1, #2, #3                  | #4                           |
| **Fetches data**      | YES (external APIs)         | NO (uses on-chain state)     |
| **Updates contract**  | YES                         | YES                          |
| **Example duration**  | 5-10 seconds per execution  | 2-3 seconds per execution    |
| **Failure impact**    | Next cycle retries          | Event stored, triggers again |

---

## Summary: How It All Works Together

```
1. PRE-MATCH PHASE (HTTP Job #1)
   ├─ Fetches real odds from The Odds API
   ├─ Stores on-chain via contract.createMatch()
   └─ UI shows match with odds

2. BETTING WINDOW (User Action)
   ├─ Users place bets directly via smart contract
   ├─ No CRE involved
   └─ Contract stores positions

3. LIVE MATCH PHASE (HTTP Job #2)
   ├─ Every 15 seconds, fetches live score + odds
   ├─ Updates contract with real data
   ├─ Frontend refreshes with live odds
   └─ Continues until match finishes

4. SETTLEMENT PHASE (HTTP Job #3)
   ├─ Detects match finished
   ├─ Fetches final stats
   ├─ Calls contract.settleMatch()
   └─ Emits MatchSettled event

5. AUTOMATIC RESOLUTION PHASE (Log Trigger #4)
   ├─ Catches MatchSettled event
   ├─ Processes ALL user positions simultaneously
   ├─ Calculates P&L for each user
   ├─ Updates contract + database
   ├─ Credits user balances
   └─ Users see results in real-time

6. WITHDRAWAL (User Action)
   ├─ User clicks "Withdraw"
   ├─ Funds transferred from contract
   └─ Journey complete
```

**No manual intervention. No mocking. Fully automated. Transparent and verifiable on-chain.**

---

_Complete Application Flow Documentation | March 5, 2026 | goal.live Prediction Markets_
