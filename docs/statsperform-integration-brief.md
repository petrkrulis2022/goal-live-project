# goal.live × Stats Perform — Integration Brief

**Prepared for:** Stats Perform / Opta Business Development
**Contact:** Peter Krulis, Founder — petrkrulis@gmail.com
**Date:** June 12, 2026

---

## 1. What goal.live is

goal.live is a **patent-pending interactive betting overlay for live sports streams**. Instead of forcing fans to leave the stream and bet on stale odds in a separate app, our overlay renders betting markets directly on top of the video player — users bet on in-game micro-moments (next goal scorer, next corner, next card) in real time, with instant on-chain USDC settlement. Any sport, any device, any event.

**Traction & timeline:**

- 6 active beta testers today, averaging **15+ micro-bets per match** when friction is removed.
- **FIFA World Cup (June 11 – July 18, 2026): 100-tester beta across all 64 matches** — our major validation event, running now.
- $1M seed round in progress; 12-month roadmap explicitly includes Stats Perform odds/event integration and Phenix-based latency reduction as the next two milestones.

## 2. What we have already built on Opta

We are not starting from zero — we have a **working integration against the Opta SDAPI** (trial key), live in our `statsperform` branches today:

| Component | Opta product used | Status |
|---|---|---|
| OAuth 2.0 client-credentials flow against `api.statsperform.com` | API Gateway | ✅ Live |
| Match status, score, minute sync (polled every minute via cron) | **MA1 – Fixtures & Results** (`live=yes`) | ✅ Live |
| Goal & corner event detection (typeId 16 / 22, own-goal qualifier 55) | **MA3 – Match Events** | ✅ Live |
| Auto-seeding starting XIs into our player markets | **MA46 – Provisional Line-Ups** | ✅ Live |
| Bet locking, settlement triggers, odds history | Internal, driven by MA1/MA3 data | ✅ Live |

The full Opta soccer feed catalogue (MA0–MA62, TM, PE feeds) is already mapped in our data layer, and our oracle/settlement pipeline (Chainlink CRE, Hedera, Solana variants) consumes the same normalized event schema.

## 3. What we need from Stats Perform

Our product lives or dies on one thing: **video, events, and odds arriving on the user's screen at the same moment, with sub-second latency**. We believe Stats Perform is the only provider that can deliver all three from a single source, especially since the Phenix acquisition. Concretely:

### a) Ultra-low-latency live video — *Realtime Streaming / Bet LiveStreams (Phenix)*
- Sub-second (~0.5s) glass-to-glass streams of football matches that our overlay renders on top of.
- **Cross-device audience sync (≤100 ms)** so every user sees the same frame when a market opens or suspends — critical for fairness and courtsiding protection in micro-betting.
- Playback SDK / embeddable player we can wrap with our overlay (web first; browser-extension and mobile next).

### b) Real-time match events — *MA3 push / RunningBall Ultrafast Data*
- Upgrade from our current 60-second MA1/MA3 polling to **push delivery** (webhooks or streaming API) for goals, corners, cards, penalties, VAR, dangerous attacks.
- Event timestamps we can use to align data with the video timeline (see d).

### c) Live odds & micro-markets — *Bet Trading Data / Opta for Prediction Markets*
- Real-time in-play odds for match and micro-moment markets (next goal, next scorer, next corner, race-to-X), pushed as they change so our on-screen odds are never stale.
- Player-level pricing to power our clickable-player overlay (bet by tapping a player on the pitch).
- Settlement-grade results data — our smart contracts settle bets autonomously from these feeds, so we need the same source of truth for pricing and resolution.

### d) Synchronization layer — the key ask
A common clock between stream and data: per-frame or per-segment timestamps on the video plus matching timestamps on events/odds, so our platform can **gate market open/suspend/settle to what the user has actually seen**, consistently across all devices. This sync is the core of our patent-pending UX, and the reason we want video + data from one provider rather than stitching vendors together.

## 4. Proposed integration architecture

```
Opta MA feeds / RunningBall push ──► goal.live sync layer (Supabase edge functions, already built)
Bet Trading Data (odds push)     ──► odds engine ──► on-screen markets + on-chain settlement
Realtime Streaming (Phenix)      ──► video player ◄── overlay (timestamp-synced to feeds above)
```

We would start with **one league / competition scope on trial-to-production keys**, validate the synced pipeline during the remainder of the World Cup beta, then expand coverage with our post-seed league partnerships.

## 5. Asks for the BD team

1. Production access & pricing for: **MA1/MA3 (push), MA46, Bet Trading Data (or Opta for Prediction Markets), Realtime Streaming/Bet LiveStreams** for one pilot competition.
2. Technical documentation for push delivery and the stream/data synchronization mechanism (timestamps, SDKs).
3. Betting-rights guidance: which competitions Stats Perform can license to us for streaming with betting overlays in our launch markets (EU, starting CZ).
4. A technical call between our engineering team and your solutions engineers to validate the sync architecture.

---

*goal.live — E-sports meet prediction markets. Patent-pending interactive betting overlays for live streams.*
