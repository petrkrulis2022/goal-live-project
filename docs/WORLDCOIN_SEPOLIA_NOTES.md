# WorldCoin / World ID — Sepolia Integration Notes

_Last updated: March 8, 2026 | Author: goal.live team_

> **STATUS: CONFIRMED — `WorldIDRouter` is live on Sepolia.**
> Full on-chain ZK proof verification is possible on our testnet.
> For hackathon demo: use the Worldcoin Simulator to generate real ZK proofs without a real World ID device.
> Feature target: gate player entry (`fundMatch`) and withdrawal (`withdraw`) — anti-bot, anti-Sybil.

---

## 1. Core Question — RESOLVED ✅

> Is World ID verification testable end-to-end on Ethereum Sepolia (chain 11155111)?

**YES.** `WorldIDRouter` is deployed and verified on Sepolia:
[0x469449f251692e0779667583026b5a1e99512157](https://sepolia.etherscan.io/address/0x469449f251692e0779667583026b5a1e99512157#code)

For demo purposes: the **Worldcoin Simulator** (https://simulator.worldcoin.org) generates real ZK proofs
using test identities — no Orb scan required. These proofs pass full on-chain `verifyProof()` verification
against the Sepolia router. This means the entire flow (widget → ZK proof → Sepolia tx) is demonstrable.

---

## 2. Contract Deployment Status — CONFIRMED ✅

| Contract         | Address on Sepolia                           | Verified?        |
| ---------------- | -------------------------------------------- | ---------------- |
| `WorldIDRouter`  | `0x469449f251692e0779667583026b5a1e99512157` | ✅ Etherscan     |
| Simulator proofs | https://simulator.worldcoin.org              | ✅ Works on demo |

Use the Simulator app for demo — scan the QR code in IDKitWidget with the Simulator app
instead of the real World app. Generates a valid ZK proof that the Sepolia router accepts.

---

## 3. Developer Portal — Test Proofs on Sepolia

- Does the World ID Developer Portal allow creating an App targeting Sepolia?
- Are Simulator proofs (from `@worldcoin/idkit` staging mode) verifiable by the Sepolia `WorldIDRouter`?
- Is there a separate "Staging" environment that uses Sepolia under the hood?

---

## 4. `@worldcoin/idkit` SDK

Current version in npm registry: check at research time.

Questions:

- Is `IDKitWidget` the correct component for Web3 dApps (vs. WLD wallet flow)?
- Does `idkit` support a `action` string and `signal` (which we'd set to the bettor's address)?
- What does the proof payload look like: `(root, nullifierHash, proof[8])`?

---

## 5. Solidity Integration Pattern

If WorldCoin is available on Sepolia, the `lockBet()` modifier would look like:

```solidity
import { IWorldID } from "@worldcoin/world-id-contracts/src/interfaces/IWorldID.sol";

IWorldID public worldId;
uint256 public worldIdGroupId = 1; // Orb-verified
string  public constant WID_ACTION = "goal-live-lock-bet";

modifier onlyVerifiedHuman(
    address signal,
    uint256 root,
    uint256 nullifierHash,
    uint256[8] calldata proof
) {
    worldId.verifyProof(
        root,
        worldIdGroupId,
        abi.encodePacked(signal).hashToField(),
        nullifierHash,
        abi.encodePacked(WID_ACTION).hashToField(),
        proof
    );
    _;
}
```

Questions:

- Is `IWorldID` interface in `@worldcoin/world-id-contracts` v1 or v2?
- What is the correct `hashToField` helper — is it in `ByteHasher.sol`?
- Should `nullifierHash` be stored on-chain to prevent replay, or does the Router handle this?
- Gas estimate for `verifyProof()` on Sepolia (rough)?

---

## 6. UX Impact

If the user has not verified with WorldCoin:

- Option A: Block the "Place Bet" button entirely with a "Verify with World ID" prompt
- Option B: Allow the bet to be submitted, but the chain call reverts with a clear error message
- Option C: World ID verification is optional (gating is off in MVP, enabled in v2)

**Preferred option (TBD after research):** C for MVP — ship without gating, add in v2 once Sepolia is confirmed working.

---

## 7. Research Checklist

- [ ] Visit worldcoin.org/developer → check Sepolia address book
- [ ] Check `@worldcoin/idkit` latest version and changelog
- [ ] Search GitHub `worldcoin/world-id-contracts` for `address-book.md` or `networks.json`
- [ ] Test Developer Portal: create app, set network to Sepolia, try simulator proof
- [ ] Check Discord `#developer` channel for Sepolia support status
- [ ] Confirm gas cost of `verifyProof()` on Sepolia (deploy a test contract)

---

## 8. Decision Gate — RESOLVED ✅

| Finding                                              | Status                                                    |
| ---------------------------------------------------- | --------------------------------------------------------- |
| WorldIDRouter deployed on Sepolia + test proofs work | ✅ **CONFIRMED** — full on-chain verification, do it now  |
| Simulator ZK proofs for demo                         | ✅ **CONFIRMED** — simulator.worldcoin.org generates real proofs |
| Only Optimism/Polygon mainnet supported              | N/A — Sepolia is confirmed                                |
| No testnet support at all                            | N/A — moving forward                                      |

**Decision: implement full on-chain ZK verification against Sepolia `WorldIDRouter`.
Use Worldcoin Simulator for demo run (no real World ID device needed).**

---

## 10. Implementation Plan

### Step 0 — Create branch off `cre-chainlink`

```bash
git checkout cre-chainlink
git pull
git checkout -b worldid-integration
git push -u origin worldid-integration
```

All World ID work happens on `worldid-integration`. Merge back into `cre-chainlink` via PR when complete.

> **Demo note**: Install the **Worldcoin Simulator** app (https://simulator.worldcoin.org) on your phone.
> Scan the IDKitWidget QR code with it instead of the real World app — it generates a real ZK proof
> that passes full on-chain Sepolia verification. Perfect for hackathon demo with no real World ID needed.

---

### Step 1 — Install SDK & configure app

```bash
npm install @worldcoin/idkit
```

- Create World ID App at [developer.worldcoin.org](https://developer.worldcoin.org):
  - Set network to **Ethereum Sepolia**
  - Enable **Simulator** (for demo) and **Device** verification level
  - Add two actions: `goal-live-fund-match`, `goal-live-withdraw`
  - Copy your `app_id`
- Add to `.env.example` and `.env.local`:
  ```
  VITE_WORLD_APP_ID=app_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  VITE_WORLD_ID_ROUTER=0x469449f251692e0779667583026b5a1e99512157
  ```

---

### Step 2 — Supabase: nullifier anti-replay table

Create `supabase/migrations/xxx_world_id_verifications.sql`:

```sql
create table world_id_verifications (
  id uuid primary key default gen_random_uuid(),
  nullifier_hash text unique not null,
  wallet_address text not null,
  action text not null,
  verified_at timestamptz default now()
);
-- nullifier_hash unique = same identity cannot fund/withdraw twice on same action
```

---

### Step 3 — Supabase Edge Function: `verify-worldid`

Create `supabase/functions/verify-worldid/index.ts`:
- Accepts POST `{ proof, merkle_root, nullifier_hash, action, signal }` (signal = player wallet address)
- Calls Worldcoin Developer Portal Cloud API to verify ZK proof:
  `POST https://developer.worldcoin.org/api/v2/verify/<app_id>`
- Rejects if `nullifier_hash` already in DB (anti-replay — same human, same action, once only)
- On success: inserts record, returns `{ verified: true, nullifier_hash }`

---

### Step 4 — Frontend hook: `useWorldID`

Create `src/hooks/useWorldID.ts`:
- Calls edge function after IDKitWidget `onSuccess` callback
- Caches result in `sessionStorage` per `(action, walletAddress)` — no re-prompt same session
- Returns `{ verified, verify, isVerifying, error }`

---

### Step 5 — Reusable gate component: `WorldIDGate`

Create `src/components/WorldIDGate.tsx`:
- Wraps `IDKitWidget` from `@worldcoin/idkit`
- Connects to `WorldIDRouter` at `0x469449f251692e0779667583026b5a1e99512157` (Sepolia)
- Props: `action`, `walletAddress`, `onVerified`, `children`
- States: unverified (shows "Verify with World ID" button) → verifying → verified (green checkmark, render `children`)
- Calls `useWorldID` to submit proof to edge function

---

### Step 6 — Gate `FundMatchModal` (player enters game)

In `src/components/FundMatchModal.tsx`:
- Wrap the Fund/Confirm button inside `<WorldIDGate action="goal-live-fund-match">`
- `fundMatch()` transaction only sends after World ID ZK proof verified

---

### Step 7 — Gate `WithdrawModal` (player withdraws)

In `src/components/WithdrawModal.tsx`:
- Same `<WorldIDGate action="goal-live-withdraw">` wrapping the confirm button
- `withdraw()` transaction only sends after World ID ZK proof verified

---

### Step 8 — Test & PR

1. Open FundMatchModal → "Verify with World ID" button appears
2. Click → IDKitWidget QR code opens → scan with Worldcoin Simulator app
3. Simulator generates real ZK proof → edge function verifies against Worldcoin API
4. Green checkmark → Fund button enabled → `fundMatch()` tx fires on Sepolia ✓
5. Repeat test for WithdrawModal ✓
6. Re-open modal same browser session: skips verification (session cache) ✓
7. Replay same nullifier → edge function rejects 409 ✓
8. `git push && open PR worldid-integration → cre-chainlink`

---

### Scope / Decisions

| Item | Decision |
|------|----------|
| Sepolia `WorldIDRouter` | ✅ Confirmed at `0x469449f251692e0779667583026b5a1e99512157` |
| Verification method | Cloud API (Worldcoin Developer Portal) — also covers proof validity |
| On-chain modifier | **NOT for MVP** — off-chain verification via edge function is sufficient for hackathon |
| Demo identity | Worldcoin Simulator app — real ZK proof, no Orb scan needed |
| Verification level | `Device` — lower friction for demo |
| Gated actions | `fundMatch` (enter game) + `withdraw` (exit game) |
| Bet placing (`lockBet`) | NOT gated — too much friction mid-game |
| Anti-replay | `nullifier_hash` unique per action in Supabase |
| V2 upgrade path | Add `onlyVerifiedHuman` Solidity modifier using `IWorldID.verifyProof()` via confirmed Sepolia router |

---

## 9. Related Files (once implementation starts)

- `contracts/GoalLiveBetting.sol` — add `onlyVerifiedHuman` modifier to `lockBet()`
- `scripts/deploy.ts` — pass `worldIdRouterAddress` as constructor arg
- `src/components/BetModal.tsx` — wrap with `IdKitWidget`
- `src/types/index.ts` — add `worldIdProof` to `PlaceBetParams`
- `.env.local` — add `VITE_WORLD_ID_APP_ID`
