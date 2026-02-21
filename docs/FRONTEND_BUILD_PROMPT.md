# goal.live Frontend Build Prompt (Phase 1)

**Target:** Another Copilot session / Developer  
**Phase:** 1 - Frontend with Mock Backend (ALL mocked, no real services)  
**Duration:** Week 1-2  
**Last Updated:** February 20, 2026

---

## 🎯 Context

**This is Phase 1 of a multi-phase build.**  
See **[DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)** for the full product vision and phased strategy.

**Phase 1 Goal:** Build playable frontend UI with ALL services mocked to test game experience.  
**No backend, no smart contracts, no CRE integration needed yet.**

---

## Objective

Build a **fully functional frontend** for goal.live with **mock backend services** that allows rapid UI/UX iteration and validation. The frontend MUST be designed to support **seamless backend integration** in Phase 2 without requiring component rewrites.

---

## Critical Design Principles

### 🎯 Principle 1: Service Abstraction Layer

**Components must NEVER directly import mock or real services.**

✅ **Correct:**

```typescript
import { services } from "../services";

const handleBet = () => services.betting.placeBet();
```

❌ **Wrong:**

```typescript
import { mockBettingService } from "../services/mock/mockBettingService";

const handleBet = () => mockBettingService.placeBet();
```

**Why:** When we switch to real backend, we only change the service factory - zero component changes needed.

### 🎯 Principle 2: Interface-Driven Development

All services implement the same TypeScript interfaces:

```typescript
// src/types/services.types.ts

export interface IDataService {
  getMatch(matchId: string): Promise<Match>;
  getPlayers(matchId: string): Promise<Player[]>;
  subscribeToMatch(matchId: string, callbacks: MatchCallbacks): () => void;
}

export interface IBettingService {
  placeBet(params: PlaceBetParams): Promise<PlaceBetResult>;
  changeBet(params: ChangeBetParams): Promise<ChangeBetResult>;
  getBets(wallet: string): Promise<Bet[]>;
}

export interface IWalletService {
  connect(): Promise<WalletState>; // Ethereum Sepolia only for MVP
  disconnect(): void;
  getBalance(): Promise<number>;
}
```

**Both mock and real services MUST match these interfaces exactly.**

### 🎯 Principle 3: Environment-Based Switching

```typescript
// src/services/index.ts (Service Factory)

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

export const services = {
  data: USE_MOCK ? mockDataService : realDataService,
  betting: USE_MOCK ? mockBettingService : realBettingService,
  wallet: USE_MOCK ? mockWalletService : realWalletService,
};
```

**Single environment variable controls entire app behavior.**

---

## Project Setup

### 1. Initialize Project

```bash
# Create project directory
cd goal.live
npm create vite@latest . -- --template react-ts

# Install dependencies
npm install

# Install additional packages
npm install @tanstack/react-query tailwindcss autoprefixer postcss
npm install @worldcoin/idkit  # World ID SDK for authentication
npm install -D @types/chrome vitest @playwright/test

# Initialize Tailwind
npx tailwindcss init -p
```

### 2. Configure Tailwind

```javascript
// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./extension/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#10b981", // Green for active bets
        danger: "#ef4444", // Red
        warning: "#f59e0b", // Orange for penalties
      },
    },
  },
  plugins: [],
};
```

### 3. Environment Variables

```env
# .env.development
VITE_USE_MOCK=true
VITE_APP_NAME=goal.live
VITE_DEBUG=true
VITE_WORLD_APP_ID=app_staging_xxx  # World ID app ID (test mode)

# .env.production (for later)
VITE_USE_MOCK=false
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-key
VITE_CHAINLINK_CRE_URL=https://cre.chainlink.com/api
VITE_CONTRACT_ADDRESS=0x...  # Sepolia testnet contract
VITE_WALLET_CONNECT_PROJECT_ID=your-id
VITE_WORLD_APP_ID=app_xxx  # World ID app ID (production)
```

### 4. Chrome Extension Manifest

```json
// extension/manifest.json
{
  "manifest_version": 3,
  "name": "goal.live - Live Football Betting",
  "version": "1.0.0",
  "description": "Bet on live football matches using crypto",
  "permissions": ["activeTab", "storage"],
  "host_permissions": ["https://www.youtube.com/*", "https://www.twitch.tv/*"],
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/watch*", "https://www.twitch.tv/*"],
      "js": ["content-script.js"],
      "css": ["content-styles.css"]
    }
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "web_accessible_resources": [
    {
      "resources": ["assets/*"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

---

## Phase 1 Implementation Tasks

### Task 1: Setup Type Definitions

**File:** `src/types/index.ts`

```typescript
// src/types/index.ts

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  status: "pre-match" | "live" | "finished";
  currentMinute: number;
  score: { home: number; away: number };
}

