# 🔍 CRE Integration Analysis: Key Confusion Points & Solutions

**Date:** February 27, 2026  
**Context:** Smart contract is real with exact function signatures; answers from CRE Copilot session  
**Status:** ✅ Decisions locked — see table below

## TL;DR — Decisions Locked

| Question                            | Answer                                                            | When      |
| ----------------------------------- | ----------------------------------------------------------------- | --------- |
| Oracle address for Sepolia deploy   | **Admin MetaMask address** — no Chainlink node needed yet         | TODAY     |
| Live odds on-chain?                 | ❌ **Frontend only** — Odds API → browser calc → never hits chain | Confirmed |
| How to show provisional balance     | Frontend polls Odds API every 30s, recalculates in browser        | TODAY     |
| Settlement trigger Phase 3          | Admin button click in EventDetail → Oracle tab                    | TODAY     |
| Settlement trigger Phase 4          | CRE Cron every 1 min → detects FT → calls `settleMatch()` auto    | MARCH     |
| Oracle Phase 4                      | `AutomationForwarder` — swap via `setOracle()`, **no redeploy**   | MARCH     |
| One job per match or parameterized? | One parameterised job — `{matchId}` substituted at runtime        | MARCH     |
| HTTP trigger for event creation?    | ❌ No — event creation is admin button click, not a CRE trigger   | Confirmed |

---

## The Core Confusion: Three Different Phases, Three Different Roles

You're mixing **Phase 3 (admin-manual settlement)** with **Phase 4 (CRE automation)**. Let me separate them:

### **Phase 3 TODAY (Manual Settlement) — Oracle = Your Admin Address**

```solidity
// GoalLiveBetting.sol
function settleMatch(
    string calldata matchId,
    uint256[] calldata scorerIds,
    MatchOutcome winner,
    uint8 homeGoals,
    uint8 awayGoals
) external onlyOracle;  // ← This requires msg.sender == oracle
```

**Right now:**

- Admin clicks "Settle Match" button in EventDetail page
- Edge Function calls `settleMatch()`
- `msg.sender` = admin's MetaMask address
- Admin's address is the "oracle" (the entity permitted to settle)
- **No Chainlink CRE involved yet**

**Set oracle to admin address:**

```solidity
// During deploy or via setOracle()
contract.setOracle(adminAddress)  // e.g., "0x1234..."
```

---

### **Phase 4 LATER (CRE Automation) — Oracle = Either CRE Node or Forwarder**

When you scale to automated settlement, Chainlink CRE workflow will call `settleMatch()`. But WHO signs the transaction?

**Option A: CRE Node EOA (Unstable)**

- CRE node has an EOA like `0xabcd...`
- Problem: Different nodes have different addresses
- Problem: If Chainlink rotates node operators, address changes
- **Not recommended for production**

**Option B: AutomationForwarder (Stable — RECOMMENDED)**

```solidity
// Deploy script:
IChainlinkAutomationForwarder forwarder =
  deployAutomationForwarder(registryAddress);
contract.setOracle(address(forwarder));  // Same forwarder on all networks
```

- Forwarder has a fixed address per network
- Chainlink's automation node calls through forwarder
- Forwarder's `fallback()` forwards calls to registered CRE job
- **Address stays stable even if node operator changes**

**For Phase 3→4 transition:**

```typescript
// Phase 3 (deploy)
await contract.setOracle(adminAddress);

// Phase 4 (later)
await contract.setOracle(automationForwarderAddress);
// ← No contract redeployment needed!
```

---

## Your Core Questions Addressed

### **Q1: "Why does CRE need a node oracle address?"**

**Answer:** Because `settleMatch()` is permissioned. The contract only accepts the settlement function call from ONE address:

```solidity
require(msg.sender == oracle);
```

Someone has to sign that transaction. In Phase 3, it's your admin. In Phase 4, it's the automation forwarder.

**For Phase 3 TODAY:**

```bash
# Just set it to your admin address
export ORACLE_ADDRESS="0x<your_admin_sepolia_address>"
```

**For Phase 4 LATER:**

- We'll deploy an AutomationForwarder
- Or use a shared forwarder Chainlink provides
- Then update: `contract.setOracle(forwarder_addr)`

---

### **Q2: "Can CRE bring any kind of data? How to simulate live odds?"**

**Answer: YES and NO.** Here's what CRE can/can't do:

