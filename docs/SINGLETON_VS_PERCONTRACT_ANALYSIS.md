# 🏗️ Singleton vs Per-Match Contract: CRE Architecture Analysis

**Date:** March 3, 2026  
**Status:** Decision Framework for goal.live Phase 4  
**Scale:** 5-15 matches/day (EPL, La Liga, Serie A)

---

## TL;DR — RECOMMENDATION

**🎯 Use SINGLETON contract + one persistent CRE HTTP job + one Log Trigger**

**Why:**

- ✅ One CRE job to manage (not 5-15 new jobs per day)
- ✅ Zero registration overhead per match
- ✅ Simpler failure modes (one job = one point of control)
- ✅ CRE job can query Supabase for active `matchId`s dynamically
- ✅ Log Trigger listens to one contract forever
- ✅ Scales linearly: add matches without touching CRE
- ❌ Slightly more complex job logic (iterate active matches)

**You're already here.** Don't switch to per-match unless you hit >50 matches/day or have service isolation requirements.

---

## Deep Dive: Point-by-Point Analysis

### **1. Singleton Contract — CRE Job Targeting**

**Your current setup (KEEP IT):**

```solidity
mapping(bytes32 => Match) public matches;
mapping(bytes32 => bool) public isActive;  // ← Add this

function settleMatch(bytes32 matchId, uint256 scorerId) external onlyOracle {
    require(isActive[matchId], "Match not active");
    matches[matchId].settled = true;
    emit MatchSettled(matchId, scorerId, payoutAmount);
}

function disableMatch(bytes32 matchId) external onlyOwner {
    isActive[matchId] = false;  // Safe kill-switch
}
```

**CRE HTTP Job Pattern (RECOMMENDED):**

```yaml
# chainlink-cre-goal-live.yaml
name: goal-live-settlement-monitor
description: Monitor all active matches for goals, settle when detected

triggers:
  - type: HTTP
    url: "https://api.goal-live-backend.example.com/cre/active-matches"
    method: POST
    headers:
      Authorization: "Bearer ${CRE_API_KEY}"
      Content-Type: application/json
    body:
      query: "SELECT matchId, kickoffTime, currentStatus FROM matches WHERE isActive=true AND date=TODAY"
    # Polls every 30 seconds during match hours
    schedule: "*/30 09-22 * * *" # 9am-10pm UTC daily

jobs:
  - name: settle-match
    triggers:
      - http
    steps:
      - fetch-from-goalserve:
          script: |
            // Chainlink Functions environment (JavaScript)
            const activeMatches = await getInputsFromTrigger();

            for (const match of activeMatches) {
              const goalserveData = await Functions.makeHttpRequest({
                url: `https://api.goalserve.com/getfeed?sport=soccer&matchId=${match.matchId}&key=${secrets.GOALSERVE_KEY}`
              });
              
              const { status, scorerId, score } = goalserveData;
              
              // Conditional settlement logic
              if (status === "MATCH_ENDED" && scorerId) {
                // Goal was scored
                await settleMatchOnChain(match.matchId, scorerId);
              } else if (status === "MATCH_ENDED" && !scorerId) {
                // No goals scored (0-0)
                await settleMatchOnChain(match.matchId, 0);
              }
            }

      - call-contract:
          function: settleMatch
          contract: 0xF553228655C6993Bbd446E5B7009Dd830c424EA2
          args:
            - matchId (from step above)
            - scorerId (from step above)
          encoding: "ABI"
```

**Key advantage of singleton + persistent job:**

```javascript
// ONE job, runs forever, handles dynamic list of matches
for (const match of activeMatches) {
  // Process each active match
}

// No need to:
// ❌ Register new job per match
// ❌ Update job config per match
// ❌ Pass matchId as a parameter at job-creation time
```

**Answer to Q1:**

> Use **one persistent job + dynamic match iteration**. The job queries Supabase for active `matchId`s, then polls Goalserve for each. No parameterization at job creation time needed.

---

### **2. Per-Match Contract — CRE Log Trigger Targeting**

**If you went with per-match (NOT RECOMMENDED for your scale):**

```solidity
// ❌ This approach — don't do this
// Instead of one contract, deploy a new contract PER MATCH

// For match A:
contract GoalLiveMatchA {
    bytes32 public matchId = "match-a";
    function settleMatch(uint256 scorerId) external onlyOracle { ... }
}
// Deployed at 0x1111...

