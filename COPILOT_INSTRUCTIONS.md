# 📋 Copilot Instructions for goal.live MVP Build

**Date:** February 21, 2026 (Before Manchester City vs Newcastle Match)  
**Goal:** Build Phase 1 frontend + mock backend services  
**Game Integration:** Will be added AFTER match (Feb 22)

---

## 🎯 READ THESE FILES IN THIS EXACT ORDER

### **STEP 1: Foundation & Vision (READ FIRST - 30 mins)**

These files establish the FULL product vision and phased approach:

1. **[COPILOT_QUICK_START.md](./docs/COPILOT_QUICK_START.md)** ← START HERE
   - Quick overview of the project
   - What you're building and why

2. **[DEVELOPMENT_ROADMAP.md](./docs/DEVELOPMENT_ROADMAP.md)** ← MOST IMPORTANT
   - Part 1: Complete architecture diagram + tech stack
   - Part 2: 4-phase phased build strategy
   - Part 3: Mock vs Real decision matrix
   - Part 4: Service abstraction pattern
   - **KEY TAKEAWAY:** Phase 1 = Frontend ONLY, ALL mocked, no backend/contracts/CRE yet

3. **[MVP_FINAL_SPEC.md](./docs/MVP_FINAL_SPEC.md)**
   - MVP scope, constraints, design decisions
   - What's IN the MVP, what's NOT

4. **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)**
   - Deep technical architecture
   - All system components and data flows

---

### **STEP 2: Phase 1 - Frontend Build (READ NEXT - 30 mins)**

These files contain the actual build instructions for Phase 1:

5. **[FRONTEND_BUILD_PROMPT.md](./docs/FRONTEND_BUILD_PROMPT.md)** ← BUILD THIS FIRST
   - Detailed Phase 1 instructions
   - All mock services explained
   - Component structure
   - Service abstraction patterns to implement
   - **ACTION:** This is what you START building immediately

6. **[GOAL_LIVE_GENERAL_INFO.md](./docs/GOAL_LIVE_GENERAL_INFO.md)**
   - User flows and requirements reference
   - External data structure reference

7. **[IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)**
   - Phase-by-phase implementation details
   - Deliverable checklists for each phase

---

### **STEP 3: Reference (Read as needed)**

These are reference docs for specific components:

8. **[GOAL_LIVE_PROJECT_SPEC.md](./docs/GOAL_LIVE_PROJECT_SPEC.md)**
   - Full product features and settlement model
   - Use this to understand complete feature set

9. **[GOAL_LIVE_PROJECT_SUMMARY.md](./docs/GOAL_LIVE_PROJECT_SUMMARY.md)**
   - Comprehensive project overview
   - Useful if you need context on any component

---

## 🚀 BUILD PLAN

### **Phase 1: Frontend with Mock Services (START NOW)**

**What to build:**

```
FRONTEND (React + Vite)
├── Components
│   ├── LivestreamDisplay
│   ├── BetPanel (11 left, 11 right players)
│   ├── PlayerCard (individual player bet interface)
│   └── SettlementDisplay
└── Mock Services (all in-memory for Phase 1)
    ├── MockWalletService (fake MetaMask connection)
    ├── MockBettingService (in-memory bet storage)
    ├── MockMatchService (hardcoded match data)
    ├── MockCREService (simulated goal events)
    └── MockOddsService (random odds fluctuations)
```

**Duration:** Week 1-2

**Do NOT build yet:**

- ❌ Backend/Supabase
- ❌ Smart contracts
- ❌ Real CRE integration
- ❌ World ID authentication
- ❌ ML model

---

## ⚠️ IMPORTANT: Manchester City Files (READ THESE LAST)

### **DO NOT READ THESE YET:**

These files are for **AFTER the match** (Feb 22 onwards):

- ❌ `CRE_API_ARCHITECTURE.md` (in root folder)
- ❌ `MVP_BUILD_PLAN.md` (in root folder)
- ❌ `README_MVP_GUIDE.md` (in root folder)
- ⚠️ `LIVE_ODDS_CAPTURE_AND_MOCK_CRE_API.md` (reference only if needed)

### **Why?**

These files contain:

- ✅ Real Manchester City vs Newcastle match data (from Feb 21 game)
- ✅ Real pre-match odds (from The Odds API)
- ✅ Real live odds snapshots during the match
- ✅ Real match events (goals, substitutions, etc.)
- ✅ Real live statistics (shots, xG, possession, etc.)
- ✅ ML model architecture for odds prediction

