# Real Data Flow: CRE Integration, Live Odds, and Automatic Resolution

**Date:** March 4, 2026 (revised to match actual codebase)
**Status:** Production Architecture
**Network:** Sepolia (testnet) → Mainnet
**Scale:** 5-15 matches/day (EPL, La Liga, Serie A)

---

## Overview

**No mocking.** Real data from real APIs. Real odds capture. Supabase Edge Functions handle all business logic. The contract handles match creation and final settlement only.

```
REAL ODDS API → SUPABASE DB → LIVE ODDS UPDATES → EDGE FUNCTION SETTLEMENT → AUTO-RESOLVE USER BETS
```

---

## Architecture: What Runs Where

| Layer | Role |
|---|---|
| **Supabase Postgres** | Source of truth: `matches`, `players`, `bets`, `player_balances`, `provisional_credits`, `goal_events` |
| **Supabase Edge Functions** | `lock-bet`, `sync-odds`, `settle-match`, `run-migration` |
| **GoalLiveBetting contract** | `createMatch()` + `settleMatch()` only — no 15s polling |
| **Frontend / Extension** | React + Vite Chrome extension, reads Supabase, writes via Edge Functions |

**Supabase project URL:** `https://weryswulejhjkrmervnf.supabase.co`
**Edge Function base URL:** `https://weryswulejhjkrmervnf.supabase.co/functions/v1/`

---

## Actual Contract: GoalLiveBetting.sol

The contract is **deployed once per match** (not a singleton). Each deployed instance handles a single match. The contract address is stored in the `matches.contract_address` column after deployment.

**There is no hardcoded global contract address.** The correct address is retrieved from the DB:

```sql
SELECT contract_address FROM matches WHERE id = $match_id;
```

**USDC Contract (Sepolia):** `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

### Contract ABI (relevant functions)

```solidity
// Called once when match is deployed
function createMatch(
    string matchId,
    string homeTeam,
    string awayTeam,
    uint256 kickoffTime
) external;

// Called by settle-match Edge Function after match ends
function settleMatch(
    string matchId,
    uint256[] goalScorers,   // array of external player IDs who scored
    uint8 winner,            // 0=home, 1=draw, 2=away
    uint8 homeGoals,
    uint8 awayGoals
) external;

// Called by lock-bet Edge Function (Phase 3: on-chain bet locking)
function lockBet(
    string matchId,
    address bettor,
    uint256 betType,   // 0=NEXT_GOAL_SCORER, 1=MATCH_WINNER, 2=EXACT_GOALS
    uint256 playerId,
    uint256 amount,
    uint256 odds
) external returns (uint256 betId);
```

**What the contract does NOT do:**
- ❌ Record live odds every 15 seconds
- ❌ Store goal scorer history (first / second / third)
- ❌ Resolve individual user positions on-chain
- ❌ Emit per-user settlement events live

---

## Database Schema

### `matches`

```sql
id                uuid PRIMARY KEY
external_match_id text
home_team         text
away_team         text
kickoff_at        timestamptz
status            enum: pre-match | live | halftime | finished | cancelled
current_minute    integer
score_home        integer
score_away        integer
half              integer
oracle_address    text
contract_address  text   -- address of this match's GoalLiveBetting instance
odds_api_config   jsonb  -- { event_id, market_key } for The Odds API
created_at        timestamptz
```

### `players`

```sql
id                  uuid PRIMARY KEY
match_id            uuid REFERENCES matches(id)
external_player_id  text
name                text
team                enum: home | away
jersey_number       integer
position            text
odds                numeric(10,4)
```

### `bets`

```sql
id                        uuid PRIMARY KEY
bettor_wallet             text
match_id                  uuid REFERENCES matches(id)
bet_type                  enum: NEXT_GOAL_SCORER | MATCH_WINNER | EXACT_GOALS
original_player_id        text    -- player chosen at bet placement
current_player_id         text    -- updated if user changes pick (penalty applied)
outcome                   enum: home | away | draw  -- for MATCH_WINNER bets
original_amount           numeric(18,6)
current_amount            numeric(18,6)  -- = original_amount - total_penalties
total_penalties           numeric(18,6)
change_count              integer
odds                      numeric(10,4)
status                    enum: active | provisional_win | provisional_loss |
                                settled_won | settled_lost | void