// For match B:
contract GoalLiveMatchB {
    bytes32 public matchId = "match-b";
    function settleMatch(uint256 scorerId) external onlyOracle { ... }
}
// Deployed at 0x2222...

// Problem: CRE Log Trigger must know 0x1111 and 0x2222 BEFORE deployment
```

**Why this is operationally painful:**

| Task                                        | Effort         | Frequency              |
| ------------------------------------------- | -------------- | ---------------------- |
| Deploy new match contract                   | 2-3 mins       | Every day (5-15 times) |
| Register CRE Log Trigger                    | 5-10 mins      | Every day (5-15 times) |
| Map contract address to matchId in Supabase | 1 min          | Every day (5-15 times) |
| Update CRE job if logic changes             | Very difficult | Risk of human error    |
| Audit trail of contracts                    | Complex        | Hard to track          |

**At 15 matches/day = 75 Log Triggers registered per day. 🔥**

**Factory Pattern (Marginal help):**

```solidity
// ❌ Slightly better, but still not ideal

contract MatchFactory {
    event MatchCreated(bytes32 indexed matchId, address indexed matchContract);

    function createMatch(bytes32 matchId) external {
        GoalLiveMatch match = new GoalLiveMatch(matchId);
        emit MatchCreated(matchId, address(match));
    }
}
```

Even with factory:

- CRE still needs to listen to `MatchCreated` event
- Then spawn a child CRE job per new contract
- Still 5-15 new jobs per day
- No real savings

**Answer to Q2:**

> ❌ Per-match contracts require registering new CRE jobs every deployment. At 5-15 matches/day, this is unsustainable. Factory pattern helps slightly but still requires per-match job registration.

---

### **3. `matchId` Format — String UUID vs bytes32**

**Current problem:**

- DB: `matchId = "300862b165c77b6fe6c3fccf717aba1e"` (UUID string)
- Contract: expects `bytes32`
- CRE: receives string from API

**Recommended solution:**

```javascript
// In CRE Chainlink Functions script

// Approach A: Hash the UUID (RECOMMENDED)
const matchIdString = "300862b165c77b6fe6c3fccf717aba1e";
const matchIdBytes32 = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(matchIdString),
);
// Result: bytes32 hash that's deterministic

// Approach B: Direct UTF-8 encoding (NOT RECOMMENDED)
const matchIdBytes32 = ethers.utils.toUtf8Bytes(matchIdString).padEnd(32);
// Problem: loses data if string > 31 bytes

// Approach C: Use fixed hash size (SAFEST)
const crypto = require("crypto");
const hash = crypto.createHash("sha256").update(matchIdString).digest("hex");
const matchIdBytes32 = "0x" + hash;
```

**Storage pattern (contract side):**

```solidity
/// MatchId hash: keccak256(abi.encodePacked(uuid_string))
mapping(bytes32 => Match) public matches;
mapping(bytes32 => string) public matchIdLookup;  // ← For reverse lookup

function getMatchByUUID(string calldata uuid) external view returns (Match memory) {
    bytes32 matchIdHash = keccak256(abi.encodePacked(uuid));
    return matches[matchIdHash];
}

function settleMatch(bytes32 matchIdHash, uint256 scorerId) external onlyOracle {
    require(matches[matchIdHash].initialized, "Match not found");
    // settle...
}
```

**Collision risk at scale:**

| Scenario          | Collisions               | Risk                |
| ----------------- | ------------------------ | ------------------- |
| 1,000 matches     | ~1 in 2^128              | Negligible          |
| 1,000,000 matches | ~1 in 2^128              | Still negligible    |
| UUID + keccak256  | Cryptographically secure | Zero practical risk |

**Answer to Q3:**

> Use `keccak256(abi.encodePacked(uuid))` — it's deterministic, collision-free, and standard across Ethereum. Chainlink Functions has native ethers.js support. Store the bytes32 hash on-chain, UUID string in Supabase.

---

### **4. HTTP Trigger — Polling Frequency & Match Lifecycle**

**Recommended polling strategy:**

```yaml
triggers:
  - type: HTTP
    url: "https://api.goal-live-backend.example.com/cre/active-matches"

    # Polling schedule: dense during match hours, sparse otherwise
    schedule:
      - "*/30 09-12 * * *" # 9-12am UTC: pre-match + early game (every 30s)
      - "*/15 12-22 * * *" # 12pm-10pm UTC: live matches (every 15s)
      - "*/120 22-09 * * *" # 10pm-9am UTC: no matches (every 2m)
