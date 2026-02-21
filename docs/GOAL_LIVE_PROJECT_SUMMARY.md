# goal.live - Live Football Betting Platform

**Project Name:** goal.live (formerly sport.live)  
**Part of:** vibe.live Ecosystem  
**Last Updated:** February 19, 2026  
**Status:** Design Phase → Ready for Implementation

---

> ⚠️ **CRITICAL SETTLEMENT MODEL:**  
> **TWO-PHASE SYSTEM:**
>
> 1. **IN-GAME:** Provisional credits shown (e.g., "+$130 PENDING 💰") - NOT transferred
> 2. **POST-GAME:** Final settlement after official result - ACTUAL fund transfers  
>    **EXAMPLE:** Messi scores → User credited $130 PENDING → VAR: Actually Ronaldo → Credit reversed → Match ends → Ronaldo goal confirmed → Ronaldo bettors paid

---

## 🎯 Executive Summary

**goal.live** is a browser extension that overlays interactive player objects on live football (soccer) streams, enabling viewers to bet on match outcomes in real-time. Unlike air.fun where streamers manually place agents, **goal.live automatically positions all 22 players on the sides of the screen** (left team vs right team) for clean, organized betting interaction.

### Key Differences from air.fun

| Aspect              | air.fun                                           | goal.live                                                |
| ------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| **Agent Placement** | Streamer manually places at exact X,Y coordinates | **Automatic side placement** (Team A left, Team B right) |
| **Agent Movement**  | Static (placed once)                              | **Static on sides** (not tracking pitch position)        |
| **Use Case**        | Generic streaming with custom agents              | **Football betting only**                                |
| **Platform**        | Native WebRTC streaming                           | **Browser extension overlay** on existing platforms      |
| **Agent Count**     | 4-6 custom agents                                 | **22 player objects** (11 per team)                      |
| **Data Source**     | User-generated                                    | **Live sports data via Chainlink CRE**                   |

### Two-Phase Approach

**Phase 1 (MVP - 4 Weeks):** Browser Extension for Existing Platforms

- Overlay player objects on YouTube, Twitch, ESPN live streams
- 22 clickable player buttons positioned on sides (11 left, 11 right)
- 2 bet types: "Next Goal Scorer" and "Match Winner"
- Web only (Chrome extension)
- Connect wallet, place bets, instant settlement

**Phase 2 (8 Weeks):** Native Streaming for Amateur Games

- Users stream their own local/amateur matches
- Viewers watch + bet on these streams
- Same betting interface as Phase 1
- Reuse air.fun WebRTC infrastructure

**MVP Focus:** Phase 1 - Extension overlay with 2 bet types, web only.

---

## 🏗️ System Architecture (Phase 1 - Extension)

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VIEWER'S BROWSER                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  YouTube/Twitch/ESPN Live Stream (Native)                      │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │                                                           │  │ │
│  │  │          [Live Football Match Video]                     │  │ │
│  │  │                                                           │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  goal.live Extension Overlay (Canvas Layer)                    │ │
│  │                                                                 │ │
│  │  LEFT SIDE                              RIGHT SIDE             │ │
│  │  ┌──────────┐                           ┌──────────┐           │ │
│  │  │  #10 🔴  │ ← Team A Player 1         │  #9  🔵  │           │ │
│  │  │  Messi   │                           │  Haaland │           │ │
│  │  │  3.5x    │                           │  4.2x    │           │ │
│  │  └──────────┘                           └──────────┘           │ │
│  │                                                                 │ │
│  │  ┌──────────┐                           ┌──────────┐           │ │
│  │  │  #7  🔴  │                           │  #10 🔵  │           │ │
│  │  │  Ronaldo │                           │  Benzema │           │ │
│  │  │  2.8x    │                           │  5.0x    │           │ │
│  │  └──────────┘                           └──────────┘           │ │
│  │                                                                 │ │
│  │  ... (9 more players each side)                                │ │
│  │                                                                 │ │
│  │  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  │  [Match Winner: Team A 2.1x] [Team B 1.8x] [Draw 3.5x] │   │ │
│  │  └─────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  [Connect Wallet] [My Bets] [Settings]                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────────┐
                    │  Chainlink CRE      │
                    │  (Live Sports Data) │
                    │  - Goal events      │
                    │  - Player stats     │
                    │  - Match state      │
                    └─────────────────────┘
                              ↓
                    ┌─────────────────────┐
                    │  Smart Contracts    │
                    │  (Solana/Base)      │
                    │  - Bet placement    │
                    │  - Settlement       │
                    │  - USDC transfers   │
                    └─────────────────────┘
```

### Component Architecture

```
goal.live/
├── extension/                    # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── content/
│   │   ├── overlay.ts           # Main overlay renderer
│   │   ├── player-sidebar.ts    # 22 player buttons (11 left, 11 right)
│   │   └── betting-modal.ts     # Bet placement UI
│   ├── background/
│   │   └── service-worker.ts    # Match detection, data sync
│   └── popup/
│       └── popup.tsx            # Extension settings, wallet connection
│
├── services/
│   ├── chainlinkCREService.ts   # ⚡ Chainlink CRE integration (live data)
│   ├── bettingService.ts        # Bet logic (Next Goal, Match Winner)
│   ├── walletService.ts         # Web3 wallet (Phantom, MetaMask)
│   └── settlementService.ts     # Automatic bet settlement
│
└── contracts/
    └── GoalLiveBetting.sol      # Solana/Base smart contract
```

---

## 🎮 User Experience (MVP)

### Step-by-Step Flow

**1. User installs goal.live Chrome extension**

**2. User visits YouTube/Twitch stream of live football match**

- Example: "Real Madrid vs Barcelona LIVE" on YouTube

**3. Extension detects football match**

```typescript
// Background service worker detects match
const matchDetected = detectFootballMatch(pageUrl, videoTitle);
// → Triggers overlay injection
```

**4. Overlay appears with 22 player buttons on sides**

**LEFT SIDE (Team A - Real Madrid):**

```
┌──────────┐
│  #10 🔴  │ ← Clickable button
│  Modrić  │
│  3.5x    │ ← Odds for this player to score next
└──────────┘

┌──────────┐
│  #9  🔴  │
│  Benzema │
│  2.1x    │
└──────────┘

... (9 more players)
```

**RIGHT SIDE (Team B - Barcelona):**

```
┌──────────┐
│  #10 🔵  │
│  Messi   │
│  2.8x    │
└──────────┘