placed_at_minute          integer
goal_window_at_placement  text
goals_target              integer   -- for EXACT_GOALS bets
blockchain_bet_id         text
blockchain_lock_tx        text
blockchain_settle_tx      text
```

### `bet_changes`

```sql
id              uuid PRIMARY KEY
bet_id          uuid REFERENCES bets(id)
from_player_id  text
to_player_id    text
penalty_amount  numeric(18,6)
penalty_pct     numeric(5,2)
match_minute    integer
blockchain_tx   text
```

### `player_balances`

```sql
wallet_address   text PRIMARY KEY
total_deposited  numeric(18,6)
total_withdrawn  numeric(18,6)
updated_at       timestamptz
```

Available balance computed via the `player_available_balance` view:

```sql
available = total_deposited - total_withdrawn
            - SUM(current_amount) WHERE bets.status = 'active'
```

### `provisional_credits`

Written by `settle-match` for winning bets before final on-chain confirmation:

```sql
id             uuid PRIMARY KEY
bet_id         uuid REFERENCES bets(id)
goal_event_id  uuid REFERENCES goal_events(id)
amount         numeric(18,6)   -- = current_amount × odds
is_final       boolean
created_at     timestamptz
```

### `goal_events`

```sql
id           uuid PRIMARY KEY
match_id     uuid REFERENCES matches(id)
player_id    text
player_name  text
team         enum: home | away
minute       integer
event_type   enum: GOAL | VAR_OVERTURNED | VAR_CORRECTED
confirmed    boolean
source       enum: chainlink_cre | mock_oracle | manual
raw_payload  jsonb
created_at   timestamptz
```

### `pre_game_odds`

```sql
id            uuid PRIMARY KEY
match_id      uuid REFERENCES matches(id)
player_id     text
player_name   text
odds          numeric(10,4)
source        text  -- 'manual' | 'odds_api'
cre_signature text
fetched_at    timestamptz
expires_at    timestamptz
UNIQUE (match_id, player_id)
```

---

## Bet Types

| Type | Enum Value | Description |
|---|---|---|
| Next Goal Scorer | `NEXT_GOAL_SCORER` | User picks a player to score the **next** goal in the current goal window |
| Match Winner | `MATCH_WINNER` | User picks home / draw / away for full-time result |
| Exact Goals | `EXACT_GOALS` | User picks total goals scored in the match (stored in `goals_target`) |

> `EXACT_GOALS` was added to the Postgres `bet_type` enum via migration 004. The GoalLiveBetting contract had it from the start.

---

## Bet: Penalty System

When a user **changes their pick** on an active `NEXT_GOAL_SCORER` bet, a penalty is deducted:

```
new_current_amount = current_amount - (current_amount × penalty_pct)
total_penalties   += penalty_amount
```

A `bet_changes` row is recorded for each switch.

**Payout on win:**

```
payout = current_amount × odds
```

Payout is always based on `current_amount` (post-penalty), **never** `original_amount`.

---

## Phase 1: Pre-Match Odds Capture

**Trigger:** ~1 hour before kickoff

**How it works:**

1. Match row inserted in `matches` with `status = 'pre-match'`
2. Player rows inserted in `players` with initial `odds`
3. `sync-odds` Edge Function called (manual or automated)
4. If `odds_api_config` is set on the match, The Odds API is queried live
5. Player odds updated by fuzzy-matching `players.name` against API response
6. Snapshot written to `pre_game_odds` with optional `cre_signature`

**`sync-odds` endpoint:**

```
POST https://weryswulejhjkrmervnf.supabase.co/functions/v1/sync-odds

Body (manual override):
{
  "match_id": "<uuid>",
  "manual_odds": [
    { "player_id": "<uuid>", "odds": 2.5 }
  ]
}

Body (live sync from The Odds API):
{
  "match_id": "<uuid>"
}
```

---

## Phase 2: During Match — Bet Placement and Live Odds

### Placing a Bet

**`lock-bet` endpoint:**

```
POST https://weryswulejhjkrmervnf.supabase.co/functions/v1/lock-bet