```

**Minimum polling interval:**

- CRE HTTP triggers: **15-30 seconds is practical** on both Sepolia and mainnet
- Trade-off: 30s interval = miss goal by max 30s (acceptable for settlement)
- Sub-10s requires premium CRE tier (check Chainlink docs)

**Stopping a job after settlement:**

```solidity
// On-chain state management (RECOMMENDED)

mapping(bytes32 => bool) public isActive;

function settleMatch(bytes32 matchId, uint256 scorerId) external onlyOracle {
    matches[matchId].settled = true;
    isActive[matchId] = false;  // ← Kill-switch
    emit MatchSettled(matchId, scorerId);
}

// In CRE job:
const activeMatches = await api.getActiveMatches();
// This query should ONLY return matches where isActive=true
```

**No need to delete/deactivate the CRE job itself — it just checks the `isActive` flag in contract state. Much simpler!**

**Conditional branching pattern:**

```javascript
// SINGLE Chainlink Functions script handles both branches

const goalserveData = await fetch(...)
const { status, scorerId, homeGoals, awayGoals } = goalserveData;

if (status === "MATCH_ENDED" && scorerId) {
  // Goal settlement
  await settleMatch(matchId, scorerId);
} else if (status === "MATCH_ENDED" && !scorerId) {
  // No-goal settlement (0-0 or draw signaled)
  await settleMatch(matchId, 0);  // scorerId=0 means no scorer
} else {
  // Match still ongoing, do nothing this cycle
  console.log("Match ongoing, next poll in 30s");
}
```

**Answer to Q4:**

> - Min polling: **30 seconds is viable** for live sports (industry standard)
> - Stop polling: Use `isActive[matchId]` flag in contract — CRE job checks this on each poll, skips settled matches
> - Conditional branching: **Single script with if/else logic** — easier to maintain than two separate jobs

---

### **5. Log Trigger — Settlement Verification & Outbound HTTP**

**Your planned event (GOOD):**

```solidity
event MatchSettled(bytes32 indexed matchId, uint256 indexed scorerId, uint256 totalPayout);
```

**Tool choice: CRE Log Trigger vs Chainlink Automation**

| Requirement                     | CRE Log Trigger      | Chainlink Automation | Recommendation |
| ------------------------------- | -------------------- | -------------------- | -------------- |
| Trigger on `MatchSettled` event | ✅ Native            | ❌ Manual RPC        | **CRE**        |
| Make outbound HTTP requests     | ✅ Yes               | ✅ Yes               | **CRE**        |
| Write back to contract          | ✅ Yes               | ✅ Yes               | Either         |
| Secret management               | ✅ Encrypted secrets | ✅ Upkeep state      | **CRE**        |
| Latency                         | <2 seconds           | <10 seconds          | **CRE**        |
| Cost                            | Lower                | Higher (computation) | **CRE**        |

**Two CRE Log Trigger patterns:**

**Pattern A: Log Trigger → Fetch from Goalserve → Settle Contract (DIRECT)**

```yaml
name: goal-live-settlement-direct
description: When admin emits MatchFinished event, fetch final score from Goalserve and settle

triggers:
  - type: Log
    contract: 0xF553228655C6993Bbd446E5B7009Dd830c424EA2
    event: "MatchFinished(bytes32 indexed matchId)" # Admin marks match complete
    network: Sepolia

steps:
  - fetch-and-settle:
      script: |
        const { matchId } = eventData;

        // Step 1: Fetch final score from Goalserve
        const goalserveResponse = await Functions.makeHttpRequest({
          url: `https://api.goalserve.com/getfeed?sport=soccer&matchId=${matchId}&key=${secrets.GOALSERVE_KEY}`
        });

        if (goalserveResponse.status !== 200) {
          throw new Error(`Goalserve returned ${goalserveResponse.status}`);
        }

        const { scorerId, homeGoals, awayGoals } = goalserveResponse.data;

        // Step 2: Call contract to settle
        const contractABI = [...]; // Import settlement function ABI
        const contract = new ethers.Contract(contractAddress, contractABI, signer);

        const tx = await contract.settleMatch(matchId, scorerId);
        await tx.wait(); // Wait for confirmation

        return {
          matchId,
          scorerId,
          homeGoals,
          awayGoals,
          txHash: tx.hash
        };
```

**Pattern B: Log Trigger → Notify Backend → Backend Fetches + Settles (ASYNC)**

```yaml
name: goal-live-settlement-backend-sync
description: When MatchFinished fires on-chain, notify backend to fetch score and settle