┌──────────┐
│  #7  🔵  │
│  Pedri   │
│  4.5x    │
└──────────┘

... (9 more players)
```

**5. User clicks "Messi" button**

**Betting Modal Opens:**

```
┌─────────────────────────────────┐
│  BET ON MESSI (#10)             │
├─────────────────────────────────┤
│  Bet Type: Next Goal Scorer     │
│  Odds: 2.8x                     │
│  Liquidity: $5,200 USDC         │
│                                 │
│  Amount: [___] USDC             │
│  [Bet $5] [Bet $10] [Bet $25]  │
│                                 │
│  Potential Win: $28 USDC        │
│  (if Messi scores next goal)    │
│                                 │
│  [PLACE BET] [CANCEL]           │
└─────────────────────────────────┘
```

**6. User clicks "Bet $10"**

- Wallet prompts for signature (MetaMask/Phantom)
- $10 USDC deducted from wallet
- Bet recorded on-chain
- Confirmation: "✅ Bet placed on Messi (2.8x)"

**7. User watches match**

- Messi's button glows when he's involved in play (optional animation)
- Real-time odds update every 10-30 seconds

**8. Messi scores! (72nd minute)**

- **Chainlink CRE detects goal event** ⚡
- **PROVISIONAL credit shown** (NOT transferred yet)
- Balance shows: "+$28 USDC PENDING 💰"
- Notification: "🎉 GOAL! Messi scored. +$28 USDC PENDING (paid after match)"
- ⚠️ **Funds still locked in contract** - payout happens after official result

**8a. Goal corrected! (74th minute - VAR decision)**

- Replay shows Ronaldo touched ball last
- Chainlink CRE updates: Goal credited to Ronaldo
- Messi provisional credit REVERSED: "+$28 → $0"
- Alert: "⚠️ Goal changed to Ronaldo - provisional credit reversed"
- Ronaldo bettors now see "+$X PENDING 💰"

**9. Match ends (90+3 minutes)**

- Final whistle blows
- Extension shows: "⏳ Processing final settlement..."
- Chainlink CRE fetches OFFICIAL match result
- Smart contract triggered with confirmed goal scorers

**10. Final settlement (30-60 seconds after match)**

- Wallet notification: "💰 +$28 USDC received"
- Extension: "✅ All bets settled - Ronaldo goal confirmed"
- User can view summary:
  - Total wagered: $10
  - Total won: $28
  - Net profit: +$18

**11. User can place more bets on next match**

- Extension shows upcoming matches
- Cycle repeats

---

## 📊 MVP Bet Types (Phase 1)

### Bet Type 1: Next Goal Scorer

**Description:** Which player will score the next goal in the match.

**Outcomes:**

- 22 individual player options (one per player)
- "No Goal" option (if match ends without another goal)

**Settlement:**

- **Chainlink CRE detects goal** ⚡
- Query: `GET /matches/{matchId}/events/latest` → Returns scorer info
- Winner: Player who scored
- Payout: Winning bets receive odds × stake in USDC
- Losing bets: Stakes go to liquidity pool

**Example:**

```
Bettor bets $10 on Messi at 2.8x odds
→ Messi scores → Bettor wins $28 USDC (instant credit)

Bettor bets $10 on Ronaldo at 3.5x odds
→ Messi scores → Bettor loses $10 USDC (burned)
```

### Bet Type 2: Match Winner

**Description:** Final result of the match.

**Outcomes:**

- Team A Win
- Team B Win
- Draw

**Settlement:**

- **Chainlink CRE detects full-time whistle** ⚡
- Query: `GET /matches/{matchId}/result` → Returns final score
- Winner: Team with higher score (or Draw)
- Payout: Instant settlement at match end

**Example:**

```
Bettor bets $50 on "Real Madrid Win" at 2.1x odds
→ Final score: Real Madrid 3-1 Barcelona
→ Bettor wins $105 USDC
```

---

## 🔧 Technical Implementation

### 1. Extension Components

#### manifest.json (Chrome Extension Manifest V3)

```json
{
  "manifest_version": 3,
  "name": "goal.live - Live Football Betting",
  "version": "1.0.0",
  "permissions": ["activeTab", "storage", "webRequest"],
  "host_permissions": [
    "*://www.youtube.com/*",
    "*://www.twitch.tv/*",
    "*://www.espn.com/*"
  ],
  "content_scripts": [
    {
      "matches": ["*://www.youtube.com/watch*", "*://www.twitch.tv/*"],
      "js": ["content/overlay.js"],
      "css": ["content/overlay.css"]
    }
  ],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "action": {
    "default_popup": "popup/popup.html"
  }
}
```

#### content/overlay.ts (Main Overlay Renderer)

```typescript
/**
 * goal.live Overlay - Player Sidebar Renderer
 *
 * Key Difference from air.fun:
 * - air.fun: Agents positioned at custom X,Y on stream
 * - goal.live: Players positioned in SIDEBAR (left/right, NOT on pitch)
 */

interface PlayerButton {
  playerId: string;
  playerName: string;
  jerseyNumber: number;
  teamSide: "left" | "right"; // Team A = left, Team B = right
  nextGoalOdds: number; // Odds for "Next Goal Scorer" bet
  teamColor: string; // 🔴 or 🔵
}

class GoalLiveOverlay {
  private leftSidebar: HTMLDivElement;
  private rightSidebar: HTMLDivElement;
  private players: PlayerButton[] = [];

  constructor() {
    this.createSidebars();
    this.loadMatchData(); // ⚡ Calls Chainlink CRE for player list
  }

  private createSidebars() {
    // LEFT SIDEBAR (Team A)
    this.leftSidebar = document.createElement("div");
    this.leftSidebar.id = "goallive-left-sidebar";
    this.leftSidebar.style.cssText = `
      position: fixed;
      left: 0;
      top: 100px;
      width: 120px;
      height: calc(100vh - 200px);
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(10px);
      z-index: 999999;
      overflow-y: auto;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    // RIGHT SIDEBAR (Team B)
    this.rightSidebar = document.createElement("div");
    this.rightSidebar.id = "goallive-right-sidebar";
    this.rightSidebar.style.cssText = `
      position: fixed;
      right: 0;
      top: 100px;
      width: 120px;
      height: calc(100vh - 200px);
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(10px);
      z-index: 999999;
      overflow-y: auto;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    document.body.appendChild(this.leftSidebar);
    document.body.appendChild(this.rightSidebar);
  }

  private async loadMatchData() {
    // ⚡ CHAINLINK CRE: Fetch live match data
    const matchId = this.detectMatchId(); // From URL or video title
    const matchData = await chainlinkCREService.getMatchData(matchId);

    this.players = matchData.players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      jerseyNumber: p.number,
      teamSide: p.teamId === matchData.homeTeamId ? "left" : "right",
      nextGoalOdds: p.nextGoalOdds, // From betting engine
      teamColor: p.teamId === matchData.homeTeamId ? "🔴" : "🔵",
    }));

    this.renderPlayers();
  }

  private renderPlayers() {
    const leftPlayers = this.players.filter((p) => p.teamSide === "left");
    const rightPlayers = this.players.filter((p) => p.teamSide === "right");

    // Render left team
    leftPlayers.forEach((player) => {
      const btn = this.createPlayerButton(player);
      this.leftSidebar.appendChild(btn);
    });

    // Render right team
    rightPlayers.forEach((player) => {
      const btn = this.createPlayerButton(player);
      this.rightSidebar.appendChild(btn);
    });
  }

  private createPlayerButton(player: PlayerButton): HTMLDivElement {
    const btn = document.createElement("div");
    btn.className = "goallive-player-btn";
    btn.style.cssText = `
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid ${player.teamColor === "🔴" ? "#ff4444" : "#4444ff"};
      border-radius: 12px;
      padding: 8px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
      color: white;
      font-size: 11px;
    `;

    btn.innerHTML = `
      <div style="font-size: 20px;">${player.teamColor}</div>
      <div style="font-weight: bold;">#${player.jerseyNumber}</div>
      <div style="font-size: 10px; margin: 4px 0;">${player.playerName}</div>
      <div style="background: rgba(0,255,0,0.2); border-radius: 4px; padding: 2px; font-weight: bold;">
        ${player.nextGoalOdds.toFixed(1)}x
      </div>
    `;

    // Click handler - open betting modal
    btn.addEventListener("click", () => {
      this.openBettingModal(player);
    });

    // Hover effect
    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "scale(1.05)";
      btn.style.background = "rgba(255, 255, 255, 0.2)";
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "scale(1)";
      btn.style.background = "rgba(255, 255, 255, 0.1)";
    });

    return btn;
  }

  private openBettingModal(player: PlayerButton) {
    // Open betting modal (Next Goal Scorer bet)
    bettingModalService.open({
      betType: "NEXT_GOAL_SCORER",
      playerId: player.playerId,
      playerName: player.playerName,
      odds: player.nextGoalOdds,
    });
  }

  private detectMatchId(): string {
    // Detect match from URL or video metadata
    // Example: YouTube video with "Real Madrid vs Barcelona" in title
    // → Extract team names → Query Chainlink CRE for matchId

    const videoTitle = document.querySelector("h1.title")?.textContent || "";

    // ⚡ CHAINLINK CRE: Match detection
    // Call: GET /matches/search?query={videoTitle}
    // Returns: { matchId: "rm-bar-2026-02-19", teams: [...], kickoff: ... }

    return "detected-match-id"; // Placeholder
  }
}

