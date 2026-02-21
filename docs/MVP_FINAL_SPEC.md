# goal.live - MVP Final Specification

**Version:** 1.0 (Finalized)  
**Last Updated:** February 20, 2026  
**Status:** Ready for Implementation

---

## Executive Summary

**goal.live** is a decentralized live sports betting platform (Chrome extension) demonstrating:

- ✅ Ethereum Sepolia testnet integration
- ✅ Chainlink CRE oracle for sports data
- ✅ World ID for Sybil-resistant authentication
- ✅ AI observational dashboard for learning bookies' market behavior

**MVP Scope:** Single bet type (Next Goal Scorer), single blockchain (Sepolia), static UI (no tracking overlay), demo on historical game.

---

## 1. MVP Constraints & Decisions

### 1.1 Blockchain

| Decision       | Value                    | Reasoning                                 |
| -------------- | ------------------------ | ----------------------------------------- |
| **Blockchain** | Ethereum Sepolia Testnet | Simplify MVP, testnet USDC available      |
| **Currency**   | USDC (testnet)           | Single stablecoin, no memecoin complexity |
| **Network**    | ~~Solana~~ ❌ Base L2 ❌ | Removed for MVP simplicity                |
| **Liquidity**  | Platform as market maker | User has sufficient testnet funds         |

### 1.2 Bet Types

| Decision        | Value                                           | Reasoning                                       |
| --------------- | ----------------------------------------------- | ----------------------------------------------- |
| **Bet Type**    | Next Goal Scorer ONLY                           | Single market for MVP                           |
| **Other Types** | ~~Match Winner~~ ❌ ~~Cards~~ ❌ ~~Corners~~ ❌ | Deferred to post-MVP                            |
| **Max Changes** | Unlimited                                       | User can change bet anytime until final whistle |
| **Penalty**     | Hybrid (time-decay + progressive)               | See formula below                               |

**Penalty Formula:**

```
penalty = base[change_count] × time_decay_multiplier

base = { 1st: 3%, 2nd: 5%, 3rd: 8%, 4th: 12%, 5th+: 15% }
time_decay = 1 - (current_minute / 90)

Example:
  1st change at 20': 3% × (1 - 20/90) = 3% × 0.78 = 2.34%
  2nd change at 45': 5% × (1 - 45/90) = 5% × 0.50 = 2.50%
  3rd change at 80': 8% × (1 - 80/90) = 8% × 0.11 = 0.88%
```

**Key Rules:**

- ✅ Can change during half-time and extra time
- ✅ Can change until final whistle
- ❌ No undo discount (every change penalized equally)
- ⚠️ Track zero balance → force user to top up or disable betting

### 1.3 UI/UX Design

| Decision            | Value                     | Reasoning                                |
| ------------------- | ------------------------- | ---------------------------------------- |
| **Display Type**    | Static side list          | No player tracking overlay (simpler MVP) |
| **Layout**          | 11 players left, 11 right | Matches team sides                       |
| **Half-time Swap**  | Optional auto-switch      | Match camera angle flip                  |
| **Force Unmute**    | Required                  | ACR audio sync for game detection        |
| **Balance Display** | "Pending" during match    | Final settlement post-match              |

**UI Layout:**

```
┌────────────────────────────────────────────────────────────┐
│              YOUTUBE/TWITCH VIDEO PLAYER                   │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│  Real Madrid 1-1 Barcelona    45:32 ⚽ Live                │
│  Balance: $245 (Pending) | Wallet: $1,000 USDC  ✅ Verified│
├──────────────────────┬─────────────────────────────────────┤
│  HOME (Real Madrid)  │  AWAY (Barcelona)                   │
├──────────────────────┼─────────────────────────────────────┤
│ 🔵 Benzema (#9) 4.5x │ 🔴 Lewandowski (#9) 3.8x           │
│ 🔵 Vinicius (#7) 5.2x│ 🔴 Raphinha (#11) 6.1x             │
│ ... (9 more)         │ ... (9 more)                        │
└──────────────────────┴─────────────────────────────────────┘
```

