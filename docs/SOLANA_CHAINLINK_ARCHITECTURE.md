# Solana-Chainlink Integration Architecture

Complete architecture for goal.live betting protocol on Solana with Chainlink oracle integration.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        goal.live Protocol                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐        ┌──────────────────┐                │
│  │   Web Frontend   │        │  Betting Bot     │                │
│  │  (React + Vite)  │        │  (TypeScript)    │                │
│  └────────┬─────────┘        └────────┬─────────┘                │
│           │                           │                          │
│           └──────────────┬────────────┘                          │
│                          │                                       │
│                  ┌───────▼────────┐                             │
│                  │  Sportsdata    │                             │
│                  │  Module        │                             │
│                  │  - Types       │                             │
│                  │  - Mock Data   │                             │
│                  │  - Oracle      │                             │
│                  │  - Utils       │                             │
│                  └───────┬────────┘                             │
│                          │                                       │
│        ┌─────────────────┼─────────────────┐                    │
│        │                 │                 │                    │
│  ┌─────▼────┐    ┌──────▼──────┐    ┌────▼─────┐               │
│  │   Match  │    │    Odds     │    │ Chainlink │               │
│  │   Data   │    │   Updates   │    │  Oracle  │               │
│  △         │    │             │    │ Requests │               │
│  │   USD   │    │   USDC/Pool │    │  (VRF)   │               │
│  │         │    │   Ratios    │    │          │               │
│  └─────────┘    └─────────────┘    └────┬─────┘               │
│                                          │                      │
└──────────────────────────────────────────┼──────────────────────┘
                                           │
                        ┌──────────────────▼─────────────────┐
                        │   Chainlink Functions (DON)        │
                        │   - Sports Data Aggregation        │
                        │   - Match Outcome Resolution       │
                        │   - Off-chain Computation          │
                        └──────────────────┬─────────────────┘
                                           │
                        ┌──────────────────▼─────────────────┐
                        │   Chainlink VRF                    │
                        │   - Randomness for Settlement      │
                        │   - Bet Position Selection         │
                        │   - Provably Fair Distribution     │
                        └──────────────────┬─────────────────┘
                                           │
                        ┌──────────────────▼─────────────────┐
                        │   Solana Blockchain                │
                        ├──────────────────────────────────┤
                        │  ┌──────────────────────────────┐ │
                        │  │   GoalLiveBetting Program    │ │
                        │  │   - poolAccount              │ │
                        │  │   - betAccount               │ │
                        │  │   - settlerAccount           │ │
                        │  │   - oraclacle Account         │ │
                        │  └──────────────────────────────┘ │
                        │                                    │
                        │  ┌──────────────────────────────┐ │
                        │  │   Token Accounts (USDC)      │ │
                        │  │   - Bet Pools                │ │
                        │  │   - User Escrow              │ │
                        │  │   - Protocol Treasury        │ │
                        │  └──────────────────────────────┘ │
                        └──────────────────────────────────┘
```

## Data Flow

### 1. Match Data Pipeline

```
External Data Source → Sportsdata Module → Mock/Oracle → State Update
      ↓                      ↓                  ↓            ↓
  Live Match Info    Type Validation     Chainlink    Betting Front-end
  (Score, Status)    Odds Calculation    Functions    (Real-time Odds)
```

**Sequence:**

1. `dataService.getMatch()` → Fetches from Supabase
2. `dataService.getMatchWinnerOdds()` → Calculates odds from pool ratios
3. `subscribeToMatch()` → Realtime updates via Supabase Realtime
4. If odds stale → `oracle.requestOddsData()` → Chainlink Functions
5. Update component state → UI re-renders with new odds

### 2. Betting Flow

```
User Action → Validation → Smart Contract → Pool Update → Settlement
     ↓             ↓              ↓              ↓              ↓
Place Bet    Check Funds    Lock Position   Emit Event    Calculate
Pick Outcome Verify Odds                (Supabase polls) Payout
Choose Amount Calculate Fee              Watch Chain
```

**Contract Interaction:**

```solidity
// JavaScript/TypeScript
await program.methods
  .placeBet(betAmount, outcome)
  .accounts({
    bettor: wallet.publicKey,
    pool: poolAccount,
    betAccount: betsAccount,
    mint: USDC_MINT,
    systemProgram: SystemProgram.programId,
  })
  .signers([wallet])
  .rpc();
```

### 3. Settlement Flow with Chainlink VRF

```
Match Ends → Request Verification → Chainlink VRF → Smart Contract
    ↓              ↓                    ↓                ↓