Body:
{
  "bettor_wallet": "0x...",
  "match_id": "<uuid>",
  "player_id": "<uuid>",
  "amount": 10.0,
  "odds": 2.5,
  "current_minute": 34
}
```

**What it does:**

1. Inserts a row into `bets` with `status = 'active'`
2. Sets `current_amount = amount`, `original_amount = amount`
3. Phase 3 (planned): Calls `lockBet()` on-chain and writes tx hash to `blockchain_lock_tx`

### Changing a Pick

User changes the selected player on an active `NEXT_GOAL_SCORER` bet. A `bet_changes` row is inserted, `current_amount` is reduced by the configured penalty percentage, and `current_player_id` is updated.

### Live Odds Updates

`sync-odds` can be called repeatedly during the match to refresh player odds from The Odds API. The frontend subscribes to Supabase Realtime on the `players` table. **No on-chain write occurs during the match.**

---

## Phase 3: Post-Match — Automatic Resolution

**Trigger:** Match finishes (`matches.status` transitions to `finished`)

### Step 3.1: Invoke `settle-match`

```
POST https://weryswulejhjkrmervnf.supabase.co/functions/v1/settle-match

Body:
{
  "match_id": "<uuid>",
  "goal_scorer_player_ids": ["<uuid>", "<uuid>"],
  "winner": "home" | "draw" | "away",
  "home_goals": 2,
  "away_goals": 1
}
```

### Step 3.2: Win/Loss Determination

For each `active` bet on the match, `settle-match` calls `didBetWin()`:

```typescript
function didBetWin(bet, scorerSet, winner, totalGoals) {
  if (bet.bet_type === 'NEXT_GOAL_SCORER') return scorerSet.has(bet.current_player_id);
  if (bet.bet_type === 'MATCH_WINNER')    return bet.outcome === winner;
  if (bet.bet_type === 'EXACT_GOALS')     return bet.goals_target === totalGoals;
  return false;
}
```

**NEXT_GOAL_SCORER:** A bet wins if the chosen player (`current_player_id`) appears anywhere in `goal_scorer_player_ids[]`. There is no ordinal tracking (first, second, third goal) — the bet covers the goal window in which it was placed.

### Step 3.3: Payout and Status Update

```typescript
const payout = bet.current_amount * bet.odds;
```

- `bets.status` → `provisional_win` or `provisional_loss`
- `provisional_credits` row upserted for winners: `{ bet_id, amount: payout, is_final: false }`

### Step 3.4: On-Chain Settlement

```typescript
await contract.settleMatch(matchId, goalScorerIds, winnerEnum, homeGoals, awayGoals);
```

The tx hash is written to `bets.blockchain_settle_tx`.

### Step 3.5: Response

```json
{
  "success": true,
  "match_id": "<uuid>",
  "scorers": ["<uuid>"],
  "bets_settled": 42,
  "winners": 17,
  "total_payout": 318.50,
  "settled": [
    {
      "bet_id": "<uuid>",
      "wallet": "0x...",
      "won": true,
      "payout": 25.00,
      "original_amount": 10.00,
      "current_amount": 9.00,
      "total_penalties": 1.00,
      "odds": 2.78
    }
  ]
}
```

---

## Player Balance Flow

### Deposit

User deposits USDC on-chain → `increment_player_deposit(wallet, amount)` Postgres RPC called:

```sql
INSERT INTO player_balances (wallet_address, total_deposited, total_withdrawn, updated_at)
VALUES (lower(p_wallet), p_amount, 0, NOW())
ON CONFLICT (wallet_address)
DO UPDATE SET total_deposited = player_balances.total_deposited + p_amount,
              updated_at = NOW();
