# CRE Integration Questions: Singleton vs Per-Match Contract Architecture

**Context:** goal.live is a sports betting dApp on Sepolia. We have a single deployed `GoalLiveBetting.sol` contract that handles all matches via an internal `mapping(string => Match)` keyed by matchId (UUID string). We are integrating Chainlink Functions / CRE for automated oracle settlement.

---

## 1. Singleton CRE Job Targeting

**Situation:**  
We have one contract address (`0xF553228655C6993Bbd446E5B7009Dd830c424EA2`) but many concurrent matches (5–15/day). Each match is identified by a UUID string matchId.

**Questions:**
- With CRE HTTP Trigger jobs, can we pass a dynamic `matchId` parameter per job run, or does each job need to be hardcoded to a specific matchId?
- Is it possible to create one "template" CRE job and instantiate it multiple times with different parameters (one per match), all pointing to the same contract address?
- Or do we need a separate CRE job per match, each with its own matchId baked in?
- What is the recommended pattern for handling multiple concurrent matches with a single contract?

---

## 2. Per-Match Contract Log Trigger — Dynamic Address Problem

**Situation:**  
If we move to a per-match contract deployment model (one contract per match), the CRE Log Trigger needs to know which contract address to watch for a `MatchCreated` or `FundPool` event. But at job creation time, the contract isn't deployed yet.

**Questions:**
- Can a CRE Log Trigger job be configured to watch a "factory" contract's events (e.g., `MatchDeployed(address newMatch, string matchId)`), and then dynamically target the new contract address for subsequent actions?
- Is there a CRE pattern where a trigger fires on one address but the action targets a dynamically derived address?
- Or should we stick with the singleton pattern specifically to avoid this dynamic addressing problem?

---

## 3. matchId Format: UUID String vs bytes32

**Situation:**  
Our contract currently uses `string` as the matchId key (`mapping(string => Match)`). Chainlink Functions examples typically use `bytes32`. Our matchIds are Supabase UUIDs (e.g., `6e593d0a-c3ec-4364-8854-4f9f57bd15e4`).

**Questions:**
- Does CRE have strong opinions about matchId format? Is `bytes32` significantly more gas-efficient or better supported in CRE job configuration?
- If we convert to `bytes32`, should we use `keccak256(abi.encodePacked(uuid))` on-chain and `ethers.keccak256(ethers.toUtf8Bytes(uuid))` in JS? Any gotchas?
- Can CRE job parameters natively pass a `bytes32` value, or does it need to arrive as a hex string and be decoded in the Functions script?
- Is there a practical reason to stay with `string` for human-readability in contract events?

---

## 4. HTTP Trigger — Polling Frequency and Lifecycle

**Situation:**  
We intend to use an HTTP Trigger that polls the Goalserve/Odds API every 60 seconds to detect match status changes (live → finished). A typical match runs ~2 hours. We need the job to auto-deactivate after settlement.

**Questions:**
- What is the minimum and recommended polling interval for a CRE HTTP Trigger job on testnets vs mainnet?
- Can a Chainlink Functions script call `settleMatch()` on the contract AND then self-deactivate the job, or does deactivation have to be done externally?
- If the job keeps running after settlement (because auto-deactivate isn't available), what is the gas cost of a no-op run (script detects match is already settled and returns early)?
- Is there a job TTL (time-to-live) or scheduled end-time feature in CRE?
- How do we handle multiple concurrent matches without running 5–15 simultaneous HTTP polling jobs?

---

## 5. Log Trigger — Settlement Verification and Outbound HTTP

**Situation:**  
An alternative design: the contract emits a `MatchFinished(string matchId)` event when admin marks a match complete. A CRE Log Trigger fires, fetches the final score from Goalserve HTTP API, and calls `settleMatch(matchId, homeGoals, awayGoals)` on the contract.

**Questions:**
- Can a CRE Log Trigger job make an outbound HTTP request (to Goalserve API) as part of the triggered action? Or is HTTP access restricted to HTTP Trigger jobs only?
- After a Log Trigger fires and the Functions script runs, can the script write back to the same contract that emitted the log (call `settleMatch()`)?
- What is the expected latency between a contract event being emitted and the Log Trigger job executing on Sepolia testnet?
- Are there retry/idempotency guarantees — if `settleMatch()` is called twice for the same matchId, will the second call revert cleanly without double-paying bettors?

---

## 6. Architecture Recommendation

**Our current state:**
- ✅ Singleton contract, per-matchId accounting via `mapping(string => Match)`
- ✅ Contract funded via `fundPool(matchId, amount)` 
- ✅ Settlement via `settleMatch(matchId, homeGoals, awayGoals)` — currently manual (admin calls it)
- ✅ Emergency withdrawal per-match via `emergencyWithdrawPool(matchId)`
- ❌ CRE automation not yet wired up
- ❌ matchId format (string vs bytes32) not yet decided
- Target: 5–15 EPL matches per day, settling within 10 minutes of final whistle

**Questions:**
- Given this setup, would you recommend:
  a) **Singleton + HTTP Trigger per match** (one CRE job per match, all hitting same contract)
  b) **Singleton + one Log Trigger** (admin emits event, single CRE job fetches score + settles)
  c) **Per-match contracts + Log Trigger factory pattern**
  d) **Something else entirely**
- For option (a): is there a CRE job template/clone feature to avoid manually configuring 15 jobs per day?
- For option (b): is this the most gas-efficient and operationally simple path?
- What does a production-ready CRE job configuration look like for a "fetch score, call contract" use case? Can you share an example?