triggers:
  - type: Log
    contract: 0xF553228655C6993Bbd446E5B7009Dd830c424EA2
    event: "MatchFinished(bytes32 indexed matchId)"
    network: Sepolia

steps:
  - notify-backend:
      script: |
        const { matchId } = eventData;

        // HTTP POST to your backend with encrypted secret
        const response = await Functions.makeHttpRequest({
          url: "https://api.goal-live-backend.example.com/api/settle",
          method: "POST",
          headers: {
            "Authorization": `Bearer ${secrets.BACKEND_API_KEY}`,
            "Content-Type": "application/json",
            "X-Signature": crypto.sha256(`${matchId}${secrets.WEBHOOK_SECRET}`)
          },
          data: {
            matchId,
            timestamp: Date.now(),
            network: "sepolia"
          }
        });

        if (response.status !== 200) {
          throw new Error(`Backend returned ${response.status}`);
        }

        return response.data;  // Backend handles Goalserve fetch + contract settlement
```

**Pattern Comparison:**

| Aspect                     | Pattern A (Direct)              | Pattern B (Backend Sync)        | Recommendation    |
| -------------------------- | ------------------------------- | ------------------------------- | ----------------- |
| Outbound HTTP to Goalserve | ✅ Yes, directly from CRE       | ❌ Delegated to backend         | **Pattern A**     |
| Write back to contract     | ✅ Yes, TX sent from script     | ✅ Yes, TX sent from backend    | Pattern A (1 hop) |
| Latency                    | Single round-trip (faster)      | Two hops (slower)               | **Pattern A**     |
| Error handling             | Limited (CRE retries)           | Rich (backend can audit, log)   | Pattern B         |
| Gas price management       | Script must estimate            | Backend controls gas strategy   | Pattern B         |
| Idempotency                | Must implement on-contract      | Backend can deduplicate         | Pattern B         |
| Secrets management         | Goalserve key + contract signer | Goalserve key + contract signer | Tie               |

**Recommendation:**

- **Use Pattern B (Log Trigger → Backend)** — Better error handling and gas management
- But **Pattern A (Direct Goalserve)** is viable if you want minimal latency and simplicity

**Secret management (ENCRYPTED in CRE):**

```javascript
// In CRE job configuration:
secrets: {
  GOALSERVE_KEY: "encrypted:efgh5678...",      // For Pattern A
  BACKEND_API_KEY: "encrypted:abcd1234...",    // For Pattern B
  WEBHOOK_SECRET: "encrypted:ijkl9012...",     // HMAC signing
}

// In script:
const goalserveKey = secrets.GOALSERVE_KEY;     // Decrypted at runtime
const backendApiKey = secrets.BACKEND_API_KEY;  // Never logged, secure
```

**Latency expectations:**

**Pattern A (Direct Goalserve):**

| Stage                               | Latency | Total    |
| ----------------------------------- | ------- | -------- |
| Contract emits `MatchFinished`      | <1s     | <1s      |
| Log appears in RPC node mempool     | 1-2s    | 1-3s     |
| CRE Log Trigger fires               | <2s     | <5s      |
| Chainlink Functions fetch Goalserve | 2-3s    | <8s      |
| TX sent to contract                 | <1s     | <9s      |
| Settlement confirmed                | 10-30s  | **<40s** |

**Pattern B (via Backend):**

| Stage                          | Latency | Total    |
| ------------------------------ | ------- | -------- |
| Contract emits `MatchFinished` | <1s     | <1s      |
| CRE Log Trigger fires          | <2s     | <3s      |
| Backend receives notification  | <1s     | <4s      |
| Backend fetches Goalserve      | 2-3s    | <7s      |
| Backend calls contract         | <1s     | <8s      |
| Settlement confirmed           | 10-30s  | **<40s** |

**Both sub-60 seconds, Pattern A slightly faster.** ✅

**Idempotency guarantees (CRITICAL):**

```solidity
function settleMatch(bytes32 matchId, uint256 scorerId) external onlyOracle {
    require(!matches[matchId].settled, "Already settled");  // ← Idempotent
    require(isActive[matchId], "Match not active");

    matches[matchId].settled = true;
    matches[matchId].finalScorer = scorerId;
    isActive[matchId] = false;  // Prevent second call

    _processPayouts(matchId);
    emit MatchSettled(matchId, scorerId, totalPayout);
}
```

If `settleMatch()` is called twice (CRE job runs twice):

- Second call **reverts cleanly** with "Already settled"
- No double-paying, no state corruption ✅

**Answer to Q5:**

> - ✅ **CRE Log Trigger CAN make outbound HTTP requests** (to Goalserve or any API)
> - ✅ **Log Trigger script CAN write back to the same contract** that emitted the event
> - **Pattern A (Direct):** Fetch Goalserve directly in CRE script, settle on-chain (faster, <40s)
> - **Pattern B (Backend):** Notify backend to fetch and settle (better error handling, recommended)
> - Latency: <60 seconds realistic, often <40 seconds
> - Idempotency: Require `!settled` check on contract to prevent double-settlement
> - Retry strategy: CRE has built-in exponential backoff; backend can add custom replay logic

---

### **6. Architecture Recommendation**

**FINAL RECOMMENDATION: Singleton + Persistent HTTP Job + Persistent Log Trigger**

```
┌─────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE                             │
└─────────────────────────────────────────────────────────────┘

