# goal.live - Live Football Betting Platform

**Project Status:** Design Phase  
**Last Updated:** February 19, 2026  
**Part of:** vibe.live Ecosystem

---

> ⚠️ **CRITICAL SETTLEMENT MODEL:**  
> **DURING GAME:** Users see provisional credits (+$X PENDING 💰) when goals scored  
> **AFTER GAME:** Actual payouts transferred after official result confirmed  
> **WHY:** Goals can be corrected (VAR, referee decisions) - only OFFICIAL stats count for final settlement

---

## 🎯 EXECUTIVE SUMMARY

**goal.live** is a decentralized live football betting platform where viewers watch live matches and bet on outcomes by clicking interactive player objects displayed on the sides of the screen. Unlike traditional bookmakers (centralized, fiat-only, static odds), goal.live combines:

- **Polymarket-style prediction markets** - Decentralized liquidity, YES/NO shares, $1 settlement
- **Live in-play betting** - Real-time odds, automatic suspensions during VAR/penalties
- **Interactive sidebar UI** - 22 player objects (11 per team) arranged on screen sides for easy betting
- **Crypto-native** - Wallet-based, instant USDC settlements, memecoin per match

### Key Distinction from air.fun

| Feature                | air.fun                                                           | goal.live                                                                           |
| ---------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Agent Placement**    | Streamer manually places agents at exact X,Y coordinates on video | **Players automatically positioned on SIDES of screen** (Team A left, Team B right) |
| **Use Case**           | General entertainment, creator monetization                       | **Live sports betting on football matches**                                         |
| **Interaction**        | Click/touch agents overlaid on video                              | **Click player cards in fixed sidebar layout**                                      |
| **Agent Count**        | 4-6 agents (flexible)                                             | **22 players** (11 per team, fixed)                                                 |
| **Positioning System** | Manual, precise positioning by streamer                           | **Automatic, standardized sidebar layout**                                          |

**Visual Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏠 goal.live                   LIVE: Real Madrid vs Barcelona      │
├───────┬─────────────────────────────────────────────────────┬───────┤
│ TEAM A│            VIDEO STREAM (LIVE MATCH)                │ TEAM B│
│       │                                                     │       │
│ GK #1 │                                                     │ GK #13│
│ DF #2 │                                                     │ DF #14│
│ DF #3 │                                                     │ DF #15│
│ DF #4 │      [Match plays in center viewport]              │ DF #16│
│ DF #5 │                                                     │ DF #17│
│ MF #6 │                                                     │ MF #18│
│ MF #7 │                                                     │ MF #19│
│ MF #8 │                                                     │ MF #20│
│ FW #9 │                                                     │ FW #21│
│ FW #10│                                                     │ FW #22│
│ FW #11│  ← Click player to bet on them →                   │       │
│       │                                                     │       │
├───────┴─────────────────────────────────────────────────────┴───────┤
│ MY BETS: Benzema to score (3.5x) - $10 | Next Goal: Real Madrid... │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ IMPLEMENTATION PHASES

### Phase 1: Browser Extension (MVP) - PRIORITY 1

**Goal:** Overlay betting interface on existing streaming platforms (YouTube, Twitch, Kick)

**Why Extension First:**

- Leverage existing live football streams (no need to source video)
- Huge existing audience (millions watching on YouTube/Twitch)
- Faster MVP (no streaming infrastructure needed)
- Lower bandwidth costs

**Scope:**

- Web-only (Chrome extension initially)
- 2 bet types: "Next Goal Scorer" (team-level), "Match Winner"
- Manual odds setting (platform acts as bookmaker)
- USDC payments on Base Sepolia testnet

**Reuse from air.fun filter:**

- Browser extension architecture (`filter/extension/`)
- Content script injection (`filter/extension/src/content/`)
- Platform detection (YouTube/Twitch/Kick) (`filter/extension/src/shared/platform-detect.ts`)
- Canvas overlay rendering (`filter/extension/src/content/viewer.ts`)
- WebSocket client (`filter/extension/src/shared/ws-client.ts`)

### Phase 2: Native Streaming - PRIORITY 2

**Goal:** Allow users to stream amateur/minor league matches

**Why Native Streaming Second:**

- Unlocks long-tail content (local leagues, amateur tournaments)
- Full control over stream quality and latency
- Can offer lower betting fees (no YouTube/Twitch cut)

**Scope:**

- WebRTC streaming (reuse `platform/services/webRTCService.ts`)
- Stream setup UI (reuse `platform/components/StreamSetup.tsx`)
- Mobile streaming support (React Native)

**Reuse from air.fun platform:**

- WebRTC P2P/SFU infrastructure
- Supabase stream storage
- Wallet integration (Thirdweb)

---

## 🎮 USER EXPERIENCE

### Bettor Flow (Extension - Phase 1)

```
1. Install goal.live Chrome extension
2. Visit YouTube/Twitch stream of live football match
3. Extension detects match → Injects sidebar UI
4. Connect wallet (Phantom/MetaMask)
5. See 22 player cards (11 per team) on screen sides
6. Click "Benzema (#9)" on right sidebar
   → Menu: "Benzema to score next (3.5x)" | "Match Winner: Real Madrid (1.8x)"
7. Select "Benzema to score next" → Enter $10 USDC
8. Confirm with wallet signature → Funds locked in contract
9. Bet appears in "MY BETS" panel at bottom (Status: ACTIVE)

--- DURING MATCH ---

10. User decides to CHANGE bet (45' minute)
   → Clicks bet card → "CHANGE BET" button
   → Selects new player: Modrić (current odds: 6.2x)
   → System calculates penalty: $0.50 (5% fee - TBD)
   → New effective bet: $9.50 on Modrić @ 6.2x
   → User confirms → Balance updates IMMEDIATELY
   → Can change again (penalty applies each time)

11. Benzema scores! (67' minute)
   → User doesn't win (bet changed to Modrić)
   → Balance stays at: $0 PENDING

12. Modrić scores! (82' minute)
   → Provisional credit: "+$58.90 USDC PENDING 💰" ($9.50 × 6.2x)
   → Status: PENDING PAYOUT

13. ⚠️ VAR review (84' minute): Actually touched by Rodrygo!
   → Provisional credit reversed: "+$58.90 → $0"
   → Alert: "Goal changed to Rodrygo"

--- AFTER MATCH ---

14. Match ends (90+3') → "⏳ Waiting for official confirmation..."
15. Official result confirmed (90+5') → Rodrygo goal verified
   → Smart contract recalculates considering:
     * Original bet: $10 on Benzema
     * Change penalty: -$0.50
     * Final bet: $9.50 on Modrić
     * Result: Rodrygo scored (lost)
   → No payout (bet lost)
16. Leaderboard updates with XP earned
```

