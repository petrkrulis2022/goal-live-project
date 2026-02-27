# WorldCoin / World ID — Sepolia Investigation Notes

_Last updated: Feb 27, 2026 | Author: goal.live team_

> **Scope:** Research only. No World ID code will be written until these questions are resolved.
> Feature target: gate `lockBet()` so only verified humans can place bets (anti-bot, anti-Sybil).

---

## 1. Core Question

> Is World ID verification testable end-to-end on Ethereum Sepolia (chain 11155111)?

This is the blocking question. If `WorldIDRouter` is not deployed on Sepolia and the Developer
Portal does not issue Sepolia test proofs, the whole integration cannot be built on our testnet.

---

## 2. Contract Deployment Status (to research)

| Contract                        | Expected Address on Sepolia         | Verified? |
| ------------------------------- | ----------------------------------- | --------- |
| `WorldIDRouter`                 | TBD — check worldcoin.org/developer | ❓        |
| `WorldIDIdentityManager`        | TBD                                 | ❓        |
| `OpWorldID` proxy (if OP stack) | Not applicable (Sepolia is L1)      | N/A       |

**Research tasks:**

- Check [https://docs.worldcoin.org/reference/address-book](https://docs.worldcoin.org/reference/address-book) for Sepolia entries
- Check Etherscan Sepolia for `WorldIDRouter` bytecode
- Look for `WorldIDRouterABI.json` in `@worldcoin/world-id-contracts` npm package

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

## 8. Decision Gate

| Finding                                              | Action                                         |
| ---------------------------------------------------- | ---------------------------------------------- |
| WorldIDRouter deployed on Sepolia + test proofs work | Implement World ID in Track E (future session) |
| Only Optimism/Polygon mainnet supported              | Defer to mainnet phase; use gasless relayer    |
| Staging environment uses Sepolia                     | Use staging environment for MVP testnet        |
| No testnet support at all                            | Remove World ID from MVP scope; revisit in v2  |

---

## 9. Related Files (once implementation starts)

- `contracts/GoalLiveBetting.sol` — add `onlyVerifiedHuman` modifier to `lockBet()`
- `scripts/deploy.ts` — pass `worldIdRouterAddress` as constructor arg
- `src/components/BetModal.tsx` — wrap with `IdKitWidget`
- `src/types/index.ts` — add `worldIdProof` to `PlaceBetParams`
- `.env.local` — add `VITE_WORLD_ID_APP_ID`