```

### Available Balance

```sql
SELECT * FROM player_available_balance WHERE wallet_address = lower('0x...');
-- Returns: wallet_address, in_app_balance, total_locked, available
```

`available = total_deposited - total_withdrawn - SUM(active bet current_amount)`

### Withdrawal

`increment_player_withdrawal(wallet, amount)` RPC → `total_withdrawn` incremented.

---

## Goal Events and CRE Integration

Goal events are written to `goal_events` with `source = 'chainlink_cre'` when driven by Chainlink CRE, or `'manual'` when entered via the admin panel.

| event_type | Meaning |
|---|---|
| `GOAL` | Goal confirmed |
| `VAR_OVERTURNED` | Goal disallowed by VAR |
| `VAR_CORRECTED` | Previously disallowed goal reinstated |

When a `VAR_OVERTURNED` event arrives, provisional credits for that goal window may be reversed.

---

## CRE Jobs Configuration

### Job #1: Pre-Match Odds Capture (~1 hr before kickoff)

**Trigger:** Scheduled, per registered match
**Action:** Call `sync-odds` with `match_id`
**Reads:** The Odds API via `matches.odds_api_config`
**Writes:** `players.odds`, `pre_game_odds`

### Job #2: Live Odds Polling (during match)

**Trigger:** Every N minutes (configurable)
**Action:** Call `sync-odds` with `match_id`
**Note:** No on-chain write. Postgres + Realtime only.

### Job #3: Goal Event Detection

**Trigger:** Score change detected (external feed or CRE watchdog)
**Action:** Insert `goal_events` row (`source = 'chainlink_cre'`)
**Optional:** Trigger provisional settlement per goal window

### Job #4: Final Whistle and Settlement

**Trigger:** `matches.status` transitions to `finished`
**Action:** Call `settle-match` Edge Function with final result
**Writes:** `bets.status`, `provisional_credits`, contract `settleMatch()` tx

---

## Key Differences from Naive Architecture

| Topic | Wrong Assumption | Actual System |
|---|---|---|
| Contract deployment | One singleton for all matches | One contract **per match**; address in `matches.contract_address` |
| On-chain odds | Recorded on-chain every 15 seconds | Never on-chain; Supabase Postgres only |
| Goal scorer tracking | `first_goalscorer`, `second_goalscorer`, `third_goalscorer` | `NEXT_GOAL_SCORER` per goal window; no ordinal tracking |
| Payout calculation | `original_amount × odds` | `current_amount × odds` (post-penalty) |
| Table names | `user_positions`, `user_balances` | `bets`, `player_balances`, `provisional_credits` |
| Backend URLs | Placeholder/fabricated | `https://weryswulejhjkrmervnf.supabase.co/functions/v1/{fn}` |
| Contract address | Hardcoded `0xF553...` | Retrieved from DB per match; no global address |

---

## Future: NFT Position Selling

A planned feature allows users to tokenize an **in-flight active bet** as an NFT and sell it on a secondary market. The buyer inherits the position — current odds, penalties applied so far, and the full win payout on successful resolution.

`bets.bettor_wallet` is the **current owner**, not necessarily the original placer. Any logic referencing the bettor must treat this field as mutable after a transfer.

---

## Security and Idempotency

### DB-Level Constraints

- `provisional_credits` upsert on `bet_id` is idempotent
- `settle-match` skips bets not in `active` status
- `bets.blockchain_settle_tx` is set only once; re-runs skip already-settled bets

### Retry Logic

If `settle-match` is called twice for the same match:

1. All bets already have `status != 'active'`
2. Function exits early with zero additional writes
3. Contract call protected by `isSettled` guard in Solidity

---

## Real Data Sources

| Data | Source |
|---|---|
| Player odds | The Odds API (`ODDS_API_KEY` env var) |
| Match schedule | Manual insertion into `matches` table or external feed |
| Goal events | CRE Chainlink job (`source=chainlink_cre`) or admin panel |
| Final result | Posted to `settle-match` by CRE job or admin |
| On-chain proof | GoalLiveBetting `settleMatch()` tx hash in `bets.blockchain_settle_tx` |

---

## Summary Checklist for CRE Integration

- [ ] Match deployed: `createMatch()` called, `matches.contract_address` set
- [ ] Players seeded: `players` rows with initial odds
- [ ] Pre-match odds captured: `sync-odds` called ~1 hr before kickoff
- [ ] Match goes live: `matches.status = 'live'`
- [ ] Bets placed: `lock-bet` Edge Function, `bets` rows inserted
- [ ] Live odds refresh: `sync-odds` called periodically (no on-chain write)
- [ ] Goal scored: `goal_events` row inserted, optional provisional credit
- [ ] Match ends: `settle-match` called with full result
- [ ] Bets resolved: `bets.status` updated, `provisional_credits` written
- [ ] On-chain settled: `settleMatch()` tx confirmed, hash stored in `bets.blockchain_settle_tx`
