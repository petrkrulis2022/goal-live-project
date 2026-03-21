# Hedera Testnet Integration Plan

## Goal

Submit goal.live to the Hedera hackathon using Hedera testnet + USDC, while keeping full functionality identical to the Sepolia + CRE Chainlink branch. MetaMask supports Hedera testnet natively as an EVM chain.

---

## What CRE Actually Does (and why we can remove it)

The Chainlink CRE DON workflow (`cre/goal-live/goal-live-settlement/main.ts`) does exactly **one thing**:

> Every 60s: check Supabase for live matches → check Goalserve for FT → call the `settle-match` Supabase edge function.

The `settle-match` edge function does all real work (settle bets in Supabase + call `settleMatch()` on-chain). CRE is just the **automated trigger**. We replace it with a small addition to `sync-match-status`.

---

## What Changes vs What Stays the Same

### Stays identical

- All Supabase infrastructure (same project, DB, edge functions logic)
- Admin panel (Settle button calls `settle-match` directly — no CRE needed)
- Frontend betting extension
- `sync-match-status` edge function (logic stays, just gains one extra step)
- `poll-live-matches.mjs` (corners/live scoring)
- Settlement contract logic (`settleMatch`, `settleUserBalances`, `fundMatch`, `withdraw`)
- Solidity source — Hedera EVM is fully compatible, same code

### Contract changes (minimal)

- Remove `onReport()` — called by Chainlink `keystoneForwarder`, nobody calls it on Hedera
- Remove `keystoneForwarder` storage variable + `setKeystoneForwarder()` admin function
- Deploy with **Hedera testnet USDC address** (not Sepolia one)
- Constructor comment update only

### CRE replacement — auto-settlement via `sync-match-status`

Extend `sync-match-status` (~10 lines) to call `settle-match` automatically when it detects a match transitioning to `finished`. This edge function already runs every minute via pg_cron and already detects FT from Goalserve.

**New flow on Hedera:**

```
pg_cron (every 1 min)
  → sync-match-status (edge fn)
      → Goalserve: FT detected
      → match.status = 'finished'
      → [NEW] calls settle-match internally
          → bets settled in Supabase
          → settleMatch() called on Hedera testnet (oracle EOA private key)
          → settleUserBalances() called
  → user calls withdraw() on MetaMask → Hedera testnet
```

The `emergencySettle()` function on the contract remains as a safety net if auto-settlement ever misses.

---

## Implementation Steps

### 1. Create branch

```bash
git checkout cre-chainlink
git checkout -b hedera-testnet
```

### 2. Contract — remove CRE-specific parts

In `contracts/GoalLiveBetting.sol`:

- Remove `address public keystoneForwarder;` storage variable
- Remove `setKeystoneForwarder()` admin function
- Remove `onReport()` function (Chainlink KeystoneForwarder callback)
- Remove `KeystoneForwarderUpdated` event
- Remove `keystoneForwarder = _oracle` from constructor
- Keep: `settleMatch(onlyOracle)`, `emergencySettle(onlyOwner)`, all user-facing functions

### 3. Deploy contract on Hedera testnet

- Network: Hedera Testnet (Chain ID: 296)
- RPC: `https://testnet.hashio.io/api`
- USDC on Hedera testnet: check [Hedera token service](https://hashscan.io/testnet) for the canonical USDC address
- Use Foundry (`forge create`) or Hardhat with Hedera RPC
- Note deployed contract address

### 4. Update edge function env vars (Supabase)

Add Hedera-specific env vars in Supabase project settings:

```
HEDERA_RPC_URL=https://testnet.hashio.io/api
HEDERA_CONTRACT_ADDRESS=0x...  (deployed in step 3)
HEDERA_CHAIN_ID=296
```

`settle-match` reads the RPC URL and contract address from env — update them.

### 5. Extend `sync-match-status` — auto-settlement trigger

When a match transitions to `finished`, call `settle-match` automatically:

```typescript
// After updating match status to 'finished':
if (newStatus === "finished" && currentStatus !== "finished") {
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/settle-match`, {
    method: "POST",
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ match_id: match.id }),
  });
}
```

### 6. `settle-match` edge function — Hedera RPC

The function uses `ethers.JsonRpcProvider` — only the RPC URL and contract address need to change. Read from env vars set in step 4.

### 7. Frontend — add Hedera testnet network to MetaMask prompt

In the wallet connection code, add Hedera testnet network config:

```typescript
{
  chainId: '0x128',  // 296 in hex
  chainName: 'Hedera Testnet',
  nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
  rpcUrls: ['https://testnet.hashio.io/api'],
  blockExplorerUrls: ['https://hashscan.io/testnet/'],
}
```

### 8. CRE folder

Leave `cre/` folder in place but unused — it does no harm and documents the Chainlink approach for the Sepolia branch context.

---

## What to Ignore / Leave Unused on Hedera Branch

- `cre/` folder entirely
- `requestSettlement()` contract function (fires `SettlementRequested` event for CRE Log Trigger — no CRE = nobody listening)
- `foundry.toml` Sepolia deploy config (update for Hedera)

---

## Hedera-Specific Notes

- **Chain ID**: 296 (testnet), 295 (mainnet)
- **RPC**: `https://testnet.hashio.io/api` (HashIO by Hedera)
- **Block explorer**: hashscan.io/testnet
- **USDC**: Hedera has native USDC via Circle — confirm testnet address on HashScan before deploying
- **Gas**: Hedera uses HBAR for gas but EVM transactions work identically via MetaMask
- **Solidity compatibility**: Hedera EVM supports Solidity up to 0.8.x — our `^0.8.24` is fine
- **OpenZeppelin imports**: work unchanged on Hedera EVM

---

## Status

- [ ] Fix minor issues on `cre-chainlink` branch (current work)
- [ ] Record demo video for Sepolia/CRE submission
- [ ] Create `hedera-testnet` branch
- [ ] Strip CRE from contract
- [ ] Deploy on Hedera testnet
- [ ] Wire auto-settlement in `sync-match-status`
- [ ] Test full flow on Hedera testnet
- [ ] Submit to Hedera hackathon
