# goal.live × Even Realities G2 — Voice Betting on Smart Glasses

**Integration & Implementation Plan**
DotLive Interactive · June 12, 2026 · internal

---

## 1. Product concept (corrected for real hardware)

Two modes, one plugin:

| | **Stadium Mode** | **Companion Mode (off-stadium)** |
|---|---|---|
| What the user watches | The real pitch, through the lenses | The match on TV / laptop / phone (goal.live overlay or Phenix stream) |
| What the glasses show | Floating HUD: live odds, micro-markets, events, bet slip, P&L | Same HUD, synced to the stream the user is watching |
| How the user bets | Voice + temple-tap / R1 ring confirm | Voice + tap confirm |

**Hard constraint that shapes everything:** the Even G2 has **no camera, no speaker, and cannot render video** — dual micro-LED displays, 576×288 px per eye, monochrome green (16 levels), BLE 5.2 to the phone, four-mic array (16 kHz PCM), touchpad gestures + optional R1 ring. So "watch the low-latency stream in the glasses" is not possible on this hardware. The reframe is actually stronger: **the glasses are the bet slip you never have to look down at.** The stream stays on the big screen; eyes never leave the action; the voice + HUD loop replaces fumbling with a phone. This is a perfect second-screen/zero-screen product, not a video device.

## 2. Why this fits our stack

The Even Hub model: **plugins are plain web apps** (HTML/TS, Vite, React allowed) running in a WebView inside the Even Hub companion app on the phone. The `@evenrealities/even_hub_sdk` bridge (`EvenAppBridge`) gives us:

- `createStartUpPageContainer` + text/list/image containers → glasses UI (must be created first; one container owns event capture)
- `textContainerUpgrade` → up to 2000 chars paginated text
- Device status (connection, battery, worn state), local storage, user info
- Mic stream: **PCM s16le @ 16 kHz mono** routed to our code → any STT provider
- Gestures: press, double-press, swipe up/down (temples or R1 ring)
- Dev loop: desktop simulator → QR sideload to real glasses → `evenhub pack` → portal submission

We already have everything server-side: Supabase (matches, odds, `goal_events` with realtime enabled — migration 012), edge functions (`sync-odds`, `sync-match-status`, `lock-bet`, `settle-match`), StatsPerform MA1/MA3 feeds, and on-chain settlement (Solana/Hedera/CRE variants). **The glasses plugin is a new thin client on the existing backend — no new backend platform needed.**

## 3. Architecture

```
                        ┌────────────────────────── phone ──────────────────────────┐
G2 glasses  ◄──BLE──►   │ Even Hub app                                               │
 HUD render             │   └─ WebView: goal.live G2 plugin (TS + even_hub_sdk)      │
 mic PCM 16kHz          │        ├─ HUD state machine (odds / events / bet slip)     │
 tap/swipe events       │        ├─ Mic → STT stream (Deepgram/Soniox WS)            │
                        │        ├─ Intent parser (grammar + LLM fallback)           │
                        │        └─ goal.live session (Supabase JS + wallet link)    │
                        └──────────────┬─────────────────────────────────────────────┘
                                       │ wss / https
        ┌──────────────────────────────┴───────────────────────────┐
        │ goal.live backend (existing)                              │
        │  Supabase Realtime ── odds + goal_events push             │
        │  lock-bet / settle-match edge functions                   │
        │  StatsPerform MA1/MA3 (→ push when BD deal lands)         │
        │  on-chain settlement (Solana / Hedera / CRE)              │
        └────────────────────────────────────────────────────────────┘
```

Data flow for one bet: event/odds push → Supabase Realtime → plugin → HUD container update (BLE) → user says *"five dollars, next corner"* → mic PCM → STT (~300 ms streaming) → intent parser → **confirmation card on HUD** → temple tap / "confirm" → `lock-bet` edge function → on-chain lock → HUD shows ticket + later settlement toast.