**⚠️ KEY FEATURES:**

- **Real-time balance:** Updates instantly with each bet change
- **Bet changes:** Allowed anytime with penalty (math TBD: 5% suggested)
- **Withdrawals:** Only possible after match ends + final settlement
- **Penalty tracking:** All penalties recorded for final settlement calculation

### Visual States (Player Cards)

| State                 | Visual                                       | Trigger                            |
| --------------------- | -------------------------------------------- | ---------------------------------- |
| **Default**           | Small card with player number + name         | Always                             |
| **High xG**           | Glowing orange border                        | Player expected goals >0.5         |
| **Just Touched Ball** | Pulse animation                              | Player event detected              |
| **Bet Placed**        | Green checkmark overlay + "🔄 Change" button | User has active bet on this player |
| **Bets Frozen**       | Gray + "⏸️" icon                             | Market suspended (VAR, penalty)    |
| **Goal Scored**       | Explosion animation + "⚽"                   | Player scored goal                 |

**Bet Card States (in "MY BETS" panel):**

| State               | Visual                                  | Trigger                                   |
| ------------------- | --------------------------------------- | ----------------------------------------- |
| **Active**          | Blue border + "🔄 CHANGE BET" button    | Bet placed, match in progress             |
| **Changed**         | Yellow indicator + penalty amount shown | User changed bet (e.g., "-$0.50 penalty") |
| **Provisional Win** | Green + "+$X PENDING 💰"                | Goal scored by selected player            |
| **Settled Won**     | Green + "✅ PAID $X"                    | Match ended, funds transferred            |
| **Settled Lost**    | Red + "❌ LOST"                         | Match ended, no payout                    |

---

## 🛠️ TECHNICAL ARCHITECTURE

### System Components

| Component              | Technology                      | Purpose                                                 | Status    |
| ---------------------- | ------------------------------- | ------------------------------------------------------- | --------- |
| **Extension Frontend** | React 18 + TypeScript           | Player sidebar UI, betting modal, wallet integration    | 🔵 Design |
| **Content Script**     | Vanilla TypeScript              | Inject sidebar, detect platform, capture match metadata | 🔵 Design |
| **WebSocket Server**   | Node.js + ws                    | Sync player data, odds updates, bet settlements         | 🔵 Design |
| **Odds Engine**        | Custom API + **Chainlink CRE**  | Calculate real-time odds, freeze logic                  | 🔵 Design |
| **Settlement Oracle**  | **Chainlink CRE** (Sports Data) | Detect goals/cards, trigger settlements                 | 🔵 Design |
| **CLOB (Order Book)**  | Solana Serum or custom Rust     | Match buy/sell orders for YES/NO shares                 | 🔵 Design |
| **Memecoin Contract**  | Solana SPL Token                | Deploy match-specific token, settle/burn                | 🔵 Design |
| **Backend API**        | Node.js + Express + PostgreSQL  | User accounts, bet history, leaderboard                 | 🔵 Design |

### Browser Extension Architecture

```
goal.live-extension/
├── manifest.json                    # Chrome Manifest V3
├── background/
│   └── service-worker.ts           # WebSocket proxy, message routing
├── content/
│   ├── main.ts                     # Entry point, platform detection
│   ├── player-sidebar.ts           # Render 22 player cards on sides
│   ├── betting-modal.ts            # Bet placement UI
│   └── match-detector.ts           # Extract match metadata (teams, time)
├── shared/
│   ├── types.ts                    # Player, Bet, Match types
│   ├── ws-client.ts                # WebSocket wrapper (reuse from filter)
│   └── platform-detect.ts          # YouTube/Twitch/Kick detection (reuse)
└── popup/
    └── popup.tsx                   # Settings, wallet connection
```

### Data Flow (Phase 1 MVP)

```
Step 1: User visits YouTube stream (e.g., "Real Madrid vs Barcelona LIVE")
  ↓
Step 2: Extension detects match via title parsing ("Real Madrid vs Barcelona")
  ↓
Step 3: Content script injects sidebars (11 player cards left, 11 right)
  ↓
Step 4: **Chainlink CRE** fetches live player data (names, numbers, positions from Opta API)
  ↓
Step 5: WebSocket server broadcasts player data → Extension renders cards
  ↓
Step 6: User clicks "Benzema (#9)" card on right sidebar
  ↓
Step 7: Betting modal opens with 2 options:
         - "Benzema to score next (3.5x)"
         - "Match Winner: Real Madrid (1.8x)"
  ↓
Step 8: User selects "Benzema to score next" → Enters $10 USDC
  ↓
Step 9: Wallet prompts for signature (Thirdweb SDK)
  ↓
Step 10: Transaction submitted to Solana:
          - Deduct $10 USDC from wallet
          - Mint YES shares for "Benzema scores" outcome
  ↓
Step 11: Bet recorded in PostgreSQL + confirmed to user
  ↓
Step 12: User watches stream. **Chainlink CRE** monitors match events.
  ↓
Step 13: Benzema scores! **Chainlink CRE** detects goal event (Opta API webhook)
  ↓
Step 14: Settlement oracle triggers smart contract:
          - All "Benzema to score" YES shares → $1 per share
          - User's shares redeemed: 10 shares × $3.5 = $35 USDC
  ↓
Step 15: USDC credited to user's wallet instantly
  ↓
Step 16: Leaderboard updates, XP awarded, match memecoin appreciates
```

### Chainlink CRE Integration Points

**Chainlink Compute Runtime Environment (CRE)** handles all off-chain data fetching and computation:

| Integration Point                   | Purpose                                                                   | CRE Implementation                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **1. Live Player Data**             | Fetch player names, jersey numbers, positions from Opta/Stats Perform API | `CRE Task: fetchPlayerData(matchId)` - Polls Opta API every 30s, caches in IPFS                     |
| **2. Real-Time Match Events**       | Detect goals, cards, corners, VAR reviews                                 | `CRE Task: monitorMatchEvents(matchId)` - Subscribes to Opta webhooks, triggers on-chain settlement |
| **3. Odds Calculation**             | Calculate dynamic odds based on xG, possession, bet flow                  | `CRE Task: calculateOdds(matchId, betType)` - Runs ML model, updates CLOB every 10s                 |
| **4. Bet Freeze Logic**             | Suspend bets during VAR, penalties, dangerous attacks                     | `CRE Task: detectFreezeEvents(matchId)` - Monitors xG >0.7, VAR signals, penalty awards             |
| **5. Settlement Verification**      | Verify goal scorer, card recipient, corner count                          | `CRE Task: verifyOutcome(betId, eventData)` - Cross-references Opta + blockchain state              |
| **6. xG (Expected Goals) Tracking** | Calculate shot quality for visual feedback                                | `CRE Task: calculateXG(shotData)` - ML model (trained on historical data)                           |

**Reference:** https://docs.chain.link/cre/getting-started/part-1-project-setup-ts

**CRE Architecture Overview:**

```
┌─────────────────────────────────────────────────────────────┐
│                    Chainlink CRE Layer                       │
├─────────────────────────────────────────────────────────────┤
│  CRE Task 1: fetchPlayerData                                │
│    → Polls Opta API every 30s                               │
│    → Returns: [{playerId, name, number, team}]              │
│                                                              │
│  CRE Task 2: monitorMatchEvents                             │
│    → Subscribes to Opta webhooks (goal, card, corner)       │
│    → Triggers: settleBet(betId, outcome)                    │
│                                                              │
│  CRE Task 3: calculateOdds                                  │
│    → Inputs: xG, possession, bet volume                     │
│    → Outputs: {nextGoalOdds: 3.5, matchWinnerOdds: 1.8}    │
│                                                              │
│  CRE Task 4: detectFreezeEvents                             │
│    → Monitors: xG >0.7, VAR signal, penalty award          │
│    → Action: broadcastFreeze(duration: 5s)                  │
│                                                              │
│  CRE Task 5: verifyOutcome                                  │
│    → Cross-reference: Opta data ↔ On-chain bet state       │
│    → Prevent: Oracle manipulation, data discrepancies       │
└─────────────────────────────────────────────────────────────┘
           ↓ (Off-chain compute) ↑ (On-chain verification)
┌─────────────────────────────────────────────────────────────┐
│              Solana Blockchain (Settlement)                  │
│  Smart Contracts: BettingPool.sol, MatchMemecoin.sol        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 MVP SCOPE (8-Week Timeline)

### Week 1-2: Extension Infrastructure

**Deliverables:**

- Chrome extension manifest + basic structure
- Platform detection (YouTube, Twitch, Kick)
- Match metadata extraction (team names, kickoff time)
- Wallet integration (Phantom, MetaMask)
- **Chainlink CRE setup** (fetch player data from Opta API)

**Reuse from air.fun:**

```bash
# Copy filter extension base
cp -r filter/extension goal.live-extension

# Modify content scripts
# OLD: filter/extension/src/content/viewer.ts (canvas overlay on video)
# NEW: goal.live-extension/src/content/player-sidebar.ts (sidebar cards)
```

### Week 3-4: Player Sidebar UI

**Deliverables:**

- Render 22 player cards (11 left sidebar, 11 right sidebar)
- Player data from **Chainlink CRE** (names, numbers, teams)
- Visual states (default, high xG, bet placed, frozen)
- Touch/click interaction → Betting modal opens

**Key Difference from air.fun:**

```typescript
// air.fun: Agents positioned at exact X,Y coordinates on video
const agentX = agent.x * canvasWidth; // 0-1 normalized
const agentY = agent.y * canvasHeight;

// goal.live: Players in FIXED SIDEBAR positions
const playerY = playerIndex * cardHeight + padding; // Vertical stack
const playerX =
  player.team === "home" ? 10 : window.innerWidth - cardWidth - 10;
// Left sidebar (x=10px) or Right sidebar (x=window.width - cardWidth)
```

**Layout Implementation:**

```typescript
// goal.live-extension/src/content/player-sidebar.ts

interface Player {
  id: string;
  name: string; // "Karim Benzema"
  jerseyNumber: number; // 9
  team: "home" | "away"; // Determines left or right sidebar
  position: "GK" | "DF" | "MF" | "FW";
  xG: number; // Expected goals (0-1) from Chainlink CRE
}

function renderPlayerSidebars(players: Player[]) {
  const homePlayers = players.filter((p) => p.team === "home"); // 11 players
  const awayPlayers = players.filter((p) => p.team === "away"); // 11 players

  const leftSidebar = createSidebar("left", homePlayers);
  const rightSidebar = createSidebar("right", awayPlayers);

  document.body.appendChild(leftSidebar);
  document.body.appendChild(rightSidebar);
}

function createSidebar(
  side: "left" | "right",
  players: Player[],
): HTMLDivElement {
  const sidebar = document.createElement("div");
  sidebar.style.position = "fixed";
  sidebar.style.top = "80px";
  sidebar.style.width = "120px";
  sidebar.style.height = "calc(100vh - 160px)";
  sidebar.style.zIndex = "999999";
  sidebar.style.display = "flex";
  sidebar.style.flexDirection = "column";
  sidebar.style.gap = "8px";
  sidebar.style.padding = "10px";
  sidebar.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  sidebar.style.borderRadius = "8px";

  if (side === "left") {
    sidebar.style.left = "10px";
  } else {
    sidebar.style.right = "10px";
  }

  players.forEach((player) => {
    const card = createPlayerCard(player);
    sidebar.appendChild(card);
  });

  return sidebar;
}