// Initialize overlay when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new GoalLiveOverlay();
  });
} else {
  new GoalLiveOverlay();
}
```

### 2. Chainlink CRE Integration Points

**⚡ Chainlink CRE (Crypto Risk Engine) is used for all live sports data.**

Reference: https://docs.chain.link/cre/getting-started/part-1-project-setup-ts

#### services/chainlinkCREService.ts

```typescript
/**
 * Chainlink CRE Service
 *
 * ⚡ ALL LIVE SPORTS DATA comes from Chainlink CRE
 * - Match detection (is it a live football match?)
 * - Player lists (22 players, names, numbers, teams)
 * - Live events (goals, cards, substitutions)
 * - Match state (score, time elapsed, half-time, full-time)
 *
 * Docs: https://docs.chain.link/cre/getting-started/part-1-project-setup-ts
 */

import { ChainlinkCREClient } from "@chainlink/cre-sdk"; // Hypothetical SDK

class ChainlinkCREService {
  private client: ChainlinkCREClient;

  constructor() {
    this.client = new ChainlinkCREClient({
      apiKey: process.env.CHAINLINK_CRE_API_KEY,
      network: "mainnet", // or 'testnet'
    });
  }

  /**
   * ⚡ CRE INTEGRATION POINT 1: Match Detection
   * Detect if current video is a live football match
   */
  async detectMatch(
    videoTitle: string,
    platform: string,
  ): Promise<MatchData | null> {
    const response = await this.client.query({
      endpoint: "/matches/search",
      params: {
        query: videoTitle,
        platform: platform, // 'youtube' | 'twitch' | 'espn'
        sport: "football",
        status: "live",
      },
    });

    return response.match || null;
  }

  /**
   * ⚡ CRE INTEGRATION POINT 2: Player Data
   * Get list of 22 players for match (11 per team)
   */
  async getMatchPlayers(matchId: string): Promise<PlayerData[]> {
    const response = await this.client.query({
      endpoint: `/matches/${matchId}/players`,
      params: {
        includeStats: true, // xG, shots, cards, etc.
      },
    });

    return response.players.map((p) => ({
      id: p.player_id,
      name: p.name,
      number: p.jersey_number,
      teamId: p.team_id,
      position: p.position, // 'Forward', 'Midfielder', etc.
      stats: {
        shots: p.shots,
        shotsOnTarget: p.shots_on_target,
        xG: p.expected_goals,
        cards: p.cards,
      },
    }));
  }

  /**
   * ⚡ CRE INTEGRATION POINT 3: Live Events (Goal Detection)
   * Subscribe to real-time goal events
   */
  subscribeToGoalEvents(matchId: string, onGoal: (event: GoalEvent) => void) {
    this.client.subscribe({
      endpoint: `/matches/${matchId}/events`,
      eventType: "goal",
      callback: (event) => {
        onGoal({
          playerId: event.scorer_id,
          playerName: event.scorer_name,
          minute: event.minute,
          teamId: event.team_id,
          assistBy: event.assist_by,
        });
      },
    });
  }

  /**
   * ⚡ CRE INTEGRATION POINT 4: Match State
   * Get current match state (score, time, status)
   */
  async getMatchState(matchId: string): Promise<MatchState> {
    const response = await this.client.query({
      endpoint: `/matches/${matchId}/state`,
    });

    return {
      homeScore: response.home_score,
      awayScore: response.away_score,
      minute: response.minute,
      period: response.period, // 'first_half' | 'second_half' | 'finished'
      status: response.status, // 'live' | 'finished' | 'halftime'
    };
  }

