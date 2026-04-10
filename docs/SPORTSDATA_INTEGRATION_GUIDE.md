# Integration Guide: Adding Sports Data to Betting Flow

Step-by-step guide to integrate the sportsdata module into your existing betting system.

## Overview

The sportsdata module provides:

- Real-time odds management
- Match data fetching
- Chainlink oracle integration
- Automated betting logic

This guide shows how to wire it into your existing betting components and hooks.

## Step 1: Setup Environment Variables

Copy the template and fill in your values:

```bash
cp .env.example.chainlink .env.local
```

Key variables you need:

```bash
# For development (mock data)
VITE_ENVIRONMENT=development
VITE_USE_CHAINLINK_ORACLE=false
VITE_MOCK_ONLY=true

# For production (Chainlink)
VITE_CHAINLINK_SUBSCRIPTION_ID=<your_subscription_id>
VITE_CHAINLINK_DON_ID=fun-solana-devnet-1
VITE_CHAIN=solana
```

## Step 2: Update Package.json

Add sports data utilities to your imports:

```json
{
  "dependencies": {
    "vitest": "^0.34.0"
  },
  "scripts": {
    "test:sportsdata": "vitest run sportsdata/__tests__",
    "test:integration": "vitest run sportsdata/__tests__/integration.test.ts"
  }
}
```

## Step 3: Integrate into Match Component

### Before (Using Supabase directly)

```typescript
// src/components/MatchCard.tsx
import { useMatchData } from '@/hooks/useMatchData';

export function MatchCard({ matchId }: { matchId: string }) {
  const { match, loading } = useMatchData(matchId);

  return (
    <div>
      <h2>{match?.homeTeam} vs {match?.awayTeam}</h2>
      {/* Odds from somewhere */}
    </div>
  );
}
```

### After (With sports data module)

```typescript
import { useMatchData } from '@/hooks/useMatchData';
import { useEffect, useState } from 'react';
import { createSportsDataProvider } from '@/sportsdata';
import type { OddsSnapshot } from '@/sportsdata';

export function MatchCard({ matchId }: { matchId: string }) {
  const { match, loading } = useMatchData(matchId);
  const [odds, setOdds] = useState<OddsSnapshot | null>(null);
  const [provider] = useState(() => createSportsDataProvider('development'));

  useEffect(() => {
    // Get odds from sports data module
    provider.getOdds(matchId).then(setOdds);

    // Subscribe to live updates
    const unsubscribe = provider.subscribeToLiveOdds(matchId, setOdds);
    return unsubscribe;
  }, [matchId, provider]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="match-card">
      <h2>{match?.homeTeam} vs {match?.awayTeam}</h2>

      {odds && (
        <div className="odds">
          <div className="odds-item">
            <span>Home Win</span>
            <strong>{odds.odds.homeWin}</strong>
          </div>
          <div className="odds-item">
            <span>Draw</span>
            <strong>{odds.odds.draw}</strong>
          </div>
          <div className="odds-item">
            <span>Away Win</span>
            <strong>{odds.odds.awayWin}</strong>
          </div>
          <small>Source: {odds.source}</small>
        </div>
      )}
    </div>
  );
}
```

## Step 4: Update Betting Hook

### Before (Manual odds management)

```typescript
// src/hooks/useBetting.ts
export function useBetting(wallet: string | null) {
  const [odds, setOdds] = useState(null);

  const placeManualBet = async (
    matchId: string,
    outcome: string,
    amount: number,
  ) => {
    // Odds passed manually, no validation
    const tx = await services.betting.placeBet(matchId, outcome, amount);
    return tx;
  };

  return { odds, placeManualBet };
}
```

### After (With sports data validation)

```typescript
import { useCallback } from "react";
import { validateOdds, oddsToBlockchainFormat } from "@/sportsdata";
import type { OddsSnapshot } from "@/sportsdata";

export function useBetting(wallet: string | null) {
  const placeBet = useCallback(
    async (
      matchId: string,
      odds: OddsSnapshot,
      outcome: string,
      amount: number,
    ) => {
      // 1. Validate odds are legitimate
      if (!validateOdds(odds)) {
        throw new Error("Odds validation failed");
      }

      // 2. Check odds are not stale (older than 5 minutes)
      const maxAge = 300; // 5 minutes
      const now = Math.floor(Date.now() / 1000);
      if (now - odds.timestamp > maxAge) {
        throw new Error("Odds are too old, refreshing...");
      }

      // 3. Convert to blockchain format
      const blockchainOdds = oddsToBlockchainFormat(odds.odds[outcome]);

      // 4. Place bet with validated odds
      const tx = await services.betting.placeBet({
        matchId,
        outcome,
        amount,
        oddsSnapshot: odds,
        blockchainOdds,
      });

      return tx;
    },
    [],
  );

  return { placeBet };
}
```

## Step 5: Wire Up Betting Bot (Optional)

### For Development Only

```typescript
// src/pages/AdminPanel.tsx
import { BettingBotControls } from '@/components/BettingBotControls';

export function AdminPanel() {
  return (
    <div className="admin-panel">
      <h1>Betting Bot Controls</h1>
      <BettingBotControls
        minOdds={1.5}
        maxOdds={10}
        maxBetSize={5}
        onStateChange={(state) => {
          console.log('Bot state:', state);
          // Log to monitoring service
        }}
      />
    </div>
  );
}
```

### For Production (Disabled by default)

```typescript
// src/hooks/useBettingBot.ts - Already disabled in production
// Set VITE_BOT_ENABLED=false in .env.local
```

## Step 6: Update Services

### Contract Service Integration

