# goal.live - Complete System Architecture

**Last Updated:** February 20, 2026  
**Version:** 1.0

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Chainlink CRE Integration](#chainlink-cre-integration)
7. [World ID Authentication](#world-id-authentication)
8. [Smart Contract Architecture](#smart-contract-architecture)
9. [AI Observational Dashboard](#ai-observational-dashboard)
10. [Data Flow](#data-flow)
11. [Integration Points](#integration-points)
12. [Historical Game Demo Approach](#historical-game-demo-approach)
13. [Scalability & Performance](#scalability--performance)

---

## Overview

**goal.live** is a decentralized real-time sports betting platform that allows users to bet on live football matches using cryptocurrency. The system is built with a **frontend-first approach** using mock services initially, then integrating real backend services and Chainlink CRE oracle data.

### Core Features (MVP)

- **Real-time betting** on "Next Goal Scorer" only (single bet type for MVP)
- **Unlimited bet changes** during live matches with hybrid penalty system (time-decay + progressive)
- **Provisional balance** display during match, **final settlement** post-match via Chainlink CRE
- **Chrome extension** with static side list overlay (11 players per side, no tracking)
- **World ID authentication** for privacy-preserving proof of humanness (anti-bot)
- **Decentralized settlement** via smart contracts on Ethereum Sepolia testnet
- **Oracle-verified** match data from Chainlink CRE (may be mocked for MVP demo)
- **Force unmute** requirement for ACR audio game sync
- **AI observational dashboard** to learn bookies' odds/lock patterns for future ML

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE LAYER                          │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │              Chrome Extension (Content Script)                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │           React App (Betting Overlay)                     │  │   │
│  │  │  • Player Buttons (22)  • Bet Modal  • Balance Display   │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND SERVICES LAYER                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │  Mock Services  │  │  Real Services  │  │  Wallet Service │        │
│  │  (Phase 1)      │  │  (Phase 2+)     │  │  (RainbowKit)   │        │
│  │  • mockData     │  │  • dataService  │  │  • connect()    │        │
│  │  • mockBetting  │  │  • betting      │  │  • sign()       │        │
│  │  • mockWallet   │  │  • contract     │  │  • balance()    │        │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│   CHAINLINK CRE      │  │  SMART CONTRACTS │  │   DATABASE (Supabase)│
│   (Oracle Layer)     │  │  (Blockchain)    │  │   (PostgreSQL)       │
├──────────────────────┤  ├──────────────────┤  ├──────────────────────┤
│ • Match Detection    │  │ • Bet Locking    │  │ • bets               │
│ • Player Lineup      │  │ • Bet Changes    │  │ • bet_changes        │
│ • Goal Events        │  │ • Penalty Calc   │  │ • provisional_credits│
│ • Match State        │  │ • Settlement     │  │ • goal_events        │
│ • Official Results   │  │ • Payout         │  │ • matches            │
│ • Odds Data          │  │ • Fund Storage   │  │ • players            │
└──────────────────────┘  └──────────────────┘  └──────────────────────┘
         │                         │                       │
         └─────────────────────────┼───────────────────────┘
                                   ▼
                        ┌──────────────────────┐
                        │   Opta Sports API    │
                        │  (External Data)     │
                        └──────────────────────┘
```

---

## Technology Stack

### Frontend

| Component            | Technology            | Version | Purpose                    |
| -------------------- | --------------------- | ------- | -------------------------- |
| **UI Framework**     | React                 | 18.3.1  | Component-based UI         |
| **Language**         | TypeScript            | 5.8.2   | Type-safe development      |
| **Styling**          | Tailwind CSS          | 3.4+    | Utility-first styling      |
| **Build Tool**       | Vite                  | 5.0+    | Fast dev server & bundling |
| **Extension**        | Chrome Manifest v3    | -       | Browser extension API      |
| **State Management** | React Hooks + Context | -       | Global state               |
| **HTTP Client**      | Fetch API / Axios     | -       | API requests               |
| **WebSocket**        | native WebSocket      | -       | Real-time updates          |

### Backend Services

| Component     | Technology                         | Purpose                                |
| ------------- | ---------------------------------- | -------------------------------------- |
| **Database**  | Supabase (PostgreSQL)              | Bet tracking, user data                |
| **Real-time** | Supabase Realtime                  | Live updates to clients                |
| **Auth**      | Wallet-based (no traditional auth) | User identification via wallet address |
| **API**       | RESTful + WebSocket                | Data exchange                          |
| **Storage**   | Supabase Storage                   | Match assets, player images            |

### Blockchain Layer

| Component              | Technology                 | Purpose                          |
| ---------------------- | -------------------------- | -------------------------------- |
| **Blockchain**         | Ethereum Sepolia (Testnet) | MVP testing environment          |
| **Smart Contracts**    | Solidity (Hardhat)         | Bet logic, fund locking          |
| **Wallet Integration** | RainbowKit                 | User wallet connection           |
| **Oracle**             | Chainlink CRE              | Sports data (may be mocked)      |
| **Authentication**     | World ID                   | Proof of humanness, Sybil resist |
| **Currency**           | USDC (Sepolia testnet)     | Stablecoin for betting           |
| **Liquidity Provider** | Platform (for MVP)         | Market maker with testnet funds  |

### Oracle & Data

| Component                | Technology                             | Purpose                               |
| ------------------------ | -------------------------------------- | ------------------------------------- |
| **Oracle Network**       | Chainlink Cross-Chain Data Feeds (CRE) | Tamper-proof sports data              |
| **Sports Data Provider** | Opta Sports API / Bookies API          | Real-time match data, lineups, events |
| **Data Frequency**       | Event-triggered (goals, cards, subs)   | Live match updates on key events only |
| **Settlement Data**      | CRE final confirmation                 | Official match results                |
| **MVP Note**             | **May be mocked for initial demo**     | Historical game with known data       |

### Development Tools

| Tool                | Purpose    |
| ------------------- | ---------- | --------------------- |
| **Testing (Unit)**  | Vitest     | Fast unit testing     |
| **Testing (E2E)**   | Playwright | Browser automation    |
| **Linting**         | ESLint     | Code quality          |
| **Formatting**      | Prettier   | Code formatting       |
| **Package Manager** | npm / pnpm | Dependency management |
| **Version Control** | Git        | Source control        |

---

## Frontend Architecture

### Directory Structure

```
goal.live/
├── extension/
│   ├── manifest.json              # Chrome extension config
│   ├── content-script.ts          # Injected into streaming pages
│   ├── background.ts              # Service worker
│   └── popup.html                 # Extension popup (settings)
│
├── src/
│   ├── components/                # React components
│   │   ├── BettingOverlay.tsx    # Main UI container
│   │   ├── PlayerButton.tsx      # Individual player bet button
│   │   ├── BetModal.tsx          # Bet placement modal
│   │   ├── BetChangeModal.tsx    # Bet change modal
│   │   ├── BalanceDisplay.tsx    # Balance widget
│   │   ├── MatchInfo.tsx         # Score/time display
│   │   └── BetHistory.tsx        # User's active/past bets
│   │
│   ├── services/                  # Business logic layer
│   │   ├── mock/                  # Phase 1: Mock implementations
│   │   │   ├── mockDataService.ts
│   │   │   ├── mockBettingService.ts
│   │   │   └── mockWalletService.ts
│   │   │
│   │   ├── real/                  # Phase 2+: Real implementations
│   │   │   ├── dataService.ts     # Chainlink CRE integration
│   │   │   ├── bettingService.ts  # Supabase + contract calls
│   │   │   ├── contractService.ts # Smart contract interactions
│   │   │   └── walletService.ts   # RainbowKit/Phantom
│   │   │
│   │   └── index.ts               # Service factory (mock vs real)
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── useMatchData.ts       # Match state management
│   │   ├── useBetting.ts         # Bet placement/changes
│   │   ├── useBalance.ts         # Balance tracking
│   │   ├── useWallet.ts          # Wallet connection
│   │   └── useRealtime.ts        # WebSocket subscriptions
│   │
│   ├── types/                     # TypeScript definitions
│   │   ├── index.ts              # Shared types
│   │   ├── match.types.ts        # Match-related interfaces
│   │   ├── bet.types.ts          # Bet-related interfaces
│   │   └── contract.types.ts     # Smart contract types
│   │
│   ├── utils/                     # Helper functions
│   │   ├── penaltyCalculator.ts  # Bet change penalty logic
│   │   ├── oddsFormatter.ts      # Odds display formatting
│   │   └── balanceCalculator.ts  # Balance aggregation
│   │
│   ├── config/                    # Configuration
│   │   ├── constants.ts          # App constants
│   │   └── env.ts                # Environment variables
│   │
│   └── styles/                    # Global styles
│       └── global.css            # Tailwind + custom styles
│
├── public/                        # Static assets
│   ├── icons/                    # Extension icons
│   └── images/                   # UI assets
│
└── tests/                         # Test files
    ├── unit/
    ├── integration/
    └── e2e/
```

### UI Layout (MVP Static Side List)

**Design Approach:** Static side-by-side player list (no player tracking overlay)

```
┌─────────────────────────────────────────────────────────────────┐
│                     YOUTUBE/TWITCH VIDEO                         │
│                                                                   │
│                        (Video Player)                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│           GOAL.LIVE BETTING OVERLAY (Chrome Extension)             │
├────────────────────────────────────────────────────────────────────┤
│  Real Madrid 1 - 1 Barcelona           45:32  ⚽ Live              │
│  Your Balance: $245 (Pending) | Wallet: $1,000 USDC               │
├──────────────────────────┬─────────────────────────────────────────┤
│   HOME (Real Madrid)     │        AWAY (Barcelona)                 │
├──────────────────────────┼─────────────────────────────────────────┤
│ 🔵 Benzema (#9)  @4.5x   │  🔴 Lewandowski (#9)  @3.8x            │
│ 🔵 Vinicius (#7) @5.2x   │  🔴 Raphinha (#11)    @6.1x            │
│ 🔵 Modric (#10)  @8.5x   │  🔴 Gavi (#6)         @9.2x            │
│ ... (8 more)             │  ... (8 more)                          │
├──────────────────────────┴─────────────────────────────────────────┤
│ Current Bet: Benzema ($100 @ 4.5x) | Change Bet | Cash Out        │
└────────────────────────────────────────────────────────────────────┘
```

**Key UI Characteristics:**

1. **No Player Tracking:** Players are listed statically (no movement tracking on pitch)
2. **Side List:** 11 players left column (home), 11 players right column (away)
3. **Auto-Switch:** At half-time, sides can optionally swap to match camera angle
4. **Clickable Buttons:** Each player is a button with current odds
5. **Force Unmute Required:** User must unmute video for ACR audio sync to detect match
6. **Provisional Balance:** Shows "Pending" or "Locked" status during match
7. **World ID Badge:** Verification status indicator (✅ Verified Human)

**Why Static List for MVP?**

- ✅ **Simpler implementation** (no computer vision, no DRM battles)
- ✅ **Works on all platforms** (YouTube, Twitch, any stream)
- ✅ **Reliable** (no dependency on camera angles, zoom levels)
- ✅ **Fast to build** (focus on betting logic, not CV algorithms)
- ❌ Less immersive than overlay (acceptable trade-off for MVP)

**Game Sync via Force Unmute:**

```typescript
// content-script.ts - Detect and force unmute
const forceSyncGameAudio = () => {
  const videoElement = document.querySelector("video");

  if (videoElement?.muted) {
    videoElement.muted = false;
    videoElement.volume = 0.3; // Set to reasonable volume

    // Show notification to user
    showNotification({
      message: "Video unmuted for game sync (ACR audio fingerprint)",
      type: "info",
      duration: 5000,
    });
  }

  // Start ACR listening
  startACRAudioFingerprint(videoElement);
};
```

### Service Abstraction Layer

**Key Design Principle:** Frontend code should **never know** if it's using mock or real services.

```typescript
// src/services/index.ts (Service Factory)

import { mockDataService } from "./mock/mockDataService";
import { mockBettingService } from "./mock/mockBettingService";
import { mockWalletService } from "./mock/mockWalletService";

import { dataService } from "./real/dataService";
import { bettingService } from "./real/bettingService";
import { walletService } from "./real/walletService";

// Environment flag to switch between mock and real
const USE_MOCK_SERVICES = import.meta.env.VITE_USE_MOCK === "true";

// Export unified services
export const services = {
  data: USE_MOCK_SERVICES ? mockDataService : dataService,
  betting: USE_MOCK_SERVICES ? mockBettingService : bettingService,
  wallet: USE_MOCK_SERVICES ? mockWalletService : walletService,
};
```

**Component Usage:**

```typescript
// Components always use services from index.ts (never import mock/real directly)
import { services } from '../services';

const MyComponent = () => {
  const handleBet = async () => {
    // This works with both mock and real services!
    await services.betting.placeBet({ ... });
  };
};
```

### Interface Contracts

All services implement the same interface:

```typescript
// src/types/services.types.ts

export interface IDataService {
  getMatch(matchId: string): Promise<Match>;
  getPlayers(matchId: string): Promise<Player[]>;
  subscribeToMatch(matchId: string, callbacks: MatchCallbacks): () => void;
}

export interface IBettingService {
  placeBet(params: PlaceBetParams): Promise<PlaceBetResult>;
  changeBet(params: ChangeBetParams): Promise<ChangeBetResult>;
  getBets(wallet: string): Promise<Bet[]>;
  settleBets(matchId: string): Promise<void>;
}

export interface IWalletService {
  connect(network: "base" | "solana"): Promise<WalletState>;
  disconnect(): void;
  getBalance(): Promise<number>;
  signTransaction(tx: any): Promise<string>;
}
```

---

## Backend Architecture

### Supabase Database Schema

**Tables:**

```sql
-- matches table
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_match_id VARCHAR(100) UNIQUE NOT NULL, -- From Chainlink CRE
  home_team VARCHAR(100) NOT NULL,
  away_team VARCHAR(100) NOT NULL,
  competition VARCHAR(100),
  status VARCHAR(20), -- 'pre-match', 'live', 'finished'
  kickoff_time TIMESTAMP,
  current_minute INTEGER,
  home_score INTEGER DEFAULT 0,
  away_score INTEGER DEFAULT 0,
  cre_last_updated TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id),
  external_player_id VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  team VARCHAR(10), -- 'home' or 'away'
  shirt_number INTEGER,
  position VARCHAR(10),
  current_odds DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- bets table
CREATE TABLE bets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bettor_wallet VARCHAR(100) NOT NULL,
  match_id UUID REFERENCES matches(id),
  bet_type VARCHAR(20) NOT NULL, -- 'NEXT_GOAL_SCORER', 'MATCH_WINNER'

  -- Bet change tracking
  original_player_id UUID REFERENCES players(id),
  current_player_id UUID REFERENCES players(id),
  original_amount DECIMAL(18,6) NOT NULL,
  current_amount DECIMAL(18,6) NOT NULL,
  total_penalties DECIMAL(18,6) DEFAULT 0,
  change_count INTEGER DEFAULT 0,

  odds DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'active', 'provisional_win', 'provisional_loss', 'settled_won', 'settled_lost'

  -- Blockchain tracking
  tx_hash VARCHAR(100), -- Initial bet placement tx
  block_number BIGINT,
  contract_bet_id VARCHAR(100), -- On-chain bet ID

  placed_at TIMESTAMP DEFAULT NOW(),
  settled_at TIMESTAMP
);

-- bet_changes table (audit trail)
CREATE TABLE bet_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bet_id UUID REFERENCES bets(id),
  from_player_id UUID REFERENCES players(id),
  to_player_id UUID REFERENCES players(id),
  penalty_amount DECIMAL(18,6) NOT NULL,
  penalty_type VARCHAR(20), -- 'percentage', 'flat', 'progressive', 'time-based'
  match_minute INTEGER,
  tx_hash VARCHAR(100), -- On-chain update tx
  changed_at TIMESTAMP DEFAULT NOW()
);

-- provisional_credits table (in-game balance)
CREATE TABLE provisional_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bet_id UUID REFERENCES bets(id),
  wallet VARCHAR(100) NOT NULL,
  amount DECIMAL(18,6) NOT NULL,
  goal_event_id UUID REFERENCES goal_events(id),
  credited_at TIMESTAMP DEFAULT NOW(),
  reversed BOOLEAN DEFAULT FALSE,
  reversed_at TIMESTAMP
);

-- goal_events table (track goals and corrections)
CREATE TABLE goal_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id),
  player_id UUID REFERENCES players(id),
  match_minute INTEGER,
  event_type VARCHAR(20), -- 'GOAL', 'VAR_CORRECTION'
  corrected_to_player_id UUID REFERENCES players(id), -- If VAR changes scorer
  cre_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_bets_wallet ON bets(bettor_wallet);
CREATE INDEX idx_bets_match ON bets(match_id);
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_players_match ON players(match_id);
CREATE INDEX idx_goal_events_match ON goal_events(match_id);
```

### API Endpoints (Supabase Edge Functions)

```
POST   /api/bets                    # Place new bet
PATCH  /api/bets/:id/change         # Change existing bet
GET    /api/bets/wallet/:address    # Get user's bets
POST   /api/bets/settle/:matchId    # Trigger settlement (admin/oracle)

GET    /api/matches/:id             # Get match details
GET    /api/matches/:id/players     # Get match players with odds

POST   /api/webhooks/cre            # Chainlink CRE callback endpoint
```

---

## Chainlink CRE Integration

### Overview

**Chainlink CRE (Cross-Chain Data Feeds with Real-time Events)** provides tamper-proof sports data from Opta Sports API to smart contracts and applications.

### Data Flow

```
Opta Sports API → Chainlink CRE Node → Smart Contract / App Backend
                                              ↓
                                    Supabase Database
                                              ↓
                                    Frontend (WebSocket)
```

### CRE Integration Points

#### 1. Match Detection

**Trigger:** User opens YouTube/Twitch stream  
**Process:**

- Extension extracts video metadata (title, tags)
- Sends to backend: `POST /api/matches/detect`
- Backend queries CRE: "Which match is this?"
- CRE returns match ID + teams

**CRE Endpoint:**

```
GET /matches/detect
Query: { videoTitle: "Real Madrid vs Barcelona LIVE" }
Response: { matchId: "opta-12345", homeTeam: "Real Madrid", awayTeam: "Barcelona" }
```

#### 2. Player Lineup Fetch

**Trigger:** Match confirmed, 15 min before kickoff  
**Process:**

- Backend calls CRE: `GET /matches/{matchId}/lineup`
- CRE fetches from Opta API
- Returns 22 players with metadata
- Stored in Supabase `players` table
- Sent to frontend via WebSocket

**CRE Response:**

```json
{
  "matchId": "opta-12345",
  "homeTeam": {
    "players": [
      { "id": "p1", "name": "Benzema", "number": 9, "position": "ST" }
      // ... 10 more
    ]
  },
  "awayTeam": {
    "players": [
      { "id": "p12", "name": "Lewandowski", "number": 9, "position": "ST" }
      // ... 10 more
    ]
  }
}
```

#### 3. Real-Time Goal Events

**Trigger:** Goal scored in real match  
**Process:**

- Opta API detects goal → Chainlink CRE node notified
- CRE pushes event to webhook: `POST /api/webhooks/cre`
- Backend:
  1. Inserts goal event in `goal_events` table
  2. Updates all bets (provisional win/loss)
  3. Calculates provisional credits
  4. Broadcasts via WebSocket to all connected clients
- Frontend updates balance display

**CRE Webhook Payload:**

```json
{
  "eventType": "GOAL",
  "matchId": "opta-12345",
  "playerId": "p1",
  "playerName": "Benzema",
  "minute": 34,
  "timestamp": "2026-02-20T15:34:22Z",
  "confirmed": true
}
```

#### 4. VAR Corrections

**Trigger:** Referee changes goal scorer via VAR  
**Process:**

- CRE sends correction event
- Backend:
  1. Reverses previous provisional credits
  2. Creates new goal event with corrected player
  3. Recalculates all bet statuses
  4. Notifies users via WebSocket

**CRE Correction Payload:**

```json
{
  "eventType": "VAR_CORRECTION",
  "matchId": "opta-12345",
  "originalPlayerId": "p1",
  "correctedPlayerId": "p4",
  "minute": 34,
  "timestamp": "2026-02-20T15:38:10Z"
}
```

#### 5. Match State Updates

**Trigger:** Every 30 seconds during live match  
**Process:**

- CRE polls Opta API for match state
- Pushes updates: score, minute, substitutions
- Backend updates `matches` table
- WebSocket broadcasts to clients

#### 6. Final Settlement

**Trigger:** Match ends (90+ minutes)  
**Process:**

- CRE sends official result with confirmed goal scorers
- Backend:
  1. Calls smart contract `settleBets(matchId, results)`
  2. Smart contract calculates final payouts
  3. Transfers funds to winners
  4. Updates all bet statuses to `settled_won` / `settled_lost`

**CRE Final Result:**

```json
{
  "eventType": "MATCH_ENDED",
  "matchId": "opta-12345",
  "finalScore": { "home": 2, "away": 1 },
  "goalScorers": [
    { "playerId": "p1", "minute": 34 },
    { "playerId": "p3", "minute": 67 },
    { "playerId": "p12", "minute": 89 }
  ],
  "official": true,
  "timestamp": "2026-02-20T17:50:00Z"
}
```

### CRE Configuration

**Environment Variables:**

```env
CHAINLINK_CRE_NODE_URL=https://cre.chainlink.com/api
CHAINLINK_CRE_API_KEY=your-api-key
CHAINLINK_CRE_WEBHOOK_SECRET=webhook-signing-secret
OPTA_SPORTS_API_KEY=your-opta-key
```

**CRE Subscription Setup:**

```typescript
// Backend: Subscribe to match events
const subscription = await chainlinkCRE.subscribe({
  matchId: "opta-12345",
  events: ["GOAL", "VAR_CORRECTION", "MATCH_STATE", "MATCH_ENDED"],
  webhookUrl: "https://your-backend.com/api/webhooks/cre",
  webhookSecret: process.env.CHAINLINK_CRE_WEBHOOK_SECRET,
});
```

---

## Smart Contract Architecture

### Contract: GoalLiveBetting.sol

**Functions:**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GoalLiveBetting {
    struct Bet {
        address bettor;
        bytes32 matchId;
        bytes32 playerId;
        uint256 amount;
        uint256 odds; // Fixed point (e.g., 450 = 4.5x)
        BetStatus status;
        uint256 totalPenalties;
        uint8 changeCount;
    }

    enum BetStatus { Active, ProvisionalWin, ProvisionalLoss, SettledWon, SettledLost }

    mapping(bytes32 => Bet) public bets; // betId => Bet
    mapping(bytes32 => uint256) public matchTotalBets; // matchId => total bet amount

    // Events
    event BetPlaced(bytes32 indexed betId, address indexed bettor, bytes32 matchId, bytes32 playerId, uint256 amount);
    event BetChanged(bytes32 indexed betId, bytes32 fromPlayerId, bytes32 toPlayerId, uint256 penalty);
    event BetsSettled(bytes32 indexed matchId, uint256 totalPaidOut);

    /**
     * Place a new bet
     */
    function placeBet(
        bytes32 matchId,
        bytes32 playerId,
        uint256 odds
    ) external payable returns (bytes32 betId) {
        require(msg.value > 0, "Bet amount must be > 0");

        betId = keccak256(abi.encodePacked(msg.sender, matchId, block.timestamp));

        bets[betId] = Bet({
            bettor: msg.sender,
            matchId: matchId,
            playerId: playerId,
            amount: msg.value,
            odds: odds,
            status: BetStatus.Active,
            totalPenalties: 0,
            changeCount: 0
        });

        matchTotalBets[matchId] += msg.value;

        emit BetPlaced(betId, msg.sender, matchId, playerId, msg.value);
    }

    /**
     * Change existing bet (with penalty)
     */
    function changeBet(
        bytes32 betId,
        bytes32 newPlayerId,
        uint256 penaltyAmount
    ) external {
        Bet storage bet = bets[betId];
        require(bet.bettor == msg.sender, "Not bet owner");
        require(bet.status == BetStatus.Active, "Bet not active");
        require(penaltyAmount <= bet.amount, "Penalty exceeds bet amount");

        bytes32 oldPlayerId = bet.playerId;

        bet.playerId = newPlayerId;
        bet.amount -= penaltyAmount;
        bet.totalPenalties += penaltyAmount;
        bet.changeCount++;

        emit BetChanged(betId, oldPlayerId, newPlayerId, penaltyAmount);
    }

    /**
     * Settle all bets for a match (called by oracle/admin)
     */
    function settleBets(
        bytes32 matchId,
        bytes32[] calldata winningPlayerIds,
        bytes32[] calldata betIds
    ) external onlyOracle {
        uint256 totalPayout = 0;

        for (uint256 i = 0; i < betIds.length; i++) {
            Bet storage bet = bets[betIds[i]];

            if (bet.matchId != matchId) continue;

            bool won = false;
            for (uint256 j = 0; j < winningPlayerIds.length; j++) {
                if (bet.playerId == winningPlayerIds[j]) {
                    won = true;
                    break;
                }
            }

            if (won) {
                uint256 payout = (bet.amount * bet.odds) / 100;
                payable(bet.bettor).transfer(payout);
                bet.status = BetStatus.SettledWon;
                totalPayout += payout;
            } else {
                bet.status = BetStatus.SettledLost;
            }
        }

        emit BetsSettled(matchId, totalPayout);
    }

    // Oracle access control
    address public oracle;
    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle");
        _;
    }
}
```

---

## World ID Authentication

### Overview

**World ID** provides privacy-preserving proof of humanness using zero-knowledge proofs. This prevents Sybil attacks, bot farming, and multi-accounting without requiring KYC.

### Integration Points (MVP)

**Authentication is required at 3 critical moments:**

1. **Session Start:** User initiates betting session for a match
2. **Game Finish:** Match ends, trigger final settlement
3. **Withdrawal:** User withdraws winnings to external wallet

**Why these specific points?**

- ✅ **Not too frequent** (UX-friendly, won't slow down mid-game bet changes)
- ✅ **Maximum protection** (prevents bot swarms from exploiting system)
- ✅ **Withdrawal gating** (ensures only verified humans can extract funds)

### Implementation

**Frontend Integration (React):**

```typescript
import { IDKitWidget, VerificationLevel } from '@worldcoin/idkit';

const WorldIDVerification = ({ action, onSuccess }) => {
  return (
    <IDKitWidget
      app_id={import.meta.env.VITE_WORLD_APP_ID} // From World Developer Portal
      action={action} // "start_session", "finish_match", "withdraw"
      verification_level={VerificationLevel.Device} // or Orb for higher security
      onSuccess={onSuccess}
    >
      {({ open }) => (
        <button onClick={open}>Verify with World ID</button>
      )}
    </IDKitWidget>
  );
};
```

**Backend Verification:**

```typescript
// Verify proof after frontend submission
const verifyWorldIDProof = async (proof: WorldIDProof) => {
  const response = await fetch(
    `https://developer.worldcoin.org/api/v1/verify/${import.meta.env.WORLD_APP_ID}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merkle_root: proof.merkle_root,
        nullifier_hash: proof.nullifier_hash,
        proof: proof.proof,
        action: proof.action,
        signal: proof.signal, // e.g., wallet address
      }),
    },
  );

  const data = await response.json();
  if (!data.success) throw new Error("World ID verification failed");

  // Store nullifier_hash to prevent replay attacks
  await supabase.from("world_id_verifications").insert({
    nullifier_hash: proof.nullifier_hash,
    wallet_address: proof.signal,
    action: proof.action,
    verified_at: new Date().toISOString(),
  });
};
```

### MVP Considerations

**Sepolia Testnet Support:**

- World ID is **natively supported** on Ethereum mainnet and Optimism
- **Sepolia testnet:** Check World documentation for test mode availability
- **Fallback:** If unavailable, **mock World ID verification** for MVP demo
  - Still implement full UI flow
  - Backend validates mock proofs
  - Production-ready code, just swap mock for real

### Chainlink Hackathon Prize Opportunity

**Best use of World ID with CRE** prize track ($3k/$1.5k/$500):

- ✅ **CRE brings sports data on-chain** (match results, goal events)
- ✅ **World ID gates access** (only verified humans can bet/withdraw)
- ✅ **Combined anti-bot + decentralized betting** = perfect use case
- ✅ **Off-chain World ID verification** can be bridged via CRE to Sepolia

---

## AI Observational Dashboard

### Purpose

**Goal:** Collect training data by observing betting market behavior to build AI predictor for future automated market-making.

### MVP Approach: Passive Learning (Observational Dashboard)

**No intervention** during MVP - purely data collection and analysis.

**What the AI observes:**

1. **Live Game Feed:**
   - Goal events (player ID, minute, timestamp)
   - Cards (red/yellow)
   - Substitutions
   - Other key events (penalties, VAR reviews)

2. **Bookies' Market Behavior:**
   - Odds updates (per player, per minute)
   - **Market locks** (when bookies suspend betting)
   - Lock duration (how long before reopening)
   - Lock triggers (goals, dangerous plays, cards)

3. **Correlation Analysis:**
   - **Time delta** between event and bookies' lock
   - **Predictive locks** (bookies lock before official goal announcement)
   - **Odds movements** (which players' odds change after which events)

### Data Collection Schema

**New Tables:**

```sql
-- AI training data
CREATE TABLE ai_event_observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id),

  -- Event data
  event_type VARCHAR(50), -- 'GOAL', 'CARD', 'SUB', 'DANGEROUS_PLAY'
  player_id UUID REFERENCES players(id),
  minute INTEGER,
  event_timestamp TIMESTAMP,

  -- Bookies' response
  bookies_locked BOOLEAN,
  lock_timestamp TIMESTAMP,
  lock_duration_seconds INTEGER,
  odds_before JSONB, -- { "p1": 4.5, "p2": 3.2, ... }
  odds_after JSONB,

  -- Calculated insights
  time_to_lock_ms INTEGER, -- event_timestamp - lock_timestamp
  locked_before_event BOOLEAN, -- Did bookies predict the event?

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_observations_match ON ai_event_observations(match_id);
CREATE INDEX idx_ai_observations_event ON ai_event_observations(event_type, event_timestamp);
```

### Dashboard UI (Admin Only)

**Real-time Monitoring During Match:**

```typescript
// Example admin dashboard component
const AIObservationDashboard = ({ matchId }) => {
  const observations = useRealtimeObservations(matchId);

  return (
    <div className="ai-dashboard">
      <h2>AI Learning Dashboard - Match {matchId}</h2>

      {/* Live event stream */}
      <div className="event-stream">
        <h3>Live Events vs Bookies Response</h3>
        {observations.map(obs => (
          <div key={obs.id} className="observation">
            <span>{obs.minute}' - {obs.event_type}</span>
            <span>{obs.player_name}</span>
            <span className={obs.locked_before_event ? 'predictive' : 'reactive'}>
              {obs.locked_before_event ? '🔮 Predictive Lock' : '⏱️ Reactive Lock'}
            </span>
            <span>{obs.time_to_lock_ms}ms delay</span>
          </div>
        ))}
      </div>

      {/* Insights */}
      <div className="insights">
        <h3>Match Insights</h3>
        <p>Average lock time: {calculateAvgLockTime(observations)}ms</p>
        <p>Predictive locks: {countPredictiveLocks(observations)}</p>
        <p>Most volatile player odds: {findMostVolatilePlayer(observations)}</p>
      </div>
    </div>
  );
};
```

### Data Ingestion Flow

```
Live Match → ACR/DOM Scraping → Event Detection
                                       ↓
                            AI Observation Service
                                       ↓
                    ┌──────────────────┴──────────────────┐
                    ↓                                      ↓
            Store in ai_event_observations       Compare with Bookies API
                                                          ↓
                                                 Log odds changes + locks
```

**Bookies API Integration (Mock for MVP):**

```typescript
// Poll bookies API every 2 seconds
const pollBookiesOdds = async (matchId: string) => {
  const response = await fetch(
    `https://bookies-api.com/matches/${matchId}/odds`,
  );
  const data = await response.json();

  // Check if market is locked
  if (data.market_locked) {
    await recordMarketLock(matchId, data.lock_timestamp);
  }

  // Log odds changes
  await recordOddsUpdate(matchId, data.player_odds);
};

// For MVP: mock this with plausible behavior
const mockBookiesAPI = {
  locked: false,
  lockAfterGoal: () => {
    setTimeout(() => {
      mockBookiesAPI.locked = true;
    }, 500); // 500ms delay
    setTimeout(() => {
      mockBookiesAPI.locked = false;
    }, 5000); // reopen after 5s
  },
};
```

### Post-Match Analysis

**After each match, generate insights report:**

```typescript
const generateAIInsights = async (matchId: string) => {
  const observations = await db.query(
    `
    SELECT * FROM ai_event_observations WHERE match_id = $1
  `,
    [matchId],
  );

  const insights = {
    totalEvents: observations.length,
    avgLockTime: avg(observations.map((o) => o.time_to_lock_ms)),
    predictiveLockCount: observations.filter((o) => o.locked_before_event)
      .length,
    oddsVolatility: calculateOddsVolatility(observations),
    mostSuspendedPlayers: rankPlayersByLockFrequency(observations),
  };

  // Store insights for ML training
  await db.insert("ai_match_insights", insights);
};
```

### Future ML Integration (Post-MVP)

Once sufficient data collected:

- Train classifier: **Predict when bookies will lock market**
- Regression model: **Predict odds movements**
- Anomaly detection: **Identify suspicious betting patterns**
- Auto-suspend: **Lock goal.live markets proactively** (reduces risk)

**For MVP:** Just collect data, show dashboard, no automated decisions.

---

## Historical Game Demo Approach

### Purpose

Demo the complete system flow without dependency on live match + real Chainlink CRE data (which may not be available for all leagues/testnet).

### Strategy

**Use already-finished match with known outcomes:**

1. **Select past match** (e.g., "Real Madrid vs Barcelona, Feb 10, 2026")
2. **Gather all official data:**
   - Final score
   - All goal scorers + timestamps
   - Lineups (starting 11 + subs)
   - Cards, substitutions
   - Opta/official stats

3. **Pre-populate database** with this data
4. **Mock Chainlink CRE** to deliver it in "real-time" sequence
5. **Simulate "live" playback** for demo purposes

### Implementation

**Step 1: Data Preparation**

```typescript
// scripts/prepare-demo-match.ts
const demoMatchData = {
  matchId: "demo-real-barca-2026-02-10",
  homeTeam: "Real Madrid",
  awayTeam: "Barcelona",
  kickoff: "2026-02-10T20:00:00Z",
  fullTime: "2026-02-10T21:50:00Z",

  lineup: {
    home: [
      { id: "p1", name: "Benzema", number: 9, position: "ST" },
      // ... 10 more
    ],
    away: [
      { id: "p12", name: "Lewandowski", number: 9, position: "ST" },
      // ... 10 more
    ],
  },

  events: [
    {
      type: "GOAL",
      playerId: "p1",
      minute: 23,
      timestamp: "2026-02-10T20:23:15Z",
    },
    {
      type: "GOAL",
      playerId: "p12",
      minute: 45,
      timestamp: "2026-02-10T20:45:32Z",
    },
    {
      type: "GOAL",
      playerId: "p3",
      minute: 78,
      timestamp: "2026-02-10T21:18:05Z",
    },
  ],

  finalResult: { home: 2, away: 1 },
};

// Store in database with is_demo flag
await db.insert("matches", { ...demoMatchData, is_demo: true });
```

**Step 2: Mock CRE Oracle**

```typescript
// services/mockCREOracle.ts
export const mockCREOracle = {
  // Simulate "live" event delivery by replaying at accelerated speed
  async simulateLiveMatch(matchId: string, speedMultiplier = 10) {
    const match = await db.getMatch(matchId);
    const events = match.events.sort((a, b) => a.minute - b.minute);

    console.log(`🎬 Starting demo playback (${speedMultiplier}x speed)...`);

    for (const event of events) {
      // Calculate delay (e.g., if event at minute 23, wait 2.3 seconds in 10x speed)
      const delayMs = (event.minute * 60 * 1000) / speedMultiplier;
      await sleep(delayMs);

      // Trigger event as if from real CRE webhook
      await handleCREEvent({
        eventType: event.type,
        matchId,
        playerId: event.playerId,
        minute: event.minute,
        timestamp: new Date().toISOString(), // Current time for demo
        confirmed: true,
      });

      console.log(`⚽ ${event.minute}' - ${event.type} by ${event.playerId}`);
    }

    // After all events, send match end
    await sleep(5000); // 5 second pause
    await handleMatchEnd(matchId, match.finalResult);
    console.log(
      `🏁 Demo match ended. Final: ${match.homeTeam} ${match.finalResult.home} - ${match.finalResult.away} ${match.awayTeam}`,
    );
  },
};
```

**Step 3: Demo UI Indicator**

```typescript
// Show clear "DEMO MODE" indicator in UI
const MatchInfo = ({ match }) => {
  return (
    <div className="match-info">
      {match.is_demo && (
        <div className="demo-badge">
          🎬 DEMO MODE - Historical Match Replay
        </div>
      )}
      <h2>{match.homeTeam} vs {match.awayTeam}</h2>
      <p>{match.status}</p>
    </div>
  );
};
```

**Step 4: Chainlink CRE Integration (Mocked)**

Even though using mock data, **structure code as if integrating real CRE:**

```typescript
// services/chainlinkCRE.ts
export const chainlinkCRE = {
  async subscribeToMatch(matchId: string, callbacks: CRECallbacks) {
    const match = await db.getMatch(matchId);

    // If demo match, use mock oracle
    if (match.is_demo) {
      return mockCREOracle.simulateLiveMatch(matchId);
    }

    // Otherwise, real CRE integration
    const subscription = await realCRE.subscribe({
      matchId,
      events: ["GOAL", "CARD", "SUB", "MATCH_END"],
      webhookUrl: `${process.env.BACKEND_URL}/api/webhooks/cre`,
    });

    return () => subscription.unsubscribe();
  },
};
```

### Demo Flow for Presentation

1. **User opens extension** on demo YouTube video (can be static thumbnail)
2. **System detects "demo match"** (from video metadata or manual selection)
3. **Lineup appears** (22 players, static side list)
4. **User places bet** on player (e.g., Benzema for $100)
5. **Start playback:** Click "Start Demo" button
6. **Events play out:**
   - Minute 23: Benzema scores → User's **provisional balance** shows
   - User changes bet to Lewandowski (hybrid penalty: 1st change, early in match = ~3%)
   - Minute 45: Lewandowski scores → Provisional balance updates
   - Minute 78: Other player scores → No impact on user
7. **Match ends** → Chainlink CRE "confirms" official result
8. **Final settlement** → Smart contract calculates exact payout with all penalties applied
9. **Withdrawal enabled** → User can withdraw winnings (World ID required)

**This demonstrates:**
✅ Full Chainlink CRE integration (oracle pattern)  
✅ Real-time betting flow  
✅ Penalty system working  
✅ Settlement logic  
✅ World ID verification gates (start/end/withdraw)  
✅ All without needing actual live match

---

## Data Flow

### 1. Bet Placement Flow

```
User clicks player button
         ↓
Frontend: BetModal opens
         ↓
User confirms amount
         ↓
Frontend: services.betting.placeBet()
         ↓
┌────────────────────────┐
│ IF MOCK (Phase 1):     │
│ • Store in localStorage│
│ • Update UI            │
└────────────────────────┘
         ↓
┌────────────────────────────────┐
│ IF REAL (Phase 2+):            │
│ 1. Wallet signs transaction    │
│ 2. Contract.placeBet() called  │
│ 3. Wait for confirmation        │
│ 4. Save to Supabase             │
│ 5. WebSocket broadcast          │
└────────────────────────────────┘
         ↓
Frontend: Update balance display
```

### 2. Bet Change Flow

```
User clicks "Change Bet"
         ↓
Frontend: BetChangeModal opens
         ↓
User selects new player
         ↓
Frontend: Calculate penalty (hybrid formula)
         penalty = base[change_count] × time_decay_multiplier
         Examples:
         • 1st change at 20': base[1]=3% × decay(20'/90')=0.95 = 2.85%
         • 2nd change at 45': base[2]=5% × decay(45'/90')=0.75 = 3.75%
         • 3rd change at 80': base[3]=8% × decay(80'/90')=0.30 = 2.4%
         ↓
User confirms change
         ↓
Frontend: services.betting.changeBet()
         ↓
┌────────────────────────┐
│ IF MOCK:               │
│ • Update localStorage  │
│ • Deduct penalty       │
└────────────────────────┘
         ↓
┌──────────────────────────────────┐
│ IF REAL:                         │
│ 1. Wallet signs update tx        │
│ 2. Contract.changeBet() called   │
│ 3. Supabase: Insert bet_changes  │
│ 4. Supabase: Update bets table   │
│ 5. WebSocket broadcast           │
└──────────────────────────────────┘
         ↓
Frontend: Update bet card + balance
```

### 3. Goal Event Flow

```
Goal scored in real match
         ↓
Opta API detects goal
         ↓
Chainlink CRE receives event
         ↓
CRE webhook: POST /api/webhooks/cre
         ↓
Backend:
  1. Insert goal_events table
  2. Query all active bets for match
  3. Update bet statuses (provisional win/loss)
  4. Calculate provisional_credits
  5. WebSocket broadcast to all clients
         ↓
Frontend (all connected users):
  1. Receive WebSocket message
  2. Update UI (show goal animation)
  3. Update balances
  4. Show "Provisional Win" badge
```

### 4. Settlement Flow

```
Match ends (90+ min)
         ↓
Chainlink CRE confirms final result
         ↓
CRE webhook: POST /api/webhooks/cre (MATCH_ENDED)
         ↓
Backend:
  1. Fetch all bets for match
  2. Call Contract.settleBets(matchId, winningPlayerIds, betIds)
  3. Smart contract calculates payouts
  4. Transfers USDC to winners
  5. Update Supabase: all bets to settled_won/lost
  6. WebSocket broadcast final results
         ↓
Frontend:
  1. Show settlement notification
  2. Update balances (provisional → wallet)
  3. Enable withdrawals
  4. Show bet history with outcomes
```

---

## Integration Points

### Critical Integration Points for Backend Switch

When switching from mock to real services, **only these files change:**

1. **Environment Variable:**

   ```env
   # .env.development (Phase 1)
   VITE_USE_MOCK=true

   # .env.production (Phase 2+)
   VITE_USE_MOCK=false
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_CHAINLINK_CRE_URL=https://cre.chainlink.com/api
   VITE_CONTRACT_ADDRESS=0x...
   VITE_WALLET_CONNECT_PROJECT_ID=your-project-id
   ```

2. **Service Implementations:**
   - `src/services/real/dataService.ts` (Chainlink CRE calls)
   - `src/services/real/bettingService.ts` (Supabase + contract)
   - `src/services/real/contractService.ts` (Smart contract ABI)
   - `src/services/real/walletService.ts` (RainbowKit)

3. **NO CHANGES NEEDED:**
   - ✅ All React components (use `services` abstraction)
   - ✅ All hooks (use `services` abstraction)
   - ✅ All UI components
   - ✅ All type definitions
   - ✅ All utilities

### Interface Compliance Checklist

**Both mock and real services MUST implement:**

```typescript
// Every method signature must match exactly
✅ dataService.getMatch(matchId: string): Promise<Match>
✅ dataService.getPlayers(matchId: string): Promise<Player[]>
✅ dataService.subscribeToMatch(matchId, callbacks): () => void

✅ bettingService.placeBet(params): Promise<PlaceBetResult>
✅ bettingService.changeBet(params): Promise<ChangeBetResult>
✅ bettingService.getBets(wallet): Promise<Bet[]>
✅ bettingService.settleBets(matchId): Promise<void>

✅ walletService.connect(network): Promise<WalletState>
✅ walletService.disconnect(): void
✅ walletService.getBalance(): Promise<number>
```

**If interfaces match → Zero component changes needed!**

---

## Scalability & Performance

### Frontend Optimizations

- **Code Splitting:** Lazy load components

  ```typescript
  const BetModal = lazy(() => import("./components/BetModal"));
  ```

- **Memoization:** Prevent unnecessary re-renders

  ```typescript
  const PlayerButton = memo(({ player }) => { ... });
  ```

- **Virtual Scrolling:** For bet history lists (React Window)

- **Debouncing:** Limit API calls on user input
  ```typescript
  const debouncedSearch = useMemo(() => debounce(searchPlayers, 300), []);
  ```

### Backend Optimizations

- **Database Indexes:** All foreign keys + frequently queried columns
- **Supabase Realtime:** Push updates instead of polling
- **Edge Functions:** Deploy close to users (Cloudflare Workers)
- **Caching:** Redis for match data (30s TTL)
- **Connection Pooling:** PgBouncer for Postgres

### Blockchain Optimizations

- **Batch Transactions:** Settle multiple bets in single tx
- **Layer 2:** Use Base L2 for lower fees
- **Gas Estimation:** Pre-calculate gas before user signs
- **Optimistic UI:** Show updates before blockchain confirmation

### CRE Optimizations

- **Webhook Delivery:** Push-based (no polling overhead)
- **Rate Limiting:** Prevent spam from CRE
- **Retry Logic:** Exponential backoff for failed webhooks
- **Signature Verification:** Validate CRE webhook authenticity

---

## Security Considerations

### Frontend

- ✅ Content Security Policy (CSP)
- ✅ No sensitive data in localStorage
- ✅ Validate all user inputs
- ✅ HTTPS only

### Backend

- ✅ Webhook signature verification (CRE)
- ✅ Rate limiting (prevent DDoS)
- ✅ SQL injection prevention (Supabase RLS)
- ✅ CORS configuration

### Smart Contracts

- ✅ Reentrancy guards
- ✅ Access control (onlyOracle modifier)
- ✅ Integer overflow checks (Solidity 0.8+)
- ✅ Audit before mainnet deployment

### Wallet

- ✅ Never request private keys
- ✅ Clear transaction previews
- ✅ Warn on suspicious transactions

---

## Next Steps

1. **Phase 1:** Build frontend with mock services
2. **Phase 2:** Implement real services (Chainlink CRE, Supabase, contracts)
3. **Phase 3:** Testing & deployment

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed roadmap.

---

**Last Updated:** February 20, 2026  
**Version:** 1.0  
**Maintained By:** goal.live Team