### Voice pipeline detail

1. **Push-to-talk, not always-on.** Hold/press temple pad (or ring) to open the mic. Saves battery, avoids accidental bets, and is the only thing that works in an 80 dB stadium.
2. **STT:** streaming WebSocket provider (Deepgram Nova or Soniox; both accept s16le/16k directly — the ASR template's `stt.ts` stub is built for exactly this). Czech + English models from day one.
3. **Intent parsing, two tiers:**
   - *Tier 1 — constrained grammar* (regex/CFG over normalized transcript): `bet|vsaď {amount} on {market}`, `odds on {player|market}`, `cancel`, `confirm`, `balance`. Covers >90 % of commands, runs locally, ~0 ms.
   - *Tier 2 — LLM fallback* (Claude Haiku via our backend) for free-form utterances ("put a fiver on Haaland scoring next"), returning a typed intent or a clarification question. Never auto-executes.
4. **Confirmation is non-negotiable:** every stake-moving intent renders a HUD card (`MARKET / STAKE / ODDS / payout`) and requires an explicit **gesture** confirm (tap is more robust than voice-yes in noise; voice "confirm" accepted as secondary). Misheard bets must be structurally impossible.

### HUD design (576×288, monochrome — think instrument panel, not app)

```
┌──────────────────────────────────────────┐
│ SLA 1–0 PLZ  67'        ● LIVE   ⌁ 82%   │   status strip
│                                          │
│ NEXT GOAL   SLA 1.85  ·  PLZ 4.20        │   2–3 market lines,
│ NEXT CORNER 2.10      ·  CARD 3.60       │   swipe to rotate
│                                          │
│ ▸ "Hold to speak"            bal $48.20  │   action hint + balance
└──────────────────────────────────────────┘
```

Event toasts (goal, corner, market suspended, bet settled) interrupt for ~4 s then restore. Max ~5 short lines visible; everything else is swipe-paged. All UI as text/list containers — no images needed in v1 (faster BLE updates).

### Sync & fairness

- **Stadium mode** users see reality at T0 — *ahead of* our data feed. Mitigation: market suspension latency is what matters; with StatsPerform push (RunningBall ~1–2 s) we suspend micro-markets on event detection before a voice bet can complete (voice round-trip ≥2–3 s). Document this in the market rules.
- **Companion mode** reuses the StatsPerform sync-layer work (stream timestamps ↔ event timestamps) from the BD brief — the glasses HUD subscribes to the same gated market state as the on-screen overlay, so HUD and stream never disagree.

## 4. Implementation plan

### Phase 0 — Spike (1 week, no hardware needed)
- Clone `even-realities/evenhub-templates` → `asr/` scaffold into new repo dir `glasses-g2/`.
- Run desktop simulator (`evenhub-simulator`); wire `stt.ts` to Deepgram trial.
- Render live odds for one Supabase match into a text container.
- **Exit criterion:** simulated G2 shows real goal.live odds updating live; transcript of spoken bet command visible.
- Order 2× G2 + R1 ring dev units in parallel (lead time risk).

### Phase 1 — Read-only HUD (2 weeks)
- Plugin app shell: match picker (companion WebView UI), glasses HUD state machine, container layout above.
- Supabase Realtime subscriptions: odds changes, `goal_events`, match status (reuse channels from the extension overlay).
- Event toasts; reconnect/offline handling (BLE drop, network drop); battery/worn-state awareness (pause when glasses off).
- **Exit criterion:** wear glasses during a real broadcast match; odds + goals appear on HUD within ~2 s of our DB update, 90-min session without crash.

### Phase 2 — Voice betting (3 weeks)
- Push-to-talk capture; streaming STT; Tier-1 grammar parser (EN + CZ); confirmation card + gesture confirm; `lock-bet` integration with the user's linked wallet (session-key / delegated signer so no phone interaction per bet — same pattern as the extension's bridge).
- Tier-2 LLM intent fallback behind a feature flag.
- Bet lifecycle on HUD: pending → locked → won/lost toast (from `settle-match`).
- Safety rails: per-session stake cap, balance floor, "undo within 5 s" where market rules allow, mandatory confirm always.
- **Exit criterion:** 20 consecutive spoken bets, zero unintended executions, median voice-to-locked < 4 s.