export interface Player {
  id: string;
  name: string;
  team: "home" | "away";
  number: number;
  position: string;
  odds: number;
}

export interface Bet {
  id: string;
  bettorWallet: string;
  matchId: string;
  betType: "NEXT_GOAL_SCORER" | "MATCH_WINNER";
  original_player_id: string;
  current_player_id: string;
  original_amount: number;
  current_amount: number;
  total_penalties: number;
  change_count: number;
  odds: number;
  status:
    | "active"
    | "provisional_win"
    | "provisional_loss"
    | "settled_won"
    | "settled_lost";
  placedAt: string;
}

export interface BetChange {
  bet_id: string;
  from_player_id: string;
  to_player_id: string;
  penalty_amount: number;
  penalty_type: "hybrid"; // Fixed for MVP: time-decay + progressive
  changed_at: string;
  match_minute: number;
}

export interface BalanceState {
  wallet: number; // Withdrawable USDC
  locked: number; // USDC in active bets
  provisional: number; // Pending winnings (not withdrawable)
}

export interface WalletState {
  connected: boolean;
  address: string | null;
  balance: number;
  network: "sepolia" | null; // Ethereum Sepolia testnet for MVP
}

// Service method parameters
export interface PlaceBetParams {
  playerId: string;
  amount: number;
  betType: "NEXT_GOAL_SCORER" | "MATCH_WINNER";
  odds: number;
}

export interface PlaceBetResult {
  success: boolean;
  betId: string;
  error?: string;
}

export interface ChangeBetParams {
  betId: string;
  newPlayerId: string;
  currentMatchMinute: number;
}

export interface ChangeBetResult {
  success: boolean;
  penalty: number;
  newAmount: number;
  error?: string;
}

export interface MatchCallbacks {
  onGoal: (playerId: string) => void;
  onUpdate: (match: Match) => void;
  onEnd: () => void;
}
```

**File:** `src/types/services.types.ts`

```typescript
// src/types/services.types.ts

import type {
  Match,
  Player,
  Bet,
  WalletState,
  PlaceBetParams,
  PlaceBetResult,
  ChangeBetParams,
  ChangeBetResult,
  MatchCallbacks,
} from "./index";

export interface IDataService {
  getMatch(matchId: string): Promise<Match>;
  getPlayers(matchId: string): Promise<Player[]>;
  subscribeToMatch(matchId: string, callbacks: MatchCallbacks): () => void;
  triggerGoal?(playerId: string): void; // Optional (mock only)
}

export interface IBettingService {
  placeBet(params: PlaceBetParams): Promise<PlaceBetResult>;
  changeBet(params: ChangeBetParams): Promise<ChangeBetResult>;
  getBets(wallet: string): Promise<Bet[]>;
  getBalance(): { wallet: number; locked: number; provisional: number };
  settleBets(matchId: string): Promise<void>;
  reset?(): void; // Optional (mock only)
}

export interface IWalletService {
  connect(): Promise<{ success: boolean; error?: string }>; // Sepolia only
  disconnect(): void;
  getState(): WalletState;
  getBalance(): Promise<number>;
  updateBalance?(newBalance: number): void; // Optional (mock only)
}
```

---

### Task 2: Implement Mock Services

**Use the complete code from [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md):**

1. **Copy** `mockDataService.ts` code → `src/services/mock/mockDataService.ts`
2. **Copy** `mockBettingService.ts` code → `src/services/mock/mockBettingService.ts`
3. **Copy** `mockWalletService.ts` code → `src/services/mock/mockWalletService.ts`

**Ensure each service implements the interface:**

```typescript
// src/services/mock/mockDataService.ts
import type { IDataService } from "../../types/services.types";

class MockDataService implements IDataService {
  // ... implementation from IMPLEMENTATION_PLAN.md
}

export const mockDataService = new MockDataService();
```

---

### Task 3: Create Service Factory

**File:** `src/services/index.ts`

```typescript
// src/services/index.ts