Final Score  Chainlink Functions   Random Number   Distribute Funds
(from Oracle) Process Outcome      Weighted         (Winners get payout)
             Return Result         Selection        Emit Settlement Event
```

## Module Breakdown

### A. Sportsdata Module (`src/sportsdata/`)

Handles all sports data operations, abstracted from blockchain.

#### Types (`types/sports.ts`)

```typescript
interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: number; // Unix timestamp
  status: MatchStatus;
  score?: { home: number; away: number };
}

interface OddsSnapshot {
  id: string;
  matchId: string;
  timestamp: number;
  source: "CHAINLINK" | "MOCK" | "EXTERNAL";
  odds: {
    homeWin: string; // Decimal string
    draw: string;
    awayWin: string;
  };
  vrfRequestId?: string;
  confirmations?: number;
}
```

#### Mock Provider (`mock/MockSportsDataProvider.ts`)

Simulates real data for development/testing:

```typescript
const provider = createSportsDataProvider("development");

// Get match data
const matches = await provider.getUpcomingMatches(5);

// Get live odds with subscriptions
const unsubscribe = provider.subscribeToLiveOdds("match_001", (newOdds) => {
  console.log("Odds updated:", newOdds.odds);
  // Update UI or state
});

// Clean up
unsubscribe();
```

#### Utilities (`utils/oddsUtils.ts`)

Odds calculations and conversions:

```typescript
// Validation
validateOdds(odds); // Check odds are within valid ranges

// Conversions for blockchain
const blockchainValue = oddsToBlockchainFormat("2.50"); // → '2500000'
const decimalOdds = blockchainFormatToOdds(blockchainValue); // → '2.5000'

// Analytics
const probability = oddsToImpliedProbability("2.50"); // → 0.4
const moneyline = oddsToMoneyline("2.50"); // → +150

// Payout calculations
const payout = calculatePayout("2.50", 100); // → 250
const profit = calculateProfit("2.50", 100); // → 150
```

#### Chainlink Oracle (`integration/ChainlinkOracleClient.ts`)

Direct interface to Chainlink Functions and VRF:

```typescript
const oracle = new ChainlinkOracleClient(createOracleConfigFromEnv());

// Request odds from oracle
const oddsData = await oracle.requestOddsData("match_001", "PL");

// Request randomness for settlement
const { requestId, randomWord } = await oracle.requestVRFRandomness();

// Verify oracle response
const isValid = oracle.verifyOracleResponse(oddsData, 3); // 3 confirmations
```

### B. Betting Bot (`src/hooks/`)

Orchestrates automated betting logic:

#### BettingBotManager

```typescript
const bot = createBettingBot({
  maxBetSize: 5, // USDC
  minOddsThreshold: 1.5,
  maxOddsThreshold: 10,
  refreshIntervalMs: 10000,
  useChainlinkOracle: false, // Set true in production
});

await bot.start();
// ... bot runs, monitors odds, places bets
bot.stop();
```

#### useBettingBot Hook

```typescript
const { state, isRunning, start, stop } = useBettingBot({
  maxBetSize: 5,
});

return (
  <>
    {isRunning ? 'Bot running' : 'Bot stopped'}
    <button onClick={start}>Start</button>
    <button onClick={stop}>Stop</button>
  </>
);
```

### C. Smart Contract (`contracts/GoalLiveBetting.sol`)

Solana program handling bet escrow and settlement:

```rust
// Key accounts
pub struct Pool {
    pub match_id: String,       // Match identifier
    pub home_amount: u64,       // Total wagered on home
    pub draw_amount: u64,       // Total wagered on draw
    pub away_amount: u64,       // Total wagered on away
    pub total_wagered: u64,     // Sum of all bets
    pub settled: bool,          // Has match been settled?
    pub winning_outcome: u8,    // 0=home, 1=draw, 2=away
}

pub struct Bet {
    pub pool: Pubkey,           // Which pool
    pub bettor: Pubkey,         // Who bet
    pub amount: u64,            // Bet amount
    pub outcome: u8,            // 0=home, 1=draw, 2=away
    pub timestamp: i64,         // When placed
    pub settled: bool,          // Has this bet been paid?
}
```

## Integration Points

### Frontend Integration

```typescript
// In your betting component
import { useBettingBot } from '@/hooks/useBettingBot';
import { BettingBotControls } from '@/components/BettingBotControls';

