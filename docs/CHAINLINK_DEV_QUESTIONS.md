# Chainlink Dev Session — Open Questions
_Last updated: Feb 27, 2026 | Author: goal.live team_

These questions will be answered during a dedicated Chainlink integration session
before implementing on-chain automation. No Chainlink code has been written yet.

---

## 1. CRE (Chainlink Runtime Environment) — Basic Availability

| Question | Status |
|---|---|
| Is CRE HTTP adapter available on Sepolia testnet (chain 11155111)? | ❓ |
| Is CRE Cron adapter available on Sepolia testnet? | ❓ |
| Which CRE version is current stable (`cre-cli` tag)? | ❓ |
| Is there a public CRE Sepolia node operator endpoint for testnet usage? | ❓ |

---

## 2. CRE HTTP vs Classic External Adapters (DON)

- What is the operational difference between a CRE HTTP job and a classic Chainlink DON external adapter?
- Can the same node run both CRE jobs and classic DON jobs simultaneously?
- For `settleMatch()` automation (fire once on match end), should we use:
  - A) CRE HTTP trigger (webhook from our backend → Chainlink node)?
  - B) CRE Cron job (poll Goalserve every N seconds)?
  - C) Classic DON request–response?
- What is the recommended pattern for a **one-shot settlement trigger** (not a recurring price feed)?

---

## 3. Automating `settleMatch()` via Chainlink

Current plan (no Chainlink): admin presses **Settle** button in the admin panel → calls `settleMatch()` directly via MetaMask.

Proposed Chainlink path:
```
Goalserve final score event
    → CRE HTTP / Cron job picks up final result
    → Chainlink node calls GoalLiveBetting.settleMatch(matchId, scorers[], winner, homeGoals, awayGoals)
```

Questions:
- Does the Chainlink node wallet need to be the `oracle` address in the contract, or should we use Chainlink's Forwarder contract pattern?
- What LINK fee is required for a single Sepolia call of this type?
- How do we test this end-to-end on Sepolia without a real CRE node? Is there a mock CRE harness?
- Is `chainlink/contracts` npm package needed in our Hardhat project, and which version?

---

## 4. Betfair Odds via Chainlink Data Streams

- Is Chainlink Data Streams available on Sepolia, or only mainnet?
- Is there a Betfair Exchange odds stream or any sports-market odds stream currently in the Data Streams catalog?
- If not, what is the correct approach: CRE HTTP job polling The Odds API → pushing to an on-chain aggregator we deploy?
- What is the on-chain interface to read from a custom Data Streams aggregator?

---

## 5. NGS (Next Goal Scorer) — Event-Driven Log Trigger

- Is there a Chainlink Log Trigger (Automation v2.1) that can watch for an on-chain `GoalScored(matchId, playerId)` event and then call `settleMatch()` automatically?
- What is the minimum Automation subscription balance required for Sepolia?
- Should we use Automation v2.1 Log Trigger or CRE for this use case?

---

## 6. Recommended Testnet Topology for goal.live MVP

Proposed minimal topology:
```
[Our Backend (Supabase Edge Fn)]
    │ HTTP POST final score
    ▼
[CRE HTTP Job on Chainlink Sepolia node]
    │ on-chain tx
    ▼
[GoalLiveBetting.sol on Sepolia]
    │ emits MatchSettled(...)
    ▼
[Admin panel reads event → shows "Settled"]
```

Questions:
- Is this topology correct and feasible with CRE on Sepolia?
- Is there a hosted test CRE node for developers (like the Chainlink Faucet node for LINK)?
- Do we need to run our own Chainlink node, or can we use a third-party operator?

---

## 7. CRE Architecture Guide

- Where is the official CRE architecture documentation?
- Which CRE adapters are planned for Sepolia in Q1 2026?
- Is there a CRE Discord channel or GitHub repo for issue tracking?

---

## Action Items After Session

- [ ] Confirm CRE availability on Sepolia
- [ ] Decide automation pattern: CRE HTTP vs CRE Cron vs DON vs Manual admin
- [ ] Add `chainlink/contracts` to Hardhat dependencies (if needed)
- [ ] Update `GoalLiveBetting.sol` oracle address strategy (EOA vs Forwarder)
- [ ] Update `CONTRACTS_BUILD_PROMPT.md` § Chainlink Integration with confirmed answers
- [ ] Update `DEVELOPMENT_ROADMAP.md` Phase 4 checklist with concrete CRE tasks
