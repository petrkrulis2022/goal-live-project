# goal.live Development Roadmap

**Last Updated:** February 20, 2026  
**Status:** MVP Planning Phase  
**Strategy:** Phased Build with Progressive Integration

---

## 🎯 Read This FIRST

**For Copilot Sessions:**

1. ✅ Understand the **FULL PRODUCT VISION** (Sections 1-3 below)
2. ✅ Build in **PHASES** (Section 4 below)
3. ✅ Phase 1 = Frontend ONLY with ALL mocks (no backend, no contracts, no CRE)
4. ✅ Phases 2-4 = Gradually add real integrations
5. ✅ Stay flexible on mock vs real CRE data (depends on availability)

**This document shows:**

- ✨ What we're building (complete architecture)
- 🔧 How we're building it (phased approach)
- 🎭 What's mocked vs real in each phase

---

# Part 1: FULL PRODUCT VISION

> This is what the complete MVP looks like when finished. We build this incrementally in phases.

## 1.1 Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                      │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │  Livestream    │  │  Bet Panel   │  │  Static Player List     │ │
│  │  (OBS/force    │  │  (Sepolia    │  │  (11 left, 11 right)    │ │
│  │   unmute)      │  │   USDC)      │  │  Click to bet/change    │ │
│  └────────────────┘  └──────────────┘  └─────────────────────────┘ │
│                                                                       │
│  Services Layer (Mock in Phase 1 → Real in Later Phases):           │
│  - IWalletService (MetaMask)                                         │
│  - IBettingService (Smart Contract or Mock)                          │
│  - IMatchService (CRE or Mock)                                       │
│  - IAudioService (ACR game sync)                                     │
│  - IWorldIDService (Authentication)                                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐    ┌──────────────────┐    ┌────────────────────┐
│  BLOCKCHAIN   │    │     BACKEND      │    │   CHAINLINK CRE    │
│  (Sepolia)    │    │   (Supabase)     │    │  (Sports Oracle)   │
├───────────────┤    ├──────────────────┤    ├────────────────────┤
│ • USDC        │    │ • Bet tracking   │    │ • Match data       │
│ • Bonding     │    │ • Match history  │    │ • Player lineups   │
│   Curve       │    │ • Realtime sync  │    │ • Live events      │
│ • Betting     │    │ • AI dashboard   │    │ • Goal confirmations│
│   Contract    │    │ • World ID logs  │    │ • Official results │
│ • Penalty     │    │ • Bookies polls  │    │                    │
│   Logic       │    │                  │    │ (May be mocked)    │
└───────────────┘    └──────────────────┘    └────────────────────┘
```

## 1.2 Complete Tech Stack

| Layer               | Technology            | Purpose                            | Phase Introduced                  |
| ------------------- | --------------------- | ---------------------------------- | --------------------------------- |
| **Frontend**        | React 18 + TypeScript | UI framework                       | Phase 1                           |
|                     | Vite                  | Build tool                         | Phase 1                           |
|                     | ethers.js v6          | Blockchain interactions            | Phase 1 (mocked) / Phase 2 (real) |
|                     | Radix UI / shadcn/ui  | Component library                  | Phase 1                           |
|                     | TailwindCSS           | Styling                            | Phase 1                           |
|                     | ACR Cloud             | Audio fingerprinting for game sync | Phase 1 (mocked) / Phase 3 (real) |
|                     | @worldcoin/idkit      | World ID authentication SDK        | Phase 4                           |
| **Smart Contracts** | Solidity 0.8.x        | Contract language                  | Phase 2                           |
|                     | Hardhat               | Development framework              | Phase 2                           |
|                     | OpenZeppelin          | Security libraries                 | Phase 2                           |
|                     | Sepolia Testnet       | Ethereum test network              | Phase 2                           |
|                     | USDC (testnet)        | Betting currency                   | Phase 2                           |
| **Backend**         | Supabase              | Database + realtime + auth         | Phase 2                           |
|                     | PostgreSQL            | Database engine                    | Phase 2                           |
|                     | Edge Functions        | Serverless API endpoints           | Phase 3                           |
|                     | Row Level Security    | Data access control                | Phase 2                           |
| **Oracle**          | Chainlink CRE         | Sports data oracle                 | Phase 3                           |
|                     | Custom Feed           | Match events delivery              | Phase 3 (mock or real)            |
| **AI/ML**           | PostgreSQL            | Observation data store             | Phase 4                           |
|                     | (Future) Python/TF    | Predictive model training          | Post-MVP                          |
| **DevOps**          | Git                   | Version control                    | All phases                        |
|                     | Vercel / Netlify      | Frontend hosting                   | Phase 1+                          |
|                     | GitHub Actions        | CI/CD                              | Phase 2+                          |

## 1.3 Complete Feature List

### Core Features (MVP)

- ✅ **Live betting on next goal scorer** (USDC on Sepolia)
- ✅ **Unlimited bet changes** with hybrid penalty
- ✅ **Static player list UI** (11 left side, 11 right side)
- ✅ **Force unmute** for ACR audio sync
- ✅ **Provisional balance** during match
- ✅ **Final settlement** post-match
- ✅ **World ID authentication** (3 checkpoints: start, finish, withdrawal)
- ✅ **Historical demo mode** (replay finished match at 10x speed)
- ✅ **AI observational dashboard** (bookies behavior tracking)
- ✅ **Zero balance alerts** (force top-up)

### Penalty System

**Hybrid Formula:** `penalty = base[change_count] × time_decay_multiplier`

| Change # | Base Rate | Example (20' into match) |
| -------- | --------- | ------------------------ |
| 1st      | 3%        | 3% × 0.78 = 2.34%        |
| 2nd      | 5%        | 5% × 0.78 = 3.90%        |
| 3rd      | 8%        | 8% × 0.78 = 6.24%        |
| 4th      | 12%       | 12% × 0.78 = 9.36%       |
| 5th+     | 15%       | 15% × 0.78 = 11.70%      |

**Time Decay:** `1 - (current_minute / 90)`

### Removed Features (Not in MVP)

- ❌ Memecoins (air.fun tokens)
- ❌ Solana blockchain
- ❌ Base L2
- ❌ Match Winner bets
- ❌ Cards/Corners bets
- ❌ Tracking overlay UI
- ❌ Bookies-style odds changes

---

# Part 2: PHASED BUILD STRATEGY

> We build incrementally, starting with mocked frontend to test gameplay.

## Overview Table

| Phase | Duration | Focus           | Backend   | Contracts | CRE             | Output           |
| ----- | -------- | --------------- | --------- | --------- | --------------- | ---------------- |
| **1** | Week 1-2 | Frontend only   | ❌ Mocked | ❌ Mocked | ❌ Mocked       | Playable UI demo |
| **2** | Week 3   | Smart contracts | ✅ Basic  | ✅ Real   | ❌ Mocked       | On-chain betting |
| **3** | Week 4   | Backend + CRE   | ✅ Full   | ✅ Real   | 🎭 Mock or Real | Historical demo  |
| **4** | Week 5   | AI + World ID   | ✅ Full   | ✅ Real   | 🎭 Mock or Real | Full MVP         |

**Legend:**

- ❌ Mocked = Entirely simulated in frontend
- ✅ Real = Fully integrated
- 🎭 Mock or Real = Depends on CRE data availability

---

## Phase 1: Frontend Only (ALL MOCKED)

**Goal:** Build playable frontend to test game experience

**Build Prompt:** [FRONTEND_BUILD_PROMPT.md](./FRONTEND_BUILD_PROMPT.md)

### What to Build

```
✅ React app with all UI components
✅ Static player list (11 left, 11 right)
✅ Bet placement flow
✅ Bet change flow with penalty preview
✅ Mock wallet connection (hardcoded address)
✅ Mock match data (fake players, odds)
✅ Mock bet submission (console.log only)
✅ Mock penalty calculation (frontend-only)
✅ Mock livestream (static video or iframe)
✅ Mock audio sync (simulated game minute)
```

### Mock Service Implementations

**All services return fake data:**

```typescript
// Mock Wallet Service
export class MockWalletService implements IWalletService {
  async connect() {
    return { address: "0xMOCK123...", balance: 1000000000n }; // 1000 USDC
  }
  async getBalance() {
    return 1000000000n;
  }
}

