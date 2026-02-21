# 🎯 goal.live

**Decentralized Live Football Betting Platform - MVP**

Part of the vibe.live ecosystem - Watch live matches, bet on Next Goal Scorer in real-time using USDC on Ethereum Sepolia.

---

## 🚀 START HERE (For Copilot & Developers)

**Read in this order:**

1. **[DEVELOPMENT_ROADMAP.md](./docs/DEVELOPMENT_ROADMAP.md)** 🔥  
   → **FULL product vision + phased build strategy**  
   → Complete architecture + tech stack  
   → Mock vs real integration approach  
   → **Read this FIRST**

2. **[MVP_FINAL_SPEC.md](./docs/MVP_FINAL_SPEC.md)**  
   → All MVP design decisions and constraints  
   → Quick reference for features

3. **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)**  
   → Technical deep dive  
   → System components

4. **[COPILOT_QUICK_START.md](./docs/COPILOT_QUICK_START.md)**  
   → Additional onboarding info

**Read this FIRST before starting any work.**

---

## 📁 Project Structure

```
goal.live/
├── docs/                              # All documentation
│   ├── 🔥 MVP_FINAL_SPEC.md          # ⭐ MVP specification (START HERE)
│   ├── 🔥 COPILOT_QUICK_START.md     # ⭐ Onboarding for new Copilot sessions
│   ├── ARCHITECTURE.md               # Complete system architecture
│   ├── FRONTEND_BUILD_PROMPT.md      # Frontend development guide
│   ├── IMPLEMENTATION_PLAN.md        # Phased dev plan + mock service code
│   ├── GENERAL_INFO.md               # Non-technical overview (4 parts)
│   ├── PROJECT_SPEC.md               # Original technical spec (pre-simplification)
│   └── PROJECT_SUMMARY.md            # Implementation guide (4 weeks)
├── src/                              # Source code (to be created in Phase 1)
│   ├── components/                   # React components
│   ├── services/                     # Business logic (mock + real)
│   │   ├── mock/                     # Phase 1: Mock implementations
│   │   ├── real/                     # Phase 2: Real backend integration
│   │   └── index.ts                  # Service factory (mock vs real switch)
│   ├── hooks/                        # Custom React hooks
│   ├── types/                        # TypeScript interfaces
│   └── utils/                        # Helper functions
└── extension/                        # Chrome extension (to be created)
    ├── manifest.json                 # Extension configuration
    ├── content-script.ts             # Injected into streaming pages
    └── background.ts                 # Service worker
```

---

## 🚀 Quick Start

### Phase 1: Frontend with Mock Backend (Current)

```bash
# Navigate to project
cd goal.live

# Install dependencies (once created)
npm install

# Start development server
npm run dev

# Load extension in Chrome
# 1. Go to chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select goal.live/extension folder
```

### Development Approach

We're using a **frontend-first strategy**:

1. ✅ **Phase 1 (Week 1-2):** Build UI with mock services → Rapid prototyping
2. ⏳ **Phase 2 (Week 3-4):** Integrate Chainlink CRE, smart contracts, Supabase
3. ⏳ **Phase 3 (Week 5-6):** Testing, deployment to mainnet

---

## 📚 Documentation

| File                                                             | Purpose                                                                                                                  | Audience                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** ✨                   | **Complete system architecture** - Frontend, backend, Chainlink CRE integration, smart contracts, data flow              | **All developers, architects**                |
| **[FRONTEND_BUILD_PROMPT.md](docs/FRONTEND_BUILD_PROMPT.md)** ✨ | **Frontend implementation guide** - Build instructions with mock backend, designed for seamless real backend integration | **Frontend developers, new Copilot sessions** |
| [GENERAL_INFO.md](docs/GOAL_LIVE_GENERAL_INFO.md)                | Non-technical overview divided into 4 parts (general, pre-match, in-game, after-game)                                    | Product managers, stakeholders                |
| [PROJECT_SPEC.md](docs/GOAL_LIVE_PROJECT_SPEC.md)                | Technical specification with 8-week timeline, database schemas, API contracts                                            | Engineers, architects                         |
| [PROJECT_SUMMARY.md](docs/GOAL_LIVE_PROJECT_SUMMARY.md)          | Implementation guide with code examples, TypeScript classes, 4-week timeline                                             | Frontend/backend developers                   |
| [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)            | Phased development plan with complete mock service code                                                                  | Team leads, project managers                  |

