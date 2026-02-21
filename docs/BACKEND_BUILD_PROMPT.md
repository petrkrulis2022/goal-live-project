# goal.live Backend Build Prompt (Phases 2-4)

**Target:** Backend Developer / Copilot Session  
**Phases:** 2 (Database) → 3 (CRE) → 4 (AI + World ID)  
**Stack:** Supabase + Chainlink CRE  
**Duration:** Week 3-5  
**Last Updated:** February 20, 2026

---

## 🎯 Context

**This covers Phases 2-4 of a multi-phase build.**  
See **[DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)** for the full product vision and phased strategy.

**Phase 2:** Database setup (Supabase)  
**Phase 3:** CRE integration (mock or real based on availability)  
**Phase 4:** AI dashboard + World ID

**Key Concept:** We stay flexible on mock vs real CRE data. Decision made during Phase 3 based on actual API availability.

---

## Objective

Build backend services to replace frontend mocks:

- ✅ Supabase database for bet tracking
- ✅ Chainlink CRE integration (or mock for demo)
- ✅ Real-time WebSocket updates
- ✅ AI observational dashboard data collection
- ✅ Historical match demo playback system

---

## Prerequisites

**Before starting:**

- ✅ Read [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) — **Understand full vision + mock vs real strategy**
- ✅ Read [MVP_FINAL_SPEC.md](./MVP_FINAL_SPEC.md) — All design decisions
- ✅ Smart contracts deployed ([CONTRACTS_BUILD_PROMPT.md](./CONTRACTS_BUILD_PROMPT.md))
- ✅ Supabase account created
- ✅ Chainlink CRE API key (or plan to mock)

---

## 1. Supabase Setup

### 1.1 Create Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project: `goal-live-mvp`
3. Save credentials:
   - Project URL: `https://xxx.supabase.co`
   - Anon key: `eyJhbGc...`

### 1.2 Database Schema

**Run these SQL migrations in Supabase SQL Editor:**

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- MATCHES TABLE
-- =====================
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_match_id VARCHAR(100) UNIQUE NOT NULL, -- From CRE or demo
  home_team VARCHAR(100) NOT NULL,
  away_team VARCHAR(100) NOT NULL,
  competition VARCHAR(100),
  kickoff_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pre-match', 'live', 'finished')),
  current_minute INTEGER DEFAULT 0,
  score_home INTEGER DEFAULT 0,
  score_away INTEGER DEFAULT 0,
  is_demo BOOLEAN DEFAULT FALSE, -- Flag for historical demo matches
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_external_id ON matches(external_match_id);

-- =====================
-- PLAYERS TABLE
-- =====================
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  external_player_id VARCHAR(100) NOT NULL, -- From Opta/CRE
  name VARCHAR(100) NOT NULL,
  team VARCHAR(10) NOT NULL CHECK (team IN ('home', 'away')),
  number INTEGER,
  position VARCHAR(20),
  odds INTEGER NOT NULL, -- In basis points (e.g., 4.5x = 45000)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_players_match ON players(match_id);
CREATE INDEX idx_players_team ON players(match_id, team);

-- =====================
-- BETS TABLE
-- =====================
CREATE TABLE bets (
  id BIGSERIAL PRIMARY KEY,
  bettor_wallet VARCHAR(42) NOT NULL, -- Ethereum address
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  original_player_id UUID, -- Track first choice
  original_amount BIGINT NOT NULL, -- USDC in smallest unit (6 decimals)
  current_amount BIGINT NOT NULL, -- After penalties
  odds INTEGER NOT NULL, -- Odds at time of bet
  change_count INTEGER DEFAULT 0,
  total_penalties BIGINT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'settled', 'cancelled')),
  blockchain_tx_hash VARCHAR(66), -- Ethereum tx hash
  placed_at TIMESTAMP DEFAULT NOW(),
  settled_at TIMESTAMP
);

CREATE INDEX idx_bets_bettor ON bets(bettor_wallet);
CREATE INDEX idx_bets_match ON bets(match_id);
CREATE INDEX idx_bets_status ON bets(status);