function createPlayerCard(player: Player): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "goal-live-player-card";
  card.style.cursor = "pointer";
  card.style.padding = "8px";
  card.style.borderRadius = "6px";
  card.style.backgroundColor = player.team === "home" ? "#1e3a8a" : "#dc2626";
  card.style.color = "white";
  card.style.fontSize = "12px";
  card.style.fontWeight = "bold";
  card.style.textAlign = "center";
  card.style.border = player.xG > 0.5 ? "2px solid #fbbf24" : "none"; // Glow if high xG

  card.innerHTML = `
    <div style="font-size: 18px;">#${player.jerseyNumber}</div>
    <div style="font-size: 10px; margin-top: 4px;">${player.name.split(" ").pop()}</div>
    <div style="font-size: 9px; color: #9ca3af;">${player.position}</div>
  `;

  card.addEventListener("click", () => openBettingModal(player));

  return card;
}
```

### Week 5-6: Betting Core

**Deliverables:**

- Betting modal UI (reuse `platform/components/PaymentModal.tsx` pattern)
- 2 bet types: "Next Goal Scorer" (team-level), "Match Winner"
- USDC payment flow (Thirdweb SDK)
- Bet confirmation + transaction receipt
- **Chainlink CRE** calculates odds dynamically

**Betting Modal:**

```typescript
// goal.live-extension/src/content/betting-modal.ts

function openBettingModal(player: Player) {
  const modal = document.createElement("div");
  modal.innerHTML = `
    <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                background: white; padding: 24px; border-radius: 12px; z-index: 9999999; 
                box-shadow: 0 10px 40px rgba(0,0,0,0.3); min-width: 320px;">
      <h3 style="margin: 0 0 16px 0; color: #111;">BET ON ${player.name.toUpperCase()}</h3>
      
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">NEXT GOAL SCORER (TEAM)</div>
        <button onclick="placeBet('next_goal', '${player.team}', 3.5, 10)" 
                style="width: 100%; padding: 12px; background: #16a34a; color: white; 
                       border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
          ${player.team === "home" ? "HOME" : "AWAY"} to score next (3.5x) - Bet $10 USDC
        </button>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">MATCH WINNER</div>
        <button onclick="placeBet('match_winner', '${player.team}', 1.8, 10)"
                style="width: 100%; padding: 12px; background: #2563eb; color: white; 
                       border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
          ${player.team === "home" ? "HOME" : "AWAY"} to win (1.8x) - Bet $10 USDC
        </button>
      </div>
      
      <button onclick="closeModal()" 
              style="width: 100%; padding: 8px; background: #e5e7eb; color: #374151; 
                     border: none; border-radius: 6px; cursor: pointer;">
        CANCEL
      </button>
    </div>
  `;

  document.body.appendChild(modal);
}
```

### Week 7-8: Settlement + Testing

**Deliverables:**

- **Chainlink CRE** monitors match events (goals, final whistle)
- **Two-phase settlement system:**
  1. IN-GAME: Provisional credits (shown to users, NOT transferred)
  2. POST-GAME: Final settlement (actual payouts after official result)
- Bet history panel (active bets, pending payouts, settled bets)
- Leaderboard + XP system
- Beta testing (50 users, 5 matches)

**Settlement Flow (CRITICAL - Two-Phase Model):**

```typescript
// Chainlink CRE Task: monitorMatchEvents
async function monitorMatchEvents(matchId: string) {
  // Subscribe to Opta API webhook
  const opta = new OptaWebhook(matchId);

  // PHASE 1: IN-GAME - Provisional Credits
  opta.on("goal", async (goalEvent) => {
    console.log("Goal detected:", goalEvent);
    // goalEvent = { scorer: "Benzema", team: "away", time: 67 }

    // ⚠️ IMPORTANT: Credit user balance (PROVISIONAL, NOT TRANSFERRED)
    const bets = await getBetsForOutcome(
      matchId,
      "next_goal",
      goalEvent.scorer,
    );

    for (const bet of bets) {
      // Mark as provisionally won (NOT settled on-chain yet)
      await creditProvisionalWinnings(bet.id, bet.amount * bet.odds, {
        status: "PENDING_PAYOUT",
        goalEventId: goalEvent.id,
        creditedAt: Date.now(),
      });
    }

    // Update WebSocket → Show users their provisional winnings
    broadcastToViewers(matchId, {
      type: "GOAL_SCORED",
      scorer: goalEvent.scorer,
      team: goalEvent.team,
      time: goalEvent.time,
      message: "💰 Winnings credited (pending final confirmation)",
    });
  });

  // Handle goal corrections (e.g., Messi → Ronaldo)
  opta.on("goal_correction", async (correction) => {
    console.log("Goal corrected:", correction);
    // correction = { originalScorer: "Messi", newScorer: "Ronaldo", minute: 23 }

    // Reverse provisional credits for original scorer
    await reverseProvisionalCredits(
      matchId,
      correction.originalScorer,
      correction.minute,
    );

    // Apply credits to correct scorer
    const bets = await getBetsForOutcome(
      matchId,
      "next_goal",
      correction.newScorer,
    );
    for (const bet of bets) {
      await creditProvisionalWinnings(bet.id, bet.amount * bet.odds, {
        status: "PENDING_PAYOUT",
        correctedFrom: correction.originalScorer,
      });
    }

    // Alert users about correction
    broadcastToViewers(matchId, {
      type: "GOAL_CORRECTION",
      from: correction.originalScorer,
      to: correction.newScorer,
      message: `⚠️ Goal changed: ${correction.newScorer} scored (not ${correction.originalScorer})`,
    });
  });

  // PHASE 2: POST-GAME - Final Settlement
  opta.on("match_end", async (finalResult) => {
    console.log("Match ended - waiting for official confirmation...");

    // Wait for OFFICIAL result (not just final whistle)
    const officialResult = await opta.getOfficialMatchResult(matchId);
    // officialResult includes confirmed goal scorers, final score, etc.

    console.log("Official result confirmed:", officialResult);
    // officialResult = {
    //   finalScore: { home: 2, away: 0 },
    //   goals: [{scorer: "Ronaldo", minute: 23}, {scorer: "Benzema", minute: 67}],
    //   winner: "home",
    //   confirmedAt: "2026-02-19T22:53:42Z"
    // }

    // Trigger ON-CHAIN settlement (ACTUAL fund transfers)
    await settleBetsOnChain(matchId, officialResult);

    // This transfers funds from contract to winners' wallets
    // Only OFFICIAL goal scorers get paid, regardless of in-game corrections

    // Update all provisional credits to PAID or LOST
    await finalizeAllBets(matchId, officialResult);

    // Notify users
    broadcastToViewers(matchId, {
      type: "SETTLEMENT_COMPLETE",
      finalScore: officialResult.finalScore,
      message: "✅ All bets settled - check your wallet",
    });
  });
}