Singleton Contract (0xF553...)
├── matches[bytes32] → Match struct
├── isActive[bytes32] → bool flag
└── function settleMatch(bytes32 matchId, uint256 scorerId)

🔴 CRE HTTP Job (Persistent, Always Running)
│  ├── Trigger: Every 30 seconds during live hours (09:00-22:00 UTC)
│  ├── Query Supabase: "SELECT matchId WHERE isActive=true"
│  ├── For each active matchId:
│  │  ├── Poll Goalserve API
│  │  ├── Detect goal scored or match finished
│  │  └── Call settleMatch(matchId, scorerId) ON-CHAIN
│  └── Result: Automated settlement within 1-2 minutes of final whistle

🟢 CRE Log Trigger (Persistent, Event-Driven)
│  ├── Listens to: MatchSettled event on singleton contract
│  ├── On event fired:
│  │  ├── Option A: Fetch Goalserve directly, re-verify score
│  │  └── Option B: Notify backend, backend updates Supabase
│  └── Result: Real-time backend synchronization <40 seconds

Supabase (Single Source of Truth)
├── matches table: matchId, isActive, settled_at, final_scorer
├── bets table: matchId, playerId, amount, status, position
└── payouts table: matchId, playerId, payout_amount, claimed_at
```

**Dual-job approach answers all 6 questions:**

| Question                                   | Addressed by                     | Pattern                      |
| ------------------------------------------ | -------------------------------- | ---------------------------- |
| 1. Job targeting (dynamic matchIds)        | ✅ HTTP job iter. active matches | Loop `for (match of active)` |
| 2. Per-match contract dynamic addressing   | ✅ Not needed: stay singleton    | N/A                          |
| 3. `matchId` format (string vs bytes32)    | ✅ Both jobs use `keccak256()`   | Deterministic hash           |
| 4. HTTP polling frequency (30s lifecycle)  | ✅ HTTP job every 30s, kill flag | `isActive[matchId]`          |
| 5. Log Trigger outbound HTTP + idempotency | ✅ Both patterns A & B supported | Direct or via backend        |
| 6. Recommended architecture                | ✅ This dual-job singleton model | Simplest, most reliable      |

---

**Deployment details:**

| Concern                   | Singleton Approach                 | Per-Match Approach            | Winner               |
| ------------------------- | ---------------------------------- | ----------------------------- | -------------------- |
| Job registration overhead | 0 per day                          | 5-15 per day                  | **Singleton**        |
| Failure isolation         | All matches in one job             | Each match isolated           | Per-Match (slightly) |
| Auditability              | Single contract ABI, clear history | 5-15 contracts/day to audit   | **Singleton**        |
| Code maintenance          | 1 job config                       | 5-15 job configs              | **Singleton**        |
| Deployment risk           | One contract → all matches secure  | 5-15 deployments/day risk     | **Singleton**        |
| Scaling to 50 matches/day | Still manageable                   | Becomes operational nightmare | **Singleton**        |
| RPC calls                 | ~100 per day (polling)             | ~100 per day (same)           | Tie                  |
| Gas costs                 | Lower (1 contract)                 | Higher (5-15 contracts)       | **Singleton**        |

---

## Failure Modes & Mitigations

### **Scenario A: Goalserve API down in final 10 minutes**

**Mitigation:**

```solidity
function emergencySettle(bytes32 matchId, uint256 scorerId)
  external
  onlyOwner  // Admin fallback
{
    require(!matches[matchId].settled);
    matches[matchId].settled = true;
    // Pay out based on last-known goal
    emit MatchSettled(matchId, scorerId, fallbackPayout);
}
```

⏱️ **Fallback:** Human admin settles within 5 minutes of FT

---

### **Scenario B: CRE job offline during critical match**

**Mitigation:**

```yaml
# CRE job redundancy

