# goal.live - General Information & User Flows

**Project:** goal.live  
**Part of:** vibe.live Ecosystem  
**Last Updated:** February 19, 2026

---

## 1. GENERAL INFO

### What is goal.live?

**goal.live** is a decentralized live football betting platform where viewers watch live matches and place bets on in-game outcomes. Unlike traditional bookmakers, goal.live offers:

- **Real-time betting** - Bet on "Next Goal Scorer" and "Match Winner" while watching live
- **Crypto-native** - Wallet-based, USDC payments, instant blockchain settlement
- **Interactive UI** - 22 player buttons displayed on sides of screen (Team A left, Team B right)
- **Browser extension** - Overlays on YouTube, Twitch, ESPN live streams (Phase 1)
- **Decentralized settlement** - Smart contracts with oracle-verified match data

### External Data Requirements

We need **real-time sports data** from external providers:

| Data Type           | Source                                  | Purpose                                    | Update Frequency                 |
| ------------------- | --------------------------------------- | ------------------------------------------ | -------------------------------- |
| **Match Detection** | ⚡ Chainlink CRE → Opta Sports API      | Identify which match is being streamed     | On page load                     |
| **Player Lineup**   | ⚡ Chainlink CRE → Opta Sports API      | Get 22 players (names, numbers, positions) | Pre-match (15min before kickoff) |
| **Goal Events**     | ⚡ Chainlink CRE → Opta Sports API      | Real-time goal scorer notifications        | Immediate (within 10-30 seconds) |
| **Match State**     | ⚡ Chainlink CRE → Opta Sports API      | Current score, time, period (1st/2nd half) | Every 30 seconds                 |
| **Official Result** | ⚡ Chainlink CRE → Opta Sports API      | Final score + all goal scorers (confirmed) | At full-time whistle             |
| **Odds Data**       | Internal algorithm OR external odds API | Dynamic odds for each player/outcome       | Every minute (or after each bet) |

**Why Chainlink CRE?**

- Tamper-proof oracle network
- Connects smart contracts to real-world sports data
- Ensures fair, transparent settlement (no manual intervention)

### How Game-Betting Execution Works

**Core Betting Mechanism:**

```
1. USER PLACES BET
   - Click player button (e.g., "Messi to score next - 4.5x")
   - Confirm bet amount (e.g., $10 USDC)
   - Wallet transaction → Funds locked in smart contract

2. DURING GAME (IN-PLAY)

   2a. USER CAN CHANGE BET ANYTIME (with penalty)
   - User bets $10 on Messi (4.5x odds)
   - 15 minutes later, wants to switch to Ronaldo
   - Click "Change Bet" → Select new player (Ronaldo)
   - Penalty deducted: e.g., 5% fee = $0.50 slashed
   - New effective bet: $9.50 on Ronaldo at current odds (3.2x)
   - User can change multiple times (penalty per change)
   - Balance updates in REAL-TIME after each change

   2b. GOAL SCORED
   - Goal scored → Chainlink CRE detects event
   - Platform CREDITS user's balance (e.g., +$45 USDC)
   - Balance shown as "PENDING PAYOUT" (not transferred yet)
   - User can continue betting with wallet funds OR change existing bet

3. AFTER GAME (SETTLEMENT)
   - Match ends → Chainlink CRE confirms official result
   - Smart contract processes ALL bets from that match
   - Recalculates final balance considering all bet changes + penalties
   - Final payouts transferred to winners' wallets
   - Only then can users WITHDRAW their winnings
   - If goal scorer changed (e.g., Messi → Ronaldo), correct winners paid
```

**Key Distinction: Real-time Balance ≠ Withdrawable Funds**

- **Balance Updates** = Shown in real-time during game (provisional)
- **Bet Changes** = Allowed anytime with penalty (math TBD - e.g., 5% fee, flat $1, etc.)
- **Withdrawals/Payouts** = Only possible after game ends + final settlement