// Helper: Credit provisional winnings (shown in UI, NOT transferred)
async function creditProvisionalWinnings(
  betId: string,
  amount: bigint,
  metadata: any,
) {
  await db.provisionalCredits.insert({
    betId,
    amount,
    status: "PENDING_PAYOUT", // NOT 'PAID'
    ...metadata,
  });

  // Update UI to show pending winnings
  await db.bets.update(betId, {
    provisionalWinnings: amount,
    displayStatus: "PENDING_PAYOUT 💰",
  });
}

// Helper: Reverse provisional credits (when goal scorer changes)
async function reverseProvisionalCredits(
  matchId: string,
  playerId: string,
  minute: number,
) {
  const credits = await db.provisionalCredits.find({
    matchId,
    playerId,
    minute,
    status: "PENDING_PAYOUT",
  });

  for (const credit of credits) {
    await db.provisionalCredits.update(credit.id, {
      status: "REVERSED",
      reversedAt: Date.now(),
    });

    await db.bets.update(credit.betId, {
      provisionalWinnings: 0,
      displayStatus: "BET_LOST ❌",
    });
  }
}

// Helper: Final on-chain settlement (ACTUAL fund transfers)
async function settleBetsOnChain(matchId: string, officialResult: any) {
  // Call smart contract with official oracle data
  const tx = await bettingContract.settleBets(matchId, {
    goals: officialResult.goals, // Official goal scorers
    winner: officialResult.winner,
    finalScore: officialResult.finalScore,
  });

  await tx.wait(); // Wait for blockchain confirmation

  console.log("On-chain settlement complete:", tx.hash);
}
```

**Why Two Phases?**

⚠️ **CRITICAL DISTINCTION:**

- **During Game:** User sees "+$130 PENDING 💰" (provisional, can be reversed)
- **After Game:** Smart contract transfers $130 to wallet (final, irreversible)

**Example Scenario:**

1. 23' - Goal announced: Messi → User credited +$130 PENDING
2. 25' - VAR review: Actually Ronaldo → User credit reversed -$130
3. 90+3' - Match ends → Chainlink confirms Ronaldo scored → Ronaldo bettors paid

This prevents disputes and ensures only OFFICIAL results determine payouts.

---

## 📦 REUSABLE COMPONENTS FROM AIR.FUN

### From Filter Extension

| Component               | Path                                                | Reuse for goal.live              | Adaptation                                     |
| ----------------------- | --------------------------------------------------- | -------------------------------- | ---------------------------------------------- |
| **Extension Manifest**  | `filter/extension/public/manifest.json`             | ✅ Chrome V3 structure           | Update permissions (add Opta API domains)      |
| **Service Worker**      | `filter/extension/src/background/service-worker.ts` | ✅ WebSocket proxy               | No changes needed                              |
| **Platform Detection**  | `filter/extension/src/shared/platform-detect.ts`    | ✅ YouTube/Twitch/Kick detection | Add match metadata extraction                  |
| **WebSocket Client**    | `filter/extension/src/shared/ws-client.ts`          | ✅ Real-time sync                | Add bet-specific message types                 |
| **Content Script Base** | `filter/extension/src/content/main.ts`              | ✅ Injection logic               | Change from canvas overlay → sidebar injection |

### From Platform

| Component              | Path                                     | Reuse for goal.live            | Adaptation                        |
| ---------------------- | ---------------------------------------- | ------------------------------ | --------------------------------- |
| **Wallet Integration** | `platform/App.tsx` (Thirdweb)            | ✅ MetaMask/Phantom connection | No changes needed                 |
| **Payment Modal**      | `platform/components/PaymentModal.tsx`   | ✅ USDC transaction UI         | Rename "Buy Tokens" → "Place Bet" |
| **Blockchain Service** | `platform/services/blockchainService.ts` | ✅ Smart contract calls        | Adapt for betting contracts       |
| **WebRTC (Phase 2)**   | `platform/services/webRTCService.ts`     | ✅ Native streaming            | Use for amateur match streaming   |

### NOT Reusable (goal.live-Specific)

| Component             | Why Not Reusable                           | goal.live Approach                                   |
| --------------------- | ------------------------------------------ | ---------------------------------------------------- |
| **Agent Positioning** | air.fun uses manual X,Y placement on video | goal.live uses **fixed sidebar layout** (left/right) |
| **Agent Rendering**   | air.fun uses Canvas overlay on video       | goal.live uses **HTML DOM elements** (player cards)  |
| **3D Agents**         | air.fun has Three.js 3D models             | goal.live uses **2D cards** (simpler, faster)        |

---

## 🗂️ FILE STRUCTURE (New Codebase)

```
goal.live/
├── extension/                      # Chrome Extension (Phase 1 MVP)
│   ├── manifest.json               # Chrome Manifest V3
│   ├── background/
│   │   └── service-worker.ts       # WebSocket proxy (reuse from filter)
│   ├── content/
│   │   ├── main.ts                 # Entry point (reuse from filter)
│   │   ├── player-sidebar.ts       # NEW: Render 22 player cards
│   │   ├── betting-modal.ts        # NEW: Bet placement UI
│   │   ├── match-detector.ts       # NEW: Extract match metadata
│   │   └── styles.css              # Player card styling
│   ├── shared/
│   │   ├── types.ts                # NEW: Player, Bet, Match types
│   │   ├── ws-client.ts            # Reuse from filter
│   │   └── platform-detect.ts      # Reuse from filter (adapt)
│   ├── popup/
│   │   ├── popup.tsx               # Settings, wallet connection
│   │   └── popup.html
│   └── assets/
│       └── icons/                  # Extension icons
│
├── server/                         # WebSocket Signaling Server
│   └── src/
│       ├── index.ts                # Server + message routing (reuse from filter/server)
│       ├── chainlink-cre.ts        # NEW: Chainlink CRE integration
│       ├── opta-webhook.ts         # NEW: Opta API webhook handler
│       └── types.ts                # Match, Player, Bet types
│
├── contracts/                      # Smart Contracts (Solana)
│   ├── BettingPool.sol             # NEW: Manage bet liquidity
│   ├── MatchMemecoin.sol           # NEW: Match-specific SPL token
│   └── Settlement.sol              # NEW: Bet settlement logic
│
├── chainlink-cre/                  # Chainlink Compute Runtime Environment
│   ├── tasks/
│   │   ├── fetchPlayerData.ts      # Fetch from Opta API
│   │   ├── monitorMatchEvents.ts   # Subscribe to goal/card webhooks
│   │   ├── calculateOdds.ts        # ML model for dynamic odds
│   │   ├── detectFreezeEvents.ts   # VAR/penalty detection
│   │   └── verifyOutcome.ts        # Cross-reference Opta + blockchain
│   ├── config/
│   │   └── cre-config.ts           # CRE setup (see Chainlink docs)
│   └── package.json
│
├── backend/                        # API Server (Phase 2)
│   └── src/
│       ├── index.ts                # Express API
│       ├── routes/
│       │   ├── bets.ts             # GET/POST /bets
│       │   ├── matches.ts          # GET /matches/live
│       │   └── leaderboard.ts      # GET /leaderboard
│       └── db/
│           └── schema.sql          # PostgreSQL tables
│
└── docs/
    ├── GOAL_LIVE_PROJECT_SPEC.md   # This file
    ├── API_REFERENCE.md            # Backend API docs
    └── CHAINLINK_CRE_SETUP.md      # CRE integration guide