---

## 🎮 Key Features

### Real-Time Betting

- Bet on "Next Goal Scorer" while watching live matches
- 22 player buttons overlaid on YouTube/Twitch streams
- Instant wallet-based transactions (USDC)

### Bet Changes with Penalties

- Change your bet anytime during the match
- Penalty system (5% recommended for MVP)
- Balance updates in real-time
- Withdrawals only after final settlement

### Two-Phase Settlement

- **In-Game:** Provisional credits (can be reversed if VAR corrects goal)
- **Post-Game:** Actual payouts transferred to wallet

### Decentralized Architecture

- Chainlink CRE for tamper-proof sports data
- Smart contracts for bet locking and settlement
- No middleman, fully transparent

---

## 🛠 Tech Stack

| Layer               | Technology                             |
| ------------------- | -------------------------------------- |
| **Frontend**        | React 18, TypeScript 5.8, Tailwind CSS |
| **Extension**       | Chrome Manifest v3, Content Scripts    |
| **Blockchain**      | Base L2 (Ethereum) or Solana           |
| **Smart Contracts** | Solidity (Hardhat) or Rust (Anchor)    |
| **Oracle**          | Chainlink CRE → Opta Sports API        |
| **Database**        | Supabase (PostgreSQL)                  |
| **Wallet**          | RainbowKit (Base) or Phantom (Solana)  |
| **Testing**         | Vitest (unit), Playwright (E2E)        |

---

## 📖 How It Works

### 1. Pre-Match (15 minutes before kickoff)

- Extension detects live match on YouTube/Twitch
- Chainlink CRE fetches player lineup + odds
- 22 player buttons displayed (11 left, 11 right)

### 2. In-Game (Live Betting)

- User clicks player (e.g., "Messi - 4.5x")
- Confirms bet amount ($10 USDC)
- Funds locked in smart contract
- **User can change bet anytime:**
  - Click "Change Bet" → Select new player
  - Penalty deducted (e.g., 5% = $0.50)
  - New effective bet: $9.50 on new player
  - Balance updates immediately
- Goal scored → Provisional balance update
- Balance shown in real-time (not withdrawable yet)

### 3. After-Game (Settlement)

- Match ends → Chainlink CRE confirms official result
- Smart contract settles all bets
- Final balance calculated (including all penalties)
- Payouts transferred to winners' wallets
- Users can now withdraw

---

## 🧪 Current Status

**Phase:** Documentation Complete, Ready for Phase 1 Implementation

**Completed:**

- ✅ Requirements gathering
- ✅ Technical architecture design
- ✅ Database schema design
- ✅ Bet change feature specification
- ✅ Two-phase settlement model
- ✅ Phased implementation plan

**Next Steps:**

1. Create `src/` folder structure
2. Implement mock services (mockDataService, mockBettingService, mockWalletService)
3. Build React components (BettingOverlay, PlayerButton, BetModal)
4. Create Chrome extension manifest
5. Test betting flow with mock data
6. Get user feedback on UX

---

## 🤝 Related Projects

goal.live is part of the **vibe.live** ecosystem:

- **air.fun** - Decentralized AI agent marketplace
- **cube.pay** - Livestream creator monetization
- **goal.live** - Live sports betting (this project)

---

## 📝 Notes

### Bet Change Penalty Options (TBD)

We've documented 5 penalty calculation methods:

1. **Percentage-based:** 5% of current bet amount (recommended for MVP)
2. **Flat fee:** $1 per change
3. **Progressive:** 5%, 10%, 15% for 1st, 2nd, 3rd change
4. **Time-based:** Higher penalty closer to match end
5. **Hybrid:** $0.50 flat + 3% percentage

**Decision pending:** Choose penalty formula before Phase 2 implementation.

### Blockchain Choice (TBD)

- **Base L2:** Lower gas fees, Ethereum ecosystem, RainbowKit integration
- **Solana:** Ultra-low fees, fast transactions, Phantom wallet

**Decision pending:** Finalize blockchain before smart contract development.

---

## 📞 Contact

For questions about goal.live implementation, see documentation files or contact project lead.

**Last Updated:** February 19, 2026