import { mockDataService } from "./mock/mockDataService";
import { mockBettingService } from "./mock/mockBettingService";
import { mockWalletService } from "./mock/mockWalletService";

// Real services (to be implemented in Phase 2)
// import { dataService } from './real/dataService';
// import { bettingService } from './real/bettingService';
// import { walletService } from './real/walletService';

// For Phase 1, always use mock services
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

// Service factory - ONLY place where mock/real decision is made
export const services = {
  data: USE_MOCK ? mockDataService : (null as any), // Replace null with real service in Phase 2
  betting: USE_MOCK ? mockBettingService : (null as any),
  wallet: USE_MOCK ? mockWalletService : (null as any),
};

// Type-safe exports
export type Services = typeof services;
```

---

### Task 4: Build React Components

#### 4.1 Main Overlay Component

**File:** `src/components/BettingOverlay.tsx`

```typescript
// src/components/BettingOverlay.tsx

import React, { useEffect, useState } from 'react';
import { services } from '../services';
import type { Match, Player } from '../types';
import { PlayerButton } from './PlayerButton';
import { BetModal } from './BetModal';
import { BalanceDisplay } from './BalanceDisplay';
import { MatchInfo } from './MatchInfo';

export const BettingOverlay: React.FC = () => {
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showBetModal, setShowBetModal] = useState(false);

  useEffect(() => {
    // Load match and players
    const loadData = async () => {
      try {
        const matchData = await services.data.getMatch('mock-match-001');
        const playersData = await services.data.getPlayers('mock-match-001');

        setMatch(matchData);
        setPlayers(playersData);
      } catch (error) {
        console.error('Failed to load match data:', error);
      }
    };

    loadData();

    // Subscribe to live match updates
    const unsubscribe = services.data.subscribeToMatch('mock-match-001', {
      onGoal: (playerId) => {
        console.log('Goal scored by player:', playerId);
        // Handle goal event (update UI, show animation)
      },
      onUpdate: (updatedMatch) => {
        setMatch(updatedMatch);
      },
      onEnd: () => {
        console.log('Match ended');
        // Trigger settlement
      },
    });

    return () => unsubscribe();
  }, []);

  const homePlayers = players.filter(p => p.team === 'home');
  const awayPlayers = players.filter(p => p.team === 'away');

  const handlePlayerClick = (player: Player) => {
    setSelectedPlayer(player);
    setShowBetModal(true);
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Balance Display - Top Right */}
      <div className="absolute top-4 right-4 pointer-events-auto">
        <BalanceDisplay />
      </div>

      {/* Match Info - Top Center */}
      {match && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 pointer-events-auto">
          <MatchInfo match={match} />
        </div>
      )}

      {/* Player Buttons - Left Side (Home Team) */}
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 space-y-2 pointer-events-auto">
        {homePlayers.map(player => (
          <PlayerButton
            key={player.id}
            player={player}
            onClick={() => handlePlayerClick(player)}
          />
        ))}
      </div>

      {/* Player Buttons - Right Side (Away Team) */}
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 space-y-2 pointer-events-auto">
        {awayPlayers.map(player => (
          <PlayerButton
            key={player.id}
            player={player}
            onClick={() => handlePlayerClick(player)}
          />
        ))}
      </div>

      {/* Bet Modal */}
      {showBetModal && selectedPlayer && (
        <BetModal
          player={selectedPlayer}
          onClose={() => setShowBetModal(false)}
        />
      )}
    </div>
  );
};
```

#### 4.2 Player Button Component

**File:** `src/components/PlayerButton.tsx`

```typescript
// src/components/PlayerButton.tsx

import React from 'react';
import type { Player } from '../types';

interface PlayerButtonProps {
  player: Player;
  onClick: () => void;
}

export const PlayerButton: React.FC<PlayerButtonProps> = ({ player, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700
                 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-all duration-200
                 hover:scale-105 active:scale-95 min-w-[180px]"
    >
      <div className="flex items-center justify-between">
        <div className="text-left">
          <div className="text-sm font-semibold">{player.name}</div>
          <div className="text-xs opacity-90">#{player.number} • {player.position}</div>
        </div>
        <div className="text-right ml-3">
          <div className="text-lg font-bold">{player.odds}x</div>
        </div>
      </div>
    </button>
  );
};
```

#### 4.3 Bet Modal Component

**File:** `src/components/BetModal.tsx`

```typescript
// src/components/BetModal.tsx