```

---

## 💻 IMPLEMENTATION PROMPT FOR COPILOT

**Context:** You are building **goal.live**, a live football betting platform that is part of the vibe.live ecosystem (formerly air.fun). This is a NEW codebase, but you can reuse components from the existing air.fun repository.

**Goal:** Create a Chrome browser extension that overlays a betting interface on live football streams (YouTube, Twitch, Kick).

**Key Requirements:**

### 1. **Player Sidebar Layout (NOT Video Overlay)**

**CRITICAL DISTINCTION:**

- ❌ **DO NOT** overlay player objects on the video like air.fun does
- ✅ **DO** create fixed sidebars on LEFT and RIGHT edges of screen
- ✅ Team A players on LEFT sidebar (11 cards stacked vertically)
- ✅ Team B players on RIGHT sidebar (11 cards stacked vertically)
- ✅ Video stream plays in CENTER (unobstructed)

**Implementation:**

```typescript
// goal.live/extension/content/player-sidebar.ts

// Create LEFT sidebar for Team A (home)
const leftSidebar = document.createElement("div");
leftSidebar.style.position = "fixed";
leftSidebar.style.left = "10px";
leftSidebar.style.top = "80px";
leftSidebar.style.width = "120px";
leftSidebar.style.height = "calc(100vh - 160px)";
leftSidebar.style.zIndex = "999999";
leftSidebar.style.display = "flex";
leftSidebar.style.flexDirection = "column";
leftSidebar.style.gap = "8px";
leftSidebar.style.overflowY = "auto";

// Create RIGHT sidebar for Team B (away)
const rightSidebar = leftSidebar.cloneNode() as HTMLDivElement;
rightSidebar.style.left = "auto";
rightSidebar.style.right = "10px";
```

### 2. **Bet Types (MVP: Only 2)**

**Phase 1 Scope:**

- ✅ "Next Goal Scorer" (team-level: HOME or AWAY)
- ✅ "Match Winner" (final result: HOME or AWAY or DRAW)
- ❌ NO player-specific bets yet (e.g., "Benzema to score")
- ❌ NO complex bets (corners, cards, etc.)

**Why:** Simplify MVP, reduce Chainlink CRE complexity.

### 3. **Chainlink CRE Integration**

**Reference:** https://docs.chain.link/cre/getting-started/part-1-project-setup-ts

**Tasks to Implement:**

```typescript
// goal.live/chainlink-cre/tasks/fetchPlayerData.ts
// Fetch player names, jersey numbers from Opta API every 30s

export async function fetchPlayerData(matchId: string): Promise<Player[]> {
  const response = await fetch(
    `https://api.optasports.com/v3/matches/${matchId}/lineups`,
    {
      headers: { Authorization: `Bearer ${process.env.OPTA_API_KEY}` },
    },
  );

  const data = await response.json();
  return data.players.map((p) => ({
    id: p.player_id,
    name: p.full_name,
    jerseyNumber: p.jersey_number,
    team: p.team_id === data.home_team_id ? "home" : "away",
    position: p.position,
  }));
}
```

```typescript
// goal.live/chainlink-cre/tasks/monitorMatchEvents.ts
// Subscribe to Opta webhooks for goals, match end

export async function monitorMatchEvents(matchId: string) {
  const webhook = new OptaWebhook(matchId);

  webhook.on("goal", async (event) => {
    // event = { scorer_id, team, time }
    await settleBets(matchId, "next_goal", event.team);
  });

  webhook.on("match_end", async (event) => {
    // event = { final_score: { home: 2, away: 1 } }
    const winner =
      event.final_score.home > event.final_score.away ? "home" : "away";
    await settleBets(matchId, "match_winner", winner);
  });
}
```

```typescript
// goal.live/chainlink-cre/tasks/calculateOdds.ts
// Calculate odds based on xG, possession, bet flow