| Data Type                  | Fetch via CRE HTTP? | For What Phase? | Example                                                   |
| -------------------------- | ------------------- | --------------- | --------------------------------------------------------- |
| **Final match score**      | ✅ YES              | Phase 4 settle  | POST-MATCH: CRE fetches Sportmonks, calls `settleMatch()` |
| **Final goalscorers**      | ✅ YES              | Phase 4 settle  | POST-MATCH: CRE fetches Opta, passes to `settleMatch()`   |
| **Live odds during match** | ❌ NO               | ❌ Not needed   | Live odds → Frontend UI only, NOT on-chain                |
| **Player lineups**         | ✅ YES              | Phase 4 start   | PRE-MATCH: CRE pre-populates players table                |
| **Live scores (1–1, 2–0)** | ✅ YES              | Phase 3 or 4    | Real-time but stored off-chain in `goal_events` table     |

**The KEY INSIGHT:**

- **Live odds updates during the game = Frontend directly calls The Odds API**
  - No blockchain transaction
  - No oracle needed
  - Fast (1-2s latency)
  - Shows user "If I bet now at these odds, I'd win $X"
- **Settlement after the game = Single chain call via oracle**
  - Final score + final odds
  - Calculated balance = contract settles all bets
  - One transaction per match

---

### **Q3: "How to update winnings/lost during live game?"**

**Answer: ON FRONTEND, not on-chain.**

```javascript
// extension/src/hooks/useOddsUpdater.ts

useEffect(() => {
  const interval = setInterval(async () => {
    // Fetch LIVE odds from The Odds API every 30 seconds
    const liveOdds = await fetchLiveOdds(matchId);

    // Recalculate provisional balance in BROWSER (off-chain)
    const provisionalBalance = calculateBalance(
      myBets, // bets already locked on-chain
      liveOdds, // fresh odds from API
      liveScore, // if Haaland scored, his odds → 0.15
      currentMinute, // used for penalty calc if user wants to change bet
    );

    setProvisionalBalance(provisionalBalance); // Update UI
  }, 30_000);
}, [matchId]);
```

**User sees:**

```
🟢 Your Balance: $100 (LOCKED on-chain)
💚 Provisional Winnings: +$47.50 if match ends now
   (Haaland 1.52x @ $50 locked → odds dropped to 0.80 due to 1:0 lead)
```

**At end of match:**

- Admin clicks "Settle Match" → calls `settleMatch()`
- Contract resolves all bets using the final odds you pass in
- Payouts calculated on-chain, transferred to winners

---

### **Q4: "Should HTTP trigger be used when creating event/deploying contract?"**

**Answer: No, those are different triggers. Here's the anatomy:**

```
┌────────────────────────────────────────────────────────────────┐
│                    MATCH LIFECYCLE                             │
└────────────────────────────────────────────────────────────────┘

SETUP PHASE (T-24h)
├─ Admin action: Click "Create Event" in admin UI
├─ Trigger type: USER ACTION (button click)
├─ What happens:
│  ├─ Admin UI calls Edge Function "create-match"
│  ├─ Edge Function calls contract.createMatch(matchId)
│  ├─ Edge Function inserts row in Supabase matches table
│  └─ Admin is set as oracle: contract.setOracle(adminAddress)
├─ HTTP trigger involved? ❌ NO (internal user action)
└─ CRE involved? ❌ NO (Phase 3 manual)

LIVE PHASE (T+0 to T+90min)
├─ Data flow: Odds API → Frontend → User
├─ Trigger type: FRONTEND POLLING (every 30s)
├─ What happens:
│  ├─ Extension polls The Odds API for live odds
│  ├─ User clicks "Change Bet" → locks new bet in contract
│  ├─ Contract updates odds in provisionalBalance calculation
│  └─ User sees "+$X PENDING" as odds fluctuate
├─ HTTP trigger involved? ✅ YES (frontend fetches odds)
├─ CRE triggered? ❌ NO (Phase 3 manual)
└─ Oracle called? ❌ NO (not yet settled)

SETTLEMENT PHASE (T+90+ minutes)
├─ Admin action: Click "Settle Match" in EventDetail
├─ Trigger type: USER ACTION (button click)
├─ What happens:
│  ├─ Admin enters: final score + goalscorer list
│  ├─ Admin clicks "Settle Match" → calls Edge Function
│  ├─ Edge Function calls contract.settleMatch(matchId, ...)
│  ├─ msg.sender = admin address (the oracle)
│  ├─ Contract validates require(msg.sender == oracle) ✅
│  ├─ Contract resolves all bets, calculates payouts
│  └─ Winners can claim USDC via claimPayout()
├─ HTTP trigger involved? ❌ NO
├─ CRE triggered? ❌ NO (Phase 3 manual)
└─ Oracle called? ✅ YES (settlement!)

PHASE 4 (FUTURE - Automated via CRE)
├─ Settlement AUTOMATICALLY triggered by Chainlink CRE
├─ Trigger type: CRON (e.g., every minute after kickoff)
├─ What happens:
│  ├─ CRE workflow wakes up every 1 min
│  ├─ CRE polls: "Is this match finished?"
│  ├─ If match != finished → sleep 1 min
│  ├─ If match == finished:
│  │  ├─ CRE HTTP calls Sportmonks/Opta: GET final score
│  │  ├─ CRE ABI-encodes: settleMatch(matchId, scorerIds, winner, ...)
│  │  ├─ CRE submits tx signed as ForwarderAddress
│  │  ├─ Contract checks: require(msg.sender == oracle) where oracle=ForwarderAddr ✅
│  │  └─ Settlement happens automatically!
├─ HTTP trigger involved? ✅ YES (CRE→Sportmonks)
├─ Cron trigger involved? ✅ YES (every minute)
└─ Oracle called? ✅ YES (automated!)
```