function BettingUI() {
  const { state, isRunning, start, stop } = useBettingBot();

  return (
    <div>
      <BettingBotControls
        minOdds={1.5}
        maxOdds={10}
        maxBetSize={5}
        onStateChange={(state) => console.log('Bot state:', state)}
      />
      {state?.currentMatch && (
        <MatchCard match={state.currentMatch} odds={state.currentOdds} />
      )}
    </div>
  );
}
```

### Smart Contract Integration

```typescript
// In your contract service
import { BettingBotManager } from '@/hooks/BettingBotManager';

class ContractService {
  async placeBet(match: Match, odds: OddsSnapshot, amount: number) {
    // 1. Validate odds from oracle
    if (!oracle.verifyOracleResponse(odds, 3)) {
      throw new Error('Odds not verified by oracle');
    }

    // 2. Convert odds to blockchain format
    const blockchainOdds = oddsToBlockchainFormat(odds.odds.homeWin);

    // 3. Call smart contract
    const tx = await program.methods.placeBet(
      new BN(amount),
      new BN(blockchainOdds),
      match.id
    )
      .accounts({...})
      .rpc();

    return tx;
  }
}
```

### Real-time Updates

```typescript
// Realtime subscription for match updates
const unsub = dataService.subscribeToMatch(matchId, {
  onOddsUpdate: (players, mwOdds) => {
    // Odds have changed
    // Re-evaluate betting conditions
    if (shouldPlaceBet(match, mwOdds)) {
      bot.executeBet(match, mwOdds);
    }
  },
  onMinuteTick: (minute) => {
    // Match time advanced
    // Update UI
  },
  onGoal: (team) => {
    // Goal scored
    // Recalculate odds
  },
});

// Cleanup
return () => unsub();
```

## Testing

### Unit Tests

```bash
npm run test:sportsdata
```

Tests individual utilities, mock provider, oracle client.

### Integration Tests

```bash
npm run test:integration
```

Tests full flow: match → odds → oracle → settlement.

### End-to-End Tests

```bash
npm run test:e2e
```

Tests with real Solana devnet and Chainlink testnet.

## Deployment Checklist

- [ ] Environment variables configured (see `.env.example.chainlink`)
- [ ] Chainlink Functions subscription created
- [ ] Chainlink VRF subscription created
- [ ] Solana program deployed
- [ ] Program ID updated in env vars
- [ ] USDC token initialized
- [ ] Pool accounts created
- [ ] Integration tests passing
- [ ] Odds validation working
- [ ] Oracle callbacks verified
- [ ] Bot disabled in production initially
- [ ] Monitoring/alerting configured

## Security Considerations

### Oracle Integrity

- ✅ Verify Chainlink Functions signatures
- ✅ Require minimum confirmations (3+)
- ✅ Validate odds are within acceptable ranges
- ✅ Check timestamp freshness (max 5 min old)
- ✅ Rate-limit oracle requests

### Bet Validation

- ✅ Verify bet signature from user
- ✅ Check sufficient balance locked
- ✅ Validate bet placed before match start
- ✅ Prevent same bet placed twice
- ✅ Lock funds in escrow until settlement

### Settlement

- ✅ Require oracle confirmation of outcome
- ✅ Use Chainlink VRF for fair randomness
- ✅ Distribute funds atomically
- ✅ Log all settlements for audit

## Performance Targets

| Metric              | Target | Current    |
| ------------------- | ------ | ---------- |
| Odds update latency | <1s    | <1s (mock) |
| Oracle callback     | <30s   | TBD        |
| Bet placement       | <2s    | <2s        |
| Settlement          | <60s   | TBD        |
| Bot decision loop   | 10s    | 10s        |

## Monitoring

### Key Metrics to Track

```typescript
// Oracle performance
- Request latency (time to receive callback)
- Success rate (fulfilled vs failed)
- Gas cost per callback
- Confirmation time

// Betting activity
- Bets per minute
- Avg bet size
- Win rate by market
- Pool depth over time

// Bot performance
- Bets placed per session
- Win/loss ratio
- ROI per match
```

## Next Steps

1. **Deploy Solana Program** → Register on Devnet
2. **Create Chainlink Subscription** → Get subscription ID
3. **Run Integration Tests** → Verify end-to-end flow
4. **Enable Bot in Development** → Real testnet bets
5. **Load Test** → 100+ concurrent bets
6. **Security Audit** → Code review + formal audit
7. **Mainnet Deployment** → Go live

## References

- [Chainlink Functions Docs](https://docs.chain.link/chainlink-functions)
- [Chainlink VRF Docs](https://docs.chain.link/vrf)
- [Solana Program Examples](https://github.com/solana-labs/solana-program-library)
- [goal.live Smart Contract](../contracts/GoalLiveBetting.sol)
- [Sports Data Module README](./sportsdata/README.md)