export async function calculateOdds(
  matchId: string,
  betType: string,
): Promise<number> {
  const xgData = await fetch(
    `https://api.optasports.com/v3/matches/${matchId}/xg`,
  );
  const possession = await fetch(
    `https://api.optasports.com/v3/matches/${matchId}/possession`,
  );

  // Simple example: Next goal odds based on xG
  if (betType === "next_goal") {
    const homeXG = xgData.home_xg;
    const awayXG = xgData.away_xg;

    const homeProbability = homeXG / (homeXG + awayXG);
    const homeOdds = 1 / homeProbability;

    return homeOdds; // e.g., 1.8x for home, 2.5x for away
  }

  // TODO: Implement for match_winner
}
```

**Chainlink CRE Setup:**

```bash
# goal.live/chainlink-cre/package.json
{
  "name": "goal-live-cre",
  "dependencies": {
    "@chainlink/cre": "^1.0.0",
    "ethers": "^6.0.0"
  },
  "scripts": {
    "deploy": "cre deploy --config config/cre-config.ts"
  }
}
```

### 4. **Reuse from air.fun Repository**

**Copy these files DIRECTLY:**

```bash
# WebSocket client
cp air-fun-ai/filter/extension/src/shared/ws-client.ts goal.live/extension/shared/

# Platform detection
cp air-fun-ai/filter/extension/src/shared/platform-detect.ts goal.live/extension/shared/

# Service worker
cp air-fun-ai/filter/extension/src/background/service-worker.ts goal.live/extension/background/

# WebSocket server
cp -r air-fun-ai/filter/server goal.live/server
```

**Adapt these components:**

```typescript
// FROM: air-fun-ai/platform/components/PaymentModal.tsx
// TO: goal.live/extension/content/betting-modal.ts

// Change "Buy Tokens" → "Place Bet"
// Change "Amount" → "Bet Amount"
// Keep USDC transaction flow IDENTICAL
```

### 5. **Database Schema**

```sql
-- goal.live/backend/db/schema.sql

CREATE TABLE matches (
  id UUID PRIMARY KEY,
  home_team VARCHAR(100),
  away_team VARCHAR(100),
  kickoff_time TIMESTAMP,
  is_live BOOLEAN DEFAULT false,
  current_score JSONB, -- { home: 2, away: 1 }
  official_result JSONB, -- OFFICIAL result after match ends
  memecoin_address VARCHAR(64), -- Solana token address
  opta_match_id VARCHAR(50), -- Opta API match ID
  status VARCHAR(20) DEFAULT 'scheduled' -- 'scheduled', 'live', 'finished', 'settled'
);

CREATE TABLE players (
  id UUID PRIMARY KEY,
  match_id UUID REFERENCES matches(id),
  opta_player_id VARCHAR(50),
  name VARCHAR(100),
  jersey_number INT,
  team VARCHAR(10), -- 'home' or 'away'
  position VARCHAR(5) -- 'GK', 'DF', 'MF', 'FW'
);

CREATE TABLE bets (
  id UUID PRIMARY KEY,
  match_id UUID REFERENCES matches(id),
  bettor_wallet VARCHAR(64),
  bet_type VARCHAR(50), -- 'next_goal_scorer' or 'match_winner'
  original_player_id UUID REFERENCES players(id), -- ORIGINAL bet target
  current_player_id UUID REFERENCES players(id), -- CURRENT bet target (after changes)
  outcome VARCHAR(10), -- For match_winner: 'home' | 'away' | 'draw'
  original_amount DECIMAL(18, 6), -- Original USDC amount
  current_amount DECIMAL(18, 6), -- Amount after penalties deducted
  total_penalties DECIMAL(18, 6) DEFAULT 0, -- Sum of all change penalties
  change_count INT DEFAULT 0, -- Number of times bet was changed
  odds DECIMAL(5, 2), -- Current odds (updates with each change)
  provisional_winnings DECIMAL(18, 6), -- Shown during game (NOT paid yet)
  final_payout DECIMAL(18, 6), -- Actual payout after settlement
  status VARCHAR(20), -- 'pending', 'provisional_win', 'settled_won', 'settled_lost'
  placed_at TIMESTAMP DEFAULT NOW(),
  settled_at TIMESTAMP,
  tx_hash VARCHAR(100) -- Settlement transaction hash
);

-- NEW TABLE: Track bet changes (for penalty calculation)
CREATE TABLE bet_changes (
  id UUID PRIMARY KEY,
  bet_id UUID REFERENCES bets(id),
  user_wallet VARCHAR(64),
  from_player_id UUID REFERENCES players(id), -- Previous player
  to_player_id UUID REFERENCES players(id),   -- New player
  from_odds DECIMAL(5, 2),
  to_odds DECIMAL(5, 2),
  penalty_amount DECIMAL(18, 6), -- Penalty deducted
  penalty_type VARCHAR(20), -- 'percentage' | 'flat' | 'progressive' | 'time_based'
  penalty_rate DECIMAL(5, 2), -- e.g., 5.00 for 5%
  amount_before DECIMAL(18, 6), -- Bet amount before change
  amount_after DECIMAL(18, 6), -- Bet amount after penalty
  changed_at TIMESTAMP DEFAULT NOW(),
  match_minute INT -- Match minute when changed
);

-- NEW TABLE: Track provisional credits during game
CREATE TABLE provisional_credits (
  id UUID PRIMARY KEY,
  bet_id UUID REFERENCES bets(id),
  user_wallet VARCHAR(64),
  amount DECIMAL(18, 6), -- Provisional credit amount
  goal_event_id UUID, -- Links to goal event
  status VARCHAR(20), -- 'PENDING_PAYOUT', 'REVERSED', 'CONFIRMED'
  credited_at TIMESTAMP DEFAULT NOW(),
  reversed_at TIMESTAMP, -- If goal scorer changes
  confirmed_at TIMESTAMP -- When final settlement happens
);