### 1.4 Authentication

| Decision            | Value                              | Reasoning                             |
| ------------------- | ---------------------------------- | ------------------------------------- |
| **Auth Method**     | World ID                           | Privacy-preserving proof of humanness |
| **Auth Points**     | 3 times: Start, Finish, Withdrawal | Balance UX vs security                |
| **Testnet Support** | May need mocking                   | Check World ID Sepolia availability   |
| **Hackathon Prize** | $3k/$1.5k/$500                     | "Best use of World ID with CRE"       |

**World ID Integration Points:**

1. **Session Start:** User initiates betting on a match
   - Prompt: "Verify you're human to start betting"
   - Action: `start_session`

2. **Game Finish:** Match ends, before settlement
   - Prompt: "Verify to finalize your bets"
   - Action: `finish_match`

3. **Withdrawal:** User withdraws winnings
   - Prompt: "Verify to withdraw funds"
   - Action: `withdraw`

**Why NOT on every bet?**

- Too slow (would kill UX during live match)
- Unnecessary (3 checkpoints sufficient for Sybil resistance)

### 1.5 Balance & Settlement

| Decision         | Value                            | Reasoning                               |
| ---------------- | -------------------------------- | --------------------------------------- |
| **During Match** | Show "Pending" balance           | Avoid real-time penalty calculation lag |
| **Post-Match**   | CRE confirms → Final calculation | Accurate settlement with all penalties  |
| **Withdrawal**   | Only after final settlement      | Prevent disputes                        |
| **Zero Balance** | Track and force top-up           | Disable betting if user runs out        |

**Settlement Flow:**

```
During Match:
  User bets $100 on Benzema @ 4.5x
  Benzema scores → Balance shows "Pending: +$450"
  (Not final - just provisional estimate)

After Match:
  1. CRE confirms official result (all goal scorers)
  2. Smart contract calculates:
     - Original bet: $100
     - All bet changes with penalties deducted
     - Final winning odds
     = Real payout: $423.45 (after 3% penalties)
  3. User sees "Confirmed: +$423.45"
  4. Withdrawal enabled (World ID required)
```

---

## 2. Chainlink CRE Integration

### 2.1 CRE Data Points

| Data Type             | Timing          | Source             | MVP Status    |
| --------------------- | --------------- | ------------------ | ------------- |
| **Pre-game odds**     | Before kickoff  | Bookies API / Opta | May be mocked |
| **Player lineups**    | 15 min before   | Opta / Bookies API | May be mocked |
| **Live goal events**  | Real-time       | Opta → CRE webhook | May be mocked |
| **Live odds updates** | Event-triggered | Bookies API        | May be mocked |
| **Official results**  | Post-match      | Opta → CRE         | May be mocked |

### 2.2 Event-Triggered Updates (NOT Real-time Polling)

**Odds update triggers:**

- ⚽ Goal scored
- 🟥 Red card
- 🥅 Penalty awarded
- 🔄 Key substitution

**Why not continuous polling?**

- Saves API costs
- Reduces noise
- MVP-appropriate simplicity

### 2.3 Historical Demo Approach

**Problem:** Real CRE data may not be available for all matches/testnet.

**Solution:** Demo on already-finished match with known outcomes.

**Steps:**

1. **Select past match** (e.g., "Real Madrid vs Barcelona, Feb 10, 2026")
2. **Gather official data** (final score, all goals, lineups, timestamps)
3. **Pre-populate database** with this data (mark as `is_demo: true`)
4. **Mock CRE oracle** to replay events at accelerated speed (e.g., 10x)
5. **Simulate "live" experience** for demo purposes

**Code Structure:**

```typescript
// services/chainlinkCRE.ts
export const chainlinkCRE = {
  async subscribeToMatch(matchId: string) {
    const match = await db.getMatch(matchId);

    if (match.is_demo) {
      // Use mock oracle that replays known events
      return mockCREOracle.simulateLiveMatch(matchId, speedMultiplier: 10);
    }

    // Real CRE integration (for production)
    return realCRE.subscribe({ matchId, webhookUrl: '...' });
  }
};
```

