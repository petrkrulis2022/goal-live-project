---
name: cre-blockchain-architecture
description: "**CRE-Blockchain Architecture Skill** — Design, document, and explain Chainlink Functions (CRE) automated workflows integrated with smart contracts, databases, and frontends. USE FOR: creating complete CRE application architecture docs; explaining HTTP trigger polling patterns; documenting Log trigger event-driven resolution; designing atomic settlement systems; mapping user journeys through blockchain automation; explaining data flows from external APIs through contracts to UI. DO NOT USE FOR: general smart contract coding; Solidity syntax validation; basic blockchain questions; non-CRE automation patterns. PRODUCES: architecture diagrams, phase-by-phase flows, trigger patterns, resolution logic, user journey docs, data flow visualizations."
---

# CRE-Blockchain Architecture Documentation

## When to Use This Skill

Use this skill when:

- ✅ Designing a new blockchain app with Chainlink Functions automation
- ✅ Documenting HTTP triggers that poll external APIs (odds, scores, stats)
- ✅ Explaining Log triggers that react to contract events
- ✅ Designing atomic settlement/resolution systems (batch P&L calculation, etc.)
- ✅ Creating complete user journey documentation through an automated workflow
- ✅ Explaining real data flows (no mocking/simulation) from API → contract → database → UI
- ✅ Documenting multi-phase applications (pre-match → live → settlement → resolution)
- ✅ Creating safety/idempotency documentation for automated systems
- ✅ Explaining when events are emitted once vs multiple times (and how to handle both)

Do NOT use for:

- ❌ Writing Solidity code itself
- ❌ Debugging gas issues
- ❌ General blockchain tutorials
- ❌ Non-CRE automation (use Automation Keeper, standard webhooks, etc.)
- ❌ Frontend component implementation details

---

## Workflow: CRE-Blockchain Architecture Documentation

### Phase 1: Understand the Application

**Clarify these questions:**

1. **Application Type**: What does the app do? (e.g., "Sports betting prediction market", "DAO governance", "Insurance settlement")

2. **CRE Jobs**: How many HTTP triggers? How many Log triggers?
   - HTTP triggers: Periodic polling (e.g., every 15 seconds for live odds)
   - Log triggers: Event-driven reactions (e.g., when settlement event fires)

3. **Real vs Simulated**: Is data real or mocked?
   - Real: "Fetch from The Odds API, Goalserve, ESPN"
   - Simulated: "Use mock data for demo"

4. **Key Timelines**: What are the main phases?
   - Pre-phase? (e.g., pre-match odds capture)
   - Active phase? (e.g., live match polling)
   - Settlement phase? (e.g., final match settlement)
   - Resolution phase? (e.g., automatic user P&L calculation)

5. **Users & Positions**: What do users do?
   - Place bets/positions?
   - View live updates?
   - See automatic settlement?

### Phase 2: Design the Architecture

**Create these components:**

1. **Architecture Diagram**

   ```
   External APIs → CRE Jobs → Smart Contract → Supabase → Frontend
   ```

   Show all data sources and flow directions.

2. **Job Specifications**
   - Job name, trigger type (HTTP or Log), schedule/event
   - What data it fetches
   - What contract function it calls
   - What gets stored in database
   - Example execution time

3. **Smart Contract State**
   - Main structs (Match, Position, etc.)
   - State variables (mappings, storage)
   - Key functions (createMatch, settleMatch, resolvePosition)
   - Events emitted

4. **Database Schema**
   - Tables (matches, user_positions, live_odds, payouts)
   - What triggers update each table
   - Timing of inserts/updates

5. **Frontend Integration**
   - What the user sees at each phase
   - Real-time update frequency
   - When results appear (immediately after resolution)

### Phase 3: Document Each Phase

**For each phase (pre, active, settlement, resolution):**

1. **Timeline Label** (T=0, T-60min, T+90min, etc.)

2. **What Happens**
   - Which CRE jobs fire?
   - What external APIs are called?
   - What contract functions are called?
   - What data flows where?

3. **Data Example** (Real values)

   ```json
   {
     "score": { "home": 2, "away": 1 },
     "odds": { "home": 1.25, "draw": 7.5, "away": 25.0 }
   }
   ```

4. **Job Execution Detail**

   ```
   Job#X fires (trigger type: HTTP/Log)
   ├─ Query: ...
   ├─ Fetch: API call to ...
   ├─ Contract call: ...()
   └─ Result: ...
   ```

5. **Duration** (e.g., "~5 seconds", "240 times per 60-min match")

### Phase 4: Explain HTTP vs Log Triggers

**HTTP Triggers:**

- Schedule-based polling (e.g., "every 15 seconds")
- Fetch external data repeatedly
- Idempotent (safe to retry)
- Example: Poll live odds every 15 seconds