---

## **TL;DR: What to Do NOW vs LATER**

### **Phase 3 (THIS WEEK - Manual Settlement)**

1. **Deploy contract**

   ```bash
   forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC --broadcast
   ```

2. **Set oracle to admin address** (in EventDetail page, Oracle tab)

   ```javascript
   await contract.setOracle(adminAddress);
   ```

3. **Test flow:**
   - Admin creates match ✅
   - Users lock bets ✅
   - Watch live odds in UI (from The Odds API, no oracle needed) ✅
   - Admin manually settles (calls contract.settleMatch() with final data) ✅

4. **No Chainlink CRE needed yet.**

---

### **Phase 4 (MARCH - CRE Automation)**

1. **Decide:** Use AutomationForwarder or Chainlink-provided forwarder

2. **Switch oracle address:**

   ```javascript
   await contract.setOracle(forwarderAddress);
   ```

3. **Deploy CRE workflow** (YAML config)

   ```yaml
   triggers:
     - type: Cron
       schedule: "*/1 * * * *" # every minute
   steps:
     - http:
         url: "https://api.sportmonks.com/matches/{matchId}"
         headers: { Authorization: "Bearer $SPORTMONKS_KEY" }
     - evm-write:
         contract: GoalLiveBetting
         function: settleMatch
         args: [matchId, scorerIds, winner, homeGoals, awayGoals]
   ```

4. **No admin action needed** — settlement is automatic!

---

## **What's Missing in CRE_CHAINLINK_INTEGRATION_GUIDE.md**

The doc has great theory but needs these Phase 3→4 specifics added:

1. **AutomationForwarder registration pattern** (code snippet)
2. **Oracle address lifecycle:**
   - Phase 3: admin address
   - Phase 4: forwarder address
   - How to transition without redeploying
3. **CRE YAML for settelMatch specifically**
   - How to ABI-encode the `uint256[]` scorerIds array
   - Example for goal.live's exact function signature
4. **Testing CRE locally with testnet oracle** (Sepolia config)

---

## **Action Items for Copilot**

**Tell Copilot THIS when it asks those 6 questions:**

> **1. Oracle address:** Phase 3 = admin address you pass to `setOracle()`. Phase 4 = AutomationForwarder address. No fixed CRE EOA needed; use forwarder.
>
> **2. Can CRE call settleMatch?** Yes. Once you upgrade oracle to forwarder address, CRE can call it. See Phase 4 YAML example at [bottom of this doc].
>
> **3. Webhook vs cron:** Webhook = Opta fires goal event immediately. Cron = we poll every 1 min for match end. For Phase 3 manual; for Phase 4 use cron for settlement trigger, webhook for goal events if Opta integrated.
>
> **4. CRE HTTP on Sepolia:** Yes, fully supported. Use public nodes or Chainlink's shared nodes. No custom node needed for MVP.
>
> **5. One job per match or parameterized:** One parameterized job that reads matchId from API. Pattern = job.yaml has `{matchId}` placeholder, CRE substitutes at runtime.
>
> **6. Odds API on-chain:** Anti-pattern for real-time (1-2s delay → data stale). Use Data Streams if available, else: frontend fetches odds, Edge Function calculates on settlement. Odds NOT stored on-chain except at settlement time.

---

_Updated Feb 27, 2026 — aligns Phase 3 (manual) with Phase 4 (CRE) architecture._