import React, { useState } from 'react';
import { services } from '../services';
import type { Player } from '../types';

interface BetModalProps {
  player: Player;
  onClose: () => void;
}

export const BetModal: React.FC<BetModalProps> = ({ player, onClose }) => {
  const [amount, setAmount] = useState('10');
  const [loading, setLoading] = useState(false);

  const handlePlaceBet = async () => {
    setLoading(true);

    try {
      const result = await services.betting.placeBet({
        playerId: player.id,
        amount: parseFloat(amount),
        betType: 'NEXT_GOAL_SCORER',
        odds: player.odds,
      });

      if (result.success) {
        alert(`✅ Bet placed! Bet ID: ${result.betId}`);
        onClose();
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Bet placement failed:', error);
      alert('❌ Failed to place bet');
    } finally {
      setLoading(false);
    }
  };

  const potentialWinnings = parseFloat(amount) * player.odds;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 pointer-events-auto">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
        <h2 className="text-2xl font-bold mb-4">Place Bet</h2>

        <div className="mb-4 p-4 bg-gray-100 rounded-lg">
          <div className="text-lg font-semibold">{player.name}</div>
          <div className="text-sm text-gray-600">#{player.number} • {player.position}</div>
          <div className="text-xl font-bold text-green-600 mt-2">{player.odds}x odds</div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Bet Amount (USDC)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            min="1"
            step="0.01"
          />
        </div>

        <div className="mb-6 p-3 bg-green-50 rounded-lg">
          <div className="text-sm text-gray-600">Potential Winnings</div>
          <div className="text-2xl font-bold text-green-600">
            {potentialWinnings.toFixed(2)} USDC
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handlePlaceBet}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600
                       disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={loading || parseFloat(amount) <= 0}
          >
            {loading ? 'Placing...' : 'Confirm Bet'}
          </button>
        </div>
      </div>
    </div>
  );
};
```

#### 4.4 Balance Display Component

**File:** `src/components/BalanceDisplay.tsx`

```typescript
// src/components/BalanceDisplay.tsx

import React, { useEffect, useState } from 'react';
import { services } from '../services';