-- =====================
-- BET CHANGES TABLE
-- =====================
CREATE TABLE bet_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bet_id BIGINT REFERENCES bets(id) ON DELETE CASCADE,
  old_player_id UUID REFERENCES players(id),
  new_player_id UUID REFERENCES players(id),
  penalty_amount BIGINT NOT NULL,
  minute_in_match INTEGER,
  blockchain_tx_hash VARCHAR(66),
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bet_changes_bet ON bet_changes(bet_id);

-- =====================
-- GOAL EVENTS TABLE
-- =====================
CREATE TABLE goal_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id),
  minute INTEGER NOT NULL,
  event_type VARCHAR(20) DEFAULT 'GOAL' CHECK (event_type IN ('GOAL', 'VAR_OVERTURNED', 'VAR_CORRECTED')),
  confirmed BOOLEAN DEFAULT FALSE,
  source VARCHAR(50), -- 'chainlink_cre', 'mock_oracle', 'manual'
  occurred_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_goal_events_match ON goal_events(match_id);
CREATE INDEX idx_goal_events_confirmed ON goal_events(confirmed);

-- =====================
-- PROVISIONAL CREDITS TABLE
-- =====================
CREATE TABLE provisional_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bet_id BIGINT REFERENCES bets(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL, -- Estimated payout
  based_on_goal_event UUID REFERENCES goal_events(id),
  is_final BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_provisional_credits_bet ON provisional_credits(bet_id);

-- =====================
-- AI OBSERVATIONS TABLE (For ML Dashboard)
-- =====================
CREATE TABLE ai_event_observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,

  -- Event data
  event_type VARCHAR(50) NOT NULL, -- 'GOAL', 'CARD', 'SUB', 'DANGEROUS_PLAY'
  player_id UUID REFERENCES players(id),
  minute INTEGER,
  event_timestamp TIMESTAMP NOT NULL,

  -- Bookies' response (from external API polling)
  bookies_locked BOOLEAN DEFAULT FALSE,
  lock_timestamp TIMESTAMP,
  lock_duration_seconds INTEGER,
  odds_before JSONB, -- { "p1": 45000, "p2": 38000, ... }
  odds_after JSONB,

  -- AI insights
  time_to_lock_ms INTEGER, -- event_timestamp - lock_timestamp in ms
  locked_before_event BOOLEAN DEFAULT FALSE, -- Predictive lock indicator

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_observations_match ON ai_event_observations(match_id);
CREATE INDEX idx_ai_observations_event ON ai_event_observations(event_type, event_timestamp);

-- =====================
-- WORLD ID VERIFICATIONS TABLE
-- =====================
CREATE TABLE world_id_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(42) NOT NULL,
  nullifier_hash VARCHAR(66) NOT NULL UNIQUE, -- Prevents replay attacks
  action VARCHAR(50) NOT NULL, -- 'start_session', 'finish_match', 'withdraw'
  match_id UUID REFERENCES matches(id),
  verified_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_world_id_wallet ON world_id_verifications(wallet_address);
CREATE INDEX idx_world_id_action ON world_id_verifications(action);

-- =====================
-- ROW LEVEL SECURITY (RLS)
-- =====================

-- Enable RLS
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_changes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own bets
CREATE POLICY "Users can view own bets" ON bets
  FOR SELECT
  USING (bettor_wallet = current_setting('request.jwt.claims')::json->>'wallet');

-- Policy: Users can insert their own bets
CREATE POLICY "Users can insert own bets" ON bets
  FOR INSERT
  WITH CHECK (bettor_wallet = current_setting('request.jwt.claims')::json->>'wallet');

-- =====================
-- FUNCTIONS
-- =====================

-- Function: Update match status automatically
CREATE OR REPLACE FUNCTION update_match_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_match_timestamp
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_match_status();
```

### 1.3 Supabase Edge Functions

**Create realtime webhook listener:**

```bash
supabase functions new cre-webhook
```

**Function code:**

```typescript
// supabase/functions/cre-webhook/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

serve(async (req) => {
  try {
    // Verify webhook signature (Chainlink CRE)
    const signature = req.headers.get("x-chainlink-signature");
    // TODO: Verify signature

    const payload = await req.json();

    if (payload.eventType === "GOAL") {
      // Insert goal event
      await supabase.from("goal_events").insert({
        match_id: payload.matchId,
        player_id: payload.playerId,
        minute: payload.minute,
        event_type: "GOAL",
        confirmed: true,
        source: "chainlink_cre",
        occurred_at: payload.timestamp,
      });

      // Update provisional credits for affected bets
      const { data: bets } = await supabase
        .from("bets")
        .select("*")
        .eq("match_id", payload.matchId)
        .eq("player_id", payload.playerId)
        .eq("status", "active");

      for (const bet of bets || []) {
        const payout = (bet.current_amount * bet.odds) / 10000;
        await supabase.from("provisional_credits").insert({
          bet_id: bet.id,
          amount: payout,
          based_on_goal_event: payload.eventId,
          is_final: false,
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

---

## 2. Chainlink CRE Integration

### 2.1 Real CRE Service (If Available)

```typescript
// backend/services/chainlinkCREService.ts

import axios from "axios";

interface CREConfig {
  apiUrl: string;
  apiKey: string;
  webhookSecret: string;
}

export class ChainlinkCREService {
  private config: CREConfig;

  constructor(config: CREConfig) {
    this.config = config;
  }

  /**
   * Subscribe to match events
   */
  async subscribeToMatch(matchId: string, webhookUrl: string) {
    const response = await axios.post(
      `${this.config.apiUrl}/subscriptions`,
      {
        matchId,
        events: ["GOAL", "CARD", "SUB", "MATCH_END"],
        webhookUrl,
      },
      {
        headers: {
          "X-API-Key": this.config.apiKey,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data;
  }

  /**
   * Get match lineup
   */
  async getLineup(matchId: string) {
    const response = await axios.get(
      `${this.config.apiUrl}/matches/${matchId}/lineup`,
      {
        headers: { "X-API-Key": this.config.apiKey },
      },
    );

    return response.data;
  }

  /**
   * Get official match result
   */
  async getMatchResult(matchId: string) {
    const response = await axios.get(
      `${this.config.apiUrl}/matches/${matchId}/result`,
      {
        headers: { "X-API-Key": this.config.apiKey },
      },
    );

    return response.data;
  }
}
```

### 2.2 Mock CRE Service (For Demo)

```typescript
// backend/services/mockCREService.ts

import { supabase } from "./supabase";

interface DemoMatchData {
  matchId: string;
  lineup: any[];
  events: Array<{
    type: string;
    playerId: string;
    minute: number;
    timestamp: string;
  }>;
  finalResult: any;
}

export class MockCREService {
  /**
   * Load historical match data
   */
  async loadDemoMatch(matchId: string): Promise<DemoMatchData> {
    // Load from pre-populated JSON file
    const fs = require("fs");
    const data = JSON.parse(
      fs.readFileSync(`./demo-data/${matchId}.json`, "utf8"),
    );

    return data;
  }

  /**
   * Simulate live match playback
   * @param matchId Historical match ID
   * @param speedMultiplier Playback speed (10x = 10 times faster)
   */
  async simulateLiveMatch(matchId: string, speedMultiplier: number = 10) {
    const demoData = await this.loadDemoMatch(matchId);

    console.log(`🎬 Starting demo playback (${speedMultiplier}x speed)...`);

    // Sort events chronologically
    const events = demoData.events.sort((a, b) => a.minute - b.minute);

    for (const event of events) {
      // Calculate delay
      const delayMs = (event.minute * 60 * 1000) / speedMultiplier;
      await this.sleep(delayMs);

      // Trigger event (insert into Supabase as if from real CRE)
      await this.emitEvent(matchId, event);

      console.log(`⚽ ${event.minute}' - ${event.type} by ${event.playerId}`);
    }

    // Send match end event
    await this.sleep(5000);
    await this.emitMatchEnd(matchId, demoData.finalResult);
    console.log(`🏁 Demo match ended.`);
  }

  private async emitEvent(matchId: string, event: any) {
    // Insert goal event into Supabase
    await supabase.from("goal_events").insert({
      match_id: matchId,
      player_id: event.playerId,
      minute: event.minute,
      event_type: event.type,
      confirmed: true,
      source: "mock_oracle",
      occurred_at: new Date().toISOString(),
    });

    // Trigger webhook to frontend via Supabase Realtime
    // (Frontend subscribes to goal_events table changes)
  }

  private async emitMatchEnd(matchId: string, result: any) {
    await supabase
      .from("matches")
      .update({
        status: "finished",
        end_time: new Date().toISOString(),
        score_home: result.home,
        score_away: result.away,
      })
      .eq("external_match_id", matchId);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

**Demo match data file:**

```json
// demo-data/real-madrid-vs-barcelona-2026-02-10.json
{
  "matchId": "demo-real-barca-2026-02-10",
  "homeTeam": "Real Madrid",
  "awayTeam": "Barcelona",
  "kickoff": "2026-02-10T20:00:00Z",
  "lineup": {
    "home": [
      {
        "id": "p1",
        "name": "Benzema",
        "number": 9,
        "position": "ST",
        "odds": 45000
      },
      {
        "id": "p2",
        "name": "Vinicius",
        "number": 7,
        "position": "LW",
        "odds": 52000
      }
      // ... 9 more
    ],
    "away": [
      {
        "id": "p12",
        "name": "Lewandowski",
        "number": 9,
        "position": "ST",
        "odds": 38000
      }
      // ... 10 more
    ]
  },
  "events": [
    { "type": "GOAL", "playerId": "p1", "minute": 23 },
    { "type": "GOAL", "playerId": "p12", "minute": 45 },
    { "type": "GOAL", "playerId": "p2", "minute": 78 }
  ],
  "finalResult": { "home": 2, "away": 1 }
}
```

---

## 3. Real-Time Services

### 3.1 Frontend Realtime Subscription

```typescript
// frontend: src/services/real/realtimeService.ts

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export const realtimeService = {
  /**
   * Subscribe to match events
   */
  subscribeToMatch(
    matchId: string,
    callbacks: {
      onGoal: (event: any) => void;
      onUpdate: (match: any) => void;
    },
  ) {
    // Subscribe to goal events
    const goalSubscription = supabase
      .channel(`match:${matchId}:goals`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "goal_events",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => callbacks.onGoal(payload.new),
      )
      .subscribe();

    // Subscribe to match updates
    const matchSubscription = supabase
      .channel(`match:${matchId}:updates`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => callbacks.onUpdate(payload.new),
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      goalSubscription.unsubscribe();
      matchSubscription.unsubscribe();
    };
  },
};
```

---

## 4. AI Observational Dashboard

### 4.1 Bookies API Polling Service

```typescript
// backend/services/bookiesObserver.ts

import axios from "axios";
import { supabase } from "./supabase";

export class BookiesObserver {
  private pollInterval: NodeJS.Timer | null = null;

  /**
   * Start observing bookies' odds and market locks
   */
  startObserving(matchId: string) {
    this.pollInterval = setInterval(async () => {
      await this.pollBookiesAPI(matchId);
    }, 2000); // Poll every 2 seconds
  }

  stopObserving() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async pollBookiesAPI(matchId: string) {
    try {
      // Mock bookies API response for MVP
      const mockResponse = {
        marketLocked: Math.random() > 0.95, // 5% chance of lock
        odds: {
          p1: 45000 + Math.floor(Math.random() * 5000) - 2500, // Benzema
          p2: 52000 + Math.floor(Math.random() * 4000) - 2000, // Vinicius
          // ... more players
        },
      };

      // Check for significant events to log
      const { data: recentGoals } = await supabase
        .from("goal_events")
        .select("*")
        .eq("match_id", matchId)
        .gte("occurred_at", new Date(Date.now() - 10000).toISOString()) // Last 10s
        .order("occurred_at", { ascending: false })
        .limit(1);

      if (recentGoals && recentGoals.length > 0) {
        const goalEvent = recentGoals[0];
        const timeDiff = Date.now() - new Date(goalEvent.occurred_at).getTime();

        // Log observation
        await supabase.from("ai_event_observations").insert({
          match_id: matchId,
          event_type: "GOAL",
          player_id: goalEvent.player_id,
          minute: goalEvent.minute,
          event_timestamp: goalEvent.occurred_at,
          bookies_locked: mockResponse.marketLocked,
          lock_timestamp: mockResponse.marketLocked
            ? new Date().toISOString()
            : null,
          odds_before: mockResponse.odds,
          time_to_lock_ms: mockResponse.marketLocked ? timeDiff : null,
          locked_before_event: timeDiff < 0, // Locked before official event
        });
      }
    } catch (error) {
      console.error("Bookies polling error:", error);
    }
  }
}
```

### 4.2 Admin Dashboard API

```typescript
// backend/routes/aiDashboard.ts

import express from "express";
import { supabase } from "../services/supabase";

const router = express.Router();

/**
 * GET /api/ai/insights/:matchId
 * Get AI observations for a match
 */
router.get("/insights/:matchId", async (req, res) => {
  const { matchId } = req.params;

  const { data: observations } = await supabase
    .from("ai_event_observations")
    .select("*")
    .eq("match_id", matchId)
    .order("event_timestamp", { ascending: true });

  // Calculate insights
  const insights = {
    totalEvents: observations?.length || 0,
    avgLockTime: calculateAverage(observations?.map((o) => o.time_to_lock_ms)),
    predictiveLockCount:
      observations?.filter((o) => o.locked_before_event).length || 0,
    oddsVolatility: calculateVolatility(observations),
  };

  res.json({ observations, insights });
});

export default router;
```

---

## 5. Integration Checklist

**Supabase:**

- [ ] Create project
- [ ] Run database migrations
- [ ] Deploy edge functions
- [ ] Configure RLS policies
- [ ] Test realtime subscriptions

**Chainlink CRE:**

- [ ] Get API credentials (or plan mock)
- [ ] Set up webhook endpoint
- [ ] Test match subscription
- [ ] Verify webhook signatures

**Demo System:**

- [ ] Prepare historical match data JSON
- [ ] Test mock CRE playback
- [ ] Verify frontend receives events
- [ ] Confirm provisional balance updates

**AI Dashboard:**

- [ ] Set up bookies API polling (or mock)
- [ ] Test observation logging
- [ ] Build admin UI for insights
- [ ] Export CSV for ML analysis

---

## 6. Environment Variables

```env
# Backend .env

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... # Server-only

# Chainlink CRE (if using real)
CHAINLINK_CRE_URL=https://cre.chainlink.com/api
CHAINLINK_CRE_API_KEY=your_api_key
CHAINLINK_CRE_WEBHOOK_SECRET=webhook_secret

# Smart Contract
CONTRACT_ADDRESS=0x... # From deployment.json
NETWORK=sepolia

# Demo Mode
USE_MOCK_CRE=true  # Set to false for production
```

---

## Next Steps

1. **Set up Supabase** → Run migrations, test database
2. **Deploy smart contracts** → See [CONTRACTS_BUILD_PROMPT.md](./CONTRACTS_BUILD_PROMPT.md)
3. **Build frontend services** → Replace mocks with real Supabase calls
4. **Test historical demo** → Run mock CRE playback
5. **Build AI dashboard** → Admin panel for observations

**Questions?** See [MVP_FINAL_SPEC.md](./MVP_FINAL_SPEC.md) for architecture.