**Benefits:**

- ✅ Demonstrates full Chainlink CRE integration pattern
- ✅ No dependency on live match timing
- ✅ Repeatable, controllable demo
- ✅ Shows oracle verification flow
- ✅ Tests all betting mechanics

---

## 3. AI Observational Dashboard

### 3.1 Purpose

**Goal:** Collect training data by observing how bookies react to live game events, to build future predictive AI for automated market-making.

**MVP Approach:** Passive learning (no intervention)

### 3.2 What AI Observes

**Live Game Feed:**

- Goal events (player, minute, timestamp)
- Cards (red/yellow)
- Substitutions
- Dangerous plays (near-misses)

**Bookies' Market Behavior:**

- Odds updates (per player)
- **Market locks** (when bookies suspend betting)
- Lock duration (how long suspended)
- **Predictive locks** (before official event announcement)

**Correlation Analysis:**

- Time delta between event and lock
- Which events trigger which lock patterns
- Odds volatility by player
- Bookies' prediction accuracy

### 3.3 Data Schema

```sql
CREATE TABLE ai_event_observations (
  id UUID PRIMARY KEY,
  match_id UUID REFERENCES matches(id),

  -- Event data
  event_type VARCHAR(50), -- 'GOAL', 'CARD', 'SUB', 'DANGEROUS_PLAY'
  player_id UUID,
  minute INTEGER,
  event_timestamp TIMESTAMP,

  -- Bookies' response
  bookies_locked BOOLEAN,
  lock_timestamp TIMESTAMP,
  lock_duration_seconds INTEGER,
  odds_before JSONB,  -- { "p1": 4.5, "p2": 3.2, ... }
  odds_after JSONB,

  -- AI insights
  time_to_lock_ms INTEGER,  -- Event timestamp - lock timestamp
  locked_before_event BOOLEAN,  -- Predictive lock?

  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.4 Dashboard UI (Admin Only)

**Real-time Monitoring:**

```
┌───────────────────────────────────────────────────────────┐
│  AI LEARNING DASHBOARD - Match: Real Madrid vs Barcelona  │
├───────────────────────────────────────────────────────────┤
│  LIVE EVENT STREAM                                        │
│  ─────────────────────────────────────────────────────── │
│  23' GOAL   Benzema   🔮 Predictive Lock (-450ms)         │
│  45' SUB    Modric → Camavinga  ⏱️ Reactive Lock (+1.2s) │
│  67' GOAL   Vinicius  🔮 Predictive Lock (-320ms)         │
├───────────────────────────────────────────────────────────┤
│  MATCH INSIGHTS                                           │
│  Average lock time: -285ms (bookies lock BEFORE event)   │
│  Predictive lock accuracy: 87%                            │
│  Most volatile player odds: Benzema (Δ 2.3x avg)          │
└───────────────────────────────────────────────────────────┘
```

### 3.5 Data Ingestion Flow

```
Live Match → ACR/DOM Scraping → Event Detection
                                      ↓
                         AI Observation Service
                                      ↓
                 ┌────────────────────┴────────────────┐
                 ↓                                      ↓
   Store in ai_event_observations         Poll Bookies API (every 2s)
                                                       ↓
                                         Log odds changes + market locks