**Log Triggers:**

- Event-driven (fired by contract event)
- React to state changes (once per event)
- Access on-chain state directly
- Example: When MatchSettled event fires, auto-resolve all bets

**Create a comparison table:**
| Aspect | HTTP | Log |
|--------|------|-----|
| Trigger | Schedule | Event |
| Frequency | Recurring | Once per event |
| Data source | External API | On-chain |
| In goal.live | Jobs #1,#2,#3 | Job #4 |

### Phase 5: Document Resolution Logic

**Critical for systems with user settlements:**

1. **What triggers resolution?**
   - Event emission (e.g., MatchSettled)
   - Frequency: Once per match

2. **Resolution algorithm:**

   ```typescript
   For each user_position WHERE resolved=false:
   ├─ Determine: Does position WIN or LOSE?
   ├─ If WIN: payout = amountWagered × odds
   ├─ If LOSS: payout = 0
   ├─ Calculate: P&L = payout - amountWagered
   └─ Update: contract + database + balance
   ```

3. **Idempotency checks:**

   ```solidity
   require(!position.resolved, "Already resolved");
   // Prevents double-payment
   ```

4. **Edge cases:**
   - What if Log Trigger fires twice?
   - What if resolution partially fails?
   - Can users dispute outcomes?

5. **Timeline:**
   ```
   Match finishes
   ├─ Job #3 settles (5s)
   ├─ Contract emits event (instant)
   ├─ Log Trigger catches (1-2s)
   └─ All users resolved (2-3s)
   Total: ~10 seconds
   ```

### Phase 6: Document User Journey

**Follow one user from start to finish:**

1. **Pre-Phase** (what they see, what they can do)

   ```
   "User sees match with odds, clicks 'Place Bet'"
   ```

2. **Active Phase** (real-time updates)

   ```
   "User watches live score & odds update every 15 seconds"
   "Sees: 'Haaland already scored, first goalscorer market CLOSED'"
   ```

3. **Settlement Phase** (when finishes)

   ```
   "Match ends 3-1, HTTP Job #3 settles"
   ```

4. **Resolution Phase** (immediate result)
   ```
   "Log Trigger runs automatically"
   "User sees dashboard: 'WIN +$52 profit, balance now $2070'"
   "Can withdraw immediately"
   ```

### Phase 7: Create Safety Documentation

**Document these safeguards:**

1. **Immutability**
   - What's stored on-chain forever?
   - Why (auditability)?

2. **Idempotency**
   - Can position be resolved twice? NO (contract check)
   - Can match be settled twice? NO (contract check)
   - What happens if job retries?

3. **Race Conditions**
   - Can user place bet after settlement? (Should fail)
   - Can resolution start before settlement? (Should wait)

4. **Error Handling**
   - API timeout → Retry with backoff
   - Contract tx fails → Log and alert
   - Division by zero → Check in code

5. **Audit Trail**
   - All bets logged on-chain? YES
   - All P&L calculations logged? YES
   - User can verify their position? YES

---

## Output Template

When documenting a CRE application, produce:

1. **Architecture Diagram** (ASCII or visual)
   - Shows: APIs → CRE → Contract → DB → UI

2. **Job Specifications** (table or list)

   ```
   Job #1: Pre-Match Odds
   - Trigger: HTTP, schedule "0 * * * *"
   - Data: Odds from The Odds API
   - Contract: createMatch()
   - Frequency: Once per match
   ```

3. **Phase Documentation** (6 pages for 6 phases)
   - T=0 (Pre-match) → T-60min
   - T=Kickoff (Live) → Every 15s
   - T=+90min (Settlement) → Once
   - T=+90min+1s (Resolution) → Once
   - T=+90min+5s (Complete) → Done

4. **User Journey** (narrative + data)
   - "User places $100 bet on Haaland @ 1.52 odds"
   - "After match: WON, payout $152, profit +$52"
   - "Dashboard shows: Balance $2070 (was $1970)"

5. **HTTP vs Log Trigger Table**
   - When to use each
   - Frequency
   - Example in context

6. **Resolution Algorithm** (pseudocode or TypeScript)
   - Decision tree for WIN/LOSS
   - Payout calculation
   - Idempotency checks

7. **Safety Documentation**
   - Immutability guarantees
   - Double-spending prevention
   - Edge case handling

8. **Timeline Summary**
   ```
   T-60: Job #1 (pre-match) ← HTTP
   T=0: Job #2 starts (live polling) ← HTTP every 15s
   T+90: Job #3 (settlement) ← HTTP once
   T+91: Job #4 (resolution) ← Log Trigger once
   ```

---

## Quality Checklist

Before considering the documentation complete:

- [ ] **Architecture diagram** shows all data flows (APIs, CRE, contract, database, UI)
- [ ] **Every CRE job** documented: name, trigger type, schedule/event, what it does, execution time
- [ ] **Real data examples** provided (no mocking mentioned unless explicitly labeled as mock for demo)
- [ ] **User journey** complete: from placing first position through final withdrawal
- [ ] **HTTP vs Log triggers** explained in context of the application
- [ ] **Resolution logic** shows: WIN/LOSS conditions, payout calculation, P&L formula
- [ ] **Idempotency safeguards** documented: prevents double-settlement, double-payment
- [ ] **Timeline clear**: T-values show exactly when each job fires
- [ ] **Frequency stated**: how often does each job run? Once per match? Every 15 seconds?
- [ ] **Edge cases addressed**: What if event fires twice? What if API times out?

---

## Example Prompts to Use This Skill

1. **"Document the CRE workflow for our goal.live sports betting app"**
   - Produces: Complete architecture docs with 4 CRE jobs, HTTP + Log triggers

2. **"Create a user journey showing how a player's bet is resolved in goal.live"**
   - Produces: Step-by-step narrative from bet placement to P&L display

3. **"Explain how the Log Trigger automatically resolves all user positions after a match settles"**
   - Produces: Resolution algorithm, safety checks, idempotency explanation

4. **"Design CRE jobs for a new liquidation system"**
   - Produces: Job specs (HTTP for price polling, Log for trigger), settlement logic

5. **"Document the HTTP polling pattern for real-time odds"**
   - Produces: Schedule, data flow, frequency, contract updates, frontend refresh

---

## Related Skills to Create Next

Once this skill is used, consider creating:

1. **CRE Error Handling & Resilience**
   - Retry strategies, backoff patterns
   - Monitoring and alerting
   - Graceful degradation

2. **Smart Contract Security for Automated Systems**
   - Reentrancy protection with Log triggers
   - Rate limiting on settlement
   - Authorization patterns for CRE oracle

3. **Blockchain Data Analytics**
   - Querying on-chain settlement logs
   - Audit trail verification
   - User P&L reconciliation

4. **CRE Cost Optimization**
   - Batching multiple updates
   - Reducing RPC calls
   - Gas optimization strategies

---

## Key Insights from goal.live Example

Core patterns that apply to ANY CRE + blockchain app:

1. **Polling + Settlement Pattern**
   - HTTP jobs continuously update state
   - One settlement event triggers resolution
   - Efficient and doesn't miss data

2. **Atomic Batch Resolution**
   - Log Trigger processes ALL positions simultaneously
   - Single execution = no race conditions
   - All P&L calculated at once

3. **Real Data, Not Simulation**
   - Fetch from actual APIs (no mocking in production)
   - Makes system transparent and auditable
   - Users trust real data sources

4. **Immutability as Safety**
   - Every settlement logged on-chain
   - Cannot be changed after the fact
   - Users can verify their own positions

5. **Clear Phase Documentation**
   - Pre-phase (setup)
   - Active phase (polling)
   - Settlement phase (finalization)
   - Resolution phase (automatic P&L)
   - Each phase has clear trigger and duration

---

## References & External Documentation

### Official Chainlink Documentation

- **[Chainlink Functions (CRE) Overview](https://docs.chain.link/cre)**
  Main documentation hub for Chainlink Functions / Compute Request Engine

- **[Getting Started - Part 2: Fetching Data with TypeScript](https://docs.chain.link/cre/getting-started/part-2-fetching-data-ts)**
  Learn how to build HTTP trigger jobs that fetch data from external APIs

- **[Getting Started - Part 3: Reading On-Chain Values with TypeScript](https://docs.chain.link/cre/getting-started/part-3-reading-onchain-value-ts)**
  Learn how to read state from smart contracts in CRE jobs

- **[Getting Started - Part 4: Writing On-Chain with TypeScript](https://docs.chain.link/cre/getting-started/part-4-writing-onchain-ts)**
  Learn how to send transactions and update contract state from CRE jobs

### Learning Resources

- **[CRE Bootcamp 2026 - Complete Workflow](https://smartcontractkit.github.io/cre-bootcamp-2026/day-2/05-complete-workflow.html)**
  Comprehensive example of a complete CRE workflow with all job types and state management

- **[5 Ways to Build with CRE - AI-Powered Prediction Market Settlement](https://blog.chain.link/5-ways-to-build-with-cre/#3._ai-powered_prediction_market_settlement)**
  Blog post featuring prediction markets (like goal.live) as a key use case for CRE automation

---

_CRE-Blockchain Architecture Skill | March 6, 2026 | For designing automated settlement systems with Chainlink Functions_