This allows:

- **Flexibility**: Change your bet as match dynamics shift
- **Engagement**: Balance updates live (not just at goal events)
- **Fairness**: Penalties prevent free-riding on live info
- **Accuracy**: Final settlement uses official data only

---

## 2. PRE-MATCH

### Odds Creation

**When:** 15 minutes before kickoff until match starts

**How Odds Are Calculated:**

| Bet Type             | Odds Source                                        | Example                                        |
| -------------------- | -------------------------------------------------- | ---------------------------------------------- |
| **Next Goal Scorer** | Player's goal-scoring probability + pool liquidity | Messi: 4.5x, Benzema: 5.2x, Defender: 15x      |
| **Match Winner**     | Historical performance + betting pool distribution | Real Madrid: 1.8x, Barcelona: 2.1x, Draw: 3.2x |

**Odds Algorithm (Simplified):**

```
For "Next Goal Scorer":
  Base Odds = 1 / Player's Goal Probability

  Example:
  - Messi (striker, 22% chance) → 1/0.22 = 4.5x
  - Benzema (striker, 19% chance) → 1/0.19 = 5.2x
  - Carvajal (defender, 2% chance) → 1/0.02 = 50x

Dynamic Adjustment:
  - If many bets on Messi → Odds decrease to 3.8x
  - If few bets on Carvajal → Odds increase to 60x
  - Ensures balanced pool (like Polymarket)
```

**Odds Update Frequency:**

- Pre-match: Every 5 minutes
- In-play: Every minute OR after significant bet volume

### Off-Chain Data (Pre-Match)

**Data Fetched Before Match:**

1. **Match Metadata**
   - Teams: "Real Madrid vs Barcelona"
   - Venue: "Santiago Bernabéu"
   - Kickoff time: "20:00 CET"
   - Competition: "La Liga"

2. **Player Lineup (22 players)**
   - Name: "Lionel Messi"
   - Number: 10
   - Position: Forward
   - Team: Home/Away
   - Photo URL: `https://...`

3. **Initial Odds**
   - Next Goal Scorer odds for all 22 players
   - Match Winner odds (Home/Away/Draw)

**Storage:**

- Off-chain database (PostgreSQL/Supabase)
- Cached in browser extension for fast loading
- Updated every 5 minutes via Chainlink CRE tasks

### Pre-Match User Experience

**User Flow (Before Kickoff):**

```
1. USER NAVIGATES TO LIVE STREAM
   - Opens YouTube/Twitch stream of "Real Madrid vs Barcelona"
   - Extension detects match via video title/metadata

2. EXTENSION ACTIVATES
   - Shows notification: "⚽ Match detected: Real Madrid vs Barcelona"
   - Displays 22 player buttons on sides (11 left, 11 right)
   - Shows countdown to kickoff: "Match starts in 8 minutes"

3. USER PLACES PRE-MATCH BETS
   - Clicks "Messi" button → Modal opens
   - Sees bet options:
     * "Messi to score first goal (6.5x)" ✅
     * "Messi to score anytime (3.2x)"
     * "Barcelona to win (2.1x)"
   - Selects "Messi to score first goal - $20 USDC"
   - Confirms wallet transaction → Bet locked

4. BET CONFIRMED
   - Notification: "✅ Bet placed: Messi first goal - $20 @ 6.5x"
   - Bet appears in "MY BETS" panel at bottom
   - Funds ($20) locked in smart contract
   - Potential payout shown: "$130 USDC"

5. WAIT FOR KICKOFF
   - User watches pre-match analysis
   - Can place more bets (Match Winner, other players)
   - Odds update in real-time as other users bet
```

