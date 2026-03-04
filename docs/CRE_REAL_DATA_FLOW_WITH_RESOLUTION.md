# Real Data Flow: CRE Integration, Live Odds, and Automatic Resolution

**Date:** March 4, 2026
**Branch:** `cre-chainlink` (commit `849f2b1`)
**Network:** Sepolia (testnet) → Mainnet
**Scale:** 5-15 matches/day (EPL, La Liga, Serie A)

---

## ✅ Build Progress — Where We Are

| Phase                             | Status                     | What was built                                               |
| --------------------------------- | -------------------------- | ------------------------------------------------------------ |
| Migrations 007–010                | ✅ DONE — applied          | odds_history, match odds columns, pg_cron jobs, status cron  |
| `sync-odds` edge function         | ✅ DONE — deployed         | Live odds (MW/EG/NGS) → Supabase Realtime → extension        |
| `sync-match-status` edge function | ✅ DONE — deployed         | Goalserve livescores → status/minute/score in real time      |
| pg_cron wiring (010)              | ✅ DONE — applied          | 3 jobs: Goalserve sync (primary) + 2 SQL safety nets         |
| Extension manifest                | ✅ DONE                    | Bumped to v2.0.0 on `cre-chainlink`                          |
| **`lock-bet` edge function**      | ❌ TODO — **NEXT SESSION** | Bet placement, DB insert, on-chain `lockBet()`               |
| **`settle-match` edge function**  | ❌ TODO                    | Post-match resolution, payout calc, on-chain `settleMatch()` |
| **Goal events feed**              | ❌ TODO                    | CRE Job #3 — goal detection → `goal_events` table            |
| **`createMatch()` deployment**    | ❌ TODO                    | Per-match on-chain contract deployment                       |
| **Admin panel: post result**      | ❌ TODO                    | Trigger `settle-match` from admin UI                         |

---

## Overview

**No mocking.** Real data from real APIs. Real odds capture. Supabase Edge Functions handle all business logic. The contract handles match creation and final settlement only.

```
REAL ODDS API → SUPABASE DB → LIVE ODDS UPDATES → EDGE FUNCTION SETTLEMENT → AUTO-RESOLVE USER BETS
```

---

## Architecture: What Runs Where

| Layer                        | Role                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Supabase Postgres**        | Source of truth: `matches`, `players`, `bets`, `player_balances`, `provisional_credits`, `goal_events`  |
| **Supabase Edge Functions**  | ✅ `sync-odds` (live odds), ✅ `sync-match-status` (Goalserve status), ❌ `lock-bet`, ❌ `settle-match` |
| **GoalLiveBetting contract** | `createMatch()` + `settleMatch()` only — no 15s polling                                                 |
| **Frontend / Extension**     | React + Vite Chrome extension, reads Supabase, writes via Edge Functions                                |

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
id                    uuid PRIMARY KEY
external_match_id     text
home_team             text
away_team             text
kickoff_at            timestamptz
status                enum: pre-match | live | halftime | finished | cancelled
current_minute        integer   -- ✅ written by sync-match-status every minute
score_home            integer   -- ✅ written by sync-match-status (localteam/@goals)
score_away            integer   -- ✅ written by sync-match-status (visitorteam/@goals)
half                  integer
oracle_address        text
contract_address      text      -- address of this match's GoalLiveBetting instance
odds_api_config       jsonb     -- { event_id, market_key } for The Odds API
goalserve_static_id   text      -- ✅ Goalserve @static_id — used by sync-match-status to match rows
odds_home             numeric(10,4)  -- ✅ latest H2H home-win odds (sync-odds → Realtime)
odds_draw             numeric(10,4)  -- ✅ latest H2H draw odds
odds_away             numeric(10,4)  -- ✅ latest H2H away-win odds
exact_goals_odds      jsonb          -- ✅ {"0":12.0,"1":7.5,...} derived from totals market
updated_at            timestamptz    -- ✅ touched on every sync-match-status update
created_at            timestamptz
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

### `odds_history`

Append-only odds log. Every `sync-odds` run INSERTs here — never UPDATEs.  
Used after the match to verify bets were awarded at the correct locked-in odds.