**Integration Timeline:**

1. **Feb 21, 20:00-21:30 UTC:** Match happens → We capture real game data
2. **Feb 22:** Populate game data + odds snapshots into files
3. **Feb 22 afternoon:** Share updated game data files with you
4. **Feb 22 late:** You integrate real game data into Phase 1 frontend as final step

---

## 📊 Phase 1 Frontend Mock Data Structure

**For now, use THIS mock structure** (from the 11 original files):

```typescript
// Mock Match Data
const mockMatch = {
  id: "match_001",
  homeTeam: "Manchester City",
  awayTeam: "Newcastle United",
  kickoffTime: new Date("2026-02-21T20:00:00Z"),
  players: [
    // 11 City players (left side)
    { id: "city_1", name: "Haaland", position: "ST", odds: 1.52 },
    { id: "city_2", name: "Foden", position: "LW", odds: 2.8 },
    // ... 9 more
    // 11 Newcastle players (right side)
    { id: "newc_1", name: "Isak", position: "ST", odds: 3.5 },
    // ... 10 more
  ],
};

// Mock Odds (update dynamically during simulation)
const mockOdds = {
  city_1: 1.52,
  city_2: 2.8,
  // ... all players
};

// Mock Goals (simulated events)
const mockGoals = [
  { playerId: "city_1", playerName: "Haaland", minute: 15 },
  { playerId: "city_2", playerName: "Foden", minute: 38 },
  // ... more goals
];
```

**After Feb 22:** These will be replaced with REAL data from the match.

---

## ✅ Phase 1 Completion Checklist

When Phase 1 is complete, you should have:

- ✅ React + Vite frontend running
- ✅ 22 player cards (11 left, 11 right) displaying on screen
- ✅ Click player card → place bet (mock USDC amount)
- ✅ MockCREService progresses match in accelerated time (10x speed)
- ✅ When goal happens → odds update dynamically
- ✅ User balance updates with provisional credits (PENDING)
- ✅ Full match replay works (90 minutes in ~9 minutes)
- ✅ Reset button allows infinite replays
- ✅ Service abstraction patterns in place (easy to swap mock/real later)

---

## 🔄 Phase 2+ (LATER - Not yet)

Once Phase 1 is approved:

- **Phase 2:** Smart contracts on Sepolia (CONTRACTS_BUILD_PROMPT.md)
- **Phase 3:** Supabase backend + CRE integration (BACKEND_BUILD_PROMPT.md)
- **Phase 4:** AI dashboard + World ID (reference CRE_CHAINLINK_INTEGRATION_GUIDE.md)

---

## 📅 Timeline

| Date                    | Task                                                   | Responsible |
| ----------------------- | ------------------------------------------------------ | ----------- |
| **Feb 21 (Today)**      | Read files Step 1-2 above, start Phase 1 frontend      | Copilot     |
| **Feb 21, 20:00-21:30** | Manchester City vs Newcastle match                     | Real world  |
| **Feb 21, Post-match**  | Capture game stats + odds evolution                    | Team        |
| **Feb 22 (Tomorrow)**   | Populate real game data into files, share with Copilot | Team        |
| **Feb 22 afternoon**    | Integrate real game data into Phase 1 (FINAL)          | Copilot     |
| **Feb 22 evening**      | Complete Phase 1 MVP demo with real game data          | Copilot     |

---

## 🎯 Key Principles for Phase 1

1. **Frontend First** - Get UI/UX right before touching backend
2. **All Mocked** - ZERO real API calls in Phase 1
3. **Service Abstraction** - Every external service uses an interface so we can swap mock ↔ real later
4. **Speed Over Perfection** - Validate UX quickly, polish later
5. **Repeatable** - Full match replay should work anytime, anywhere (no timing dependencies)

---

## ❓ Questions?

If you get stuck:

- Reread DEVELOPMENT_ROADMAP.md Part 4 (Service Abstraction Pattern)
- Check FRONTEND_BUILD_PROMPT.md for examples
- All mock services should be simple in-memory implementations

**You're building a DEMO, not production code. Keep it simple.**

---

**Ready to start?** Begin with COPILOT_QUICK_START.md and follow the reading order above. 🚀