**UI State (Pre-Match):**

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏠 goal.live            Real Madrid vs Barcelona - KICKOFF IN 5:32 │
├───────┬─────────────────────────────────────────────────────┬───────┤
│ REAL  │                                                     │  BARCA│
│       │         [Pre-match show on stream]                  │       │
│ GK #1 │                                                     │ GK #13│
│ DF #2 │         🔴 MATCH STARTS IN 5:32                     │ DF #14│
│ ...   │                                                     │  ...  │
│ #10   │         Place your bets now!                        │ MESSI │
│ 3.8x  │                                                     │ 4.5x ⭐│
│       │                                                     │       │
├───────┴─────────────────────────────────────────────────────┴───────┤
│ MY BETS (1): Messi first goal - $20 @ 6.5x | Potential: $130 💰    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. IN-GAME (LIVE BETTING)

### In-Game User Flow

**User Flow (During Match):**

```
1. MATCH STARTS (0:00)
   - Extension switches to "LIVE" mode
   - Player buttons remain active (in-play betting enabled)
   - Current score displayed: "0-0"
   - Match time updates: "12'" (12th minute)

2. USER PLACES IN-PLAY BET (15th minute)
   - Score still 0-0
   - User clicks "Benzema" button
   - Modal shows: "Benzema next goal (5.2x) - Bet $10"
   - Confirms → Bet locked in smart contract
   - MY BETS panel updates: "Benzema next goal - $10 @ 5.2x"

3. GOAL SCORED - INITIAL DECISION (23rd minute)
   - ⚡ Chainlink CRE detects: "GOAL - Messi (23')"
   - Extension shows notification: "⚽ GOAL! Messi scored (23')"
   - Score updates: "1-0"

   FOR USERS WHO BET ON MESSI:
   - Balance CREDITED: +$130 (first goal bet from pre-match)
   - Status: "PENDING PAYOUT 💰" (green, not transferred yet)
   - Can see provisional winning in MY BETS panel

   FOR USERS WHO BET ON BENZEMA:
   - Bet still active (next goal could be Benzema)

4. GOAL DECISION CHANGED (25th minute - 2min later)
   - VAR review / Referee decision: "Actually touched by Ronaldo!"
   - ⚡ Chainlink CRE updates: "GOAL CORRECTION - Ronaldo (23')"
   - Extension shows: "⚠️ Goal changed: Ronaldo scored (not Messi)"

   FOR USERS WHO BET ON MESSI:
   - Provisional credit REMOVED: -$130
   - Status changes to "BET LOST ❌"
   - Balance back to $0 pending

   FOR USERS WHO BET ON RONALDO:
   - Balance CREDITED: +$52 (if they bet $10 @ 5.2x)
   - Status: "PENDING PAYOUT 💰"

5. SECOND GOAL (67th minute)
   - ⚡ Chainlink CRE: "GOAL - Benzema (67')"
   - Extension: "⚽ GOAL! Benzema scored"
   - Score: "2-0"

   FOR USERS WHO BET BENZEMA NEXT GOAL:
   - Balance CREDITED: +$52 ($10 @ 5.2x)
   - Status: "PENDING PAYOUT 💰"

5a. USER CHANGES BET (45th minute - Example)
   - User originally bet $10 on Messi @ 4.5x
   - At 45', Messi looks tired, user wants to switch to Benzema
   - Clicks Messi bet card → "CHANGE BET" button
   - Selects new player: Benzema (current odds: 3.8x)
   - System shows:
     * Original bet: $10 on Messi
     * Change penalty: $0.50 (5% fee - TBD)
     * New effective bet: $9.50 on Benzema @ 3.8x
     * Potential new payout: $36.10
   - User confirms → Transaction processed
   - Balance updates IMMEDIATELY:
     * Old potential: $45 (Messi) → $0 (cancelled)
     * New potential: $36.10 (Benzema)
   - Can change again later (another penalty applied)

6. MATCH CONTINUES
   - User can keep placing NEW bets on next goal scorer
   - User can CHANGE existing bets (with penalties each time)
   - Odds adjust dynamically (strikers' odds decrease as time runs out)
   - Match Winner odds update based on current score
   - Balance shows real-time potential winnings (all provisional)

**Real-Time Processing:**

| Event              | Platform Action                             | User Sees                     | Smart Contract                      |
| ------------------ | ------------------------------------------- | ----------------------------- | ----------------------------------- |
| **Goal Scored**    | Chainlink CRE detects → Update database     | "⚽ GOAL! Messi (23')"        | Mark bets as "provisionally won"    |
| **Credit Balance** | Calculate winnings → Show in UI             | "+$130 PENDING 💰"            | Funds stay locked (not transferred) |
| **Goal Corrected** | Chainlink CRE update → Reverse credit       | "⚠️ Goal changed to Ronaldo"  | Update provisional winners          |
| **Bet Placed**     | Lock funds in contract → Add to active bets | "✅ Bet placed - Benzema $10" | Execute smart contract call         |
| **Bet Changed**    | Apply penalty → Update bet record           | "🔄 Bet changed to Ronaldo (-$0.50 penalty)" | Update on-chain bet params |
| **Score Update**   | Fetch from Chainlink CRE every 30s          | "Score: 2-0 (67')"            | No action (read-only)               |

**Technical Flow (Goal Event):**

```