```

**Bookies API (Mock for MVP):**

```typescript
const mockBookiesAPI = {
  locked: false,
  lockAfterGoal: () => {
    setTimeout(() => { locked = true; }, 500);  // 500ms reaction time
    setTimeout(() => { locked = false; }, 5000); // Reopen after 5s
  },
  adjustOdds: (playerId, delta) => { ... }
};
```

### 3.6 Post-Match Analysis

After each match, generate insights report:

```typescript
const generateAIInsights = async (matchId: string) => {
  const observations = await db.query('SELECT * FROM ai_event_observations WHERE match_id = $1', [matchId]);

  return {
    totalEvents: observations.length,
    avgLockTime: avg(observations.map(o => o.time_to_lock_ms)),
    predictiveLockCount: observations.filter(o => o.locked_before_event).length,
    oddsVolatility: calculateVolatility(observations),
    mostSuspended Players: rankByLockFrequency(observations),
  };
};
```

### 3.7 Future ML (Post-MVP)

Once sufficient data collected:

- **Classifier:** Predict when bookies will lock market
- **Regression:** Predict odds movements
- **Anomaly detection:** Identify suspicious betting patterns
- **Auto-suspend:** Proactively lock goal.live markets to reduce risk

**For MVP:** Just collect data, show dashboard, export CSV for analysis.

---

## 4. Game Sync & Detection

### 4.1 Force Unmute Requirement

**Problem:** ACR audio fingerprint requires audio access.

**Solution:** Extension force-unmutes video and notifies user.

**Implementation:**

```typescript
// content-script.ts
const forceSyncGameAudio = () => {
  const videoElement = document.querySelector("video");

  if (videoElement?.muted) {
    videoElement.muted = false;
    videoElement.volume = 0.3; // Reasonable default

    showNotification({
      message: "Video unmuted for game sync (required for betting)",
      type: "info",
      duration: 5000,
    });
  }

  startACRAudioFingerprint(videoElement);
};
```

**User Experience:**

1. User opens stream (initially may be muted)
2. Extension detects video
3. Auto-unmutes with notification
4. ACR starts listening
5. Identifies match within 10-15 seconds

### 4.2 Match Detection Flow

```
User Opens Stream
       ↓
Extension Detects <video> Element
       ↓
Force Unmute (if muted)
       ↓
DOM Scraping (title, tags, metadata)
       ↓
ACR Audio Fingerprint (10-15s)
       ↓
Backend: Correlate signals → Identify match
       ↓
Load Lineup (22 players)
       ↓
Display Betting UI
```

---

## 5. Technical Stack (Finalized)

### 5.1 Frontend

| Component          | Technology            | Version | Purpose                     |
| ------------------ | --------------------- | ------- | --------------------------- |
| **Framework**      | React                 | 18.3+   | UI components               |
| **Language**       | TypeScript            | 5.8+    | Type safety                 |
| **Build Tool**     | Vite                  | 5.0+    | Fast dev server             |
| **Styling**        | Tailwind CSS          | 3.4+    | Utility-first CSS           |
| **Extension**      | Chrome Manifest v3    | -       | Browser integration         |
| **Authentication** | World ID SDK          | Latest  | Proof of humanness          |
| **Wallet**         | RainbowKit            | Latest  | Ethereum wallet connection  |
| **State**          | React Query + Context | -       | Server state + global state |

**Key Packages:**

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@tanstack/react-query": "^5.0.0",
    "@worldcoin/idkit": "^1.0.0",
    "@rainbow-me/rainbowkit": "^2.0.0",
    "wagmi": "^2.0.0",
    "viem": "^2.0.0"
  }
}
```

### 5.2 Backend

| Component     | Technology              | Purpose                  |
| ------------- | ----------------------- | ------------------------ |
| **Database**  | Supabase (PostgreSQL)   | Bet tracking, match data |
| **Realtime**  | Supabase Realtime       | Live updates to clients  |
| **Functions** | Supabase Edge Functions | Serverless API           |
| **Storage**   | Supabase Storage        | Player images, assets    |

### 5.3 Blockchain

| Component      | Technology    | Network           |
| -------------- | ------------- | ----------------- |
| **Blockchain** | Ethereum      | Sepolia Testnet   |
| **Contracts**  | Solidity 0.8+ | Hardhat framework |
| **Oracle**     | Chainlink CRE | Sports data feeds |
| **Currency**   | USDC          | Testnet token     |

### 5.4 External Services

| Service             | Purpose                 | MVP Status      |
| ------------------- | ----------------------- | --------------- |
| **Chainlink CRE**   | Sports data oracle      | May be mocked   |
| **Opta Sports API** | Match stats, lineups    | May be mocked   |
| **Bookies API**     | Live odds, market locks | Mocked          |
| **ACR Cloud**       | Audio fingerprint       | Real (required) |

---

## 6. Service Abstraction Pattern