```typescript
// src/services/matchContract.ts
import { ChainlinkOracleClient, createOracleConfigFromEnv } from '@/sportsdata';
import type { OddsSnapshot } from '@/sportsdata';

export class MatchContractService {
  private oracle: ChainlinkOracleClient;

  constructor() {
    this.oracle = new ChainlinkOracleClient(createOracleConfigFromEnv());
  }

  async settleBet(match: Match, oddsSnapshot: OddsSnapshot) {
    // Request outcome from oracle
    const vrfResult = await this.oracle.requestVRFRandomness();

    // Call settlement function with VRF proof
    const tx = await program.methods.settleBet(
      match.id,
      oddsSnapshot.id,
      vrfResult.randomWord
    )
      .accounts({...})
      .rpc();

    return tx;
  }

  async verifyOdds(odds: OddsSnapshot) {
    return this.oracle.verifyOracleResponse(odds, 3);
  }
}
```

## Step 7: Add Error Handling

```typescript
// Create a wrapper for safe odds operations
import { useState } from "react";
import { isOddsStale } from "@/sportsdata";
import type { OddsSnapshot } from "@/sportsdata";

export function useOddsSafely(initialOdds: OddsSnapshot | null) {
  const [odds, setOdds] = useState(initialOdds);
  const [error, setError] = useState<string | null>(null);

  const updateOdds = (newOdds: OddsSnapshot) => {
    try {
      if (isOddsStale(newOdds, 300)) {
        throw new Error("Odds are too old");
      }
      setOdds(newOdds);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  return { odds, error, updateOdds };
}
```

## Step 8: Add Tests

### Test Your Integration

```typescript
// src/hooks/__tests__/useBetting.test.ts
import { renderHook, act } from "@testing-library/react";
import { useBetting } from "../useBetting";
import { MockSportsDataProvider } from "@/sportsdata";

describe("useBetting with sports data", () => {
  it("should validate odds before placing bet", async () => {
    const { result } = renderHook(() => useBetting("test_wallet"));
    const provider = new MockSportsDataProvider();

    const odds = await provider.getOdds("match_001");

    await act(async () => {
      const tx = await result.current.placeBet(
        "match_001",
        odds,
        "homeWin",
        100,
      );
      expect(tx).toBeDefined();
    });
  });

  it("should reject stale odds", async () => {
    const { result } = renderHook(() => useBetting("test_wallet"));

    const staleOdds = {
      id: "stale",
      matchId: "match_001",
      timestamp: Math.floor(Date.now() / 1000) - 400,
      source: "MOCK" as const,
      odds: {
        homeWin: "2.50",
        draw: "3.00",
        awayWin: "2.80",
      },
    };

    await act(async () => {
      try {
        await result.current.placeBet("match_001", staleOdds, "homeWin", 100);
        fail("Should have thrown error");
      } catch (err) {
        expect(err.message).toContain("too old");
      }
    });
  });
});
```

## Step 9: Monitoring & Logging

```typescript
// src/lib/oracleMonitoring.ts
import { ChainlinkOracleClient } from "@/sportsdata";
import type { OddsSnapshot } from "@/sportsdata";

export class OracleMonitor {
  private oracle: ChainlinkOracleClient;
  private metrics = {
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    avgLatency: 0,
  };

  constructor(oracle: ChainlinkOracleClient) {
    this.oracle = oracle;
  }

  async trackOddsRequest(matchId: string) {
    const startTime = Date.now();
    this.metrics.requestCount++;

    try {
      const odds = await this.oracle.requestOddsData(matchId);
      const latency = Date.now() - startTime;

      this.metrics.successCount++;
      this.metrics.avgLatency =
        (this.metrics.avgLatency * (this.metrics.requestCount - 1) + latency) /
        this.metrics.requestCount;

      console.log(`Oracle request succeeded in ${latency}ms`);
      return odds;
    } catch (err) {
      this.metrics.failureCount++;
      console.error(`Oracle request failed:`, err);
      throw err;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.successCount / this.metrics.requestCount,
    };
  }
}
```

## Troubleshooting

### "Odds validation failed"

**Cause**: Odds are outside acceptable ranges  
**Fix**: Check `validateOdds()` constraints in `sportsdata/utils/oddsUtils.ts`

### "Odds are too old"

**Cause**: Odds timestamp is more than 5 minutes old  
**Fix**: Call `provider.subscribeToLiveOdds()` to get fresh updates

### "Oracle not responding"

**Cause**: Chainlink Functions not available or network issue  
**Fix**:

1. Check `VITE_CHAINLINK_SUBSCRIPTION_ID` is set
2. Verify Chainlink subscription has balance
3. Check network connectivity
4. Fall back to mock data in development

### "VRF randomness failed"

**Cause**: VRF callback not verified  
**Fix**:

1. Ensure Chainlink VRF subscription is funded
2. Verify smart contract expects correct VRF format
3. Check block confirmations are sufficient (3+)

## Checklist

- [ ] Environment variables configured
- [ ] Package imports working
- [ ] Match component shows odds from sports data module
- [ ] Betting hook validates odds
- [ ] Oracle client initialized
- [ ] Error handling in place
- [ ] Tests passing
- [ ] Bot controls available (dev only)
- [ ] Monitoring/logging configured
- [ ] Documentation updated

## Next Steps

1. Run `npm run test:sportsdata` to verify integration
2. Test with mock data in development
3. Try placing test bets without real funds
4. Monitor oracle responses (check logs)
5. Load test with multiple concurrent bets
6. When ready, enable Chainlink and deploy to testnet

## Support

Check these files for reference implementations:

- [Sportsdata Module README](../sportsdata/README.md)
- [Solana-Chainlink Architecture](./SOLANA_CHAINLINK_ARCHITECTURE.md)
- [Environment Configuration](../.env.example.chainlink)
- [Integration Tests](../sportsdata/__tests__/integration.test.ts)
