# goal.live - Quick Start for New Copilot Session

**Context:** Building a decentralized live football betting platform  
**Strategy:** Phased build (Frontend mocks → Backend → CRE → AI)  
**Last Updated:** February 20, 2026

---

## 🚀 START HERE: Development Roadmap

**🎯 MOST IMPORTANT:** Read **[DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)** FIRST

This document explains:

- ✅ **FULL product vision** (complete architecture + tech stack)
- ✅ **Phased build approach** (Phase 1: frontend mocks → Phase 4: full MVP)
- ✅ **Mock vs real strategy** (what's mocked when, what's real when)
- ✅ Service abstraction pattern
- ✅ CRE integration flexibility

**Then read:**

- **[MVP_FINAL_SPEC.md](./MVP_FINAL_SPEC.md)** - All design decisions
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical deep dive

---

## 🎯 Project Summary

**goal.live** is a Chrome extension that overlays betting controls on YouTube/Twitch football streams. Users can:

- Bet on **"Next Goal Scorer"** only (MVP single bet type)
- Change bets unlimited times during match (with hybrid penalty: base × time-decay)
- Receive **provisional balance** during match, **final settlement** post-match
- Use **USDC on Ethereum Sepolia testnet** (no memecoin, no Solana for MVP)
- Authenticate with **World ID** (start, finish, withdrawal)
- **Static side list UI** (11 players left, 11 right - no tracking overlay)
- **Force unmute** for ACR audio game sync

---

## 📋 What You Need to Know

### Critical Design Principle: Service Abstraction

**Frontend NEVER imports mock or real services directly.**

✅ **Always do this:**

```typescript
import { services } from "../services";
const result = await services.betting.placeBet();
```

❌ **Never do this:**

```typescript
import { mockBettingService } from "../services/mock/mockBettingService";
const result = await mockBettingService.placeBet();
```

**Why:** When we switch from mock to real backend, only 1 file changes (`src/services/index.ts`) - zero component changes!

---

## 📂 Key Files to Read First

**Start here (in order):**

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system overview
   - Frontend, backend, blockchain architecture
   - Chainlink CRE integration points
   - Data flow diagrams
   - Tech stack details

2. **[FRONTEND_BUILD_PROMPT.md](./FRONTEND_BUILD_PROMPT.md)** - Your build instructions
   - Step-by-step implementation guide
   - Complete React component code
   - Service abstraction explanation
   - Testing checklist

3. **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** - Mock service code
   - Full `mockDataService.ts` implementation
   - Full `mockBettingService.ts` implementation
   - Full `mockWalletService.ts` implementation

4. **[GENERAL_INFO.md](./GOAL_LIVE_GENERAL_INFO.md)** - Business logic
   - User flows (4 parts: general, pre-match, in-game, after-game)
   - Bet change mechanics
   - Two-phase settlement model

---

## 🛠 Tech Stack (MVP)

| Layer              | Technology                               |
| ------------------ | ---------------------------------------- |
| **UI**             | React 18 + TypeScript 5.8 + Tailwind CSS |
| **Extension**      | Chrome Manifest v3                       |
| **State**          | React Hooks + Context + React Query      |
| **Authentication** | World ID (may be mocked for MVP)         |
| **Wallet**         | RainbowKit (Ethereum Sepolia)            |
| **Mock Data**      | localStorage (Phase 1)                   |
| **Real Backend**   | Supabase + Chainlink CRE (Phase 2)       |
| **Blockchain**     | Ethereum Sepolia Testnet                 |
| **Currency**       | USDC (testnet)                           |

---

## 🚀 Your Task (Phase 1)

**Build the frontend with mock backend that's ready for real backend integration.**

### Step-by-Step:

1. **Setup Project**

   ```bash
   npm create vite@latest . -- --template react-ts
   npm install tailwindcss autoprefixer postcss
   ```

2. **Create Type Definitions**
   - Copy interfaces from `FRONTEND_BUILD_PROMPT.md` → `src/types/`

3. **Implement Mock Services**
   - Copy code from `IMPLEMENTATION_PLAN.md` → `src/services/mock/`
   - Ensure each implements the interface from `src/types/services.types.ts`