**Critical Design Principle:** Frontend must work with both mock and real services without code changes.

### 6.1 Service Factory

```typescript
// src/services/index.ts

import { mockDataService } from "./mock/mockDataService";
import { dataService } from "./real/dataService";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

export const services = {
  data: USE_MOCK ? mockDataService : dataService,
  betting: USE_MOCK ? mockBettingService : bettingService,
  wallet: USE_MOCK ? mockWalletService : walletService,
};
```

### 6.2 Interface Contracts

**All services implement identical interfaces:**

```typescript
export interface IDataService {
  getMatch(matchId: string): Promise<Match>;
  getPlayers(matchId: string): Promise<Player[]>;
  subscribeToMatch(matchId: string, callbacks: MatchCallbacks): () => void;
}

export interface IBettingService {
  placeBet(params: PlaceBetParams): Promise<PlaceBetResult>;
  changeBet(params: ChangeBetParams): Promise<ChangeBetResult>;
  getBets(wallet: string): Promise<Bet[]>;
}

export interface IWalletService {
  connect(): Promise<WalletState>; // Sepolia only
  disconnect(): void;
  getBalance(): Promise<number>;
}
```

### 6.3 Component Usage

**Components always use `services` (never import mock/real directly):**

```typescript
import { services } from '../services';

const MyComponent = () => {
  const handleBet = async () => {
    await services.betting.placeBet({ ... });  // Works with mock OR real!
  };
};
```

**Switching between mock and real:**

```bash
# Development with mocks
VITE_USE_MOCK=true npm run dev

# Production with real services
VITE_USE_MOCK=false npm run build
```

---

## 7. Development Phases

### Phase 1: Frontend with Mocks (Week 1-2)

**Goal:** Build fully functional UI with mock services.

**Deliverables:**

- ✅ Chrome extension skeleton
- ✅ Static side list UI (22 players)
- ✅ Bet placement modal
- ✅ Bet change modal with penalty calculation
- ✅ Balance display (pending/confirmed states)
- ✅ World ID verification UI (mocked)
- ✅ Mock services (data, betting, wallet)
- ✅ Force unmute logic
- ✅ DOM scraping for match detection

**Success Criteria:** Can place bets, change bets, see penalties calculated, experience full flow end-to-end (all mocked).

### Phase 2: Real Service Integration (Week 3-4)

**Goal:** Swap mock services for real implementations.

**Deliverables:**

- ✅ Supabase setup (database, realtime)
- ✅ Smart contract deployment (Sepolia)
- ✅ Chainlink CRE integration (or mock)
- ✅ World ID integration (or mock)
- ✅ RainbowKit wallet connection
- ✅ ACR audio fingerprint
- ✅ AI observational dashboard (admin)

**Success Criteria:** Full system working on Sepolia testnet with real wallet, real smart contract, real (or mocked) oracle data.

### Phase 3: Historical Demo + Polish (Week 5)

**Goal:** Prepare demo on historical game, polish UI, test thoroughly.

**Deliverables:**

- ✅ Historical game data prepared
- ✅ Mock CRE oracle replay simulation
- ✅ Demo video/walkthrough
- ✅ AI dashboard capturing demo data
- ✅ Documentation for Chainlink hackathon submission

**Success Criteria:** Can demo complete flow on recorded match, showcase CRE integration, World ID auth, AI learning dashboard.

---

## 8. Key Metrics & Success Criteria

### 8.1 MVP Success Metrics

| Metric                    | Target  | Measurement                       |
| ------------------------- | ------- | --------------------------------- |
| **UI Load Time**          | < 2s    | Extension injection to UI visible |
| **Bet Placement Time**    | < 5s    | Click to transaction confirmed    |
| **Match Detection Time**  | < 15s   | ACR audio fingerprint match       |
| **Penalty Calculation**   | < 100ms | Real-time bet change UI update    |
| **World ID Verification** | < 10s   | User flow completion              |

### 8.2 Demo Requirements

**Must Demonstrate:**