GOAL DETECTED:

1. Chainlink CRE webhook → goal.live backend
2. Backend updates database:
   - goals table: INSERT {scorer: "Messi", minute: 23, match_id}
   - bets table: UPDATE bets WHERE player="Messi" SET provisional_status="won"
3. WebSocket broadcast to all viewers:
   - Message: {type: "GOAL", scorer: "Messi", minute: 23}
4. Extension receives → Shows notification + credits balances
5. Smart contract: Mark bets (on-chain state NOT changed yet)

GOAL CORRECTED:

1. Chainlink CRE correction webhook → Backend
2. Database update:
   - goals table: UPDATE {scorer: "Ronaldo"} WHERE minute=23
   - bets table: Reverse Messi credits, apply to Ronaldo
3. WebSocket: {type: "GOAL_CORRECTION", old: "Messi", new: "Ronaldo"}
4. Extension: Show alert + update balances

````

### Off-Chain Data (In-Game)

**Live Data Updates:**

| Data Point          | Update Frequency   | Source                | Purpose                         |
| ------------------- | ------------------ | --------------------- | ------------------------------- |
| **Match State**     | Every 30 seconds   | Chainlink CRE         | Current score, time, period     |
| **Goal Events**     | Immediate (10-30s) | Chainlink CRE webhook | Trigger bet settlements         |
| **Player Stats**    | Every 2 minutes    | Chainlink CRE         | Shots, assists (future feature) |
| **Odds Adjustment** | Every 60 seconds   | Internal algorithm    | Update betting odds             |
| **Bet Pool Volume** | Real-time          | Database query        | Show total bets on each player  |

**In-Game Database Operations:**