  /**
   * ⚡ CRE INTEGRATION POINT 5: Match Result (Full-time)
   * Get final result for "Match Winner" bet settlement
   */
  async getMatchResult(matchId: string): Promise<MatchResult> {
    const response = await this.client.query({
      endpoint: `/matches/${matchId}/result`,
    });

    return {
      winner: response.winner, // 'home' | 'away' | 'draw'
      homeScore: response.home_score,
      awayScore: response.away_score,
      confirmedAt: response.confirmed_at,
    };
  }
}

export const chainlinkCREService = new ChainlinkCREService();
```

### 3. Betting Service

#### services/bettingService.ts

```typescript
/**
 * Betting Service - Handles bet placement and TWO-PHASE settlement
 *
 * ⚠️ CRITICAL SETTLEMENT MODEL:
 * - PHASE 1 (In-Game): Provisional credits shown to user (NOT transferred)
 * - PHASE 2 (Post-Game): Final settlement with actual fund transfers
 *
 * ⚠️ BET CHANGES:
 * - Users can change "Next Goal Scorer" bet anytime during game
 * - Each change incurs a penalty (math TBD - default 5%)
 * - Balance updates in REAL-TIME
 * - Withdrawals only possible after final settlement
 *
 * MVP: 2 bet types only
 * 1. Next Goal Scorer (22 players + "No Goal")
 * 2. Match Winner (Team A / Team B / Draw)
 */

import { chainlinkCREService } from "./chainlinkCREService";

interface Bet {
  id: string;
  matchId: string;
  betType: "NEXT_GOAL_SCORER" | "MATCH_WINNER";
  playerId?: string; // Current "Next Goal Scorer" target
  original_player_id?: string; // Original bet target (before changes)
  current_player_id?: string; // Current bet target (after changes)
  outcome?: string; // For "Match Winner": 'home' | 'away' | 'draw'
  amount: bigint; // Current USDC amount (after penalties)
  original_amount?: bigint; // Original bet amount
  total_penalties?: bigint; // Sum of all change penalties
  change_count?: number; // Number of times bet was changed
  odds: number;
  bettorWallet: string;
  placedAt: Date;
  status: "pending" | "provisional_win" | "settled_won" | "settled_lost";
  provisionalWinnings?: bigint; // Shown during game (NOT paid yet)
  finalPayout?: bigint; // Actual payout after settlement
}

interface ProvisionalCredit {
  betId: string;
  amount: bigint;
  creditedAt: Date;
  goalEventId?: string;
  status: "PENDING_PAYOUT" | "REVERSED" | "CONFIRMED";
}

class BettingService {
  private activeBets: Map<string, Bet> = new Map();
  private provisionalCredits: Map<string, ProvisionalCredit> = new Map();

  /**
   * Place "Next Goal Scorer" bet
   */
  async placeNextGoalScorerBet(
    matchId: string,
    playerId: string,
    amount: bigint,
    odds: number,
    wallet: string,
  ): Promise<string> {
    const betId = `bet-${Date.now()}-${Math.random()}`;

    const bet: Bet = {
      id: betId,
      matchId,
      betType: "NEXT_GOAL_SCORER",
      playerId,
      amount,
      odds,
      bettorWallet: wallet,
      placedAt: new Date(),
      status: "pending",
    };

    // Store bet in contract (on-chain) - FUNDS LOCKED
    await this.submitBetToContract(bet);

    // Store locally for tracking
    this.activeBets.set(betId, bet);

    // ⚡ Subscribe to Chainlink CRE goal events for PROVISIONAL settlement
    this.setupGoalListener(matchId);

    return betId;
  }

  /**
   * Place "Match Winner" bet
   */
  async placeMatchWinnerBet(
    matchId: string,
    outcome: "home" | "away" | "draw",
    amount: bigint,
    odds: number,
    wallet: string,
  ): Promise<string> {
    const betId = `bet-${Date.now()}-${Math.random()}`;

    const bet: Bet = {
      id: betId,
      matchId,
      betType: "MATCH_WINNER",
      outcome,
      amount,
      odds,
      bettorWallet: wallet,
      placedAt: new Date(),
      status: "pending",
    };

    await this.submitBetToContract(bet);
    this.activeBets.set(betId, bet);

    // ⚡ Subscribe to Chainlink CRE match result for settlement
    this.setupMatchResultListener(matchId);

    return betId;
  }