// Mock Betting Service
export class MockBettingService implements IBettingService {
  async placeBet(playerId: string, amount: bigint) {
    console.log("Mock bet placed:", { playerId, amount });
    return { success: true, txHash: "0xMOCK_TX" };
  }
  async getBets(wallet: string) {
    return [
      {
        id: 1,
        playerId: "p1",
        amount: 100000000n,
        odds: 45000,
        changeCount: 0,
      },
    ];
  }
}

// Mock Match Service
export class MockMatchService implements IMatchService {
  async getMatch(id: string) {
    return {
      id,
      homeTeam: "Real Madrid",
      awayTeam: "Barcelona",
      status: "live",
      minute: 23,
      score: { home: 0, away: 0 },
      players: MOCK_PLAYERS, // Hardcoded array
    };
  }
}
```

**No Backend Calls:** Everything runs in browser memory.

**Deliverable:** Playable demo where you can:

- See match and players
- Place bet
- Change bet and see penalty preview
- See balance update (in-memory only)

---

## Phase 2: Smart Contracts + Basic Backend

**Goal:** Real on-chain betting with Sepolia USDC

**Build Prompts:**

- [CONTRACTS_BUILD_PROMPT.md](./CONTRACTS_BUILD_PROMPT.md)
- [BACKEND_BUILD_PROMPT.md](./BACKEND_BUILD_PROMPT.md) (Supabase setup only)

### What to Build

```
✅ GoalLiveBetting.sol smart contract
✅ Hybrid penalty calculation in Solidity
✅ Deploy to Sepolia testnet
✅ Hardhat scripts and tests
✅ Supabase database setup
✅ Basic bet tracking tables
✅ Frontend integration (replace MockBettingService)
```

### Mock vs Real

| Component        | Status    | Details                   |
| ---------------- | --------- | ------------------------- |
| Wallet           | ✅ Real   | MetaMask on Sepolia       |
| USDC             | ✅ Real   | Sepolia testnet USDC      |
| Betting Contract | ✅ Real   | Deployed on Sepolia       |
| Penalty Calc     | ✅ Real   | On-chain calculation      |
| Match Data       | ❌ Mocked | Still hardcoded players   |
| Goal Events      | ❌ Mocked | Manual trigger in UI      |
| CRE Oracle       | ❌ Mocked | Frontend simulates events |

### Supabase Tables Created

- `matches`
- `players`
- `bets`
- `bet_changes`
- `goal_events` (manually inserted for now)

**Deliverable:** Real bets on Sepolia with penalty enforcement

---

## Phase 3: CRE Integration (Mock or Real)

**Goal:** Automated match data and events via custom bookies API + MockCREService

**Build Prompt:** [BACKEND_BUILD_PROMPT.md](./BACKEND_BUILD_PROMPT.md) (CRE sections)

### What to Build

```
✅ Custom internal "Bookies API Service" (our own data layer)
✅ MockCREService that calls our Bookies API
✅ Webhook endpoint (Supabase Edge Function)
✅ Historical demo playback system (10x speed replay)
✅ Realtime event broadcasting to frontend
✅ Provisional balance + dynamic odds calculation on goal
```

### Recommended MVP Approach: Custom Bookies API Service

Instead of waiting for external CRE or real-time API access, **build a lightweight internal API that serves one complete match** with all known stats. This becomes your MVP's data engine.

**Architecture:**

```
┌────────────────────────────────────────────────────┐
│    Our Custom Bookies API Service                  │
│    (Simple Node.js/Express server)                 │
├────────────────────────────────────────────────────┤
│                                                    │
│  POST /api/matches/setup                           │
│  ├─ Upload match data:                             │
│  │  - PreMatch odds (from The Odds API)            │
│  │  - Lineups (player names, positions)            │
│  │  - Match events (goals, cards, subs - KNOWN)    │
│  │  - Final result (KNOWN)                         │
│  │                                                 │
│  GET /api/matches/:matchId/state                   │
│  ├─ Returns current game state at requested time   │
│  │                                                 │
│  GET /api/matches/:matchId/odds?minute=23          │
│  ├─ Returns odds adjusted for events at min 23:    │
│  │  - Base odds: from pre-match (The Odds API)     │
│  │  - Dynamic adjustment: if Benzema scores @ 23', │
│  │    then his odds DROP (he's less likely now)    │
│  │  - Substitutes: if player subbed off, odds LOCK │
│  │                                                 │
│  POST /api/matches/:matchId/reset                  │
│  ├─ Reset match state to kickoff                   │
│  ├─ Allows infinite replays for demo/testing       │
│  │                                                 │
└────────────────────────────────────────────────────┘
         ↑                                ↓
         │                                │
   MockCREService                   Frontend + Smart Contracts
   (calls this API)                  (call this API for odds/state)
```

### Data Source Strategy

**For MVP Demo, choose ONE of these approaches:**

#### Option A: Recent Completed Match (RECOMMENDED)

Use a match that was **played recently** (last 2-7 days) where all stats are known:

```yaml
Example: Manchester City vs Newcastle (if already played)
└─ ✅ All stats publicly available (go to ESPN, FBRef)
└─ ✅ Pre-match odds retrievable from The Odds API
└─ ✅ Can replay unlimited times
└─ ✅ No dependency on live broadcast timing
└─ ✅ Demo works anytime, anywhere
```

**Workflow:**

1. Find match (ESPN/FBRef)
2. Get lineups, final score, all goals + times
3. Fetch pre-match odds from The Odds API (they archive this)
4. Build your Bookies API with this data
5. Replay anytime during hackathon

#### Option B: Today's Game (If It Fits Timeline)

Use a match happening **today/tomorrow**:

```yaml
Example: Manchester City vs Newcastle (if playing today)
└─ ✅ Real odds from The Odds API
└─ ✅ Real lineups when published (T-15 min pre-game)
└─ └─ Get from The Odds API or ESPN
└─ ✅ Watch live, record all events
└─ ✅ After match: compile full stats
└─ After: Can replay demo using compiled data
```

**Workflow:**

1. Watch game live
2. Record: minute of each goal, player name, substitutions, cards
3. After final whistle: compile official stats
4. Build Bookies API with recorded data
5. Demo MVP with this data

**Risk:** Depends on timing. If game is late, you might finish after hackathon ends.

#### Option C: Hybrid (Best for Hackathon)

- Use a **recent past match** (completed, all stats known)
- Get pre-match odds from The Odds API (they archive odds for past matches)
- Build stable Bookies API immediately
- If external CRE becomes available later → integrate real data

**Recommended for goal.live MVP: OPTION A (recent past match)**

### Implementation: Your Bookies API Service

```typescript
// backend/src/services/bookiesApi.ts

export interface MatchSetupData {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: Date;

  // Pre-match odds from The Odds API (or archive)
  preMatchOdds: {
    [playerId: string]: {
      name: string;
      odds: number; // Decimal odds (e.g., 4.5)
      position: string;
    };
  };

  // All events that will happen (in chronological order)
  events: Array<{
    minute: number;
    type: "GOAL" | "RED_CARD" | "YELLOW_CARD" | "SUBSTITUTION";
    playerId: string;
    playerName: string;
    team: "home" | "away";
  }>;

  // Final result
  finalResult: {
    scoreHome: number;
    scoreAway: number;
  };
}

export class BookiesApiService {
  private matchData: MatchSetupData;
  private currentMinute: number = 0;
  private playersOnPitch: Set<string> = new Set();

  async setupMatch(data: MatchSetupData) {
    this.matchData = data;
    // Initialize players on pitch
    Object.keys(data.preMatchOdds).forEach((pId) => {
      this.playersOnPitch.add(pId);
    });
  }

  async getMatchState(atMinute: number) {
    // Return match state AT THAT MINUTE
    // E.g., if Benzema scored at minute 23, and we query minute 30,
    // return state with goal already counted

    const events = this.matchData.events.filter((e) => e.minute <= atMinute);
    const scorersAtMinute = events
      .filter((e) => e.type === "GOAL")
      .map((e) => e.playerName);

    return {
      matchId: this.matchData.matchId,
      currentMinute: atMinute,
      score: {
        home: scorersAtMinute.filter(
          (s) => this.matchData.preMatchOdds[s]?.position === "home",
        ).length,
        away: scorersAtMinute.length,
      },
      goalScorers: scorersAtMinute,
    };
  }

  async getOddsAtMinute(atMinute: number): Promise<Record<string, number>> {
    // Return odds ADJUSTED for events that have occurred
    const odds: Record<string, number> = {};

    for (const [playerId, playerData] of Object.entries(
      this.matchData.preMatchOdds,
    )) {
      let baseOdds = playerData.odds;

      // Check if player has already scored
      const hasScored = this.matchData.events
        .filter((e) => e.minute <= atMinute && e.type === "GOAL")
        .some((e) => e.playerId === playerId);

      if (hasScored) {
        // Player already scored - odds DROP significantly
        baseOdds = baseOdds * 0.15; // 85% reduction (can't score again same match)
      }

      // Check if player was subbed off
      const wasSubbed = this.matchData.events
        .filter((e) => e.minute <= atMinute && e.type === "SUBSTITUTION")
        .some((e) => e.playerId === playerId);

      if (wasSubbed) {
        // Player off the field - odds are 0 (can't score)
        baseOdds = 0;
      }

      // Check if player is on pitch
      if (this.playersOnPitch.has(playerId)) {
        odds[playerId] = baseOdds;
      }
    }

    return odds;
  }

  async progressTime(toMinute: number) {
    // Simulate time progression
    this.currentMinute = toMinute;
  }

  async reset() {
    // Reset to kickoff - allows infinite replays
    this.currentMinute = 0;
    this.playersOnPitch.clear();
    Object.keys(this.matchData.preMatchOdds).forEach((pId) => {
      this.playersOnPitch.add(pId);
    });
  }
}
```

**Express Server:**

```typescript
// backend/src/routes/bookies-api.ts

import express from "express";
import { BookiesApiService } from "../services/bookiesApi";

const router = express.Router();
const bookiesApi = new BookiesApiService();

// Setup match with known data
router.post("/api/matches/setup", async (req, res) => {
  await bookiesApi.setupMatch(req.body);
  res.json({ success: true, message: "Match data loaded" });
});

// Get current match state
router.get("/api/matches/:matchId/state", async (req, res) => {
  const { minute } = req.query;
  const state = await bookiesApi.getMatchState(parseInt(minute as string));
  res.json(state);
});

// Get odds at specific minute
router.get("/api/matches/:matchId/odds", async (req, res) => {
  const { minute } = req.query;
  const odds = await bookiesApi.getOddsAtMinute(parseInt(minute as string));
  res.json({
    minute: parseInt(minute as string),
    odds,
    disclaimer: "Odds adjusted for events that have occurred",
  });
});

// Reset match (for replays)
router.post("/api/matches/:matchId/reset", async (req, res) => {
  await bookiesApi.reset();
  res.json({ success: true, message: "Match reset to kickoff" });
});

export default router;
```

### MockCREService Implementation

Once your Bookies API is running, MockCREService becomes simple:

```typescript
// services/cre/MockCREService.ts

export class MockCREService implements ICREService {
  constructor(
    private bookiesApiUrl: string,
    private speedMultiplier: number = 10,
  ) {}

  subscribeToGoalEvents(
    matchId: string,
    callback: (goal: GoalEvent) => void,
  ): () => void {
    // Get match data from OUR Bookies API
    const events = this.fetchMatchEvents(matchId);

    // Simulate time progression and call callback when goals occur
    let currentIndex = 0;

    const interval = setInterval(async () => {
      if (currentIndex >= events.length) {
        clearInterval(interval);
        return;
      }

      const event = events[currentIndex];

      // Calculate delay based on speed multiplier
      const delayMs = (event.minute * 60 * 1000) / this.speedMultiplier;

      // Call callback with goal event
      callback({
        matchId,
        playerId: event.playerId,
        playerName: event.playerName,
        minute: event.minute,
        timestamp: Date.now(),
        source: "mock_cre_bookies_api",
        verified: true,
      });

      currentIndex++;
    }, 500);

    return () => clearInterval(interval);
  }

  async getOddsAtMinute(matchId: string, minute: number) {
    // Call OUR Bookies API to get adjusted odds
    const response = await fetch(
      `${this.bookiesApiUrl}/api/matches/${matchId}/odds?minute=${minute}`,
    );
    return response.json();
  }

  private fetchMatchEvents(matchId: string) {
    // Call OUR Bookies API to get all match events
    return fetch(`${this.bookiesApiUrl}/api/matches/${matchId}/events`).then(
      (r) => r.json(),
    );
  }
}
```

### MVP Flow with Bookies API

```
1. Setup Phase:
   ├─ Get match data from ESPN (lineups, final score, goals)
   ├─ Get pre-match odds from The Odds API
   ├─ POST to /api/matches/setup with all data
   └─ Bookies API is now ready

2. Demo Phase (Repeatable):
   ├─ Frontend asks: "Which match?"
   ├─ Bookies API returns: Match state at minute 0
   ├─ User places bet on Benzema (4.5x odds)
   ├─ MockCREService progresses time (10x speed)
   ├─ At minute 23: Goal! Callback fires
   ├─ Frontend queries: GET /odds?minute=23
   ├─ Bookies API returns: Benzema odds now 0.5x (already scored)
   ├─ User sees provisional balance update
   ├─ Continue to final whistle
   └─ Final settlement triggered

3. Replay Phase:
   ├─ POST /reset
   ├─ Bookies API state returns to minute 0
   ├─ Repeat demo as many times as needed
   └─ Perfect for hackathon demos (no timing dependencies)
```

### Deliverable

- ✅ Lightweight Bookies API service (can be Express or even Next.js API routes)
- ✅ One complete match with all stats pre-loaded
- ✅ MockCREService calling Bookies API
- ✅ Frontend receiving events via realtime (Supabase or WebSocket)
- ✅ Dynamic odds adjustments based on game events
- ✅ Repeatable, reliable MVP demo

**Decision Point:** If Chainlink CRE becomes available later, replace Bookies API calls with real CRE calls. Service interface remains the same.

---

## Phase 3 Option B (If Real CRE Available)

If during Phase 3 you gain access to **real Chainlink CRE**:

```
✅ Subscribe to live match via CRE webhooks
✅ Receive goal events directly from Chainlink
✅ Populate players from CRE lineup data
✅ Get official result from CRE
✅ **Service abstraction means zero code changes** - just swap the service
```

**Implementation:**

```typescript
// Simply swap the service factory
const creService =
  process.env.USE_REAL_CRE === "true"
    ? new RealCREService(creApiKey)
    : {
        bookiesApiUrl: process.env.BOOKIES_API_URL,
        speedMultiplier: 10,
        // ... new MockCREService(bookiesApiUrl, speedMultiplier)
      };
```

---

## Phase 4: AI Dashboard + World ID

**Goal:** Complete MVP with anti-bot and ML foundation

**Build Prompt:** [BACKEND_BUILD_PROMPT.md](./BACKEND_BUILD_PROMPT.md) (AI sections)

### What to Build

```
✅ World ID integration (@worldcoin/idkit)
✅ World ID verification at 3 checkpoints
✅ AI observational dashboard
✅ Bookies API polling service (or mock)
✅ ai_event_observations table
✅ Admin UI for ML insights
✅ CSV export for training data
```

### Mock vs Real

| Component       | Status          | Details                             |
| --------------- | --------------- | ----------------------------------- |
| World ID        | 🎭 Real or Mock | Depends on Sepolia support          |
| Bookies Polling | 🎭 Mock likely  | Most bookies don't have public APIs |
| AI Dashboard    | ✅ Real         | PostgreSQL + basic analytics        |

**Deliverable:** Full MVP with authentication and ML data collection

---

# Part 3: MOCK VS REAL DECISION MATRIX

## 3.1 Always Real (No Mocking)

- ✅ Wallet connection (MetaMask)
- ✅ Blockchain transactions (Sepolia)
- ✅ USDC transfers
- ✅ Penalty calculations (smart contract)
- ✅ Supabase database
- ✅ Realtime subscriptions

## 3.2 Real if Available, Mock Otherwise

- 🎭 **Chainlink CRE** → Depends on API access and data availability
  - Real: Live match subscriptions, official results
  - Mock: Historical JSON replay, simulated events
- 🎭 **World ID** → Depends on Sepolia testnet support
  - Real: Full verification flow
  - Mock: Skip verification, log attempts
- 🎭 **Bookies APIs** → Most don't have public access
  - Real: Poll live odds if API available
  - Mock: Generate random odds fluctuations

## 3.3 Mocked in Phase 1, Real Later

- ⏳ Match data (Phase 1: hardcoded → Phase 3: CRE or mock)
- ⏳ Goal events (Phase 1: manual → Phase 3: CRE webhook)
- ⏳ Betting contract (Phase 1: console.log → Phase 2: Sepolia)
- ⏳ Audio sync (Phase 1: fake minute → Phase 3: ACR integration)

---

# Part 4: INTEGRATION STRATEGY

## 4.1 Service Abstraction Pattern

**All external integrations use interfaces:**

```typescript
// Define interface
export interface IMatchService {
  getMatch(id: string): Promise<Match>;
  subscribeToEvents(id: string, callback: (event: any) => void): () => void;
}

// Mock implementation (Phase 1)
export class MockMatchService implements IMatchService {
  async getMatch(id: string) {
    return HARDCODED_MATCH_DATA;
  }
}

// Real implementation (Phase 3)
export class ChainlinkMatchService implements IMatchService {
  async getMatch(id: string) {
    const response = await fetch(`${CRE_API}/matches/${id}`);
    return response.json();
  }
}

// Switch via environment variable
const matchService: IMatchService =
  import.meta.env.VITE_USE_MOCK_MATCH === "true"
    ? new MockMatchService()
    : new ChainlinkMatchService(apiKey);
```

**Benefits:**

- ✅ Build frontend with mocks immediately
- ✅ Swap implementations without code changes
- ✅ Test both mock and real in parallel
- ✅ Easy rollback if real integration fails

## 4.2 CRE Data Flexibility

**As we build, we discover what CRE data is available:**

### Scenario A: Full CRE Access

```
✅ Use real match subscriptions
✅ Get live player lineups
✅ Receive goal events via webhook
✅ Get official results
```

### Scenario B: Limited CRE Data

```
🎭 Use historical JSON files
🎭 Manually populate player lists
🎭 Replay events from archived data
🎭 Simulate webhook calls
```

### Scenario C: Hybrid

```
✅ Use CRE for pre-match data (lineups, odds)
🎭 Mock live events with historical data
✅ Use CRE for final result verification
```

**Decision made during Phase 3 based on actual availability.**

---

# Part 5: PHASE COMPLETION CRITERIA

## Phase 1 Complete When:

- [ ] UI renders all components
- [ ] Can click player to place mock bet
- [ ] Can change bet and see penalty preview
- [ ] Mock balance updates in UI
- [ ] Livestream iframe displays
- [ ] No console errors

## Phase 2 Complete When:

- [ ] Smart contract deployed on Sepolia
- [ ] MetaMask connects and shows real balance
- [ ] Real USDC bet transaction succeeds
- [ ] On-chain penalty calculated correctly
- [ ] Supabase stores bet records
- [ ] Can query bets via Supabase API

## Phase 3 Complete When:

- [ ] Match data loads (CRE or mock)
- [ ] Goal event triggers (webhook or simulation)
- [ ] Provisional balance updates on goal
- [ ] Historical demo plays at 10x speed
- [ ] Frontend receives realtime events
- [ ] Final settlement processes correctly

## Phase 4 Complete When:

- [ ] World ID prompts at 3 checkpoints (or mocked)
- [ ] AI observations logged to database
- [ ] Admin dashboard displays insights
- [ ] Bookies data collected (real or mock)
- [ ] CSV export works
- [ ] Full user flow tested end-to-end

---

# Part 6: QUICK START FOR COPILOT

**New session? Read in this order:**

1. **This file** → Understand vision + phased approach
2. [MVP_FINAL_SPEC.md](./MVP_FINAL_SPEC.md) → All design decisions
3. **Phase-specific prompt:**
   - Phase 1: [FRONTEND_BUILD_PROMPT.md](./FRONTEND_BUILD_PROMPT.md)
   - Phase 2: [CONTRACTS_BUILD_PROMPT.md](./CONTRACTS_BUILD_PROMPT.md) + [BACKEND_BUILD_PROMPT.md](./BACKEND_BUILD_PROMPT.md)
   - Phase 3: [BACKEND_BUILD_PROMPT.md](./BACKEND_BUILD_PROMPT.md) (CRE sections)
   - Phase 4: [BACKEND_BUILD_PROMPT.md](./BACKEND_BUILD_PROMPT.md) (AI sections)

**Key Principles:**

- 🎯 Build for **complete MVP** (see Part 1)
- 🔧 But **start with Phase 1** (frontend mocks only)
- 🎭 Stay **flexible on mock vs real** (especially CRE)
- 📦 Use **service abstraction** pattern everywhere
- ✅ Complete **one phase fully** before moving to next

---

**Questions?** See [ARCHITECTURE.md](./ARCHITECTURE.md) for technical deep dives.