export const BalanceDisplay: React.FC = () => {
  const [balance, setBalance] = useState({ wallet: 0, locked: 0, provisional: 0 });

  useEffect(() => {
    // Update balance every second
    const interval = setInterval(() => {
      const currentBalance = services.betting.getBalance();
      setBalance(currentBalance);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 min-w-[200px]">
      <h3 className="text-sm font-semibold text-gray-600 mb-2">Your Balance</h3>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-xs text-gray-500">Wallet:</span>
          <span className="font-bold text-green-600">${balance.wallet.toFixed(2)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-xs text-gray-500">Locked:</span>
          <span className="font-bold text-orange-600">${balance.locked.toFixed(2)}</span>
        </div>

        {balance.provisional > 0 && (
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Pending:</span>
            <span className="font-bold text-blue-600">${balance.provisional.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t">
        <div className="flex justify-between">
          <span className="text-sm font-semibold">Total:</span>
          <span className="text-lg font-bold text-gray-900">
            ${(balance.wallet + balance.locked + balance.provisional).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};
```

#### 4.5 Match Info Component

**File:** `src/components/MatchInfo.tsx`

```typescript
// src/components/MatchInfo.tsx

import React from 'react';
import type { Match } from '../types';

interface MatchInfoProps {
  match: Match;
}

export const MatchInfo: React.FC<MatchInfoProps> = ({ match }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg px-6 py-3">
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className="text-sm font-semibold">{match.homeTeam}</div>
          <div className="text-2xl font-bold">{match.score.home}</div>
        </div>

        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase">
            {match.status === 'live' ? `${match.currentMinute}'` : match.status}
          </div>
          <div className="text-xl font-bold text-gray-400">-</div>
        </div>

        <div className="text-center">
          <div className="text-sm font-semibold">{match.awayTeam}</div>
          <div className="text-2xl font-bold">{match.score.away}</div>
        </div>
      </div>
    </div>
  );
};
```

---

### Task 5: Chrome Extension Integration

**File:** `extension/content-script.ts`

```typescript
// extension/content-script.ts

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BettingOverlay } from '../src/components/BettingOverlay';
import '../src/styles/global.css';

// Inject React app into page
function injectApp() {
  // Create container for React app
  const container = document.createElement('div');
  container.id = 'goal-live-extension';
  document.body.appendChild(container);

  // Mount React app
  const root = ReactDOM.createRoot(container);
  root.render(<BettingOverlay />);

  console.log('✅ goal.live extension loaded');
}

// Wait for page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectApp);
} else {
  injectApp();
}
```

**File:** `extension/background.ts`

```typescript
// extension/background.ts

// Service worker for extension
chrome.runtime.onInstalled.addListener(() => {
  console.log("goal.live extension installed");
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_WALLET") {
    // Handle wallet requests
    sendResponse({ wallet: "mock-wallet-address" });
  }
});
```

---

### Task 6: Build Configuration

**File:** `vite.config.ts`

```typescript
// vite.config.ts

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        contentScript: resolve(__dirname, "extension/content-script.ts"),
        background: resolve(__dirname, "extension/background.ts"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});
```

---

## Testing Checklist

### Phase 1 - Mock Services Testing

- [ ] **Extension loads** on YouTube/Twitch pages
- [ ] **22 player buttons** render (11 left, 11 right)
- [ ] **Click player** → Bet modal opens with correct player info
- [ ] **Place bet** → Balance updates (wallet ↓, locked ↑)
- [ ] **Bet persists** after closing/reopening extension (localStorage)
- [ ] **Simulate goal** (use mock service method) → Provisional balance updates
- [ ] **Click "Change Bet"** → Penalty calculated, new amount shown
- [ ] **Multiple bet changes** → Penalties accumulate correctly
- [ ] **Match ends** → Settlement triggered, final payouts calculated
- [ ] **All balances correct** (wallet + locked + provisional = total)

### Integration Readiness

- [ ] **No components import mock services directly** (only via `services` factory)
- [ ] **All service methods match interfaces** in `services.types.ts`
- [ ] **Environment variable** `VITE_USE_MOCK` controls service selection
- [ ] **TypeScript compiles** with no errors
- [ ] **ESLint passes** with no warnings

---

## Backend Integration Preparation

### When Ready for Phase 2:

1. **Implement real services** in `src/services/real/`:
   - `dataService.ts` (Chainlink CRE integration)
   - `bettingService.ts` (Supabase + smart contracts)
   - `walletService.ts` (RainbowKit/Phantom)

2. **Update service factory:**

   ```typescript
   // src/services/index.ts
   import { dataService } from "./real/dataService";
   import { bettingService } from "./real/bettingService";
   import { walletService } from "./real/walletService";

   const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

   export const services = {
     data: USE_MOCK ? mockDataService : dataService,
     betting: USE_MOCK ? mockBettingService : bettingService,
     wallet: USE_MOCK ? mockWalletService : walletService,
   };
   ```

3. **Change environment variable:**

   ```env
   VITE_USE_MOCK=false
   ```

4. **Zero component changes needed!** ✅

---

## Common Pitfalls to Avoid

❌ **Don't:**

- Import mock services directly in components
- Hard-code mock data in components
- Use `localStorage` directly (use service abstraction)
- Skip TypeScript interface definitions
- Forget to implement all interface methods

✅ **Do:**

- Always import from `services` factory
- Keep all data/state in services
- Use TypeScript strictly
- Follow interface contracts
- Test with mock first, then switch to real

---

## Success Criteria

**Phase 1 is complete when:**

1. ✅ Chrome extension loads on YouTube/Twitch
2. ✅ All UI components render correctly
3. ✅ Users can place bets with mock wallet
4. ✅ Bet changes work with penalty calculation
5. ✅ Balance updates in real-time
6. ✅ Settlement logic works correctly
7. ✅ All testing checklist items pass
8. ✅ Code is ready for backend integration (service abstraction validated)

---

## Next Steps After Phase 1

1. **User feedback** - Validate UI/UX with stakeholders
2. **Design refinements** - Adjust based on feedback
3. **Performance optimization** - Lazy loading, memoization
4. **Phase 2 planning** - Backend service implementation
5. **Chainlink CRE integration** - Connect to real sports data

---

## Additional Resources

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Complete system architecture
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Full mock service code
- [GENERAL_INFO.md](./GOAL_LIVE_GENERAL_INFO.md) - User flows and business logic
- [PROJECT_SPEC.md](./GOAL_LIVE_PROJECT_SPEC.md) - Technical requirements

---

**Questions?** Review the architecture documentation or consult with the goal.live team.

**Last Updated:** February 20, 2026  
**Target Completion:** End of Week 2
