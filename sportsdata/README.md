# Sports Data Module

Sports data integration layer for Goal.Live betting platform. Handles odds data, match information, and Chainlink oracle integration.

## Structure

```
sportsdata/
├── types/           # TypeScript interfaces and enums
├── mock/            # Mock providers for development/testing
├── utils/           # Utility functions for odds calculations
├── integration/     # Chainlink oracle client
└── index.ts         # Module exports
```

## Quick Start

### Import the module

```typescript
import { createSportsDataProvider, MockSportsDataProvider } from "./sportsdata";
```

### Get upcoming matches

```typescript
const provider = createSportsDataProvider("development");
const upcomingMatches = await provider.getUpcomingMatches(10);

upcomingMatches.forEach((match) => {
  console.log(
    `${match.homeTeam} vs ${match.awayTeam} at ${new Date(match.startTime * 1000)}`,
  );
});
```

### Get live odds

```typescript
const odds = await provider.getOdds("match_001");
console.log(`Home Win: ${odds.odds.homeWin}`);
console.log(`Draw: ${odds.odds.draw}`);
console.log(`Away Win: ${odds.odds.awayWin}`);
```

### Subscribe to live odds updates

```typescript
const unsubscribe = provider.subscribeToLiveOdds("match_001", (newOdds) => {
  console.log("Odds updated:", newOdds.odds);
});

// Later, unsubscribe
unsubscribe();
```

## Utilities

### Odds Calculations

```typescript
import {
  oddsToImpliedProbability,
  oddsToMoneyline,
  calculatePayout,
  calculateProfit,
} from "./sportsdata";

const odds = "2.50";
const probability = oddsToImpliedProbability(odds); // 0.4 (40%)
const moneyline = oddsToMoneyline(odds); // +150
const payout = calculatePayout(odds, 100); // 250
const profit = calculateProfit(odds, 100); // 150
```

### Chainlink Oracle Integration

```typescript
import { ChainlinkOracleClient, createOracleConfigFromEnv } from "./sportsdata";

const config = createOracleConfigFromEnv();
const oracle = new ChainlinkOracleClient(config);

// Request odds from Chainlink Functions
const oddsData = await oracle.requestOddsData("match_001", "PL");

// Request VRF randomness
const { requestId, randomWord } = await oracle.requestVRFRandomness();

// Verify response
const isValid = oracle.verifyOracleResponse(oddsData, 3);
```

## Data Types

### Match

```typescript
interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  startTime: number; // Unix timestamp
  status: MatchStatus;
  score?: { home: number; away: number };
  odds?: OddsSnapshot;
}
```

### OddsSnapshot

```typescript
interface OddsSnapshot {
  id: string;
  matchId: string;
  timestamp: number;
  source: "CHAINLINK" | "MOCK" | "EXTERNAL";
  odds: {
    homeWin: string; // Decimal odds
    draw: string;
    awayWin: string;
  };
  vrfRequestId?: string;
  blockNumber?: number;
  confirmations?: number;
}
```

## Blockchain Integration

### Odds Precision

All odds are stored as strings to maintain precision. For blockchain operations, they're converted to fixed-point format:

```typescript
import { oddsToBlockchainFormat, blockchainFormatToOdds } from "./sportsdata";

const decimalOdds = "2.5";
const blockchainFormat = oddsToBlockchainFormat(decimalOdds); // '2500000'
const roundTrip = blockchainFormatToOdds(blockchainFormat); // '2.5000'
```

### Stale Data Detection

```typescript
import { isOddsStale } from "./sportsdata";

if (isOddsStale(odds, 300)) {
  // 5 minutes
  console.log("Odds are outdated, refresh needed");
}
```

## Environment Variables

For Chainlink integration:

```bash
CHAINLINK_ROUTER_ADDRESS=0x...
CHAINLINK_DON_ID=fun-solana-devnet-1
CHAINLINK_SUBSCRIPTION_ID=12345
CHAINLINK_GAS_LIMIT=200000
CHAINLINK_CALLBACK_FUNCTION=fulfillOddsRequest
```

## Development Notes

### Mock Provider Behavior

The `MockSportsDataProvider` simulates realistic data:

- Updates live match odds every 5 seconds
- Odds move within ±2% variance
- Includes realistic match schedules and scores
- Ready for UI development and testing

### Chainlink Integration (MVP Phase)

Current implementation includes:

- ✅ Type definitions for oracle data
- ✅ Mock oracle client for testing
- ✅ Gas estimation helpers
- ⏳ Real Chainlink Functions when testnet available
- ⏳ VRF integration for bet resolution

## Testing

```typescript
import { MockSportsDataProvider } from "./sportsdata";

const provider = new MockSportsDataProvider();

// Test odds retrieval
const odds = await provider.getOdds("match_001");
expect(odds).toBeDefined();

// Test live matches
const liveMatches = await provider.getLiveMatches();
expect(liveMatches.length).toBeGreaterThan(0);

// Clean up
provider.destroy();
```

## Next Steps

1. **Real API Integration**: Replace mock data with actual sports data API
2. **Chainlink Functions**: Deploy actual Functions for trustless odds fetching
3. **VRF Integration**: Implement bet resolution using Chainlink VRF
4. **Caching Layer**: Add Redis caching for improved performance
5. **Audit**: Security audit of oracle integration before mainnet
