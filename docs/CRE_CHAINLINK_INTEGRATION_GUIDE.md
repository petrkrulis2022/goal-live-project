# Chainlink CRE & Sports Data Integration Guide for goal.live

**Version:** 1.0  
**Last Updated:** February 20, 2026  
**Status:** Deep Technical Reference  
**Audience:** Backend Engineers, CRE Integration Developers

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The Five Pillars of Sports Data](#the-five-pillars-of-sports-data)
3. [Chainlink CRE Architecture Overview](#chainlink-cre-architecture-overview)
4. [Mock vs Real CRE Decision Matrix](#mock-vs-real-cre-decision-matrix)
5. [Phase 3 Implementation: Mock CRE Service](#phase-3-implementation-mock-cre-service)
6. [Phase 4+ Implementation: Real CRE Integration](#phase-4-implementation-real-cre-integration)
7. [Data Provider Comparison](#data-provider-comparison)
8. [Service Abstraction Pattern for CRE](#service-abstraction-pattern-for-cre)
9. [CRE Workflow Development](#cre-workflow-development)
10. [Integration Security & Secrets Management](#integration-security--secrets-management)
11. [Testing CRE Locally](#testing-cre-locally)
12. [Monitoring & Fallback Strategies](#monitoring--fallback-strategies)

---

## Executive Summary

**goal.live** requires sports data from five distinct sources:

| Pillar                   | Data Type                     | Latency Requirement      | Complexity | MVP Approach                       |
| ------------------------ | ----------------------------- | ------------------------ | ---------- | ---------------------------------- |
| **1. Pre-Game Odds**     | Home/Away player odds         | Low (hours)              | Low        | Mock or CRE HTTP + Cron            |
| **2. Live Goal Events**  | Player ID, minute scored      | High (real-time)         | Medium     | Mock for MVP, CRE webhook Phase 3+ |
| **3. Player Lineups**    | Starting 11, formations       | Medium (15 min pre-game) | Medium     | Mock or CRE HTTP                   |
| **4. Live Odds Updates** | Volatile odds, 1-2s intervals | Very High                | High       | Data Streams (NOT push)            |
| **5. Official Results**  | Final score, all goal scorers | Low (post-match)         | Low        | Mock or CRE HTTP                   |

**Key Decision Point:** Use **Chainlink CRE** for all but #4 (live odds updates).

- **Live odds updates** require **Chainlink Data Streams** with pull-based architecture
- **Everything else** flows through **CRE HTTP Capability** + **Webhook triggers**

---

## The Five Pillars of Sports Data

### Pillar 1: Pre-Game Odds

**What:** Opening odds for Next Goal Scorer (e.g., Benzema 4.5x, Vinicius 5.2x)

**Timing:** Updated daily, peak activity 24 hours before kickoff

**Latency:** Hours (no rush)

**CRE Implementation:**

```typescript
// Pre-game odds fetching (LOW frequency, HIGH accuracy)
export async function fetchPreGameOdds(matchId: string) {
  // Option A: Sportmonks native Chainlink node (production)
  // Option B: Opta via CRE HTTP + threshold encryption (if deeper stats needed)

  const result = await cre.runInNodeMode(
    async (clients) => {
      const odds = await clients.http.get(
        "https://api.sportmonks.com/v3/odds",
        { matchId },
        // Include Chainlink signature for verification
        { chainlinkVerify: true },
      );

      return {
        fetchedAt: Date.now(),
        expiresAt: Date.now() + 3600000, // 1 hour validity
        odds: odds.data, // Cryptographically signed by Sportmonks node
      };
    },
    consensusMedianAggregation(), // BFT consensus across nodes
  );

  return result;
}
```

**Cron Schedule:**

```yaml
# cre workflow configuration
triggers:
  - type: Cron
    schedule: "0 18 * * *" # Daily at 6 PM
    days_before_match: [2, 1, 0] # Start 2 days before
    ramp_up: |
      Days before = 2: Every 12 hours
      Days before = 1: Every 6 hours
      Days before = 0: Every 1 hour
      Minutes before = 60: Every 5 minutes
```

**Database Storage:**

```sql
CREATE TABLE pre_game_odds (
  id UUID PRIMARY KEY,
  match_id UUID REFERENCES matches(id),
  player_id UUID REFERENCES players(id),
  odds INTEGER NOT NULL,  -- Basis points
  source VARCHAR(50),     -- 'sportmonks_native' or 'opta_cre'
  cre_signature VARCHAR(66), -- Hex-encoded DON signature
  fetched_at TIMESTAMP,
  expires_at TIMESTAMP,
  UNIQUE(match_id, player_id) -- Latest only
);
```

---

### Pillar 2: Live Goal Events

**What:** Real-time notification that a goal was scored (player ID, minute, timestamp)

**Timing:** Instant (1-2 seconds after goal on pitch)

**Latency:** **CRITICAL** - Milliseconds matter

**Why CRE is Perfect:** Event-driven webhook trigger vs polling

**CRE Implementation:**

```typescript
// Event-driven goal notification (HIGH frequency, CRITICAL latency)
export async function handleGoalWebhook(payload: GoalEventPayload) {
  // 1. Receive webhook from CRE
  const { matchId, playerId, minute, timestamp } = payload;

  // 2. Multi-source verification (within CRE)
  const verification = await cre.runInNodeMode(async (clients) => {
    // Query BOTH Opta AND Sportradar simultaneously
    const optaGoal = await clients.http.get(
      "https://api.opta.com/v3/matches/{matchId}/goals",
      { headers: { Authorization: `Bearer ${secrets.OPTA_KEY}` } },
    );

    const sportradarGoal = await clients.http.get(
      "https://api.sportradar.com/v3/soccer/{matchId}/goal-events",
      { headers: { Authorization: `Bearer ${secrets.SPORTRADAR_KEY}` } },
    );

    // BFT consensus: both sources must agree
    return {
      verified: optaGoal.confirmed && sportradarGoal.confirmed,
      sources: { opta: true, sportradar: true },
    };
  });

  if (!verification.verified) {
    // Escalate to manual review if sources disagree
    await escalateToManualReview(matchId, playerId);
    return;
  }

  // 3. Push to blockchain immediately (high-priority EVM write)
  await cre.capabilities.EVMClient.write({
    chainId: 11155111, // Sepolia
    to: BETTING_CONTRACT,
    functionName: "confirmGoal",
    args: [matchId, playerId, minute, timestamp],
    gasOverride: "high", // Fast execution
  });

  // 4. Broadcast to users via Supabase Realtime
  await supabase
    .from("goal_events")
    .insert({
      match_id: matchId,
      player_id: playerId,
      minute,
      event_timestamp: timestamp,
      confirmed: true,
      source: "chainlink_cre",
    })
    .select();
}
```

**Webhook Trigger Configuration:**

```yaml
# CRE workflow.yaml
triggers:
  - type: HTTP
    endpoint: "https://api.goal-live.com/webhooks/cre/goal"
    headers:
      x-chainlink-signature: "${CHAINLINK_CRE_SIGNING_KEY}"
    verification: "chainlink-signature"
    queueing: "priority-fifo" # Ensure order
```

**Important:** Goals must be queued and processed in strict chronological order to prevent race conditions in betting settlement.

---

### Pillar 3: Player Lineups

**What:** Starting 11 + substitutes, formations, player positions

**Timing:** Published 15 minutes before kickoff (sometimes 45 min before)

**Latency:** Minutes (not critical)

**CRE Implementation:**

```typescript
// Complex JSON parsing OFF-CHAIN (WASM environment)
export async function fetchPlayerLineups(matchId: string) {
  const result = await cre.runInNodeMode(async (clients) => {
    // Fetch raw lineup data
    const lineupResponse = await clients.http.get(
      `https://api.opta.com/v3/matches/${matchId}/lineups`,
      {
        headers: { Authorization: `Bearer ${secrets.OPTA_KEY}` },
      },
    );

    // Heavy JSON parsing happens OFF-CHAIN in WASM
    // This keeps on-chain storage minimal
    const parsedLineups = {
      home: parseTeamLineup(lineupResponse.data.home),
      away: parseTeamLineup(lineupResponse.data.away),
    };

    // Return only essential data for on-chain resolution
    return {
      startingEleven: {
        home: parsedLineups.home.starting.map((p) => p.id),
        away: parsedLineups.away.starting.map((p) => p.id),
      },
      // Formation is stored but only for UI, not for settlement
      formations: {
        home: parsedLineups.home.formation,
        away: parsedLineups.away.formation,
      },
      timestamp: Date.now(),
    };
  }, consensusMedianAggregation());

  // Only push starting eleven to blockchain (minimal storage)
  await cre.capabilities.EVMClient.write({
    chainId: 11155111,
    to: BETTING_CONTRACT,
    functionName: "registerStartingEleven",
    args: [matchId, result.startingEleven],
  });

  // Store full lineup data in Supabase (cheaper than on-chain)
  await supabase
    .from("players")
    .upsert(result.startingEleven.home.concat(result.startingEleven.away));
}

// Helper function (executes in WASM)
function parseTeamLineup(rawData: any) {
  return {
    starting: rawData.players.slice(0, 11),
    substitutes: rawData.players.slice(11),
    formation: detectFormation(rawData.positions),
  };
}
```

**Gas Optimization:** This demonstrates the critical value of CRE's WASM execution:

- Off-chain: Parse massive JSON lineup arrays (fast, cheap)
- On-chain: Only write compact byte arrays (minimal gas)

---

### Pillar 4: Live Odds Updates

**What:** Real-time odds fluctuation (every 1-2 seconds during live match)

**Timing:** Continuous updates during match

**Latency:** **ULTRA-HIGH** - Sub-second requirements

**⚠️ Critical Architecture Decision:**

```
❌ NOT: CRE push-based polling (too slow, too expensive)
✅ YES: Chainlink Data Streams with pull-based architecture
```

**Why Not Polling?**

- Gas costs for thousands of daily updates are prohibitive
- Continuous blockchain writes = network congestion
- Users experience stale odds while awaiting confirmation

**Why Data Streams?**

- Off-chain cryptographic signing
- Users pull signed data directly into their transactions
- Zero gas costs for oracle data delivery
- Atomic execution: trade + oracle verification in same tx

**Implementation:**

```typescript
// Live odds flow (User side)
export async function placeLiveOdds(
  matchId: string,
  playerId: string,
  amount: bigint,
) {
  // 1. User fetches LATEST signed odds payload (off-chain)
  const signedOdds = await fetch(
    `https://data-streams.chainlink.com/latest/${matchId}/${playerId}`,
  ).then((r) => r.json());

  // Example payload:
  // {
  //   odds: 45000,  // 4.5x
  //   timestamp: 1707234567890,
  //   signature: "0x...",  // DON signature
  //   chainId: 11155111
  // }

  // 2. Submit bet WITH the signed payload
  const tx = await contract.placeBetWithOdds(
    matchId,
    playerId,
    amount,
    signedOdds /* <-- Include signed data here */,
  );

  // 3. Smart contract verifies signature & timestamp atomically
  // - Ensures odds are from Chainlink DON
  // - Ensures odds are recent (within 1-2 second slippage window)
  // - Prevents front-running
}
```

**Smart Contract Side:**

```solidity
// contracts/GoalLiveBetting.sol

function placeBetWithOdds(
    string memory matchId,
    uint256 playerId,
    uint256 amount,
    OddsPayload calldata signedOdds  // From Data Streams
) external {
    // Verify Chainlink Data Streams signature
    require(
        _verifyChainlinkOdds(signedOdds),
        "Invalid odds signature"
    );

    // Verify timestamp is within slippage window (1-2 seconds)
    require(
        block.timestamp <= signedOdds.timestamp + 2 seconds,
        "Odds expired"
    );

    // Now we can use these odds safely
    _placeBet(matchId, playerId, amount, signedOdds.odds);
}
```

**Database Entry (for in-game tracking):**

```sql
CREATE TABLE live_odds_streams (
  match_id UUID REFERENCES matches(id),
  player_id UUID REFERENCES players(id),
  odds INTEGER NOT NULL,
  stream_timestamp BIGINT,
  signature VARCHAR(66),
  verified BOOLEAN DEFAULT FALSE,
  captured_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (match_id, player_id, stream_timestamp)
);
```

---

### Pillar 5: Official Match Results

**What:** Final score, all goal scorers, official match status

**Timing:** Complete within 2-3 minutes of final whistle

**Latency:** Minutes (not critical)

**CRE Implementation:**

```typescript
// Post-match settlement (time-triggered, ~120 min after kickoff)
export async function settleMatch(matchId: string) {
  const match = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  // Cron trigger: approximately 120 minutes after kickoff
  const settlementTime = new Date(
    match.kickoff_time.getTime() + 120 * 60 * 1000,
  );

  // But match could end early (e.g., 95 min), so use flexible window
  const now = Date.now();
  if (now < settlementTime.getTime()) {
    // Match likely still ongoing, reschedule
    return { rescheduled: true };
  }

  // Fetch official results from multiple sources (BFT consensus)
  const results = await cre.runInNodeMode(async (clients) => {
    // Query primary source
    const optaResult = await clients.http.get(
      `https://api.opta.com/v3/matches/${matchId}/result`,
      {
        headers: { Authorization: `Bearer ${secrets.OPTA_KEY}` },
      },
    );

    // Query backup source (Sportradar)
    const sportradarResult = await clients.http.get(
      `https://api.sportradar.com/v3/soccer/${matchId}/summary`,
      {
        headers: { Authorization: `Bearer ${secrets.SPORTRADAR_KEY}` },
      },
    );

    // BFT consensus: both sources must agree on final score
    const opta = optaResult.data;
    const sportradar = sportradarResult.data;

    if (
      opta.score.home !== sportradar.score.home ||
      opta.score.away !== sportradar.score.away
    ) {
      // Scores disagree! This is rare but critical.
      // Escalate to subjective UMA oracle or manual review
      throw new Error("SCORE_MISMATCH");
    }

    return {
      scoreHome: opta.score.home,
      scoreAway: opta.score.away,
      goalScorers: opta.goals.map((g) => ({
        playerId: g.playerId,
        minute: g.minute,
        type: g.ownGoal ? "OWN_GOAL" : "REGULAR_GOAL",
      })),
    };
  });

  // Push official results to smart contract (EVM Write)
  await cre.capabilities.EVMClient.write({
    chainId: 11155111,
    to: BETTING_CONTRACT,
    functionName: "settleMatch",
    args: [matchId, results.scoreHome, results.scoreAway, results.goalScorers],
    gasOverride: "normal",
  });
}
```

---

## Chainlink CRE Architecture Overview

### Core Components

The Chainlink Runtime Environment is built on a **decentralized, modular architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                      YOUR WORKFLOW                              │
│  (TypeScript/Go code that handles your app's logic)             │
│                                                                 │
│  • HTTP requests (Opta, Sportradar, Sportmonks)                │
│  • JSON parsing (in WASM environment)                           │
│  • Decision logic (threshold checks, aggregations)              │
│  • EVM writes (smart contract calls)                            │
└────────────┬────────────────────────────────────────────────────┘
             │
    ┌────────▼───────────────────────────┐
    │     WORKFLOW DON (Central           │
    │     Orchestration Layer)            │
    │                                     │
    │  • Monitors triggers                │
    │  • Coordinates capability nodes     │
    │  • Manages execution state          │
    └────────────┬────────────────────────┘
                 │
    ┌────────────┼────────────────────────┐
    │            │            │           │
┌───▼──┐  ┌─────▼─┐  ┌──────┴──┐  ┌─────▼──┐
│HTTP  │  │EVM    │  │Secrets  │  │Logging │
│Fetch │  │Write  │  │Manager  │  │Node    │
│DON   │  │DON    │  │DON      │  │DON     │
└──────┘  └───────┘  └─────────┘  └────────┘

(Each DON = Decentralized Oracle Network)
```

### Workflow vs Capability DONs

| Component          | Purpose                                                        | Examples                                  |
| ------------------ | -------------------------------------------------------------- | ----------------------------------------- |
| **Workflow DON**   | Central nervous system - monitors triggers & coordinates tasks | Single network per application            |
| **Capability DON** | Specialized execution - does ONE specific task very well       | HTTP Fetch, EVM Write, Secrets Manager    |
| **Trigger Types**  | How workflow is initiated                                      | Cron, HTTP (webhook), EVM Log, Time-based |

### Execution Model: BFT Consensus

Every Capability DON execution follows this pattern:

```
1. Request → All nodes in DON execute task independently
2. Aggregation → Collect results from all nodes
3. BFT Consensus → Byzantine Fault Tolerant agreement
   - If majority agrees → proceed with result
   - If nodes diverge → identify & exclude malicious nodes
4. Output → Single, verified result delivered to smart contract
```

**Example:** Fetch goal event from Opta API

- 10 nodes, all query https://api.opta.com/goals simultaneously
- 9 nodes get: `{ goalId: 12345, playerId: 789 }`
- 1 node gets corrupted response (network error)
- BFT consensus: "9 out of 10 agree, proceed with majority"
- One verified result delivered on-chain

### Trigger Types for goal.live

```yaml
# 1. CRON: Pre-game odds (fixed schedule)
triggers:
  - type: Cron
    schedule: "*/30 * * * *"  # Every 30 minutes
    enabled: true

# 2. HTTP: Live goal events (webhook from sports data provider)
triggers:
  - type: HTTP
    endpoint: "/webhooks/goal-event"
    signature_verification: "chainlink"

# 3. EVM Log: Goal recorded on blockchain (reactive trigger)
triggers:
  - type: EVM Log
    chainId: 11155111
    addresses: ["0x...betting-contract"]
    topics: ["GoalConfirmed(bytes32, uint256)"]

# 4. Time-based: Post-match settlement (absolute timestamp)
triggers:
  - type: Time
    timestamp: "${{ params.kickoff_time + 90 * 60 * 1000 }}"
```

---

## Mock vs Real CRE Decision Matrix

### Decision: When to Use Mock vs Real?

Navigate this matrix based on **data availability and development timeline**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    MOCK vs REAL DECISION TREE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Q: Do you have CRE API key + data subscription?               │
│  ├─ YES → Can you deploy to live CRE networks?                 │
│  │   ├─ YES → Use REAL CRE                                      │
│  │   └─ NO → Use MOCK (simulate real behavior)                  │
│  └─ NO → Use MOCK (historical replay or simulated data)         │
│                                                                 │
│  Q: What's your timeline?                                       │
│  ├─ < 2 weeks → Use MOCK (faster iteration)                     │
│  ├─ 2-4 weeks → Use MOCK + start real integration              │
│  └─ > 4 weeks → Go straight to REAL CRE                        │
│                                                                 │
│  Q: Do you have live match data synchronized with testnet?     │
│  ├─ YES → Use REAL CRE with live subscriptions                 │
│  └─ NO → Use MOCK with historical data replay                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Mock CRE Service Abstraction

```typescript
// services/cre/types.ts
export interface ICREService {
  // Pre-game odds
  fetchPreGameOdds(matchId: string): Promise<PreGameOdds>;
  subscribeToPreGameOdds(
    matchId: string,
    callback: (odds: PreGameOdds) => void,
  ): () => void;

  // Goal events (real or mocked)
  subscribeToGoalEvents(
    matchId: string,
    callback: (goal: GoalEvent) => void,
  ): () => void;

  // Lineups
  fetchLineups(matchId: string): Promise<MatchLineups>;

  // Official results
  fetchOfficialResults(matchId: string): Promise<MatchResult>;

  // Health check
  isHealthy(): Promise<boolean>;
}

// services/cre/mock.ts
export class MockCREService implements ICREService {
  constructor(private speedMultiplier: number = 10) {} // 10x speed for demo

  async fetchPreGameOdds(matchId: string): Promise<PreGameOdds> {
    // Return static odds from hardcoded data
    return MOCK_ODDS[matchId] || generateRandomOdds();
  }

  subscribeToGoalEvents(
    matchId: string,
    callback: (goal: GoalEvent) => void,
  ): () => void {
    // Load historical match data
    const match = HISTORICAL_MATCHES[matchId];
    if (!match) throw new Error(`Match ${matchId} not found in history`);

    // Simulate goals at accelerated speed
    const goals = match.goals.sort((a, b) => a.minute - b.minute);
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex >= goals.length) {
        clearInterval(interval);
        return;
      }

      const goal = goals[currentIndex];
      // Adjust timing for speed multiplier
      const realDelay = (goal.minute / this.speedMultiplier) * 60 * 1000;

      callback({
        matchId,
        playerId: goal.playerId,
        minute: goal.minute,
        timestamp: Date.now(),
        source: "mock_cre",
      });

      currentIndex++;
    }, 500); // Check every 500ms for next goal

    // Return unsubscribe function
    return () => clearInterval(interval);
  }

  subscribeToPreGameOdds(
    matchId: string,
    callback: (odds: PreGameOdds) => void,
  ): () => void {
    // Simulate odds fluctuation
    const interval = setInterval(() => {
      const odds = this.generateFluctuatingOdds(matchId);
      callback(odds);
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }

  async fetchLineups(matchId: string): Promise<MatchLineups> {
    return (
      MOCK_LINEUPS[matchId] || {
        home: generateMockPlayers("home"),
        away: generateMockPlayers("away"),
      }
    );
  }

  async fetchOfficialResults(matchId: string): Promise<MatchResult> {
    return HISTORICAL_MATCHES[matchId].result;
  }

  async isHealthy(): Promise<boolean> {
    return true; // Mock is always healthy
  }
}

// services/cre/real.ts
export class RealCREService implements ICREService {
  constructor(
    private creApiKey: string,
    private creWebsocketUrl: string,
  ) {}

  async fetchPreGameOdds(matchId: string): Promise<PreGameOdds> {
    // Call real CRE API
    const response = await fetch(
      `${this.creWebsocketUrl}/workflows/fetch-odds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.creApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ matchId, source: "sportmonks" }),
      },
    );
    return response.json();
  }

  subscribeToGoalEvents(
    matchId: string,
    callback: (goal: GoalEvent) => void,
  ): () => void {
    // Set up webhook listener for real CRE events
    // CRE will POST to our webhook endpoint
    // This is handled separately in the backend

    // For now, return a dummy unsubscribe
    return () => {
      // Clean up webhook listener
    };
  }

  // ... implement other methods calling real CRE APIs
}

// services/cre/index.ts (Factory)
export function getCurrentCREService(): ICREService {
  if (process.env.USE_MOCK_CRE === "true") {
    return new MockCREService(
      parseInt(process.env.MOCK_SPEED_MULTIPLIER || "10"),
    );
  }

  return new RealCREService(
    process.env.CHAINLINK_CRE_API_KEY!,
    process.env.CHAINLINK_CRE_WS_URL!,
  );
}
```

### Historical Match Data for Mock CRE

For realistic testing without live matches, use pre-recorded match data:

```typescript
// data/historical-matches.ts

export const HISTORICAL_MATCHES = {
  "real-madrid-barcelona-2026-02-10": {
    matchId: "real-madrid-barcelona-2026-02-10",
    homeTeam: "Real Madrid",
    awayTeam: "Barcelona",
    kickoffTime: new Date("2026-02-10T20:00:00Z"),
    status: "finished",

    // Pre-recorded goals with exact timing
    goals: [
      {
        minute: 23,
        playerId: "benzema-123",
        playerName: "Benzema",
        timestamp: new Date("2026-02-10T20:23:00Z"),
      },
      {
        minute: 45,
        playerId: "lewandowski-456",
        playerName: "Lewandowski",
        timestamp: new Date("2026-02-10T20:45:00Z"),
      },
      {
        minute: 67,
        playerId: "vinicius-789",
        playerName: "Vinicius",
        timestamp: new Date("2026-02-10T21:07:00Z"),
      },
    ],

    // Official final result
    result: {
      scoreHome: 2,
      scoreAway: 1,
      goalScorers: [
        { playerId: "benzema-123", minute: 23 },
        { playerId: "vinicius-789", minute: 67 },
        { playerId: "lewandowski-456", minute: 45 },
      ],
    },

    // Players available for betting
    players: {
      home: [
        { id: "benzema-123", name: "Benzema", number: 9, odds: 45000 },
        { id: "vinicius-789", name: "Vinicius", number: 7, odds: 52000 },
        // ... 9 more
      ],
      away: [
        { id: "lewandowski-456", name: "Lewandowski", number: 9, odds: 38000 },
        // ... 10 more
      ],
    },
  },
};
```

---

## Phase 3 Implementation: Mock CRE Service

### When to Build the Mock CRE Service

**Timeline:** Phase 3, Week 4 (after smart contracts deployed)  
**Prerequisites:** Phase 2 complete (Supabase + contracts)  
**Alternative:** Skip if integrating real CRE simultaneously

### Step-by-Step Implementation

#### Step 1: Define CRE Service Interface

```typescript
// backend/src/services/cre/ICREService.ts

export interface PreGameOdds {
  matchId: string;
  odds: Record<string, number>; // { playerId: odds_in_bp }
  source: "sportmonks" | "opta" | "mock";
  fetchedAt: number;
  expiresAt: number;
}

export interface GoalEvent {
  matchId: string;
  playerId: string;
  playerName: string;
  minute: number;
  timestamp: number; // Unix milliseconds
  source: "chainlink_cre" | "mock_cre";
  verified: boolean;
}

export interface MatchLineups {
  matchId: string;
  home: PlayerLineup[];
  away: PlayerLineup[];
  formation: { home: string; away: string };
}

export interface PlayerLineup {
  id: string;
  name: string;
  number: number;
  position: string;
  odds: number; // Basis points
}

export interface MatchResult {
  matchId: string;
  scoreHome: number;
  scoreAway: number;
  goalScorers: GoalRecord[];
  status: "finished" | "live" | "rescheduled";
}

export interface ICREService {
  // Fetch methods (one-time calls)
  fetchPreGameOdds(matchId: string): Promise<PreGameOdds>;
  fetchLineups(matchId: string): Promise<MatchLineups>;
  fetchOfficialResults(matchId: string): Promise<MatchResult>;

  // Subscribe methods (streaming)
  subscribeToPreGameOdds(
    matchId: string,
    callback: (odds: PreGameOdds) => void,
  ): () => void; // Returns unsubscribe function

  subscribeToGoalEvents(
    matchId: string,
    callback: (goal: GoalEvent) => void,
  ): () => void;

  // Health check
  isHealthy(): Promise<boolean>;
  getStatus(): CREStatus;
}

export interface CREStatus {
  isHealthy: boolean;
  lastCheck: number;
  mode: "real" | "mock";
  currentMatch: string | null;
}
```

#### Step 2: Implement Mock CRE Service

```typescript
// backend/src/services/cre/MockCREService.ts

import { supabase } from "../../db/supabase";
import { HISTORICAL_MATCHES } from "../../data/historical-matches";
import {
  ICREService,
  GoalEvent,
  PreGameOdds,
  MatchLineups,
  MatchResult,
} from "./ICREService";

export class MockCREService implements ICREService {
  private speedMultiplier: number; // 10x = match plays 10x faster
  private activeSubscriptions: Map<string, NodeJS.Timeout> = new Map();
  private lastCheckTime: number = Date.now();

  constructor(speedMultiplier: number = 10) {
    this.speedMultiplier = speedMultiplier;
    console.log(`🎭 Mock CRE Service initialized (${speedMultiplier}x speed)`);
  }

  async fetchPreGameOdds(matchId: string): Promise<PreGameOdds> {
    console.log(`📊 MockCRE: Fetching odds for ${matchId}`);

    const match = HISTORICAL_MATCHES[matchId];
    if (!match) {
      throw new Error(`Match ${matchId} not found in mock data`);
    }

    return {
      matchId,
      odds: match.players.home
        .concat(match.players.away)
        .reduce((acc, p) => ({ ...acc, [p.id]: p.odds }), {}),
      source: "mock",
      fetchedAt: Date.now(),
      expiresAt: Date.now() + 3600000, // 1 hour
    };
  }

  async fetchLineups(matchId: string): Promise<MatchLineups> {
    console.log(`👥 MockCRE: Fetching lineups for ${matchId}`);

    const match = HISTORICAL_MATCHES[matchId];
    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    return {
      matchId,
      home: match.players.home,
      away: match.players.away,
      formation: { home: "4-3-3", away: "4-2-3-1" },
    };
  }

  async fetchOfficialResults(matchId: string): Promise<MatchResult> {
    console.log(`✅ MockCRE: Fetching official results for ${matchId}`);

    const match = HISTORICAL_MATCHES[matchId];
    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    return {
      matchId,
      scoreHome: match.result.scoreHome,
      scoreAway: match.result.scoreAway,
      goalScorers: match.result.goalScorers,
      status: "finished",
    };
  }

  subscribeToPreGameOdds(
    matchId: string,
    callback: (odds: PreGameOdds) => void,
  ): () => void {
    console.log(`📊 MockCRE: Subscribing to odds for ${matchId}`);

    const interval = setInterval(async () => {
      try {
        const odds = await this.fetchPreGameOdds(matchId);
        callback(odds);
      } catch (error) {
        console.error("Error fetching odds:", error);
      }
    }, 5000); // Update every 5 seconds

    this.activeSubscriptions.set(`odds-${matchId}`, interval);

    return () => {
      clearInterval(interval);
      this.activeSubscriptions.delete(`odds-${matchId}`);
    };
  }

  subscribeToGoalEvents(
    matchId: string,
    callback: (goal: GoalEvent) => void,
  ): () => void {
    console.log(`⚽ MockCRE: Subscribing to goals for ${matchId}`);

    const match = HISTORICAL_MATCHES[matchId];
    if (!match) {
      throw new Error(`Match ${matchId} not found in mock data`);
    }

    // Sort goals by minute
    const goals = [...match.goals].sort((a, b) => a.minute - b.minute);
    let nextGoalIndex = 0;

    // Calculate delay for each goal based on speedMultiplier
    const scheduleNextGoal = () => {
      if (nextGoalIndex >= goals.length) {
        console.log(`✅ MockCRE: All goals delivered for ${matchId}`);
        return;
      }

      const nextGoal = goals[nextGoalIndex];

      // Calculate real delay: if goal at min 23, and speed is 10x,
      // we wait (23 * 60 seconds / 10) = 138 seconds
      const delayMs = (nextGoal.minute * 60 * 1000) / this.speedMultiplier;

      const timeout = setTimeout(() => {
        const goalEvent: GoalEvent = {
          matchId,
          playerId: nextGoal.playerId,
          playerName: nextGoal.playerName,
          minute: nextGoal.minute,
          timestamp: Date.now(),
          source: "mock_cre",
          verified: true,
        };

        console.log(
          `⚽ MockCRE: Goal scored - ${goalEvent.playerName} (${goalEvent.minute}')`,
          `[Speed: ${this.speedMultiplier}x]`,
        );

        callback(goalEvent);

        nextGoalIndex++;
        scheduleNextGoal(); // Schedule next goal
      }, delayMs);

      this.activeSubscriptions.set(`goal-${matchId}-${nextGoalIndex}`, timeout);
    };

    // Start goal simulation
    scheduleNextGoal();

    // Return unsubscribe function
    return () => {
      // Clear all goal timeouts for this match
      for (const [key, timeout] of this.activeSubscriptions.entries()) {
        if (key.startsWith(`goal-${matchId}`)) {
          clearTimeout(timeout);
          this.activeSubscriptions.delete(key);
        }
      }
    };
  }

  async isHealthy(): Promise<boolean> {
    return true; // Mock is always healthy
  }

  getStatus() {
    return {
      isHealthy: true,
      lastCheck: this.lastCheckTime,
      mode: "mock" as const,
      currentMatch: null,
    };
  }
}
```

#### Step 3: Create Historical Match Data

```typescript
// backend/src/data/historical-matches.ts
export const HISTORICAL_MATCHES = {
  "real-madrid-barcelona-2026-02-01": {
    matchId: "real-madrid-barcelona-2026-02-01",
    homeTeam: "Real Madrid",
    awayTeam: "Barcelona",
    kickoffTime: new Date("2026-02-01T20:00:00Z"),

    goals: [
      {
        minute: 23,
        playerId: "benzema-123",
        playerName: "Benzema (#9)",
      },
      {
        minute: 45,
        playerId: "lewandowski-456",
        playerName: "Lewandowski (#9)",
      },
      {
        minute: 67,
        playerId: "vinicius-789",
        playerName: "Vinicius (#7)",
      },
    ],

    result: {
      scoreHome: 2,
      scoreAway: 1,
      goalScorers: [
        { playerId: "benzema-123", minute: 23 },
        { playerId: "vinicius-789", minute: 67 },
        { playerId: "lewandowski-456", minute: 45 },
      ],
    },

    players: {
      home: [
        { id: "benzema-123", name: "Karim Benzema", number: 9, odds: 45000 },
        { id: "vinicius-789", name: "Vinicius Junior", number: 7, odds: 52000 },
        // ... more players
      ],
      away: [
        {
          id: "lewandowski-456",
          name: "Robert Lewandowski",
          number: 9,
          odds: 38000,
        },
        // ... more players
      ],
    },
  },
};
```

#### Step 4: Integration with Supabase Backend

```typescript
// backend/src/routes/cre-events.ts

import { Router } from "express";
import { services } from "../services";

const router = Router();

// Start watching a match (stream goal events)
router.post("/matches/:matchId/watch", async (req, res) => {
  const { matchId } = req.params;
  const { speedMultiplier } = req.body;

  try {
    const cre = services.getCREService();

    console.log(
      `Starting to watch match: ${matchId} (${speedMultiplier}x speed)`,
    );

    // Subscribe to goal events
    const unsubscribe = cre.subscribeToGoalEvents(
      matchId,
      async (goal: GoalEvent) => {
        // Broadcast to all connected users via Supabase Realtime
        const channel = supabase.channel(`match:${matchId}:goals`);

        await channel.send("broadcast", {
          event: "GOAL_SCORED",
          data: goal,
        });

        // Also insert into database for history
        await supabase.from("goal_events").insert({
          match_id: matchId,
          player_id: goal.playerId,
          minute: goal.minute,
          event_timestamp: new Date(goal.timestamp),
          confirmed: true,
          source: goal.source,
        });
      },
    );

    // Store unsubscribe function (cleanup on match end)
    storeUnsubscriber(matchId, unsubscribe);

    res.json({
      success: true,
      message: `Watching ${matchId}`,
      mode: cre.getStatus().mode,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Stop watching (cleanup)
router.post("/matches/:matchId/stop-watch", (req, res) => {
  const { matchId } = req.params;

  const unsubscribe = getUnsubscriber(matchId);
  if (unsubscribe) {
    unsubscribe();
    clearUnsubscriber(matchId);
  }

  res.json({ success: true, message: `Stopped watching ${matchId}` });
});

export default router;
```

---

## Phase 4+ Implementation: Real CRE Integration

### Transitioning from Mock to Real CRE

Once you have:

- ✅ Chainlink CRE API key
- ✅ Sportmonks/Opta subscription
- ✅ CRE workflow deployed

### Real CRE Implementation

```typescript
// backend/src/services/cre/RealCREService.ts

export class RealCREService implements ICREService {
  private creApiUrl: string;
  private creApiKey: string;
  private workflowIds: Map<string, string> = new Map();

  constructor(creApiUrl: string, creApiKey: string) {
    this.creApiUrl = creApiUrl;
    this.creApiKey = creApiKey;
    console.log("✅ Real CRE Service initialized");
  }

  async fetchPreGameOdds(matchId: string): Promise<PreGameOdds> {
    // Call deployed CRE workflow
    const response = await fetch(`${this.creApiUrl}/workflows/fetch-odds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.creApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        matchId,
        source: "sportmonks", // Native Chainlink node
      }),
    });

    const result = await response.json();

    return {
      matchId,
      odds: result.odds,
      source: "sportmonks", // Origin-signed by Sportmonks node
      fetchedAt: result.fetchedAt,
      expiresAt: result.expiresAt,
    };
  }

  subscribeToGoalEvents(
    matchId: string,
    callback: (goal: GoalEvent) => void,
  ): () => void {
    // Register webhook with CRE
    // When CRE detects goal, it will POST to our webhook endpoint

    const webhookUrl = `${process.env.API_URL}/webhooks/cre/goal-event`;

    // This is handled separately in webhook handlers
    // For now, return cleanup function

    return () => {
      // Clean up webhook registration
    };
  }

  // ... implement other methods
}
```

### CRE Workflow Definition

Create actual Chainlink CRE workflows for production:

```yaml
# cre/workflows/fetch-odds.yaml
name: "Fetch Pre-Game Odds (Sportmonks)"
description: "Fetch next goal scorer odds from Sportmonks native Chainlink node"

triggers:
  - type: Cron
    schedule: "*/30 * * * *" # Every 30 minutes

workflow:
  - step: fetch_odds
    type: HTTP
    url: "https://api.sportmonks.com/v3/odds"
    auth: "threshold-encryption:SPORTMONKS_API_KEY"
    params:
      matchId: "${{ input.matchId }}"

  - step: verify_signature
    type: BFT_CONSENSUS
    input: "${{ steps.fetch_odds.result }}"
    threshold: 0.67 # 2/3 quorum

  - step: send_to_blockchain
    type: EVM_WRITE
    chainId: 11155111
    contract: "0x...GoalLiveBetting"
    function: "updateOdds"
    args:
      - matchId: "${{ input.matchId }}"
      - odds: "${{ steps.verify_signature.output }}"

output:
  success: "${{ steps.send_to_blockchain.success }}"
  txHash: "${{ steps.send_to_blockchain.txHash }}"
```

```yaml
# cre/workflows/handle-goal-event.yaml
name: "Handle Live Goal Event"
description: "Verify goal event and settle betting positions"

triggers:
  - type: HTTP
    endpoint: "/webhooks/goal-event"
    signature_verification: "chainlink"

workflow:
  - step: parse_goal
    type: JSON_PARSE
    input: "${{ request.body }}"

  - step: verify_with_opta
    type: HTTP
    url: "https://api.opta.com/v3/matches/${{ steps.parse_goal.matchId }}/goals"
    auth: "threshold-encryption:OPTA_API_KEY"

  - step: verify_with_sportradar
    type: HTTP
    url: "https://api.sportradar.com/v3/soccer/${{ steps.parse_goal.matchId }}/goals"
    auth: "threshold-encryption:SPORTRADAR_API_KEY"

  - step: consensus_check
    type: BFT_CONSENSUS
    inputs:
      - opta: "${{ steps.verify_with_opta.result }}"
      - sportradar: "${{ steps.verify_with_sportradar.result }}"
    threshold: 0.67

  - step: settle_bets
    type: EVM_WRITE
    chainId: 11155111
    contract: "0x...GoalLiveBetting"
    function: "confirmGoal"
    args:
      - matchId: "${{ steps.parse_goal.matchId }}"
      - playerId: "${{ steps.parse_goal.playerId }}"
      - minute: "${{ steps.parse_goal.minute }}"
      - timestamp: "${{ steps.parse_goal.timestamp }}"
    gasOverride: "high" # Prioritize this transaction

output:
  settled: "${{ steps.settle_bets.success }}"
  txHash: "${{ steps.settle_bets.txHash }}"
```

---

## Data Provider Comparison

### Three Tiers of Sports Data

```
┌──────────────────────────────────────────────────────────────┐
│ TIER 1: Native Chainlink Node (Easiest Integration)         │
├──────────────────────────────────────────────────────────────┤
│ Sportmonks & SportsDataIO                                    │
│ ✅ Deploy own Chainlink nodes                                 │
│ ✅ Origin-signed data (maximum trust)                         │
│ ✅ Covers all 5 pillars of sports data                        │
│ ✅ Best for immediate production deployment                  │
│ ⚠️  Fewer advanced metrics (vs Opta)                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ TIER 2: CRE HTTP Integration (Medium Integration)            │
├──────────────────────────────────────────────────────────────┤
│ Opta & Sportradar                                            │
│ ✅ Can be integrated via CRE HTTP Capability                  │
│ ✅ Opta = deepest analytics (80+ metrics)                     │
│ ✅ Sportradar = global coverage + granularity                 │
│ ⚠️  Requires threshold encryption for API keys               │
│ ⚠️  Needs DON consensus (not origin-signed)                   │
│ 🚀 Best for specialized advanced betting markets             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ TIER 3: Web2 Bookies APIs (External Services)                │
├──────────────────────────────────────────────────────────────┤
│ Traditional Sportsbooks (rarely public)                       │
│ ⚠️  Most have restrictive ToS against bots                    │
│ ❌ Not recommended as primary data source                     │
│ 💡 OK for secondary `observational_insights` only            │
└──────────────────────────────────────────────────────────────┘
```

### Provider-by-Pillar Matrix

| Pillar               | Sportmonks (Tier 1)        | Opta (Tier 2)              | Sportradar (Tier 2)              |
| -------------------- | -------------------------- | -------------------------- | -------------------------------- |
| **Pre-Game Odds**    | ✅ Live odds               | ✅ Dynamic Stats API       | ✅ Risk indicators               |
| **Goal Events**      | ✅ Real-time (Chainlink)   | ✅ Play-by-play detailed   | ✅ Event feeds                   |
| **Player Lineups**   | ✅ Starting 11 + subs      | ✅ 80+ metadata per player | ✅ Extended lineups + formations |
| **Live Odds**        | ⚠️ Basic                   | ✅ xG, expected metrics    | ✅ Market-implied probabilities  |
| **Official Results** | ✅ Final stats (Chainlink) | ✅ Complete match data     | ✅ Global coverage               |

### Recommendation for goal.live MVP

**Use Sportmonks (Tier 1) + optional Opta (Tier 2) for advanced props**

```typescript
// Production recommendation
const PRIMARY_PROVIDER = "sportmonks"; // Origin-signed via Chainlink node
const SECONDARY_PROVIDER = "opta"; // For advanced betting (Phase post-MVP)

export async function fetchGoalEvent(matchId: string): Promise<GoalEvent> {
  // ALWAYS check Sportmonks first (fastest, most trusted)
  try {
    return await fetchViaChainlinkNode(matchId, "sportmonks");
  } catch {
    // Fallback to Opta via CRE if Sportmonks is down
    return await fetchViaCreHttpCapability(matchId, "opta");
  }
}
```

---

## Service Abstraction Pattern for CRE

### Key Principle: Single Interface, Multiple Implementations

The entire CRE integration should be **swappable at runtime** without changing a single component file.

```typescript
// services/index.ts (Factory Pattern)
export function getCREService(): ICREService {
  if (process.env.MODE === "production") {
    return new RealCREService(
      process.env.CHAINLINK_CRE_API_URL!,
      process.env.CHAINLINK_CRE_API_KEY!,
    );
  }

  // Default to mock for development
  return new MockCREService(
    parseInt(process.env.MOCK_SPEED_MULTIPLIER || "10"),
  );
}

// In any component/endpoint
const cre = getCREService();
const odds = await cre.fetchPreGameOdds(matchId);
// ^^^^ Works identically whether using real or mock CRE
```

### Usage Throughout Backend

```typescript
// backend/src/routes/matches.ts

router.get("/matches/:matchId/odds", async (req, res) => {
  const cre = getCREService(); // Gets mock or real automatically

  const odds = await cre.fetchPreGameOdds(req.params.matchId);

  res.json({
    odds,
    mode: cre.getStatus().mode, // "mock" or "real"
  });
});

router.post("/matches/:matchId/subscribe", async (req, res) => {
  const cre = getCREService();

  const unsubscribe = cre.subscribeToGoalEvents(
    req.params.matchId,
    async (goal) => {
      // Broadcast to WebSocket clients
      io.emit(`match:${goal.matchId}:goal`, goal);

      // Record in database
      await supabase.from("goal_events").insert({
        match_id: goal.matchId,
        player_id: goal.playerId,
        minute: goal.minute,
        source: goal.source,
        verified: goal.verified,
      });
    },
  );

  res.json({ subscriptionId: req.params.matchId });
});
```

---

## CRE Workflow Development

### Local Development Setup

```bash
# Install CRE CLI
npm install -g @chainlink/cre-cli

# Authenticate
cre auth login

# Create project
cre init my-workflow

cd my-workflow
```

### Directory Structure

```
my-workflow/
├── src/
│   └── main.ts          # Your TypeScript workflow logic
├── config/
│   ├── project.yaml     # Global configuration
│   ├── workflow.yaml    # Workflow definitions
│   ├── config.staging.json
│   └── config.production.json
├── secrets.yaml         # Encrypted API keys
├── package.json
└── README.md
```

### Example CRE Workflow in TypeScript

```typescript
// src/main.ts

import {
  runInNodeMode,
  types as CRETypes,
} from "@chainlink/cre-sdk";

// ============ Type
 Definitions ============

interface FetchOddsInput {
  matchId: string;
  provider: "sportmonks" | "opta" | "sportradar";
}

interface GoalEventInput {
  matchId: string;
  playerId: string;
  minute: number;
  timestamp: number;
}

// ============ Workflow 1: Fetch Pre-Game Odds ============

export async function fetchPreGameOdds(
  input: FetchOddsInput
): Promise<CRETypes.WorkflowOutput> {
  console.log(`📊 Fetching ${input.provider} odds for match ${input.matchId}`);

  try {
    const result = await runInNodeMode(
      async (clients) => {
        // Each node executes this independently
        const { HTTPClient } = clients;

        let apiUrl: string;
        let headers: Record<string, string>;

        if (input.provider === "sportmonks") {
          // Sportmonks native Chainlink node is the easiest path
          apiUrl = `https://api.sportmonks.com/v3/odds/latest`;
          headers = {
            // Sportmonks public endpoint (no key needed for basic access)
            "Accept": "application/json",
          };
        } else if (input.provider === "opta") {
          // Opta requires authentication (threshold-encrypted secret)
          apiUrl = `https://api.opta.com/v3/matches/${input.matchId}/odds`;
          headers = {
            "Authorization": `Bearer ${process.env.OPTA_API_KEY}`,
          };
        } else {
          // Sportradar
          apiUrl = `https://api.sportradar.com/v3/soccer/${input.matchId}/odds`;
          headers = {
            "Authorization": `Bearer ${process.env.SPORTRADAR_API_KEY}`,
          };
        }

        // Each node makes the HTTP request
        const response = await HTTPClient.get(apiUrl, { headers });

        // Parse JSON response
        const data = response.json();

        return {
          matchId: input.matchId,
          odds: data.odds || {},
          provider: input.provider,
          fetchedAt: Date.now(),
        };
      },
      // BFT consensus: use median aggregation on numerical values
      {
        consensusAggregation: "median",
      }
    );

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}

// ============ Workflow 2: Handle Goal Event ============

export async function handleGoalEvent(
  input: GoalEventInput
): Promise<CRETypes.WorkflowOutput> {
  console.log(
    `⚽ Goal event: Player ${input.playerId} in minute ${input.minute}`
  );

  try {
    const verification = await runInNodeMode(
      async (clients) => {
        const { HTTPClient } = clients;

        // Multi-source verification for critical events
        const [optaResult, sportradarResult] = await Promise.all([
          HTTPClient.get(
            `https://api.opta.com/v3/matches/${input.matchId}/goals`,
            {
              headers: {
                "Authorization": `Bearer ${process.env.OPTA_API_KEY}`,
              },
            }
          ),
          HTTPClient.get(
            `https://api.sportradar.com/v3/soccer/${input.matchId}/goals`,
            {
              headers: {
                "Authorization": `Bearer ${process.env.SPORTRADAR_API_KEY}`,
              },
            }
          ),
        ]);

        const optaGoals = optaResult.json().goals || [];
        const srGoals = sportradarResult.json().goals || [];

        // Find goal at specified minute in both sources
        const optaConfirmed = optaGoals.some(
          (g: any) => g.minute === input.minute && g.playerId === input.playerId
        );
        const srConfirmed = srGoals.some(
          (g: any) => g.minute === input.minute && g.playerId === input.playerId
        );

        return {
          verified: optaConfirmed && srConfirmed,
          sources: {
            opta: optaConfirmed,
            sportradar: srConfirmed,
          },
        };
      }
    );

    if (!verification.verified) {
      console.warn("⚠️ Goal event could not be verified by multiple sources");
      // Escalate to manual review or subjective oracle
      return {
        success: false,
        error: "Goal event not verified across sources",
        requiresManualReview: true,
      };
    }

    // If verified, push to smart contract for settlement
    const contractWrite = await runInNodeMode(
      async (clients) => {
        const { EVMClient } = clients;

        // Write to blockchain (Ethereum Sepolia)
        const tx = await EVMClient.write({
          chainId: 11155111,
          to: "0x...GoalLiveBetting", // Your contract address
          functionName: "confirmGoal",
          args: [input.matchId, input.playerId, input.minute, input.timestamp],
          abi: [
            // ABI snippet for confirmGoal function
            {
              name: "confirmGoal",
              type: "function",
              inputs: [
                { name: "matchId", type: "string" },
                { name: "playerId", type: "uint256" },
                { name: "minute", type: "uint256" },
                { name: "timestamp", type: "uint256" },
              ],
            },
          ],
        });

        return {
          txHash: tx.hash,
          blockNumber: tx.blockNumber,
        };
      }
    );

    return {
      success: true,
      data: {
        goalVerified: verification.verified,
        contractWrite: contractWrite,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}

// ============ Workflow 3: Local Simulation ============

// For testing without deploying to live network
export async function simulateGoalDetection(): Promise<
  CRETypes.WorkflowOutput
> {
  console.log("🧪 Simulating goal detection workflow");

  // This runs locally in your terminal via: cre workflow simulate
  return {
    success: true,
    data: {
      message: "Simulation complete",
      timestamp: Date.now(),
    },
  };
}
```

### Running Workflows Locally

```bash
# Install dependencies
npm install

# Test individual workflow locally
cre workflow simulate fetchPreGameOdds '{
  "matchId": "real-madrid-barcelona-123",
  "provider": "sportmonks"
}'

# Output:
# ✅ Workflow simulation successful
# 📊 Fetching sportmonks odds for match real-madrid-barcelona-123
# ✓ All nodes agreed on odds (BFT consensus achieved)
# Odds: { "benzema": 45000, "vinicius": 52000, ... }
```

### Testing Before Deployment

```bash
# Build WASM binary
npm run build

# Run full integration test against testnet
npm run test:integration

# Check gas estimates
npm run estimate-gas

# Deploy to staging CRE network
cre workflow deploy --environment staging

# Once confident, deploy to production
cre workflow deploy --environment production
```

---

## Integration Security & Secrets Management

### Threshold Encryption for API Keys

**Problem:** How do you give smart contracts access to Opta API keys without exposing them?

**Solution:** Threshold Encryption via CRE

**How It Works:**

1. You store API key in `secrets.yaml`
2. CRE encrypts the key using multi-party computation
3. Key is split across multiple Chainlink nodes
4. **No single node has the complete key**
5. When workflow needs key, nodes work together to decrypt it
6. Only the authenticated CRE request can use the decrypted key

```yaml
# secrets.yaml (encrypted)

opta:
  api_key: "STANDARD-OMS-xyz123abc___ENCRYPTED"

sportradar:
  api_key: "PREMIUM-API-key789___ENCRYPTED"

sportmonks:
  # Sportmonks has native node, so key is optional
  api_key: ""
```

```typescript
// In CRE workflow
const response = await HTTPClient.get("https://api.opta.com/v3/...", {
  headers: {
    // CRE automatically decrypts this from secrets
    Authorization: `Bearer ${process.env.OPTA_API_KEY}`,
  },
});
// Even though OPTA_API_KEY value appears in code,
// it's only accessible to nodes in the DON that can collaborate to decrypt it
```

### Environment-Based Configuration

```yaml
# config.production.json
{
  "chainId": 1,  # Ethereum mainnet
  "contractAddress": "0x...mainnet",
  "providers": {
    "primary": "sportmonks",    # Native Chainlink node
    "fallback": "opta"          # Via threshold encryption
  },
  "cron": {
    "preGameOdds": "0 18 * * *"  # Daily 6 PM
  },
  "webhooks": {
    "goal": "https://api.goal-live.com/webhooks/cre/goal"
  }
}

# config.staging.json
{
  "chainId": 11155111,  # Ethereum Sepolia testnet
  "contractAddress": "0x...sepolia",
  "providers": {
    "primary": "mock"  # Use mock for testing
  },
  "cron": {
    "preGameOdds": "*/30 * * * *"  # Every 30 min for faster testing
  }
}
```

### Secure Webhook Verification

```typescript
// backend/src/middleware/verifyCRESignature.ts

import crypto from "crypto";

export function verifyCRESignature(req: Express.Request): boolean {
  const signature = req.headers["x-chainlink-signature"] as string;
  const timestamp = req.headers["x-chainlink-timestamp"] as string;
  const body = JSON.stringify(req.body);

  const secret = process.env.CHAINLINK_CRE_WEBHOOK_SECRET!;

  // Reconstruct signed message
  const signedMessage = `${timestamp}.${body}`;

  // Verify HMAC signature
  const hash = crypto
    .createHmac("sha256", secret)
    .update(signedMessage)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
}

export function creWebhookAuth(
  req: Express.Request,
  res: Express.Response,
  next: NextFunction,
) {
  if (!verifyCRESignature(req)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Check timestamp freshness (prevent replay attacks)
  const timestamp = parseInt(req.headers["x-chainlink-timestamp"] as string);
  const now = Date.now();
  if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
    // 5 minute window
    return res.status(401).json({ error: "Request expired" });
  }

  next();
}
```

### Usage in Routes

```typescript
// backend/src/routes/webhooks.ts

router.post(
  "/webhooks/cre/goal-event",
  [express.json(), creWebhookAuth], // Verify signature first
  async (req, res) => {
    const { matchId, playerId, minute, timestamp } = req.body;

    // At this point, we've verified:
    // ✅ Request came from Chainlink CRE
    // ✅ Request is recent (not replayed)
    // ✅ Request body wasn't tampered with

    // Process the verified goal event
    await handleGoalEvent({ matchId, playerId, minute, timestamp });

    res.json({ success: true });
  },
);
```

---

## Testing CRE Locally

### Unit Testing Workflow Logic

```typescript
// tests/cre.test.ts

import { describe, it, expect } from "vitest";
import { fetchPreGameOdds, handleGoalEvent } from "../src/main";

describe("CRE Workflows", () => {
  it("should fetch pre-game odds from Sportmonks", async () => {
    const result = await fetchPreGameOdds({
      matchId: "real-madrid-barcelona-123",
      provider: "sportmonks",
    });

    expect(result.success).toBe(true);
    expect(result.data.odds).toBeDefined();
    expect(typeof result.data.odds.benzema).toBe("number");
  });

  it("should verify goal event across multiple sources", async () => {
    const result = await handleGoalEvent({
      matchId: "real-madrid-barcelona-123",
      playerId: "benzema-123",
      minute: 23,
      timestamp: Date.now(),
    });

    expect(result.success).toBe(true);
    expect(result.data.goalVerified).toBe(true);
  });

  it("should handle missing players gracefully", async () => {
    const result = await handleGoalEvent({
      matchId: "nonexistent-match",
      playerId: "nonexistent-player",
      minute: 50,
      timestamp: Date.now(),
    });

    expect(result.success).toBe(false);
    expect(result.requiresManualReview).toBe(true);
  });
});
```

### End-to-End Testing with Testnet

```bash
# Deploy contract to Sepolia
npx hardhat run scripts/deploy.ts --network sepolia

# Start local CRE simulator
cre workflow simulate fetchPreGameOdds --network sepolia

# Watch for goal events (live match simulation)
npm run watch:goals -- --network sepolia --speed 10x
```

---

## Monitoring & Fallback Strategies

### Health Check Endpoint

```typescript
// backend/src/routes/health.ts

router.get("/health/cre", async (req, res) => {
  const cre = getCREService();
  const status = cre.getStatus();

  res.json({
    cre: {
      healthy: status.isHealthy,
      mode: status.mode, // "mock" or "real"
      lastCheck: status.lastCheck,
    },
    database: {
      healthy: await checkSupabaseHealth(),
    },
    contracts: {
      healthy: await checkContractHealth(),
    },
  });
});
```

### Graceful Fallback Chain

```typescript
// services/cre/failover.ts

export async function fetchGoalEventWithFallback(
  matchId: string,
): Promise<GoalEvent> {
  const fallbackChain = [
    {
      name: "Sportmonks (Native Chainlink)",
      fetch: () => fetchViaChainlink(matchId),
    },
    {
      name: "Opta (CRE HTTP)",
      fetch: () => fetchViaCreHttp(matchId, "opta"),
    },
    {
      name: "Sportradar (CRE HTTP)",
      fetch: () => fetchViaCreHttp(matchId, "sportradar"),
    },
    {
      name: "Mock Oracle (Local Simulation)",
      fetch: () => fetchViaMockOracle(matchId),
    },
  ];

  for (const provider of fallbackChain) {
    try {
      console.log(`Trying ${provider.name}...`);
      return await provider.fetch();
    } catch (error) {
      console.warn(`${provider.name} failed:`, error);
      continue; // Try next provider
    }
  }

  throw new Error("All data providers exhausted - cannot fetch goal event");
}
```

### Alerting System

```typescript
// services/monitoring/alerts.ts

export async function monitorCREHealth() {
  const interval = setInterval(async () => {
    const cre = getCREService();

    if (!cre.isHealthy()) {
      // Send alert to on-call engineer
      await sendAlert({
        severity: "critical",
        service: "Chainlink CRE",
        message: `CRE is unhealthy - mode=${cre.getStatus().mode}`,
        actionRequired: true,
      });

      // Switch to fallback if in production
      if (process.env.NODE_ENV === "production") {
        switchToMockOracle();
      }
    }
  }, 60000); // Check every minute

  return () => clearInterval(interval);
}
```

---

## Summary: CRE Integration Readiness

### Before Phase 3 (Implement Decision)

- [ ] Read Chainlink CRE documentation (https://docs.chain.link/cre)
- [ ] Understand all 5 pillars of sports data
- [ ] Decide: Real Chainlink CRE or Mock for MVP demo?
- [ ] If real: Obtain API key + Sportmonks/Opta subscription
- [ ] If mock: Create historical match data files

### Phase 3 Implementation (Mock CRE)

- [ ] Implement `ICREService` interface
- [ ] Build `MockCREService` class
- [ ] Create historical match data
- [ ] Integrate with Supabase webhooks
- [ ] Test goal event simulation

### Phase 4+ Implementation (Real CRE)

- [ ] Deploy Chainlink CRE workflows
- [ ] Implement `RealCREService` class
- [ ] Set up threshold encryption for API keys
- [ ] Configure webhook verification
- [ ] Test with live match data

### Production Readiness

- [ ] Implement health checks
- [ ] Set up fallback providers
- [ ] Configure alerting
- [ ] Load test under high volume
- [ ] Establish SLAs with data providers

---

## 📚 RESOURCES & REFERENCES

### Official Chainlink Documentation

**Core CRE Documentation:**

- [Chainlink CRE Capability Overview](https://docs.chain.link/cre) - Start here for CRE basics
- [CRE Architecture & Design](https://docs.chain.link/cre/architecture) - How CRE works under the hood
- [CRE Workflow Configuration](https://docs.chain.link/cre/workflows) - YAML-based workflow setup
- [CRE HTTP Capability](https://docs.chain.link/cre/capabilities/http) - Making HTTP calls from CRE
- [CRE Crypto Capability](https://docs.chain.link/cre/capabilities/crypto) - Cryptographic operations
- [CRE Threshold Encryption](https://docs.chain.link/cre/capabilities/threshold-encryption) - Secrets management

**Chainlink Data Feeds:**

- [Chainlink Data Streams](https://docs.chain.link/data-streams) - Real-time low-latency data feeds
- [Chainlink VRF (Verifiable Randomness)](https://docs.chain.link/vrf) - For fair settlement if needed
- [Chainlink Functions](https://docs.chain.link/functions) - Serverless compute for Web2/Web3 integration

### CRE Examples & GitHub Repositories

**Official Chainlink Examples:**

- [Chainlink CRE Examples Repository](https://github.com/smartcontractkit/cre-examples) - Production examples
- [CRE Sports Data Example](https://github.com/smartcontractkit/cre-examples/tree/main/sports-data) - Official sports data integration
- [CRE Webhook Receiver Pattern](https://github.com/smartcontractkit/cre-examples/tree/main/webhook-patterns) - Webhook handling examples

**Community Implementations:**

- [Chainlink Labs Bootcamp Materials](https://github.com/ChainlinkLabs/bootcamp-materials) - Educational resources
- [CRE Starter Kit](https://github.com/smartcontractkit/cre-starter-kit) - Minimal CRE setup template

### Sports Data Provider Documentation

**Pre-Match & Live Data Providers:**

- [Sportmonks API Documentation](https://docs.sportmonks.com/football/v/api/getting-started) - Football (soccer) stats API
  - [Sportmonks + Chainlink CRE Integration Blog](https://www.sportmonks.com/blogs/sportmonks-and-chainlink-bring-sport-data-to-the-blockchain/)
  - Endpoints: Pre-match odds, Goals, Lineups, Match events
- [Opta/Stats Perform API](https://www.statsperform.com/sports-data-apis/) - Premium sports data provider
  - [Dynamic Stats API Documentation](https://www.statsperform.com/betting-fantasy/betting-content/dynamic-stats-api/)
  - Endpoints: Live match data, xG, possession, heat maps
- [Sportradar API](https://developer.sportradar.com/docs/read/Home) - Real-time sports data
  - Football endpoints: livescores, live events, match status
  - Documentation requires registration at developer.sportradar.com

**Odds & Betting Data:**

- [The Odds API (Free)](https://the-odds-api.com/docs/) - Free historical odds for testing
  - Endpoint: `https://api.the-odds-api.com/v4/sports/{sport}/odds`
  - Markets: player_goal_scorer, player_assists, h2h
  - Rate limits: 1 request per minute (free tier)

- [Betfair API](https://www.betfair.com/exchange/plus/en/api?tab=guides) - Enterprise odds data
  - Real-time betting odds from betting exchanges
  - Requires licensing agreement

### Blockchain & Smart Contract Resources

**Ethereum & Testnet Documentation:**

- [Sepolia Testnet Info](https://sepolia.dev/) - Official Sepolia testnet documentation
- [Ethereum JSON-RPC API](https://ethereum.org/en/developers/docs/apis/json-rpc/) - Node interaction reference
- [ethers.js v6 Documentation](https://docs.ethers.org/v6/) - Ethereum library for JavaScript

**Smart Contract Development:**

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/) - Security libraries
- [Solidity Documentation](https://docs.soliditylang.org/) - Solidity language reference
- [Hardhat Documentation](https://hardhat.org/docs) - Smart contract development framework

**Decentralized Oracle Resources:**

- [Chainlink Docs - Decentralized Oracle Network](https://docs.chain.link/architecture-overview/architecture-decentralized-model)
- [Chainlink Security & Audits](https://docs.chain.link/overview/security)
- [Chainlink Service Level Agreements (SLA)](https://chain.link/sla)

### Database & Backend References

**Supabase Documentation:**

- [Supabase Getting Started](https://supabase.com/docs/guides/getting-started)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime) - WebSocket subscriptions
- [Supabase Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

**PostgreSQL References:**

- [PostgreSQL Documentation](https://www.postgresql.org/docs/current/) - Open source relational database
- [PostgreSQL JSON Support](https://www.postgresql.org/docs/current/datatype-json.html) - For odds snapshots

### Related goal.live Documentation

**Internal Project Files:**

- [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) - 4-phase product development strategy
- [BACKEND_BUILD_PROMPT.md](./BACKEND_BUILD_PROMPT.md) - Phase 2-4 backend implementation
- [MVP_FINAL_SPEC.md](./MVP_FINAL_SPEC.md) - MVP requirements and constraints
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Complete system overview
- [CRE_INTEGRATION_FOR_MVP_PROMPTS.md](./CRE_INTEGRATION_FOR_MVP_PROMPTS.md) - Specific implementation prompts

### Recommended Reading Order

**Phase 1 (Now - Frontend Building):**

1. Skip CRE docs for now (Phase 3 only)
2. Focus on [FRONTEND_BUILD_PROMPT.md](./FRONTEND_BUILD_PROMPT.md)

**Phase 3 (CRE Integration Planning):**

1. This document (CRE_CHAINLINK_INTEGRATION_GUIDE.md)
2. [Chainlink CRE Official Docs](https://docs.chain.link/cre)
3. [CRE Workflow Configuration](https://docs.chain.link/cre/workflows)
4. [Chainlink CRE Examples Repository](https://github.com/smartcontractkit/cre-examples)
5. [Sportmonks API + Chainlink CRE Integration](https://www.sportmonks.com/blogs/sportmonks-and-chainlink-bring-sport-data-to-the-blockchain/)

**Phase 4+ (Production CRE Deployment):**

1. [CRE Architecture & Design](https://docs.chain.link/cre/architecture)
2. [CRE Threshold Encryption](https://docs.chain.link/cre/capabilities/threshold-encryption)
3. [Chainlink Security & Audits](https://docs.chain.link/overview/security)
4. [Monitoring & Fallback Strategies](#monitoring--fallback-strategies) (section in this doc)

### API Rate Limits & Quotas Reference

| Provider          | Endpoint      | Free Tier     | Enterprise | Notes                            |
| ----------------- | ------------- | ------------- | ---------- | -------------------------------- |
| **The Odds API**  | `/odds`       | 500 req/month | Unlimited  | Use for testing                  |
| **Sportmonks**    | `/matches`    | 1,000/day     | On-demand  | Professional plan needed         |
| **Sportradar**    | `/livescores` | Contact       | On-demand  | Enterprise licensing             |
| **Betfair**       | Streaming API | None          | $5k+/year  | Real market odds                 |
| **Chainlink CRE** | DON requests  | Included      | Included   | Depends on node operator pricing |

### Quick Links by Use Case

**Building Mock CRE Service (Phase 1-2):**

- → [CRE_INTEGRATION_FOR_MVP_PROMPTS.md](./CRE_INTEGRATION_FOR_MVP_PROMPTS.md)
- → [LIVE_ODDS_CAPTURE_AND_MOCK_CRE_API.md](./LIVE_ODDS_CAPTURE_AND_MOCK_CRE_API.md)

**Integrating Real CRE (Phase 3+):**

- → [Chainlink CRE Workflows](https://docs.chain.link/cre/workflows)
- → [CRE Examples Repository](https://github.com/smartcontractkit/cre-examples/tree/main/sports-data)

**Fetching Sports Data:**

- → [The Odds API Docs](https://the-odds-api.com/docs/)
- → [Sportmonks API Docs](https://docs.sportmonks.com/football/v/api/getting-started)

**Setting Up Smart Contracts:**

- → [CONTRACTS_BUILD_PROMPT.md](../docs/CONTRACTS_BUILD_PROMPT.md)
- → [Hardhat Getting Started](https://hardhat.org/hardhat-runner/docs/getting-started)

**Database & Realtime Sync:**

- → [Supabase Docs](https://supabase.com/docs)
- → [BACKEND_BUILD_PROMPT.md](../docs/BACKEND_BUILD_PROMPT.md)

---

**End of CRE Integration Guide**

_Last Updated: February 21, 2026_

_Last Updated: February 20, 2026_