```sql
-- Track provisional winnings (NOT paid out yet)
CREATE TABLE provisional_credits (
  id UUID PRIMARY KEY,
  user_wallet TEXT,
  bet_id UUID REFERENCES bets(id),
  amount BIGINT, -- In USDC smallest unit
  credited_at TIMESTAMP,
  goal_event_id UUID REFERENCES goals(id),
  status TEXT -- 'active' | 'reversed' | 'confirmed'
);

-- Track goal events (including corrections)
CREATE TABLE goals (
  id UUID PRIMARY KEY,
  match_id UUID,
  scorer_player_id TEXT,
  minute INTEGER,
  team TEXT, -- 'home' | 'away'
  is_corrected BOOLEAN DEFAULT FALSE,
  corrected_from TEXT, -- Original scorer if changed
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- NEW: Track bet changes (for penalty calculation)
CREATE TABLE bet_changes (
  id UUID PRIMARY KEY,
  bet_id UUID REFERENCES bets(id),
  user_wallet TEXT,
  from_player_id TEXT, -- Original player
  to_player_id TEXT,   -- New player
  from_odds DECIMAL(5, 2),
  to_odds DECIMAL(5, 2),
  penalty_amount BIGINT, -- Penalty deducted (in USDC smallest unit)
  penalty_percentage DECIMAL(5, 2), -- e.g., 5.00 for 5%
  remaining_amount BIGINT, -- Amount after penalty
  changed_at TIMESTAMP DEFAULT NOW(),
  minute INT -- Match minute when changed
);

-- Update bets table to track total penalties
ALTER TABLE bets ADD COLUMN total_penalties BIGINT DEFAULT 0;
ALTER TABLE bets ADD COLUMN change_count INT DEFAULT 0;
ALTER TABLE bets ADD COLUMN current_player_id TEXT; -- Tracks current bet target
````

**Bet Change Penalty Logic (TBD - Options):**

1. **Percentage-based:** 5% of remaining bet amount per change
2. **Flat fee:** $1 USDC per change (regardless of bet size)
3. **Progressive:** 5% first change, 10% second, 15% third, etc.
4. **Time-based:** Higher penalty closer to match end (e.g., 3% @ 30min, 7% @ 80min)
5. **Hybrid:** $0.50 flat + 3% of bet amount

### In-Game User Experience

**UI State (Live Match - 67th minute):**

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏠 goal.live    🔴 LIVE: Real Madrid 2-0 Barcelona | 67' ⚡        │
├───────┬─────────────────────────────────────────────────────┬───────┤
│ REAL  │                                                     │ BARCA │
│       │         [Live match video stream]                   │       │
│ GK #1 │                                                     │ GK #13│
│ DF #2 │         ⚽ Recent: Benzema scored (67')             │ DF #14│
│ ...   │                                                     │  ...  │
│ BENZ  │         Score: 2-0                                  │ MESSI │
│ ⚽5.2x │         Next goal: Click player to bet             │  ❌   │
│       │                                                     │       │
├───────┴─────────────────────────────────────────────────────┴───────┤
│ MY BETS (3):                                                        │
│ ✅ Ronaldo first goal $10 → +$52 PENDING 💰 (changed from Messi)   │
│ ✅ Benzema next goal $10 → +$52 PENDING 💰                         │
│ ❌ Messi next goal $20 → LOST (goal credited to Ronaldo)           │
│ 📊 PROVISIONAL BALANCE: +$104 (Paid after match ends)              │
└─────────────────────────────────────────────────────────────────────┘
```

**Key UI Elements:**