  /**
   * Change existing "Next Goal Scorer" bet to different player
   * Applies penalty (math TBD - default 5%)
   * Balance updates in REAL-TIME
   */
  async changeBet(
    betId: string,
    newPlayerId: string,
    newOdds: number,
    matchMinute: number,
    penaltyConfig: {
      type: "percentage" | "flat" | "progressive" | "time_based";
      rate: number; // Percentage (e.g., 5 for 5%) or flat amount
    } = { type: "percentage", rate: 5.0 },
  ): Promise<{
    success: boolean;
    newBetAmount: bigint;
    penaltyAmount: bigint;
    message: string;
  }> {
    const bet = this.activeBets.get(betId);
    if (!bet) {
      return {
        success: false,
        newBetAmount: 0n,
        penaltyAmount: 0n,
        message: "Bet not found",
      };
    }

    if (bet.betType !== "NEXT_GOAL_SCORER") {
      return {
        success: false,
        newBetAmount: 0n,
        penaltyAmount: 0n,
        message: "Only Next Goal Scorer bets can be changed",
      };
    }

    const currentAmount = bet.amount - (bet.total_penalties || 0n);

    // Calculate penalty based on config
    let penaltyAmount: bigint;
    switch (penaltyConfig.type) {
      case "percentage":
        // e.g., 5% of current bet amount
        penaltyAmount =
          (currentAmount * BigInt(Math.floor(penaltyConfig.rate * 100))) /
          10000n;
        break;
      case "flat":
        // e.g., $1 USDC (smallest unit: 1000000)
        penaltyAmount = BigInt(Math.floor(penaltyConfig.rate * 1e6));
        break;
      case "progressive":
        // Increases with each change: 5%, 10%, 15%, etc.
        const changeCount = (bet.change_count || 0) + 1;
        const progressiveRate = penaltyConfig.rate * changeCount;
        penaltyAmount =
          (currentAmount * BigInt(Math.floor(progressiveRate * 100))) / 10000n;
        break;
      case "time_based":
        // Higher penalty closer to match end
        // e.g., 3% @ 0-30min, 5% @ 30-60min, 8% @ 60-90min
        let timeRate = penaltyConfig.rate;
        if (matchMinute > 60)
          timeRate *= 1.6; // 8% if >60min
        else if (matchMinute > 30)
          timeRate *= 1.0; // 5% if >30min
        else timeRate *= 0.6; // 3% if <30min

        penaltyAmount =
          (currentAmount * BigInt(Math.floor(timeRate * 100))) / 10000n;
        break;
      default:
        penaltyAmount = 0n;
    }

    const newBetAmount = currentAmount - penaltyAmount;

    // Update bet record
    const originalPlayerId = bet.current_player_id || bet.playerId;
    bet.playerId = newPlayerId;
    bet.current_player_id = newPlayerId;
    bet.odds = newOdds;
    bet.amount = newBetAmount;
    bet.total_penalties = (bet.total_penalties || 0n) + penaltyAmount;
    bet.change_count = (bet.change_count || 0) + 1;

    // Record change in database
    await this.recordBetChange(betId, {
      fromPlayerId: originalPlayerId!,
      toPlayerId: newPlayerId,
      fromOdds: bet.odds,
      toOdds: newOdds,
      penaltyAmount,
      penaltyConfig,
      amountBefore: currentAmount,
      amountAfter: newBetAmount,
      matchMinute,
    });

    // Update on-chain bet
    await this.updateBetOnChain(betId, {
      newPlayerId,
      newAmount: newBetAmount,
      totalPenalties: bet.total_penalties,
    });

    // Update provisional balance if applicable
    if (bet.provisionalWinnings) {
      // Recalculate provisional winnings with new odds
      bet.provisionalWinnings = 0n; // Reset - will be recalculated on next goal
    }

    // Notify user
    await this.notifyUser(bet.bettorWallet, {
      type: "BET_CHANGED",
      betId,
      newPlayer: newPlayerId,
      penalty: penaltyAmount,
      newAmount: newBetAmount,
      message: `🔄 Bet changed to player ${newPlayerId}. Penalty: -$${(Number(penaltyAmount) / 1e6).toFixed(2)}`,
    });

    console.log(
      `🔄 Bet ${betId} changed: ${originalPlayerId} → ${newPlayerId}. Penalty: ${penaltyAmount}`,
    );

    return {
      success: true,
      newBetAmount,
      penaltyAmount,
      message: `Bet changed successfully. New amount: $${(Number(newBetAmount) / 1e6).toFixed(2)}`,
    };
  }

  /**
   * ⚡ Chainlink CRE: Listen for goal events
   * PHASE 1: PROVISIONAL CREDITS (In-Game)
   */
  private setupGoalListener(matchId: string) {
    chainlinkCREService.subscribeToGoalEvents(matchId, async (event) => {
      console.log("⚡ Goal detected by Chainlink CRE:", event);

      // Find all "Next Goal Scorer" bets for this match
      const bets = Array.from(this.activeBets.values()).filter(
        (b) =>
          b.matchId === matchId &&
          b.betType === "NEXT_GOAL_SCORER" &&
          b.status === "pending",
      );

      // ⚠️ PROVISIONAL settlement (NOT actual payout)
      for (const bet of bets) {
        if (bet.playerId === event.playerId) {
          // PROVISIONAL WINNER - Show credit in UI
          const provisionalWinnings =
            (bet.amount * BigInt(Math.floor(bet.odds * 100))) / 100n;

          await this.creditProvisional(bet.id, provisionalWinnings, {
            goalEventId: event.id,
            creditedAt: new Date(),
          });

          console.log(
            `💰 PROVISIONAL WIN: Bet ${bet.id} → +${provisionalWinnings} USDC (PENDING)`,
          );
        }
        // Note: Losing bets stay "pending" until final settlement
      }
    });

    // Listen for goal CORRECTIONS (e.g., Messi → Ronaldo)
    chainlinkCREService.subscribeToGoalCorrections(
      matchId,
      async (correction) => {
        console.log("⚠️ Goal correction:", correction);
        // correction = { originalScorer: "Messi", newScorer: "Ronaldo", minute: 23 }

        // Reverse provisional credits for original scorer
        const originalBets = Array.from(this.activeBets.values()).filter(
          (b) =>
            b.playerId === correction.originalScorer &&
            b.status === "provisional_win",
        );

        for (const bet of originalBets) {
          await this.reverseProvisionalCredit(bet.id);
          console.log(`⚠️ REVERSED: Bet ${bet.id} (goal changed)`);
        }

        // Apply provisional credits to correct scorer
        const newBets = Array.from(this.activeBets.values()).filter(
          (b) => b.playerId === correction.newScorer && b.status === "pending",
        );

        for (const bet of newBets) {
          const provisionalWinnings =
            (bet.amount * BigInt(Math.floor(bet.odds * 100))) / 100n;
          await this.creditProvisional(bet.id, provisionalWinnings, {
            correctedFrom: correction.originalScorer,
          });
          console.log(
            `💰 CORRECTED WIN: Bet ${bet.id} → +${provisionalWinnings} USDC (PENDING)`,
          );
        }
      },
    );
  }