-- NEW TABLE: Track goal events (including corrections)
CREATE TABLE goal_events (
  id UUID PRIMARY KEY,
  match_id UUID REFERENCES matches(id),
  scorer_player_id UUID REFERENCES players(id),
  minute INT,
  team VARCHAR(10), -- 'home' or 'away'
  is_corrected BOOLEAN DEFAULT FALSE,
  corrected_from UUID REFERENCES players(id), -- Original scorer if changed
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);
```

**⚠️ Key Schema Changes for Two-Phase Settlement + Bet Changes:**

- `bets.status` now includes: `'provisional_win'` (credited, not paid) and `'settled_won'` (actually paid)
- `bets.original_player_id` vs `bets.current_player_id` - tracks bet changes
- `bets.total_penalties` and `bets.change_count` - sum penalties and track changes
- `bet_changes` table tracks every bet modification with penalty details
- `provisional_credits` table tracks in-game credits (can be reversed)
- `goal_events` table tracks corrections (VAR, referee changes)

**Bet Change Penalty Options (TBD - Math to be determined):**

1. **Percentage-based:** 5% of current bet amount per change
2. **Flat fee:** $1 USDC per change (regardless of bet size)
3. **Progressive:** 5% first change, 10% second, 15% third (discourages multiple changes)
4. **Time-based:** 3% @ 0-30min, 5% @ 30-60min, 8% @ 60-90min (higher closer to end)
5. **Hybrid:** $0.50 flat + 3% of bet amount

**Recommendation:** Start with 5% flat percentage for MVP, iterate based on user behavior.

### 6. **Testing Checklist**

Before submitting MVP:

**Extension & Detection:**

- [ ] Extension installs in Chrome without errors
- [ ] Platform detection works (YouTube, Twitch, Kick)
- [ ] Match metadata extracted (team names, kickoff time)
- [ ] 22 player cards render (11 left, 11 right)
- [ ] Player data from Chainlink CRE (names, numbers)

**Betting Flow:**

- [ ] Click player card → Betting modal opens
- [ ] Wallet connection (Phantom/MetaMask) works
- [ ] "Next Goal Scorer" bet → USDC locked in contract
- [ ] "Match Winner" bet → USDC locked in contract
- [ ] Bet appears in "MY BETS" with status: ACTIVE

**Bet Changes (NEW FEATURE):**

- [ ] Click active bet → "🔄 CHANGE BET" button appears
- [ ] Select new player → Penalty calculated and shown
- [ ] Penalty options configurable (5% default)
- [ ] User confirms change → Penalty deducted from bet amount
- [ ] Balance updates IMMEDIATELY with new potential payout
- [ ] bet_changes record created in database
- [ ] bets.current_player_id updated
- [ ] bets.total_penalties incremented
- [ ] Can change multiple times (each with penalty)
- [ ] UI shows bet history with all changes

**In-Game Settlement (Provisional):**

- [ ] ⚡ Chainlink CRE detects goal → Provisional credit shown
- [ ] UI shows: "+$X USDC PENDING 💰" (NOT transferred)
- [ ] Provisional balance updates in real-time
- [ ] Goal correction (VAR) → Provisional credit reversed correctly
- [ ] Alert shown: "⚠️ Goal changed to [Player]"

**Post-Game Settlement (Final):**

- [ ] Match ends → "⏳ Processing..." message shown
- [ ] ⚡ Chainlink CRE fetches OFFICIAL result
- [ ] Smart contract settleBets() called successfully
- [ ] Final calculation includes ALL penalties deducted
- [ ] Winners receive ACTUAL fund transfers to wallet (minus penalties)
- [ ] Wallet balance increases (can verify on blockchain)
- [ ] Provisional credits marked as CONFIRMED in database
- [ ] Settlement transaction hash recorded
- [ ] Withdrawals enabled ONLY after final settlement

**User Experience:**

- [ ] Bet history shows all statuses correctly
- [ ] No interference with video playback
- [ ] Works on low-end devices (no lag)
- [ ] Extension uninstalls cleanly

---

## 🚀 NEXT STEPS (Start Here)

### Day 1: Repository Setup

```bash
# Create new repository (separate from air.fun)
mkdir goal.live
cd goal.live

# Initialize project
npm init -y

# Create directory structure
mkdir -p extension/{background,content,shared,popup,assets}
mkdir -p server/src
mkdir -p chainlink-cre/{tasks,config}
mkdir -p backend/{src/routes,db}
mkdir -p docs

# Copy reusable components from air.fun
cp ../air-fun-ai/filter/extension/src/shared/ws-client.ts extension/shared/
cp ../air-fun-ai/filter/extension/src/shared/platform-detect.ts extension/shared/
cp ../air-fun-ai/filter/extension/src/background/service-worker.ts extension/background/

# Install dependencies
npm install typescript @types/chrome @types/node
npm install ws express pg
npm install @chainlink/cre ethers
```

### Day 2-3: Extension Manifest + Platform Detection

Create `extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "goal.live - Live Football Betting",
  "version": "1.0.0",
  "permissions": ["storage", "activeTab"],
  "host_permissions": [
    "https://www.youtube.com/*",
    "https://www.twitch.tv/*",
    "https://www.kick.com/*",
    "https://api.optasports.com/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": [
        "https://www.youtube.com/watch*",
        "https://www.twitch.tv/*",
        "https://www.kick.com/*"
      ],
      "js": ["content/main.js"]
    }
  ]
}
```

### Day 4-5: Player Sidebar Implementation

Focus on `extension/content/player-sidebar.ts` (see code examples above).

### Day 6-7: Chainlink CRE Integration

Follow https://docs.chain.link/cre/getting-started/part-1-project-setup-ts

Implement:

- `chainlink-cre/tasks/fetchPlayerData.ts`
- `chainlink-cre/tasks/monitorMatchEvents.ts`
- `chainlink-cre/config/cre-config.ts`

### Day 8-10: Betting Modal + USDC Payments

Adapt `air-fun-ai/platform/components/PaymentModal.tsx` pattern.

### Day 11-14: Testing + Beta Launch

Test with 5 live matches, 50 beta users.

---

## 📚 REFERENCES

- **Chainlink CRE Docs:** https://docs.chain.link/cre/getting-started/part-1-project-setup-ts
- **Opta Sports Data API:** https://www.statsperform.com/opta/
- **Polymarket Architecture:** https://docs.polymarket.com
- **air.fun Repository:** `/home/petrunix/air-fun-ai/air-fun-ai/`

---

**Last Updated:** February 19, 2026  
**Status:** 🟢 Ready for Development  
**Next Milestone:** Week 2 - Extension + Player Sidebar MVP

---

END OF SPECIFICATION