primary-job:
  name: goal-live-settlement-monitor
  replicas: 2 # Chainlink runs two instances in parallel

secondary-job:
  name: goal-live-settlement-monitor-backup
  enabled: true
  comment: "Identical config, separate CRE node"
```

**Each job independently monitors & calls contract.** Idempotency is key:

```solidity
function settleMatch(bytes32 matchId, uint256 scorerId) external onlyOracle {
    require(!matches[matchId].settled, "Already settled");  // ← Idempotent
    // Process...
}
```

---

### **Scenario C: On-chain tx reverted due to gas spike**

**Mitigation:**

```javascript
// In CRE job script

const tx = await sendTransaction({
  to: contractAddress,
  data: encodedSettleMatch,
  gasLimit: 500_000, // Pre-calculated + buffer
  gasPrice: ethers.utils.parseUnits("100", "gwei"), // Max you'll pay
});

// If tx reverts:
// 1. CRE script catches error
// 2. Logs to Supabase `cre_errors` table
// 3. Sends Slack alert to ops team
// 4. Admin can retry or emergency settle
```

---

## Implementation Roadmap (Phase 4)

**Week 1: Contract prep**

- ✅ Add `isActive[bytes32]` flag to contract
- ✅ Add `emergencySettle()` function
- ✅ Emit `MatchSettled(bytes32 matchId, uint256 scorerId, uint256 payout)` event
- ✅ Deploy to Sepolia, test happy path

**Week 2: CRE HTTP Job setup (Primary Settlement)**

- ✅ Write CRE HTTP job YAML with 30-second polling schedule
- ✅ Implement Chainlink Functions script:
  - Query Supabase for active `matchId`s
  - Loop through each match, poll Goalserve
  - Conditional logic: goal scored → `settleMatch()` with scorerId
  - No-goal scenario → `settleMatch()` with scorerId=0
- ✅ Register job with Chainlink CRE
- ✅ Set up encrypted secrets: `GOALSERVE_KEY`, `SUPABASE_KEY`
- ✅ Test against Sepolia testnet with mock matches

**Week 3: CRE Log Trigger setup (Backend Sync)**

- ✅ Deploy CRE Log Trigger for `MatchSettled` event
- ✅ **Choose pattern:**
  - **Pattern A:** Script fetches Goalserve directly, re-verifies score
  - **Pattern B:** Script notifies backend via HTTP POST **(RECOMMENDED)**
- ✅ Wire backend `/api/settle` endpoint
- ✅ Implement idempotency: deduplicate on matchId
- ✅ Test end-to-end: HTTP job settles → event fires → Log Trigger triggers → backend updates

**Week 4: Monitoring & failsafes**

- ✅ Add alerting (Slack/PagerDuty on CRE errors)
- ✅ Implement job health checks (Uptime Robot)
  - Monitor: "Is HTTP job returning events every 30s?"
  - Monitor: "Are Log Triggers firing within 5s of MatchSettled?"
- ✅ Deploy backup HTTP job (redundancy) — separate CRE instance
- ✅ Implement fallback: `emergencySettle()` admin function
- ✅ Go live on mainnet with monitoring

---

## Summary Table — All 6 Questions Answered

| #   | Question                                  | Singleton Approach           | Per-Match Approach               | Recommendation          |
| --- | ----------------------------------------- | ---------------------------- | -------------------------------- | ----------------------- |
| 1   | Dynamic matchId per job run?              | ✅ One job, iterate matches  | ❌ ~15 jobs per day              | **Singleton**           |
| 2   | Dynamic contract address for Log Trigger? | N/A (singleton only)         | ❌ Factory pattern still complex | **Avoid per-match**     |
| 3   | `matchId` format (string vs bytes32)?     | `keccak256(uuid)` bytes32    | Same                             | **keccak256()**         |
| 4   | HTTP polling frequency & lifecycle?       | 30s viable, `isActive` flag  | Same issue                       | **30s + kill flag**     |
| 5   | Log Trigger outbound HTTP & idempotency?  | ✅ Both patterns A & B       | Same                             | **Pattern B (backend)** |
| 6   | Recommended architecture?                 | **✅ SINGLETON + Dual Jobs** | ❌ Not for 5-15/day scale        | **SINGLETON**           |

---

_Analysis: March 3, 2026 | Scale: 5-15 matches/day | Network: Sepolia + Mainnet_