### Phase 3 — Stadium mode + hardening (3–4 weeks)
- Noise robustness: field-test STT at a live CZ league match; tune push-to-talk, grammar-biased keywords (team/player names injected as STT hints), ring confirm.
- Market-suspension latency work tied to StatsPerform push migration (shared milestone with the BD deal).
- Companion-mode sync: HUD market state driven by the same timestamp gate as the stream overlay.
- Localization polish, onboarding flow (pair → link wallet → tutorial bet on testnet).
- **Exit criterion:** end-to-end stadium pilot at one match with 3–5 testers; latency + error budget report.

### Phase 4 — Beta & distribution (2 weeks + review time)
- **Beta = QR sideload** to our existing tester cohort — no store approval needed, ships immediately (mirrors the World Cup beta model; testnet USDC, mainnet winnings).
- In parallel: `evenhub pack` + developer-portal submission. **Risk:** Even Hub content policy on real-money gambling is unpublished — engage their developer relations early; fallback is staying sideload-only for regulated users, or shipping the HUD as "live odds + prediction game" tier in-store with money flows only via sideload/companion app.
- Analytics: voice-intent success rate, confirm-abandon rate, session length, bets/match (target: beat the 15+/match phone baseline).

**Total: ~9–10 weeks** to stadium-pilot-ready with 1 frontend dev (Pierre) + shared backend (Oussama); founder does stadium field tests.

## 5. New components in the repo

| Path | What |
|---|---|
| `glasses-g2/` | Vite + TS plugin (from `asr` template): `src/hud/` containers & state, `src/voice/` stt + intents, `src/betting/` session + lock-bet client, `app.json` manifest (`g2-microphone`, `network`) |
| `supabase/functions/voice-intent/` | Tier-2 LLM intent parser (Claude Haiku), returns typed `BetIntent \| Clarification` |
| `supabase/functions/glasses-session/` | Short-lived delegated betting session keys + stake caps |
| Existing, reused | `sync-odds`, `sync-match-status`, `lock-bet`, `settle-match`, realtime `goal_events`, wallet bridges |

## 6. Costs & risks

| Item | Estimate / note |
|---|---|
| Dev hardware | 2× G2 + R1 ≈ $1,400–1,800 |
| STT | Deepgram streaming ≈ $0.0059/min → ~$0.55 per user-match at full-match push-to-talk usage; effectively pennies (mic only open while held) |
| LLM fallback | Haiku, ~$0.001/utterance |
| **Top risks** | ① Even Hub store policy on gambling (mitigate: sideload beta, early DevRel contact) ② stadium-noise STT accuracy (mitigate: push-to-talk + grammar bias + ring confirm) ③ SDK is v0.0.x — breaking changes likely (pin versions, thin abstraction over bridge) ④ regulatory: voice betting still needs the same licensing as the overlay; responsible-gambling rails (caps, cooldowns) built in from Phase 2 |

## 7. Why this is worth a pitch-deck slide

"Any device" becomes literal: phone → browser overlay → **glasses**. Stadium mode is a demo nobody else can show — live odds floating over a real pitch, a spoken bet, settled on-chain before the corner is taken. It deepens the StatsPerform story too: their push feeds and sync layer are exactly what make the HUD trustworthy.

---

*Sources: Even Realities developer overview (hub.evenrealities.com/docs), `@evenrealities/even_hub_sdk` v0.0.10 (npm), `even-realities/evenhub-templates` (GitHub: minimal / asr / image / text-heavy scaffolds).*
