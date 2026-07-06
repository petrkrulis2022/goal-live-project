# goal.live — Project & Blockchain / Smart-Contract Experience Overview

*Peter Krulis · DotLive Interactive*

## What the project is

goal.live is a patent-pending interactive betting platform that overlays real-time
prediction markets directly on top of live sports streams. Users bet on in-game
micro-moments — next goal scorer, match winner, exact goals, next corner — and bets
settle automatically on-chain from live sports data feeds. The blockchain /
smart-contract layer is where the core engineering sits.

## Smart contract — `GoalLiveBetting.sol`

A ~560-line Solidity 0.8.24 USDC escrow contract, built and tested with **Foundry**
(optimizer + `via_ir`), using **OpenZeppelin** (`SafeERC20`, `ReentrancyGuard`,
`Ownable`). Covered by a **37-case Foundry test suite** (~665 lines).

The design is a **trust-minimised hybrid escrow** that solves a real UX problem — a
user cannot sign a wallet transaction for every micro-bet during a live match:

1. **`fundMatch()`** — user locks USDC into a per-match pool in one transaction.
2. Bets / bet-changes happen off-chain (instant, gasless for the user).
3. **`recordBet()`** — a platform *relayer* writes every bet & change to an immutable
   on-chain audit trail asynchronously (platform pays gas).
4. **`settleMatch()`** — an *oracle* account writes the verified match result on-chain.
5. **`settleUserBalances()`** — final per-user payouts written on-chain, immutable.
6. **`withdraw()`** — user pulls their final USDC balance in one transaction.

**Key security property:** two-role separation (relayer + oracle) where neither can
move funds — they only record data and set balance values; withdrawals are always
user-initiated against on-chain balances. Includes a 2% platform fee (basis points),
reentrancy guards on all value-moving paths, and owner-gated emergency withdrawal.
Documented V2 path: replace off-chain bet records with per-bet on-chain `lockBet`
calls for fully trustless P&L.

## Multi-chain deployment

The same betting system implemented and deployed across three environments:

- **Ethereum (Sepolia testnet)** — reference EVM deployment, **ethers.js v6**,
  Etherscan verification.
- **Hedera Testnet** — EVM-compatible deployment via Hashio RPC + HashScan
  verification; dedicated `settle-match-hedera` settlement service.
- **Solana** — wallet-adapter integration (Phantom), `@solana/web3.js`.

## Decentralised settlement — Chainlink CRE

A **Chainlink Runtime Environment (CRE)** workflow in **TypeScript + Bun**
(`@chainlink/cre-sdk`) that decentralises match settlement across a Chainlink DON:

- 60-second cron trigger; each DON node independently fetches live match status,
  detects full-time, pulls goal-scorer data, and POSTs the result to settlement.
- **DON consensus aggregation** (`median`, `identical` field aggregation) so nodes
  agree on the outcome before it is written on-chain.
- **Idempotent settlement** — first node to succeed settles the match; others receive
  HTTP 409 and no-op, preventing double-settlement.

## Identity & supporting infrastructure

- **World ID** (`@worldcoin/idkit`) for proof-of-personhood / sybil resistance.
- **Off-chain oracle layer**: Supabase Edge Functions (Deno/TypeScript) —
  `lock-bet`, `settle-match`, `sync-odds`, `sync-match-status` — orchestrating
  on-chain calls via dedicated oracle/relayer keys and keeping DB and chain state
  consistent.

## Blockchain stack summary

`Solidity 0.8.24` · `Foundry` · `OpenZeppelin` · `ethers.js v6` ·
`Chainlink CRE (cre-sdk, Bun)` · `Hedera (Hashio / HashScan)` ·
`Solana web3.js + wallet adapters` · `World ID / IDKit` ·
`Supabase Edge Functions (Deno)` · USDC (ERC-20) escrow.
