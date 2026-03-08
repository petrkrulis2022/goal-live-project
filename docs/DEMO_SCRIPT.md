# GOAL.LIVE — 5-Minute Demo Script

---

## The Problem (0:00 – 0:30)

**Show:** Landing page at `localhost:5174` — let the typewriter text finish typing

> "Live in-play betting now accounts for 54% of all sports bets placed — reaching 70% in mature European markets. Yet every single odds update still flows through centralized, opaque feeds. Bettors have no way to verify the odds are fair. They just have to trust the bookmaker."

---

## The Solution — GOAL.LIVE (0:30 – 1:00)

**Show:** Polymarket — point to live match outcome odds

> "This is Polymarket. On-chain prediction markets — but no live in-play experience, no real-time odds as the match unfolds."

**Switch to:** A traditional bookmaker website (Bet365 or similar)

> "This is a traditional sportsbook. Numbers, odds, buttons. Fully centralized. You have no idea where those odds come from or if they've been manipulated."

**Switch to:** Extension running on the live game — show the overlay buttons for 3 seconds

> "And this is GOAL.LIVE. Same live game — but now you're betting directly on-chain, with oracle-verified odds, overlaid on your TV stream."

**Switch back to:** Landing page

> "GOAL.LIVE is a transparent, on-chain live betting platform. Odds are sourced and delivered by **Chainlink's Cross-chain Real-time Events oracle network** — immutably verifiable on-chain, trustless and manipulation-resistant.
>
> There are two entry points: the **Admin Platform** manages events and settlements. The **Launch App** is the player-facing TV experience."

---

## Part 1 — How It Works — CRE Architecture (1:00 – 1:45)

**Click:** "How it works · CRE Architecture" button → `/architecture`

> "Before we see it live, let's understand the oracle layer. Match results flow from the Goalserve sports data feed into the **Chainlink Decentralised Oracle Network**. The DON reaches consensus and pushes a signed report through the **Keystone Forwarder** directly into our smart contract."

**Point to:** Flow diagram nodes

> "The contract's `onReport()` function — callable only by the Keystone Forwarder — permanently settles the match result on-chain. No one else can call it. No tampering possible."

**Switch to:** Code tab

> "This is the actual contract code. It decodes the ABI-encoded report — match ID, goal scorers, winner, score — and settles it permanently. Payouts are then immutable."

---

## Part 2 — Admin: Creating a Live Event (1:45 – 2:30)

**Click:** Back → Admin Platform → `localhost:5174/dashboard` → Create Event

> "In the admin dashboard, an operator selects a live match — today, Sevilla. The system fetches real-time odds from the sports data feed."

**Select:** La Liga → Sevilla match → confirm

> "Once confirmed, a smart contract event is registered on Sepolia testnet. The contract is now live at `0x0ac469...` — listening for oracle-delivered match updates."

---

## Part 3 — Player Experience (2:30 – 3:30)

**Switch to:** TV view — browser extension on `tvgo.t-mobile.cz`

> "The player launches the TV stream. Our Chrome extension overlays the GOAL.LIVE betting interface directly on the broadcast."

**Open:** Bet modal

> "They see real-time odds — sourced from the same on-chain oracle — and place a bet in seconds. Wallet balance, available funds after locked bets, and a smart-contract-enforced max bet are all visible."

**Place a bet**

> "The bet is written to the blockchain. Funds are locked in smart contract escrow until the match settles."

> "Now — we're on Sepolia testnet today, so these are test USDC tokens. But think about what this experience is with real money. The same way poker becomes a completely different game when real stakes are on the table, the same way Polymarket has millions of dollars flowing through it — that's the emotional intensity we're building for live sports. Every goal, every minute matters."

> "And the platform doesn't stop at betting. At half-time, advertising can be injected directly into the stream. Expert analysis, sponsor content, discussion panels — all delivered through the same extension overlay. This is a full live sports engagement platform, not just a betting product."

---

## Part 4 — Settlement (3:30 – 4:20)

**Navigate to:** Admin dashboard → Sevilla event → Settle Match

> "When the match ends, the admin triggers settlement. The Supabase edge function calls the smart contract's `settleMatch` function — in production, this would be triggered automatically by the Chainlink CRE oracle the moment the final whistle data is confirmed."

> "The contract verifies the result against the oracle data, distributes winnings automatically, and releases locked funds — all on-chain, provably fair."

**Show:** Transaction confirmed, balance updated

---

## Wrap-up (4:20 – 5:00)

**Return to:** Landing page

> "GOAL.LIVE combines Chainlink CRE oracles for trustless real-time data, smart contract escrow for transparent fund management, and a seamless TV-native UX — bringing provably fair live betting to the 54% of the market that demands it.
>
> Built on Sepolia. Powered by Chainlink.
>
> We have a team of developers and designers in Spain ready to take this to production. And we are in active discussions with **Stats Perform** — the global leader in live sports data, the company behind the Opta system — to run a pilot integration with their real-time feed.
>
> The infrastructure is live. The oracle layer is real. The market is ready. This is GOAL.LIVE."

---

## Screen Sequence Summary

| # | Screen | Duration |
|---|--------|----------|
| 1 | Landing page `/` — typewriter animating | 0:00 – 0:30 |
| 2 | Polymarket — live match odds | quick |
| 3 | Traditional bookmaker — numbers/odds | quick |
| 4 | Extension overlay on live game — impact shot | ~3 sec |
| 5 | Back to landing page | 0:30 – 1:00 |
| 6 | `/architecture` — flow diagram + code tab | 1:00 – 1:45 |
| 7 | Admin dashboard → Create Event → Sevilla | 1:45 – 2:30 |
| 8 | Sepolia Etherscan — contract address | brief |
| 9 | TV stream + extension → bet placement | 2:30 – 3:30 |
| 10 | Settle match in admin → tx confirmed | 3:30 – 4:20 |
| 11 | Landing page for close | 4:20 – 5:00 |