- **PENDING 💰** = Credits shown, but NOT paid yet
- **Goal corrections** = Clearly communicated with alerts
- **Live score** = Always visible at top
- **Greyed out players** = Already scored (can't bet again for "next goal")

---

## 4. AFTER GAME (POST-MATCH SETTLEMENT)

### After-Game User Flow

**User Flow (After Final Whistle):**

```
1. MATCH ENDS (90+3')
   - Referee blows final whistle
   - Extension detects: "FULL TIME - Real Madrid 2-0 Barcelona"
   - All betting buttons DISABLED (no more bets)
   - Processing overlay shows: "⏳ Waiting for official confirmation..."

2. OFFICIAL RESULT CONFIRMATION (1-2 minutes after FT)
   - ⚡ Chainlink CRE fetches OFFICIAL match result from Opta
   - Confirms:
     * Final Score: Real Madrid 2-0 Barcelona
     * Goal 1: Ronaldo (23') ✅ CONFIRMED
     * Goal 2: Benzema (67') ✅ CONFIRMED
     * Match Winner: Real Madrid ✅

   - Backend receives confirmation → Triggers settlement

3. SMART CONTRACT SETTLEMENT (Automated)
   - All bets from this match processed on-chain
   - Winning bets → Funds transferred to users' wallets
   - Losing bets → Funds burned/sent to house/liquidity pool

   Process per bet type:

   A. "Next Goal Scorer" bets:
      - Ronaldo first goal bets → PAID ✅
      - Benzema next goal bets → PAID ✅
      - Messi bets → LOST ❌ (funds not returned)

   B. "Match Winner" bets:
      - Real Madrid bets → PAID ✅ (e.g., $10 @ 1.8x = $18)
      - Barcelona bets → LOST ❌
      - Draw bets → LOST ❌

4. USER RECEIVES PAYOUTS (30-60 seconds)
   - Wallet notification: "💰 +$104 USDC received"
   - Extension shows confirmation:
     "✅ SETTLEMENT COMPLETE
      - Ronaldo first goal: +$52
      - Benzema next goal: +$52
      - Total payout: $104 USDC"

   - MY BETS panel updates:
     All "PENDING 💰" → "PAID ✅"

5. POST-MATCH SUMMARY
   - Extension shows match summary:
     * Final Score: 2-0
     * Your bets: 2/3 won (66% win rate)
     * Total wagered: $40
     * Total payout: $104
     * Net profit: +$64 💰

   - Leaderboard updated (XP earned, rank)
   - Option to share results on social media

6. NEXT MATCH
   - Extension prompts: "Next match in 30 minutes: PSG vs Bayern"
   - User can browse upcoming matches
   - Cycle repeats for next game
```

### Platform Execution (After Game)

**Automated Settlement Process:**

```
STEP 1: OFFICIAL RESULT FETCHED (T+0 to T+120 seconds)
- Chainlink CRE task: fetchMatchResult(matchId)
- API call to Opta: GET /matches/{matchId}/result
- Response:
  {
    "status": "finished",
    "winner": "home",
    "score": {"home": 2, "away": 0},
    "goals": [
      {"scorer": "Ronaldo", "minute": 23, "team": "home"},
      {"scorer": "Benzema", "minute": 67, "team": "home"}
    ],
    "confirmed_at": "2026-02-19T22:53:42Z"
  }
- Store in database with confirmed=true flag

STEP 2: SETTLEMENT SMART CONTRACT TRIGGERED (T+120 to T+180 seconds)
- Backend calls smart contract: settleBets(matchId)
- Contract reads oracle data (Chainlink CRE result)
- For each bet in match:
  IF bet outcome matches result:
    - Transfer winnings to user wallet
    - Update on-chain status: settled=true, won=true
  ELSE:
    - Burn/redistribute losing funds
    - Update status: settled=true, won=false

STEP 3: DATABASE UPDATES (Concurrent with STEP 2)
- bets table:
  UPDATE bets
  SET status='settled',
      settled_at=NOW(),
      payout_tx_hash='0x...'
  WHERE match_id=... AND outcome=winning_outcome

- provisional_credits table:
  UPDATE provisional_credits
  SET status='confirmed'
  WHERE bet_id IN (winning_bets)

- user_balances table:
  UPDATE user_balances
  SET total_winnings = total_winnings + payout_amount
  WHERE wallet=...

STEP 4: NOTIFICATIONS SENT (T+180 to T+200 seconds)
- WebSocket broadcast to all users in match:
  {
    type: "SETTLEMENT_COMPLETE",
    matchId: "...",
    finalScore: {home: 2, away: 0},
    userPayouts: [{wallet: "0x...", amount: 104000000}] // Per user
  }

- Extension shows payout notification
- Email/Push notification (optional): "You won $104 on Real Madrid vs Barcelona!"

STEP 5: CLEANUP (T+5 minutes)
- Archive match data
- Remove from active_matches table
- Clear provisional_credits for this match
- Update leaderboards and user stats
```

**Settlement Smart Contract (Simplified):**

```solidity
// Simplified settlement logic
function settleBets(bytes32 matchId) external onlyOracle {
  MatchResult memory result = getOracleResult(matchId); // From Chainlink CRE
  Bet[] memory bets = getMatchBets(matchId);

  for (uint i = 0; i < bets.length; i++) {
    Bet memory bet = bets[i];

    // Check if bet won
    bool won = false;
    if (bet.betType == BetType.NEXT_GOAL_SCORER) {
      won = (bet.playerId == result.goals[bet.goalIndex].scorer);
    } else if (bet.betType == BetType.MATCH_WINNER) {
      won = (bet.outcome == result.winner);
    }

    if (won) {
      // Calculate payout
      uint256 payout = bet.amount * bet.odds / 100; // odds in basis points

      // Transfer winnings
      USDC.transfer(bet.bettor, payout);

      emit BetSettled(bet.id, true, payout);
    } else {
      // Bet lost - funds already in contract
      emit BetSettled(bet.id, false, 0);
    }

    bet.settled = true;
  }
}
```

### After-Game User Experience

**UI State (Post-Settlement):**

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏠 goal.live    ✅ MATCH ENDED: Real Madrid 2-0 Barcelona          │
├─────────────────────────────────────────────────────────────────────┤
│                    🎉 SETTLEMENT COMPLETE 🎉                         │
│                                                                     │
│  Final Score: Real Madrid 2-0 Barcelona                             │
│  Your Performance: 2/3 bets won (66% win rate) ⭐                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ YOUR BETS                                                    │   │
│  │ ✅ Ronaldo first goal - $10 @ 5.2x → +$52 PAID              │   │
│  │ ✅ Benzema next goal - $10 @ 5.2x → +$52 PAID               │   │
│  │ ❌ Messi next goal - $20 @ 6.5x → LOST                      │   │
│  │                                                              │   │
│  │ Total Wagered: $40 USDC                                      │   │
│  │ Total Payout: $104 USDC 💰                                   │   │
│  │ Net Profit: +$64 🎉                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [📊 View Leaderboard]  [🔄 Bet on Next Match]  [📤 Share]        │
│                                                                     │
│  Next Match: PSG vs Bayern Munich (Starts in 28 minutes)           │
└─────────────────────────────────────────────────────────────────────┘
```

**Transaction Receipt (Wallet):**

```
💰 USDC Received
From: goal.live Settlement Contract
Amount: +104 USDC
Match: Real Madrid 2-0 Barcelona
Timestamp: 2026-02-19 22:54:18 UTC
Tx Hash: 0x7a3f9c2e1b...
```

### Edge Cases Handled

| Scenario                       | Platform Behavior                                               |
| ------------------------------ | --------------------------------------------------------------- |
| **Match Abandoned**            | All bets refunded (no winners)                                  |
| **Delayed Official Result**    | Wait up to 30 minutes, then manual review                       |
| **Multiple Goal Corrections**  | Only FINAL official result counts for settlement                |
| **User Disconnects Mid-Match** | Bets still settled (on-chain), user sees result when reconnects |
| **Oracle Failure**             | Fallback to secondary oracle → Manual settlement if needed      |
| **Smart Contract Bug**         | Emergency pause → Funds locked until fix deployed               |

---

## SUMMARY: KEY PRINCIPLE

**⚠️ CRITICAL SETTLEMENT MODEL:**

```
IN-GAME: Credits shown ≠ Money transferred
  ↓
  User sees provisional winnings in real-time
  Status: "PENDING PAYOUT 💰"
  ↓
POST-GAME: Official result → Final settlement
  ↓
  Smart contract transfers actual funds
  Status: "PAID ✅"
```

**Why This Model?**

1. **Prevents Disputes**: Goals can be corrected (Messi → Ronaldo)
2. **Ensures Accuracy**: Only official final stats count
3. **User Engagement**: Shows winnings immediately (dopamine hit)
4. **Fair Settlement**: No manual intervention, oracle-verified

**User sees winnings during game, receives money after official confirmation.**

---

**END OF GENERAL INFO**