4. **Create Service Factory**

   ```typescript
   // src/services/index.ts
   const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

   export const services = {
     data: USE_MOCK ? mockDataService : realDataService,
     betting: USE_MOCK ? mockBettingService : realBettingService,
     wallet: USE_MOCK ? mockWalletService : realWalletService,
   };
   ```

5. **Build React Components**
   - Copy components from `FRONTEND_BUILD_PROMPT.md` → `src/components/`
   - All components import from `services` (never mock directly)

6. **Chrome Extension Setup**
   - Create `extension/manifest.json`
   - Create `extension/content-script.ts` (injects React app)
   - Create `extension/background.ts` (service worker)

7. **Test Everything**
   - Load extension in Chrome
   - Place bets → balance updates
   - Change bets → penalty applied
   - Simulate goals → provisional winnings
   - Verify persistence (reload page)

---

## ✅ Success Criteria

**Phase 1 is done when:**

- ✅ Chrome extension loads on YouTube/Twitch
- ✅ 22 player buttons render (11 left, 11 right)
- ✅ Bet placement works with mock wallet
- ✅ Bet changes work with penalty calculation
- ✅ Balance updates in real-time
- ✅ **All components use `services` abstraction** (ready for backend switch)

---

## 🔄 Backend Integration (Phase 2)

**When ready for real backend:**

1. Implement `src/services/real/dataService.ts` (Chainlink CRE)
2. Implement `src/services/real/bettingService.ts` (Supabase + contracts)
3. Implement `src/services/real/walletService.ts` (RainbowKit)
4. Change `.env`: `VITE_USE_MOCK=false`
5. **Zero component changes needed!** ✨

---

## 📖 Important Concepts

### Bet Change Flow

```
User places $10 bet on Messi (4.5x odds)
         ↓
15 minutes later, wants to switch to Ronaldo
         ↓
Click "Change Bet" → Select Ronaldo
         ↓
5% penalty = $0.50 deducted
         ↓
New bet: $9.50 on Ronaldo at current odds (3.2x)
         ↓
Balance updates immediately (but not withdrawable yet)
```

### Two-Phase Settlement

```
PHASE 1 (In-Game):
- Goal scored → Provisional balance update
- Show winnings in UI
- NOT withdrawable (could be reversed by VAR)

PHASE 2 (Post-Game):
- Match ends → Chainlink CRE confirms official result
- Smart contract settles all bets
- Final payouts transferred to wallet
- NOW withdrawable ✅
```

### Service Interface Contract

```typescript
// Both mock and real MUST implement:
interface IBettingService {
  placeBet(params: PlaceBetParams): Promise<PlaceBetResult>;
  changeBet(params: ChangeBetParams): Promise<ChangeBetResult>;
  getBets(wallet: string): Promise<Bet[]>;
  getBalance(): BalanceState;
  settleBets(matchId: string): Promise<void>;
}
```

---

## 🎨 UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  [Balance: $100]         REAL MADRID 2-1 FCB         45'│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Benzema 9]                          [Lewandowski 9]  │
│  [Modrić 10]      [YouTube Video]     [Raphinha 22]    │
│  [Vinicius 7]                         [Gavi 6]         │
│  [Rodrygo 21]                         [Pedri 8]        │
│  ...                                  ...               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Player Button:**

```
┌──────────────────┐
│ Benzema      9x  │  ← Click to bet
│ #9 • ST          │
└──────────────────┘
```

---

## 🐛 Common Mistakes to Avoid

❌ **Don't:**

- Import mock services directly in components
- Hard-code mock data in components
- Use localStorage directly (use service abstraction)
- Skip TypeScript interface definitions

✅ **Do:**

- Always import from `services` factory
- Keep all data/state in services
- Use TypeScript strictly
- Follow interface contracts
- Test mock first, then switch to real

---

## 📞 Questions?

**Read these files in order:**

1. ARCHITECTURE.md - Big picture
2. FRONTEND_BUILD_PROMPT.md - Implementation details
3. IMPLEMENTATION_PLAN.md - Mock service code
4. GENERAL_INFO.md - Business logic

**Key principle:** Build frontend once, swap backend services via environment variable.

---

**Ready to build? Start with [FRONTEND_BUILD_PROMPT.md](./FRONTEND_BUILD_PROMPT.md)!**