```sql
id           uuid PRIMARY KEY
match_id     uuid REFERENCES matches(id)
player_id    uuid REFERENCES players(id)  -- NULL for MW and EG rows
bet_type     text  -- 'NGS' | 'MW' | 'EG'
odds_value   jsonb
-- NGS:  { "odds": 8.0 }
-- MW:   { "home": 1.74, "draw": 4.2, "away": 5.0 }
-- EG:   { "0": 12.0, "1": 7.5, "2": 4.5, "3": 5.5, "4": 9.0, "5": 15.0 }
minute       integer   -- match minute at time of capture
recorded_at  timestamptz DEFAULT now()
INDEX (match_id, recorded_at)
```

**Audit query (post-match: what were Bruno's NGS odds in minute 34?):**

```sql
SELECT odds_value, minute, recorded_at
FROM odds_history
WHERE match_id = '<uuid>'
  AND player_id = '<Bruno uuid>'
  AND bet_type = 'NGS'
  AND minute <= 34
ORDER BY recorded_at DESC
LIMIT 1;
```

---

## Bet Types

| Type             | Enum Value         | Description                                                               |
| ---------------- | ------------------ | ------------------------------------------------------------------------- |
| Next Goal Scorer | `NEXT_GOAL_SCORER` | User picks a player to score the **next** goal in the current goal window |
| Match Winner     | `MATCH_WINNER`     | User picks home / draw / away for full-time result                        |
| Exact Goals      | `EXACT_GOALS`      | User picks total goals scored in the match (stored in `goals_target`)     |

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

## ✅ Phase 1: Pre-Match Odds Capture

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

## ⚠️ Phase 2: During Match — Bet Placement and Live Odds

> **Live odds + status sync: ✅ DONE. Bet placement (`lock-bet`): ❌ NEXT SESSION.**

### ❌ Placing a Bet — TODO (NEXT SESSION)

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

**✅ BUILT — How odds get from The Odds API to the extension without a page reload:**

```
 pg_cron job 'sync-odds' (every 60s, server-side, migration 009)
   ↓
 POST sync-odds { match_id }  ← fires for every match WHERE status = 'live'
   ↓
 The Odds API — TWO parallel requests (split to avoid INVALID_MARKET error):
   Request 1: markets=h2h,totals  regions=uk,eu
   Request 2: markets=player_goal_scorer  regions=uk,us  (best-effort)
   ↓
 Parse h2h      → matches.odds_home / odds_draw / odds_away
 Parse totals   → matches.exact_goals_odds  (derived exact-goals probabilities)
 Parse scorers  → players.odds  (averaged across bookmakers)
   ↓
 INSERT into odds_history (append-only audit log for post-match resolution)
   ↓
Supabase Realtime fires on matches UPDATE + players UPDATE
   ↓
 dataService matchChannel callback reads new columns from payload.new
   → calls onOddsUpdate(cachedPlayers, freshMwOdds) immediately
   ↓
 React state updates → extension re-renders with live odds
```

- **No page reload needed.** Realtime delivers the update within ~1s of the DB write.
- **Browser backup:** `useMatchData.ts` also polls `sync-odds` every **20 seconds** while the overlay is open, as a fast-path supplement to the 60s server-side cron.
- **No on-chain write** occurs during the match.
- **Odds history** is appended on every sync to `odds_history` for post-match bet resolution.

---

### ✅ Live Match Status Sync (Goalserve)

**Built:** `supabase/functions/sync-match-status/index.ts` — deployed on `cre-chainlink`

**How match status/score/minute get updated in real time:**

```
 pg_cron job 'sync-match-status' (every 60s, migration 010) — PRIMARY
   ↓
 GET http://www.goalserve.com/getfeed/{key}/soccernew/home?json=1
   ↓
 Parse scores.category[].matches.match[] (handles array or single-object quirk)
   Build lookup: @static_id → { status, minute, scoreHome, scoreAway }
   ↓
 Query DB: matches WHERE status NOT IN ('finished','cancelled')
               AND goalserve_static_id IS NOT NULL
   ↓
 For each match — map Goalserve @status:
   "FT"        → finished
   "HT"        → halftime  (minute = 45)
   "45", "67"  → live      (minute = parsed integer)
   "45+2"      → live      (minute = 47)
   "14:00"     → pre-match (no regression if already live)
   "Postponed" → cancelled
   ↓
 UPDATE matches SET status, current_minute, score_home, score_away, updated_at
   (only if value actually changed — avoids unnecessary Realtime noise)
   ↓
 Supabase Realtime fires → extension sees status/score change instantly
```

**Safety nets (also in migration 010 — SQL-only fallback if Goalserve is down):**

- `kickoff-to-live`: flips `pre-match → live` when `kickoff_at <= now()` (4hr window)
- `live-to-finished`: flips `live → finished` at `kickoff_at + 115 min`

**Goalserve API key:** `5dc9cf20aca34682682708de71344f52`  
**Feed URL:** `http://www.goalserve.com/getfeed/{key}/soccernew/home?json=1`  
**EPL league `@gid`:** `1204`  
**Match identifier:** `@static_id` → `matches.goalserve_static_id`

---

## ❌ Phase 3: Post-Match — Automatic Resolution — TODO

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
  if (bet.bet_type === "NEXT_GOAL_SCORER")
    return scorerSet.has(bet.current_player_id);
  if (bet.bet_type === "MATCH_WINNER") return bet.outcome === winner;
  if (bet.bet_type === "EXACT_GOALS") return bet.goals_target === totalGoals;
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
await contract.settleMatch(
  matchId,
  goalScorerIds,
  winnerEnum,
  homeGoals,
  awayGoals,
);
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
  "total_payout": 318.5,
  "settled": [
    {
      "bet_id": "<uuid>",
      "wallet": "0x...",
      "won": true,
      "payout": 25.0,
      "original_amount": 10.0,
      "current_amount": 9.0,
      "total_penalties": 1.0,
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

| event_type       | Meaning                               |
| ---------------- | ------------------------------------- |
| `GOAL`           | Goal confirmed                        |
| `VAR_OVERTURNED` | Goal disallowed by VAR                |
| `VAR_CORRECTED`  | Previously disallowed goal reinstated |

When a `VAR_OVERTURNED` event arrives, provisional credits for that goal window may be reversed.

---

## CRE Jobs Configuration

### ✅ Job #1: Pre-Match Odds Capture (~1 hr before kickoff)

**Trigger:** Scheduled, per registered match
**Action:** Call `sync-odds` with `match_id`
**Reads:** The Odds API via `matches.odds_api_config`
**Writes:** `players.odds`, `pre_game_odds`
**Migration:** 009 (pg_cron wired)

### ✅ Job #2: Live Odds Polling (during match)

**Mechanism:** `pg_cron` — migration 009, job name `sync-odds`
**Schedule:** Every 60 seconds, for every `matches` row with `status = 'live'`
**Action:** `POST sync-odds { match_id }` — two parallel Odds API calls (h2h+totals / player_goal_scorer)
**Writes:**

- `matches.odds_home / odds_draw / odds_away` → triggers Supabase Realtime → extension updates instantly
- `matches.exact_goals_odds` (EG odds derived from totals market)
- `players.odds` (NGS odds averaged across bookmakers)
- `odds_history` rows (append-only audit log for post-match resolution)

**Note:** No on-chain write. Postgres + Realtime only.

### ✅ Job #2b: Real-Time Match Status Sync (Goalserve)

**Mechanism:** `pg_cron` — migration 010, job name `sync-match-status`
**Schedule:** Every 60 seconds (fires even when match is pre-match — looks ahead)
**Action:** `POST sync-match-status` edge function
**Reads:** Goalserve `soccernew/home?json=1` — all today's matches with live `@status`
**Writes:**

- `matches.status` (pre-match | live | halftime | finished | cancelled)
- `matches.current_minute` (parsed from numeric Goalserve `@status`)
- `matches.score_home` / `matches.score_away` (from `localteam/@goals`, `visitorteam/@goals`)
- `matches.updated_at` (triggers Realtime subscription in extension)

**Safety nets (SQL-only, migration 010):**

- `kickoff-to-live` — flips `pre-match → live` at `kickoff_at` (4hr back-window)
- `live-to-finished` — flips `live → finished` at `kickoff_at + 115 min`

### ❌ Job #3: Goal Event Detection — TODO

**Trigger:** Score change detected (external feed or CRE watchdog)
**Action:** Insert `goal_events` row (`source = 'chainlink_cre'`)
**Optional:** Trigger provisional settlement per goal window

### ❌ Job #4: Final Whistle and Settlement — TODO

**Trigger:** `matches.status` transitions to `finished`
**Action:** Call `settle-match` Edge Function with final result
**Writes:** `bets.status`, `provisional_credits`, contract `settleMatch()` tx

---

## Key Differences from Naive Architecture

| Topic                | Wrong Assumption                                            | Actual System                                                     |
| -------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| Contract deployment  | One singleton for all matches                               | One contract **per match**; address in `matches.contract_address` |
| On-chain odds        | Recorded on-chain every 15 seconds                          | Never on-chain; Supabase Postgres only                            |
| Goal scorer tracking | `first_goalscorer`, `second_goalscorer`, `third_goalscorer` | `NEXT_GOAL_SCORER` per goal window; no ordinal tracking           |
| Payout calculation   | `original_amount × odds`                                    | `current_amount × odds` (post-penalty)                            |
| Table names          | `user_positions`, `user_balances`                           | `bets`, `player_balances`, `provisional_credits`                  |
| Backend URLs         | Placeholder/fabricated                                      | `https://weryswulejhjkrmervnf.supabase.co/functions/v1/{fn}`      |
| Contract address     | Hardcoded `0xF553...`                                       | Retrieved from DB per match; no global address                    |

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

| Data           | Source                                                                 |
| -------------- | ---------------------------------------------------------------------- |
| Player odds    | The Odds API (`ODDS_API_KEY` env var)                                  |
| Match schedule | Manual insertion into `matches` table or external feed                 |
| Goal events    | CRE Chainlink job (`source=chainlink_cre`) or admin panel              |
| Final result   | Posted to `settle-match` by CRE job or admin                           |
| On-chain proof | GoalLiveBetting `settleMatch()` tx hash in `bets.blockchain_settle_tx` |

---

## Summary Checklist for CRE Integration

### Build Checklist (one-time — code & infra)

- [x] Migration 007: `odds_history` table
- [x] Migration 008: `matches.odds_home/draw/away/exact_goals_odds` columns
- [x] Migration 009: pg_cron + pg_net enabled, `sync-odds` job scheduled
- [x] Migration 010: `sync-match-status` job + SQL safety nets
- [x] `sync-odds` edge function deployed (split 2-request, The Odds API)
- [x] `sync-match-status` edge function deployed (Goalserve livescores)
- [ ] `lock-bet` edge function — **NEXT SESSION**
- [ ] `settle-match` edge function
- [ ] Goal events feed (CRE Job #3)
- [ ] Per-match `createMatch()` deployment flow
- [ ] Admin panel: post final result → trigger `settle-match`

### Per-Match Operational Checklist (run for every live match)

- [ ] Match row inserted in `matches` with `goalserve_static_id` set
- [ ] `createMatch()` called on-chain → `matches.contract_address` set
- [ ] Players seeded: `players` rows with initial odds
- [ ] Pre-match odds captured: `sync-odds` called ~1 hr before kickoff
- [ ] Match goes live: `matches.status` auto-transitions via Goalserve sync
- [ ] Bets placed: `lock-bet` Edge Function, `bets` rows inserted
- [ ] Live odds refresh: `sync-odds` running every 60s via pg_cron (no on-chain write)
- [ ] Live status/score: `sync-match-status` running every 60s via pg_cron
- [ ] Goal scored: `goal_events` row inserted, optional provisional credit
- [ ] Match ends: `settle-match` called with full result
- [ ] Bets resolved: `bets.status` updated, `provisional_credits` written
- [ ] On-chain settled: `settleMatch()` tx confirmed, hash stored in `bets.blockchain_settle_tx`