1. ✅ Chrome extension loads on YouTube/Twitch
2. ✅ Automatically detects match (DOM + ACR)
3. ✅ Displays 22 players with live odds
4. ✅ User connects Ethereum wallet (Sepolia)
5. ✅ World ID verification (start session)
6. ✅ User places bet on Next Goal Scorer
7. ✅ Live event happens (goal) → Oracle delivers data
8. ✅ Provisional balance updates
9. ✅ User changes bet → Penalty calculated and shown
10. ✅ Match ends → Oracle confirms official result
11. ✅ Final settlement → Exact payout calculated
12. ✅ User withdraws (World ID verification)
13. ✅ AI dashboard shows learned patterns

---

## 9. Environment Configuration

### 9.1 Development

```env
# .env.development
VITE_USE_MOCK=true
VITE_APP_NAME=goal.live
VITE_DEBUG=true

# World ID (test mode)
VITE_WORLD_APP_ID=app_staging_xxx

# Wallet
VITE_WALLET_CONNECT_PROJECT_ID=your_project_id
VITE_NETWORK=sepolia
```

### 9.2 Production (Testnet)

```env
# .env.production
VITE_USE_MOCK=false

# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx

# Chainlink CRE
VITE_CHAINLINK_CRE_URL=https://cre.chainlink.com/api
VITE_CHAINLINK_CRE_API_KEY=xxx

# Smart Contract (Sepolia)
VITE_CONTRACT_ADDRESS=0x...
VITE_NETWORK=sepolia

# World ID (production or mock)
VITE_WORLD_APP_ID=app_xxx

# Wallet
VITE_WALLET_CONNECT_PROJECT_ID=your_project_id
```

---

## 10. Risks & Mitigation

| Risk                          | Impact | Mitigation                                |
| ----------------------------- | ------ | ----------------------------------------- |
| **World ID not on Sepolia**   | Medium | Mock World ID, show UI flow, note in docs |
| **CRE data unavailable**      | High   | Historical demo approach, mock oracle     |
| **ACR match detection fails** | High   | Fallback to manual match selection        |
| **Testnet USDC availability** | Medium | Platform provides initial funds           |
| **Bookies API costs**         | Low    | Mock for MVP, use free tier if available  |

---

## 11. Post-MVP Roadmap

**After successful demo, consider:**

1. **Additional Bet Types** (Match Winner, Cards, Corners)
2. **Mainnet Deployment** (Ethereum mainnet or Base L2)
3. **Multi-league Support** (EPL, La Liga, Champions League)
4. **AI Auto-market-making** (Use learned patterns)
5. **Social Features** (Leaderboards, bet sharing)
6. **Mobile App** (React Native)
7. **Liquidity Pools** (User-provided liquidity, LP tokens)

---

## 12. Documentation Index

**For complete details, see:**

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture diagrams
- [FRONTEND_BUILD_PROMPT.md](./FRONTEND_BUILD_PROMPT.md) - Implementation guide
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Mock service code
- [COPILOT_QUICK_START.md](./COPILOT_QUICK_START.md) - Onboarding for new sessions

**For historical context:**

- [GOAL_LIVE_PROJECT_SPEC.md](./GOAL_LIVE_PROJECT_SPEC.md) - Original spec (pre-simplification)

---

## 13. Quick Decision Reference

**New developer asking:**

| Question          | Answer                                 |
| ----------------- | -------------------------------------- |
| Which blockchain? | Ethereum Sepolia testnet               |
| Which currency?   | USDC only                              |
| Which bet types?  | Next Goal Scorer only                  |
| Real-time odds?   | No, event-triggered                    |
| Player tracking?  | No, static side list                   |
| Bet change limit? | Unlimited                              |
| Penalty formula?  | Hybrid: base[changes] × time_decay     |
| Authentication?   | World ID (may be mocked)               |
| Oracle?           | Chainlink CRE (may be mocked for demo) |
| Demo approach?    | Historical game replay                 |
| AI role?          | Observational learning only            |

---

**END OF MVP SPECIFICATION**

For questions or clarifications, refer to ARCHITECTURE.md or create an issue in the repository.