  /**
   * ⚡ Chainlink CRE: Listen for match result (full-time)
   * PHASE 2: FINAL SETTLEMENT (Post-Game)
   */
  private setupMatchResultListener(matchId: string) {
    // Poll match state every 30 seconds
    const interval = setInterval(async () => {
      const state = await chainlinkCREService.getMatchState(matchId);

      if (state.status === "finished") {
        clearInterval(interval);

        console.log("⏳ Match ended - waiting for OFFICIAL result...");

        // ⚡ Get OFFICIAL final result from Chainlink CRE
        const result = await chainlinkCREService.getMatchResult(matchId);
        // result includes confirmed goal scorers, final score, etc.

        console.log("✅ Official result confirmed:", result);

        // FINAL SETTLEMENT - Actual fund transfers
        await this.settleBetsOnChain(matchId, result);

        // Settle all "Match Winner" bets
        const matchWinnerBets = Array.from(this.activeBets.values()).filter(
          (b) =>
            b.matchId === matchId &&
            b.betType === "MATCH_WINNER" &&
            (b.status === "pending" || b.status === "provisional_win"),
        );

        for (const bet of matchWinnerBets) {
          if (bet.outcome === result.winner) {
            const payout =
              (bet.amount * BigInt(Math.floor(bet.odds * 100))) / 100n;
            await this.finalizeWinningBet(bet.id, payout);
          } else {
            await this.finalizeLostBet(bet.id);
          }
        }

        console.log("🎉 All bets settled for match:", matchId);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * PHASE 1: Credit provisional winnings (shown in UI, NOT transferred)
   */
  private async creditProvisional(
    betId: string,
    amount: bigint,
    metadata: any,
  ): Promise<void> {
    const bet = this.activeBets.get(betId);
    if (!bet) return;

    // Update bet status
    bet.status = "provisional_win";
    bet.provisionalWinnings = amount;

    // Store provisional credit
    this.provisionalCredits.set(betId, {
      betId,
      amount,
      creditedAt: new Date(),
      goalEventId: metadata.goalEventId,
      status: "PENDING_PAYOUT",
    });

    // Update UI (WebSocket broadcast)
    await this.notifyUser(bet.bettorWallet, {
      type: "PROVISIONAL_WIN",
      betId,
      amount,
      message: `💰 +${amount} USDC PENDING (paid after match ends)`,
    });
  }

  /**
   * PHASE 1: Reverse provisional credit (when goal scorer changes)
   */
  private async reverseProvisionalCredit(betId: string): Promise<void> {
    const bet = this.activeBets.get(betId);
    const credit = this.provisionalCredits.get(betId);
    if (!bet || !credit) return;

    // Update status
    bet.status = "pending"; // Back to pending
    bet.provisionalWinnings = undefined;
    credit.status = "REVERSED";

    // Notify user
    await this.notifyUser(bet.bettorWallet, {
      type: "CREDIT_REVERSED",
      betId,
      message: "⚠️ Goal scorer changed - provisional credit reversed",
    });
  }

  /**
   * PHASE 2: Final settlement on-chain (ACTUAL fund transfers)
   */
  private async settleBetsOnChain(
    matchId: string,
    officialResult: any,
  ): Promise<void> {
    console.log("🔗 Triggering on-chain settlement...");

    // Call smart contract with official oracle data
    // This transfers funds from contract to winners' wallets
    await this.bettingContract.settleBets(matchId, {
      goals: officialResult.goals,
      winner: officialResult.winner,
      finalScore: officialResult.finalScore,
    });

    console.log("✅ On-chain settlement transaction confirmed");
  }

  /**
   * PHASE 2: Finalize winning bet (actual payout)
   */
  private async finalizeWinningBet(
    betId: string,
    payout: bigint,
  ): Promise<void> {
    const bet = this.activeBets.get(betId);
    if (!bet) return;

    bet.status = "settled_won";
    bet.finalPayout = payout;

    // Update provisional credit to CONFIRMED
    const credit = this.provisionalCredits.get(betId);
    if (credit) {
      credit.status = "CONFIRMED";
    }

    console.log(
      `✅ FINAL PAYOUT: Bet ${betId} → ${payout} USDC transferred to wallet`,
    );

    // Notify user
    await this.notifyUser(bet.bettorWallet, {
      type: "BET_SETTLED_WON",
      betId,
      payout,
      message: `✅ Bet won! ${payout} USDC sent to your wallet`,
    });
  }

  /**
   * PHASE 2: Finalize lost bet
   */
  private async finalizeLostBet(betId: string): Promise<void> {
    const bet = this.activeBets.get(betId);
    if (!bet) return;

    bet.status = "settled_lost";

    console.log(`❌ Bet ${betId} LOST (funds burned/redistributed)`);

    // Notify user
    await this.notifyUser(bet.bettorWallet, {
      type: "BET_SETTLED_LOST",
      betId,
      message: "❌ Bet lost - better luck next time!",
    });
  }

  // Helper methods
  private async submitBetToContract(bet: Bet): Promise<void> {
    // Call smart contract to lock bet funds
    // Implementation depends on blockchain (Solana/Base)
    console.log("📝 Submitting bet to blockchain (funds locked):", bet);
  }

  /**
   * Record bet change in database for audit trail
   */
  private async recordBetChange(
    betId: string,
    fromPlayerId: string,
    toPlayerId: string,
    penalty: number,
    penaltyType: string,
    matchMinute: number,
  ): Promise<void> {
    const changeRecord = {
      bet_id: betId,
      from_player_id: fromPlayerId,
      to_player_id: toPlayerId,
      penalty_amount: penalty,
      penalty_type: penaltyType,
      changed_at: new Date().toISOString(),
      match_minute: matchMinute,
    };

    // Insert into bet_changes table
    const { error } = await supabase.from("bet_changes").insert(changeRecord);

    if (error) {
      throw new Error(`Failed to record bet change: ${error.message}`);
    }

    console.log("📝 Bet change recorded:", changeRecord);
  }

  /**
   * Update bet on blockchain (reflect new player selection)
   */
  private async updateBetOnChain(bet: Bet): Promise<void> {
    // Call smart contract to update bet metadata
    // Note: Original locked amount stays locked, penalty already deducted from balance
    // Only updating the player_id in contract state
    try {
      await this.bettingContract.updateBet({
        betId: bet.id,
        newPlayerId: bet.current_player_id,
        totalPenalties: bet.total_penalties,
        changeCount: bet.change_count,
        timestamp: Date.now(),
      });

      console.log("⛓️ Bet updated on-chain:", {
        betId: bet.id,
        newPlayer: bet.current_player_id,
        penalties: bet.total_penalties,
      });
    } catch (error) {
      console.error("❌ Failed to update bet on-chain:", error);
      throw error;
    }
  }

  private async notifyUser(wallet: string, notification: any): Promise<void> {
    // Send WebSocket notification to user's extension
    console.log(`📢 Notifying ${wallet}:`, notification);
  }

  private bettingContract = {
    // Smart contract methods (placeholder)
    settleBets: async (matchId: string, result: any) => {
      console.log("Calling contract.settleBets()", matchId, result);
    },
    updateBet: async (params: {
      betId: string;
      newPlayerId: string;
      totalPenalties: number;
      changeCount: number;
      timestamp: number;
    }) => {
      console.log("Calling contract.updateBet()", params);
      // Updates bet metadata on-chain
      // Original locked funds remain locked
      // Penalty already deducted from user's available balance
    },
  };
}

export const bettingService = new BettingService();
```

**⚠️ CRITICAL SETTLEMENT NOTES:**

```
TWO-PHASE SETTLEMENT MODEL:

PHASE 1 (During Match):
- Goal detected → Credit user's "PENDING" balance
- User sees: "+$130 PENDING 💰"
- Funds NOT transferred yet (still locked in contract)
- If goal scorer changes → Reverse credit, apply to correct player
  Example: Messi → Ronaldo
    - Messi bettors: +$130 → -$130 (reversed)
    - Ronaldo bettors: +$65 PENDING

PHASE 2 (After Match):
- Match ends → Wait for OFFICIAL result (Chainlink CRE)
- Smart contract triggered with oracle data
- Funds transferred to winners' wallets
- Provisional credits → Actual payouts
- User wallet receives USDC

WHY THIS MODEL?
1. Prevents disputes (goals can be corrected during game)
2. Ensures accuracy (only official results count)
3. User engagement (see winnings immediately)
4. Fair settlement (oracle-verified, no manual intervention)
```

---

## 🎨 UI/UX Design Specs

### Player Button Layout (Sidebar)

**Position:** Fixed sidebars (left and right edges of viewport)

**Dimensions:**

- Width: 120px per sidebar
- Height: Dynamic (11 buttons × 70px + gaps)
- Padding: 10px
- Gap between buttons: 8px

**Button Anatomy:**

```
┌────────────────┐
│   🔴/🔵        │ ← Team color emoji
│   #10          │ ← Jersey number
│   Messi        │ ← Player name (truncated if long)
│   ┌────────┐   │
│   │ 2.8x   │   │ ← Next Goal odds (green background)
│   └────────┘   │
└────────────────┘
```

**States:**

1. **Default:** Semi-transparent white background
2. **Hover:** Scale 1.05, brighter background
3. **Selected:** Green border (if user has active bet on this player)
4. **Inactive:** Grayed out (if player substituted off)

### Match Winner Bar (Bottom)

**Position:** Fixed bottom of screen

**Design:**

```
┌──────────────────────────────────────────────────────────┐
│  [Real Madrid 2.1x]  [Draw 3.5x]  [Barcelona 1.8x]      │
└──────────────────────────────────────────────────────────┘
```

**Dimensions:**

- Height: 50px
- Width: 100% (full width)
- 3 equal buttons

---

## 📋 Development Roadmap (4 Weeks)

### Week 1: Extension Setup + Match Detection

**Tasks:**

1. Set up Chrome extension boilerplate (Manifest V3)
2. Implement platform detection (YouTube, Twitch, ESPN)
3. **⚡ Integrate Chainlink CRE for match detection**
   - Call: `chainlinkCREService.detectMatch(videoTitle, platform)`
   - Parse response to get matchId, teams, players
4. Build sidebar UI (22 player buttons)
5. Test on 3 platforms (YouTube, Twitch, ESPN)

**Deliverables:**

- [ ] Extension loads on YouTube/Twitch/ESPN
- [ ] Detects live football match automatically
- [ ] Displays 22 player buttons (11 left, 11 right)
- [ ] Player data fetched from Chainlink CRE ⚡

### Week 2: Wallet + Betting Flow

**Tasks:**

1. Integrate Web3 wallet (Phantom, MetaMask)
2. Build betting modal UI
3. Implement "Next Goal Scorer" bet placement
4. Implement "Match Winner" bet placement
5. Test on testnet (Solana Devnet or Base Sepolia)

**Deliverables:**

- [ ] User can connect wallet
- [ ] Click player button → Opens betting modal
- [ ] Select amount → Sign transaction → Bet placed
- [ ] Bet recorded on-chain (testnet)

### Week 3: Settlement + Chainlink CRE Events

**Tasks:**

1. **⚡ Integrate Chainlink CRE goal event subscription**
   - `chainlinkCREService.subscribeToGoalEvents(matchId, callback)`
2. **⚡ Integrate Chainlink CRE match result polling**
   - `chainlinkCREService.getMatchResult(matchId)`
3. Implement automatic bet settlement
4. Build winner notification UI
5. Test end-to-end on real match

**Deliverables:**

- [ ] Goal detected by Chainlink CRE → Bets settled instantly ⚡
- [ ] Match finishes → "Match Winner" bets settled ⚡
- [ ] Winners receive USDC payout
- [ ] Losers see "Better luck next time" message

### Week 4: Polish + Launch

**Tasks:**

1. Add loading states and error handling
2. Optimize odds update frequency (10-30s)
3. Build "My Bets" history panel
4. Write extension store listing (Chrome Web Store)
5. Beta test with 20 users
6. Launch!

**Deliverables:**

- [ ] Extension published to Chrome Web Store
- [ ] 20 beta users place 100+ bets
- [ ] 95%+ settlement accuracy
- [ ] <2s bet placement time

---

## 🔗 Reusable Components from air.fun

### From Platform ([`platform/`](/home/petrunix/air-fun-ai/air-fun-ai/platform))

| Component                 | File Path                                         | Reuse for goal.live                            |
| ------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| Wallet Integration        | `components/StreamerInterface.tsx` (lines 50-100) | ✅ Copy Thirdweb wallet connection logic       |
| Payment Modal             | `components/PaymentModal.tsx`                     | ✅ Adapt for betting UI (rename "Buy" → "Bet") |
| USDC Transaction Logic    | `services/paymentService.ts`                      | ✅ Use for bet placement and payout            |
| Real-time Sync (Supabase) | `services/streamService.ts`                       | ⚠️ Not needed (Chainlink CRE replaces this)    |

### From Filter ([`filter/`](/home/petrunix/air-fun-ai/air-fun-ai/filter))

| Component                | File Path                           | Reuse for goal.live                                     |
| ------------------------ | ----------------------------------- | ------------------------------------------------------- |
| Extension Manifest       | `extension/public/manifest.json`    | ✅ Copy and adapt permissions                           |
| Content Script Injection | `extension/src/content/main.ts`     | ✅ Reuse platform detection logic                       |
| Canvas Overlay           | `extension/src/content/viewer.ts`   | ❌ NOT NEEDED (goal.live uses HTML sidebar, not canvas) |
| WebSocket Client         | `extension/src/shared/ws-client.ts` | ⚠️ Maybe (if we add real-time odds sync)                |

### New Components (Not in air.fun)

1. **Player Sidebar Renderer** (`extension/content/player-sidebar.ts`)
   - 22 buttons positioned on left/right edges
   - NOT canvas overlay (air.fun uses canvas)
   - HTML/CSS fixed sidebars

2. **Chainlink CRE Service** (`services/chainlinkCREService.ts`) ⚡
   - Match detection
   - Live event subscription
   - Settlement data

3. **Betting Modal** (`extension/content/betting-modal.ts`)
   - Simpler than air.fun's PaymentModal
   - Only 2 bet types (Next Goal, Match Winner)

---

## 🚀 Phase 2: Native Streaming (8 Weeks)

**Goal:** Allow users to stream their own amateur matches with betting.

**Reuse from air.fun Platform:**

- WebRTC streaming infrastructure (`platform/services/webRTCService.ts`)
- Stream setup UI (`platform/components/StreamSetup.tsx`)
- Agent synchronization (but adapted for automatic player placement)

**Key Difference:**

- air.fun: Streamer places agents manually
- goal.live: System auto-places 22 players on sides (streamer just starts stream)

**Flow:**

1. User clicks "Stream Match"
2. Configure match info (Team A name, Team B name, players)
3. Click "GO LIVE" → Camera starts
4. System automatically creates 22 player buttons on sides
5. Viewers join, see stream + betting sidebar
6. **⚡ Chainlink CRE still used for settlement** (streamer manually confirms goals via UI)

---

## 📚 Technical Prompts for Implementation

### Prompt 1: Build Extension Sidebar (Week 1)

```
Build a Chrome extension (Manifest V3) that:

1. Detects live football matches on YouTube/Twitch/ESPN
2. Injects two fixed sidebars (left and right edges of viewport)
3. Renders 22 player buttons (11 per team) with:
   - Team color emoji (🔴 or 🔵)
   - Jersey number
   - Player name
   - Next Goal odds (e.g., "2.8x")
4. Player data fetched from Chainlink CRE API

Tech Stack:
- TypeScript
- Chrome Extension Manifest V3
- HTML/CSS (no canvas - use fixed positioned divs)

Key Files:
- manifest.json (permissions for YouTube, Twitch, ESPN)
- content/overlay.ts (sidebar renderer)
- services/chainlinkCREService.ts (API integration)

Reference air.fun filter extension structure:
/home/petrunix/air-fun-ai/air-fun-ai/filter/extension/

KEY DIFFERENCE: air.fun uses canvas overlay with agents on video.
goal.live uses HTML sidebars with buttons NOT on video.
```

### Prompt 2: Implement Betting Flow (Week 2)

```
Implement betting functionality:

1. Click player button → Open modal with:
   - Bet type: "Next Goal Scorer"
   - Player name and stats
   - Odds
   - Amount input ($5, $10, $25 presets + custom)
   - Potential win calculation
2. Connect Web3 wallet (Phantom or MetaMask)
3. Sign transaction → Deduct USDC → Record bet on-chain
4. Show confirmation: "✅ Bet placed on [Player] (2.8x)"

Also implement "Match Winner" bet (Team A / Team B / Draw) as bottom bar.

Reuse from air.fun platform:
- Wallet connection: /home/petrunix/air-fun-ai/air-fun-ai/platform/components/StreamerInterface.tsx (lines 50-100)
- Payment logic: /home/petrunix/air-fun-ai/air-fun-ai/platform/services/paymentService.ts

Tech Stack:
- Thirdweb SDK for wallet
- Solana or Base (choose one)
- USDC token transfers
```

### Prompt 3: Integrate Chainlink CRE Settlement (Week 3)

```
⚡ Integrate Chainlink CRE for automatic bet settlement:

1. Subscribe to goal events:
   - When goal detected → Settle all "Next Goal Scorer" bets
   - Winners receive payout (stake × odds)
   - Losers' stakes burned

2. Poll match result:
   - Every 30 seconds, check match state
   - When status = "finished" → Settle all "Match Winner" bets

3. Notification system:
   - Winner: "🎉 YOU WON! [Player] scored. +$28 USDC"
   - Loser: "❌ Better luck next time"

Chainlink CRE Docs:
https://docs.chain.link/cre/getting-started/part-1-project-setup-ts

Integration Points:
- chainlinkCREService.subscribeToGoalEvents(matchId, callback)
- chainlinkCREService.getMatchResult(matchId)

Settlement Logic:
See services/bettingService.ts in this document.
```

---

## 🎯 Success Metrics (Week 4)

| Metric                   | Target | Measurement                      |
| ------------------------ | ------ | -------------------------------- |
| Extension Installs       | 500+   | Chrome Web Store analytics       |
| Active Users (Weekly)    | 200+   | Users who place at least 1 bet   |
| Total Bet Volume         | $10K+  | Sum of all bets placed           |
| Avg Bets per User        | 5+     | Total bets / active users        |
| Settlement Accuracy      | 98%+   | Correct settlements / total bets |
| Bet Placement Speed      | <2s    | Time from click to confirmation  |
| **Chainlink CRE Uptime** | 99%+   | API availability                 |
| User Retention (D7)      | 40%+   | Users active after 7 days        |

---

## ⚠️ Critical Differences from air.fun

| Aspect              | air.fun                                     | goal.live                                   |
| ------------------- | ------------------------------------------- | ------------------------------------------- |
| **Agent Placement** | Streamer manually places at X,Y coordinates | **Automatic sidebar (left/right teams)**    |
| **Agent Movement**  | Static (placed once)                        | **Static on sides (not tracking pitch)**    |
| **Rendering**       | Canvas overlay on video                     | **HTML sidebars (NOT on video)**            |
| **Data Source**     | User-generated (streamer creates agents)    | **⚡ Chainlink CRE (live sports data)**     |
| **Settlement**      | Bonding curve math                          | **⚡ Chainlink CRE oracle (real events)**   |
| **Platform**        | Native WebRTC streaming                     | **Browser extension on existing platforms** |
| **Use Case**        | Generic streaming with custom agents        | **Football betting only**                   |

---

## 📖 References

- **air.fun Platform:** `/home/petrunix/air-fun-ai/air-fun-ai/platform/`
- **air.fun Filter:** `/home/petrunix/air-fun-ai/air-fun-ai/filter/`
- **Chainlink CRE Docs:** https://docs.chain.link/cre/getting-started/part-1-project-setup-ts
- **Existing Wallet Integration:** `platform/components/StreamerInterface.tsx`
- **Existing Payment Service:** `platform/services/paymentService.ts`

---

**Ready to build goal.live! 🎯⚽**

Next steps:

1. Set up new `goal.live/` directory (parallel to `platform/` and `filter/`)
2. Copy Chrome extension boilerplate from `filter/extension/`
3. Integrate Chainlink CRE for match detection ⚡
4. Build player sidebar UI (22 buttons, left/right)
5. Test on real YouTube football stream

Let another Copilot take over with this prompt! 🚀
