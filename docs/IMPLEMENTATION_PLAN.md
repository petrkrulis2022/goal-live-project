# goal.live - Phased Implementation Plan

**Project:** goal.live  
**Strategy:** Frontend-First with Mock Backend  
**Last Updated:** February 19, 2026

---

## Overview

This document outlines a **3-phase development approach** for goal.live, prioritizing rapid UI/UX validation with mock services before integrating complex blockchain and real-time sports data infrastructure.

### Why Frontend-First?

✅ **Faster feedback loops** - Validate betting UX before heavy backend work  
✅ **Parallel development** - UI and backend teams work independently  
✅ **Easier debugging** - Isolate frontend issues from blockchain complexity  
✅ **Earlier demos** - Show stakeholders working prototype in week 1-2  
✅ **Lower risk** - Validate product-market fit before expensive infrastructure

---

## Phase 1: Frontend + Mock Services (Week 1-2)

### Goal

Build fully interactive Chrome extension with mock backend to validate user experience.

### Deliverables

#### 1.1 Chrome Extension Setup

```bash
goal.live/
├── extension/
│   ├── manifest.json          # Chrome extension config
│   ├── content-script.ts      # Injected into YouTube/Twitch
│   ├── background.ts          # Service worker for wallet connection
│   └── popup.html             # Extension popup (optional)
├── src/
│   ├── components/
│   │   ├── BettingOverlay.tsx     # Main UI overlay
│   │   ├── PlayerButton.tsx       # Individual player bet button
│   │   ├── BetModal.tsx           # Bet confirmation modal
│   │   ├── BalanceDisplay.tsx     # Shows current balance + pending payouts
│   │   └── BetChangeModal.tsx     # Change bet with penalty preview
│   ├── services/
│   │   ├── mockBettingService.ts  # 🎭 Mock bet actions
│   │   ├── mockDataService.ts     # 🎭 Mock match/player data
│   │   └── mockWalletService.ts   # 🎭 Mock wallet connection
│   ├── hooks/
│   │   ├── useMatchData.ts        # Hook for match state
│   │   ├── useBetting.ts          # Hook for bet placement/changes
│   │   └── useBalance.ts          # Hook for balance tracking
│   └── types/
│       └── index.ts               # TypeScript interfaces
└── docs/
    ├── GENERAL_INFO.md
    ├── PROJECT_SPEC.md
    ├── PROJECT_SUMMARY.md
    └── IMPLEMENTATION_PLAN.md     # This file
```

#### 1.2 Mock Services Implementation

**mockDataService.ts** - Simulates Chainlink CRE sports data

```typescript
// goal.live/src/services/mockDataService.ts

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
  odds: number; // Next goal scorer odds
}

class MockDataService {
  private currentMatch: Match = {
    id: "mock-match-001",
    homeTeam: "Real Madrid",
    awayTeam: "Barcelona",
    status: "pre-match",
    currentMinute: 0,
    score: { home: 0, away: 0 },
  };

  private players: Player[] = [
    // Real Madrid (home)
    {
      id: "p1",
      name: "Benzema",
      team: "home",
      number: 9,
      position: "ST",
      odds: 4.5,
    },
    {
      id: "p2",
      name: "Modrić",
      team: "home",
      number: 10,
      position: "CM",
      odds: 8.0,
    },
    {
      id: "p3",
      name: "Vinicius Jr",
      team: "home",
      number: 7,
      position: "LW",
      odds: 5.2,
    },
    {
      id: "p4",
      name: "Rodrygo",
      team: "home",
      number: 21,
      position: "RW",
      odds: 6.5,
    },
    {
      id: "p5",
      name: "Kroos",
      team: "home",
      number: 8,
      position: "CM",
      odds: 12.0,
    },
    {
      id: "p6",
      name: "Alaba",
      team: "home",
      number: 4,
      position: "CB",
      odds: 25.0,
    },
    {
      id: "p7",
      name: "Carvajal",
      team: "home",
      number: 2,
      position: "RB",
      odds: 30.0,
    },
    {
      id: "p8",
      name: "Mendy",
      team: "home",
      number: 23,
      position: "LB",
      odds: 35.0,
    },
    {
      id: "p9",
      name: "Rüdiger",
      team: "home",
      number: 22,
      position: "CB",
      odds: 28.0,
    },
    {
      id: "p10",
      name: "Tchouaméni",
      team: "home",
      number: 18,
      position: "DM",
      odds: 15.0,
    },
    {
      id: "p11",
      name: "Courtois",
      team: "home",
      number: 1,
      position: "GK",
      odds: 100.0,
    },

    // Barcelona (away)
    {
      id: "p12",
      name: "Lewandowski",
      team: "away",
      number: 9,
      position: "ST",
      odds: 4.0,
    },
    {
      id: "p13",
      name: "Raphinha",
      team: "away",
      number: 22,
      position: "RW",
      odds: 6.0,
    },
    {
      id: "p14",
      name: "Gavi",
      team: "away",
      number: 6,
      position: "CM",
      odds: 10.0,
    },
    {
      id: "p15",
      name: "Pedri",
      team: "away",
      number: 8,
      position: "CM",
      odds: 9.5,
    },
    {
      id: "p16",
      name: "De Jong",
      team: "away",
      number: 21,
      position: "CM",
      odds: 12.0,
    },
    {
      id: "p17",
      name: "Balde",
      team: "away",
      number: 28,
      position: "LB",
      odds: 32.0,
    },
    {
      id: "p18",
      name: "Araujo",
      team: "away",
      number: 4,
      position: "CB",
      odds: 22.0,
    },
    {
      id: "p19",
      name: "Koundé",
      team: "away",
      number: 23,
      position: "CB",
      odds: 24.0,
    },
    {
      id: "p20",
      name: "Christensen",
      team: "away",
      number: 15,
      position: "RB",
      odds: 30.0,
    },
    {
      id: "p21",
      name: "Busquets",
      team: "away",
      number: 5,
      position: "DM",
      odds: 18.0,
    },
    {
      id: "p22",
      name: "Ter Stegen",
      team: "away",
      number: 1,
      position: "GK",
      odds: 100.0,
    },
  ];

  /**
   * Get current match data
   */
  getMatch(): Match {
    return { ...this.currentMatch };
  }

  /**
   * Get all players with current odds
   */
  getPlayers(): Player[] {
    return [...this.players];
  }

  /**
   * Start match simulation (updates minute every 10 seconds)
   */
  startMatchSimulation(onUpdate: (match: Match) => void): () => void {
    this.currentMatch.status = "live";

    const interval = setInterval(() => {
      this.currentMatch.currentMinute += 1;

      // Simulate random goals (10% chance per minute)
      if (Math.random() < 0.1) {
        const scoringTeam = Math.random() < 0.5 ? "home" : "away";
        if (scoringTeam === "home") {
          this.currentMatch.score.home++;
        } else {
          this.currentMatch.score.away++;
        }

        // Trigger goal event
        const scoringPlayer = this.players.find(
          (p) =>
            p.team === scoringTeam && ["ST", "LW", "RW"].includes(p.position),
        );
        if (scoringPlayer) {
          window.dispatchEvent(
            new CustomEvent("goal-scored", {
              detail: {
                player: scoringPlayer,
                minute: this.currentMatch.currentMinute,
              },
            }),
          );
        }
      }

      // End match at 90 minutes
      if (this.currentMatch.currentMinute >= 90) {
        this.currentMatch.status = "finished";
        clearInterval(interval);
        window.dispatchEvent(
          new CustomEvent("match-ended", {
            detail: { match: this.currentMatch },
          }),
        );
      }

      onUpdate({ ...this.currentMatch });
    }, 10000); // Update every 10 seconds

    // Return cleanup function
    return () => clearInterval(interval);
  }

  /**
   * Manually trigger a goal (for testing)
   */
  triggerGoal(playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return;

    if (player.team === "home") {
      this.currentMatch.score.home++;
    } else {
      this.currentMatch.score.away++;
    }

    window.dispatchEvent(
      new CustomEvent("goal-scored", {
        detail: { player, minute: this.currentMatch.currentMinute },
      }),
    );
  }
}

export const mockDataService = new MockDataService();
```

**mockBettingService.ts** - Simulates bet placement, changes, and settlement

```typescript
// goal.live/src/services/mockBettingService.ts

export interface Bet {
  id: string;
  bettorWallet: string;
  matchId: string;
  betType: "NEXT_GOAL_SCORER" | "MATCH_WINNER";

  // Bet change tracking
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
  penalty_type: "percentage" | "flat" | "progressive" | "time-based";
  changed_at: string;
  match_minute: number;
}

interface BalanceState {
  wallet: number; // USDC in wallet (withdrawable)
  locked: number; // USDC locked in active bets
  provisional: number; // Pending winnings (not withdrawable until settlement)
}

class MockBettingService {
  private bets: Map<string, Bet> = new Map();
  private betChanges: BetChange[] = [];
  private balance: BalanceState = {
    wallet: 100, // Start with $100 mock balance
    locked: 0,
    provisional: 0,
  };

  // Configuration
  private penaltyRate = 0.05; // 5% penalty per change

  /**
   * Place a new bet
   */
  async placeBet(params: {
    playerId: string;
    amount: number;
    betType: "NEXT_GOAL_SCORER" | "MATCH_WINNER";
    odds: number;
  }): Promise<{ success: boolean; betId: string; error?: string }> {
    // Validate balance
    if (params.amount > this.balance.wallet) {
      return { success: false, betId: "", error: "Insufficient balance" };
    }

    // Create bet
    const betId = `bet-${Date.now()}`;
    const bet: Bet = {
      id: betId,
      bettorWallet: "mock-wallet-address",
      matchId: "mock-match-001",
      betType: params.betType,
      original_player_id: params.playerId,
      current_player_id: params.playerId,
      original_amount: params.amount,
      current_amount: params.amount,
      total_penalties: 0,
      change_count: 0,
      odds: params.odds,
      status: "active",
      placedAt: new Date().toISOString(),
    };

    this.bets.set(betId, bet);

    // Update balance
    this.balance.wallet -= params.amount;
    this.balance.locked += params.amount;

    // Store in localStorage for persistence
    this.saveToLocalStorage();

    console.log("✅ Mock bet placed:", bet);

    return { success: true, betId };
  }

  /**
   * Change existing bet (with penalty)
   */
  async changeBet(params: {
    betId: string;
    newPlayerId: string;
    currentMatchMinute: number;
  }): Promise<{
    success: boolean;
    penalty: number;
    newAmount: number;
    error?: string;
  }> {
    const bet = this.bets.get(params.betId);
    if (!bet) {
      return {
        success: false,
        penalty: 0,
        newAmount: 0,
        error: "Bet not found",
      };
    }

    if (bet.status !== "active") {
      return {
        success: false,
        penalty: 0,
        newAmount: 0,
        error: "Can only change active bets",
      };
    }

    // Calculate penalty (5% of current amount)
    const penalty = bet.current_amount * this.penaltyRate;
    const newAmount = bet.current_amount - penalty;

    // Record bet change
    const betChange: BetChange = {
      bet_id: params.betId,
      from_player_id: bet.current_player_id,
      to_player_id: params.newPlayerId,
      penalty_amount: penalty,
      penalty_type: "percentage",
      changed_at: new Date().toISOString(),
      match_minute: params.currentMatchMinute,
    };
    this.betChanges.push(betChange);

    // Update bet
    bet.current_player_id = params.newPlayerId;
    bet.current_amount = newAmount;
    bet.total_penalties += penalty;
    bet.change_count += 1;

    // Update balance (penalty goes to house/pool)
    this.balance.locked -= penalty;

    this.saveToLocalStorage();

    console.log("🔄 Mock bet changed:", { betChange, newBet: bet });

    // Dispatch event for UI update
    window.dispatchEvent(
      new CustomEvent("bet-changed", {
        detail: { betId: params.betId, penalty, newAmount },
      }),
    );

    return { success: true, penalty, newAmount };
  }

  /**
   * Process goal event (provisional win/loss)
   */
  async processGoal(playerId: string): Promise<void> {
    for (const [betId, bet] of this.bets) {
      if (bet.status !== "active") continue;

      if (
        bet.current_player_id === playerId &&
        bet.betType === "NEXT_GOAL_SCORER"
      ) {
        // Provisional win
        bet.status = "provisional_win";
        const provisionalWinnings = bet.current_amount * bet.odds;
        this.balance.provisional += provisionalWinnings;

        console.log(
          `🎉 Provisional win for bet ${betId}: +$${provisionalWinnings}`,
        );

        window.dispatchEvent(
          new CustomEvent("provisional-win", {
            detail: { betId, amount: provisionalWinnings },
          }),
        );
      } else if (bet.betType === "NEXT_GOAL_SCORER") {
        // Provisional loss
        bet.status = "provisional_loss";

        console.log(`❌ Provisional loss for bet ${betId}`);
      }
    }

    this.saveToLocalStorage();
  }

  /**
   * Final settlement after match ends
   */
  async settleBets(): Promise<void> {
    for (const [betId, bet] of this.bets) {
      if (bet.status === "provisional_win") {
        // Convert provisional to actual
        const winnings = bet.current_amount * bet.odds;
        this.balance.provisional -= winnings;
        this.balance.wallet += winnings;
        this.balance.locked -= bet.current_amount;
        bet.status = "settled_won";

        console.log(
          `✅ Final settlement (WON): Bet ${betId} → +$${winnings} to wallet`,
        );
      } else if (bet.status === "provisional_loss" || bet.status === "active") {
        // Lost bet - funds already in contract
        this.balance.locked -= bet.current_amount;
        bet.status = "settled_lost";

        console.log(`❌ Final settlement (LOST): Bet ${betId}`);
      }
    }

    this.saveToLocalStorage();

    window.dispatchEvent(
      new CustomEvent("bets-settled", {
        detail: { balance: this.getBalance() },
      }),
    );
  }

  /**
   * Get current balance
   */
  getBalance(): BalanceState {
    return { ...this.balance };
  }

  /**
   * Get all bets
   */
  getBets(): Bet[] {
    return Array.from(this.bets.values());
  }

  /**
   * Get bet changes history
   */
  getBetChanges(): BetChange[] {
    return [...this.betChanges];
  }

  /**
   * Save state to localStorage
   */
  private saveToLocalStorage(): void {
    localStorage.setItem(
      "goal-live-bets",
      JSON.stringify(Array.from(this.bets.entries())),
    );
    localStorage.setItem("goal-live-balance", JSON.stringify(this.balance));
    localStorage.setItem("goal-live-changes", JSON.stringify(this.betChanges));
  }

  /**
   * Load state from localStorage
   */
  loadFromLocalStorage(): void {
    const betsData = localStorage.getItem("goal-live-bets");
    const balanceData = localStorage.getItem("goal-live-balance");
    const changesData = localStorage.getItem("goal-live-changes");

    if (betsData) {
      this.bets = new Map(JSON.parse(betsData));
    }
    if (balanceData) {
      this.balance = JSON.parse(balanceData);
    }
    if (changesData) {
      this.betChanges = JSON.parse(changesData);
    }
  }

  /**
   * Reset all data (for testing)
   */
  reset(): void {
    this.bets.clear();
    this.betChanges = [];
    this.balance = { wallet: 100, locked: 0, provisional: 0 };
    localStorage.removeItem("goal-live-bets");
    localStorage.removeItem("goal-live-balance");
    localStorage.removeItem("goal-live-changes");
  }
}

export const mockBettingService = new MockBettingService();
```

**mockWalletService.ts** - Simulates wallet connection

```typescript
// goal.live/src/services/mockWalletService.ts

export interface WalletState {
  connected: boolean;
  address: string | null;
  balance: number; // USDC balance
  network: "base" | "solana" | null;
}

class MockWalletService {
  private state: WalletState = {
    connected: false,
    address: null,
    balance: 0,
    network: null,
  };

  /**
   * Connect wallet (simulated)
   */
  async connect(
    network: "base" | "solana",
  ): Promise<{ success: boolean; error?: string }> {
    // Simulate connection delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    this.state = {
      connected: true,
      address:
        network === "base"
          ? "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"
          : "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK",
      balance: 100,
      network,
    };

    window.dispatchEvent(
      new CustomEvent("wallet-connected", {
        detail: this.state,
      }),
    );

    console.log("✅ Mock wallet connected:", this.state);

    return { success: true };
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.state = {
      connected: false,
      address: null,
      balance: 0,
      network: null,
    };

    window.dispatchEvent(new CustomEvent("wallet-disconnected"));

    console.log("🔌 Mock wallet disconnected");
  }

  /**
   * Get current wallet state
   */
  getState(): WalletState {
    return { ...this.state };
  }

  /**
   * Update balance (for testing)
   */
  updateBalance(newBalance: number): void {
    this.state.balance = newBalance;

    window.dispatchEvent(
      new CustomEvent("balance-updated", {
        detail: { balance: newBalance },
      }),
    );
  }
}

export const mockWalletService = new MockWalletService();
```

#### 1.3 Key UI Components

**BettingOverlay.tsx** - Main overlay component

```tsx
// goal.live/src/components/BettingOverlay.tsx

import React, { useEffect, useState } from "react";
import { mockDataService, Player, Match } from "../services/mockDataService";
import { mockBettingService } from "../services/mockBettingService";
import { PlayerButton } from "./PlayerButton";
import { BalanceDisplay } from "./BalanceDisplay";
import { BetModal } from "./BetModal";
import { BetChangeModal } from "./BetChangeModal";

export const BettingOverlay: React.FC = () => {
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showBetModal, setShowBetModal] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);

  useEffect(() => {
    // Load match and players
    setMatch(mockDataService.getMatch());
    setPlayers(mockDataService.getPlayers());

    // Start match simulation
    const cleanup = mockDataService.startMatchSimulation((updatedMatch) => {
      setMatch(updatedMatch);
    });

    // Load saved bets
    mockBettingService.loadFromLocalStorage();

    return cleanup;
  }, []);

  const homePlayers = players.filter((p) => p.team === "home");
  const awayPlayers = players.filter((p) => p.team === "away");

  const handlePlayerClick = (player: Player) => {
    setSelectedPlayer(player);
    setShowBetModal(true);
  };

  return (
    <div className="goal-live-overlay">
      {/* Balance Display */}
      <BalanceDisplay />

      {/* Match Info */}
      {match && (
        <div className="match-info">
          <div className="teams">
            {match.homeTeam} {match.score.home} - {match.score.away}{" "}
            {match.awayTeam}
          </div>
          <div className="time">{match.currentMinute}'</div>
        </div>
      )}

      {/* Player Buttons - Left Side (Home Team) */}
      <div className="players-left">
        {homePlayers.map((player) => (
          <PlayerButton
            key={player.id}
            player={player}
            onClick={() => handlePlayerClick(player)}
          />
        ))}
      </div>

      {/* Player Buttons - Right Side (Away Team) */}
      <div className="players-right">
        {awayPlayers.map((player) => (
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

      {/* Bet Change Modal */}
      {showChangeModal && (
        <BetChangeModal onClose={() => setShowChangeModal(false)} />
      )}
    </div>
  );
};
```

#### 1.4 Testing Scenarios

**Manual Testing Checklist:**

- [ ] Player buttons render correctly (11 left, 11 right)
- [ ] Click player → Bet modal opens with correct odds
- [ ] Place bet → Balance updates (wallet decreases, locked increases)
- [ ] Close and reopen extension → Bets persist (localStorage)
- [ ] Simulate goal → Provisional balance updates
- [ ] Change bet → Penalty calculated, new amount shown
- [ ] Multiple bet changes → Penalties accumulate
- [ ] Match ends → Final settlement, funds transferred to wallet
- [ ] Wallet balance reflects all bet changes + penalties

### Week 1 Milestone

**Demo-able prototype** with all UI interactions working using mock data.

---

## Phase 2: Backend Integration (Week 3-4)

### Goal

Replace mock services with real Chainlink CRE data, smart contracts, and Supabase.

### Deliverables

#### 2.1 Real Data Service

Replace `mockDataService.ts` with `chainlinkDataService.ts`:

```typescript
// goal.live/src/services/chainlinkDataService.ts

import { ChainlinkCREClient } from "@chainlink/cre-sdk";

class ChainlinkDataService {
  private client: ChainlinkCREClient;

  constructor() {
    this.client = new ChainlinkCREClient({
      apiKey: process.env.CHAINLINK_CRE_API_KEY,
      network: "base", // or 'solana'
    });
  }

  /**
   * Get live match data
   */
  async getMatch(matchId: string): Promise<Match> {
    const response = await this.client.getMatch(matchId);
    return {
      id: response.id,
      homeTeam: response.homeTeam.name,
      awayTeam: response.awayTeam.name,
      status: response.status,
      currentMinute: response.currentMinute,
      score: response.score,
    };
  }

  /**
   * Subscribe to live match events
   */
  subscribeToMatch(
    matchId: string,
    callbacks: {
      onGoal: (playerId: string) => void;
      onUpdate: (match: Match) => void;
      onEnd: () => void;
    },
  ): () => void {
    return this.client.subscribe(matchId, {
      events: ["goal", "update", "end"],
      onEvent: (event) => {
        if (event.type === "goal") callbacks.onGoal(event.player.id);
        if (event.type === "update") callbacks.onUpdate(event.match);
        if (event.type === "end") callbacks.onEnd();
      },
    });
  }

  // ... more methods
}

export const chainlinkDataService = new ChainlinkDataService();
```

#### 2.2 Smart Contract Integration

Replace `mockBettingService.ts` blockchain calls with real contract:

```typescript
// goal.live/src/services/contractService.ts

import { Contract, providers, Wallet } from "ethers"; // For Base/Ethereum
// OR
import { Connection, PublicKey } from "@solana/web3.js"; // For Solana

class ContractService {
  private contract: Contract;

  async placeBet(params: {
    playerId: string;
    amount: number;
    matchId: string;
  }): Promise<string> {
    const tx = await this.contract.placeBet(
      params.matchId,
      params.playerId,
      params.amount,
    );
    await tx.wait();
    return tx.hash;
  }

  async changeBet(betId: string, newPlayerId: string): Promise<string> {
    const tx = await this.contract.changeBet(betId, newPlayerId);
    await tx.wait();
    return tx.hash;
  }

  // ... more methods
}
```

#### 2.3 Supabase Integration

```typescript
// goal.live/src/services/databaseService.ts

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

export const databaseService = {
  /**
   * Save bet to database
   */
  async saveBet(bet: Bet): Promise<void> {
    const { error } = await supabase.from("bets").insert({
      id: bet.id,
      bettor_wallet: bet.bettorWallet,
      match_id: bet.matchId,
      bet_type: bet.betType,
      original_player_id: bet.original_player_id,
      current_player_id: bet.current_player_id,
      original_amount: bet.original_amount,
      current_amount: bet.current_amount,
      total_penalties: bet.total_penalties,
      change_count: bet.change_count,
      odds: bet.odds,
      status: bet.status,
      placed_at: bet.placedAt,
    });

    if (error) throw error;
  },

  /**
   * Record bet change
   */
  async recordBetChange(change: BetChange): Promise<void> {
    const { error } = await supabase.from("bet_changes").insert(change);
    if (error) throw error;
  },

  /**
   * Get user bets
   */
  async getUserBets(wallet: string): Promise<Bet[]> {
    const { data, error } = await supabase
      .from("bets")
      .select("*")
      .eq("bettor_wallet", wallet);

    if (error) throw error;
    return data;
  },
};
```

### Week 3-4 Milestones

- **Week 3:** Chainlink CRE integrated, real match data flowing
- **Week 4:** Smart contracts deployed on testnet, Supabase connected

---

## Phase 3: Testing & Deployment (Week 5-6)

### 3.1 Testing

**Unit Tests:**

```bash
npm test -- --coverage
```

**Integration Tests:**

- Test real Chainlink CRE data on testnet matches
- Test smart contract bet placement/changes
- Test Supabase read/write operations

**E2E Tests (Playwright):**

```typescript
test("Full betting flow with bet change", async ({ page }) => {
  // 1. Connect wallet
  await page.click('[data-testid="connect-wallet"]');

  // 2. Place bet on Benzema
  await page.click('[data-testid="player-benzema"]');
  await page.fill('[data-testid="bet-amount"]', "10");
  await page.click('[data-testid="confirm-bet"]');

  // 3. Wait for goal event
  await page.waitForSelector('[data-testid="provisional-win"]');

  // 4. Change bet to Modrić
  await page.click('[data-testid="change-bet"]');
  await page.click('[data-testid="player-modric"]');
  await page.click('[data-testid="confirm-change"]');

  // 5. Verify penalty applied
  const penalty = await page.textContent('[data-testid="penalty-amount"]');
  expect(penalty).toBe("$0.50");
});
```

### 3.2 Deployment

**Chrome Extension:**

```bash
# Build production bundle
npm run build:extension

# Submit to Chrome Web Store
# https://chrome.google.com/webstore/devconsole
```

**Smart Contracts:**

```bash
# Deploy to Base mainnet
npx hardhat run scripts/deploy.ts --network base

# Verify on Basescan
npx hardhat verify --network base <CONTRACT_ADDRESS>
```

**Backend Services:**

- Deploy Chainlink CRE node (if custom)
- Configure Supabase production database
- Set up monitoring (Sentry, DataDog)

---

## Tech Stack Summary

| Layer           | Mock (Phase 1)        | Real (Phase 2-3)      |
| --------------- | --------------------- | --------------------- |
| **Frontend**    | React 18 + TypeScript | React 18 + TypeScript |
| **Extension**   | Chrome manifest v3    | Chrome manifest v3    |
| **Sports Data** | mockDataService.ts    | Chainlink CRE         |
| **Blockchain**  | localStorage          | Base L2 (or Solana)   |
| **Database**    | localStorage          | Supabase PostgreSQL   |
| **Wallet**      | mockWalletService.ts  | RainbowKit/Phantom    |
| **Testing**     | Manual clicks         | Playwright E2E        |

---

## File Organization Post-Implementation

```
goal.live/
├── extension/
│   ├── manifest.json
│   ├── content-script.ts
│   ├── background.ts
│   └── popup.html
├── src/
│   ├── components/
│   │   ├── BettingOverlay.tsx
│   │   ├── PlayerButton.tsx
│   │   ├── BetModal.tsx
│   │   ├── BetChangeModal.tsx
│   │   └── BalanceDisplay.tsx
│   ├── services/
│   │   ├── mockDataService.ts              # Phase 1
│   │   ├── mockBettingService.ts           # Phase 1
│   │   ├── mockWalletService.ts            # Phase 1
│   │   ├── chainlinkDataService.ts         # Phase 2
│   │   ├── contractService.ts              # Phase 2
│   │   ├── databaseService.ts              # Phase 2
│   │   └── walletService.ts                # Phase 2
│   ├── hooks/
│   │   ├── useMatchData.ts
│   │   ├── useBetting.ts
│   │   └── useBalance.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       ├── penaltyCalculator.ts
│       └── oddsFormatter.ts
├── contracts/
│   ├── GoalLiveBetting.sol
│   └── scripts/deploy.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── GENERAL_INFO.md
│   ├── PROJECT_SPEC.md
│   ├── PROJECT_SUMMARY.md
│   └── IMPLEMENTATION_PLAN.md
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Next Steps

1. **Setup project structure** (create folders, install dependencies)
2. **Implement mock services** (start with mockDataService.ts)
3. **Build BettingOverlay component** (render player buttons)
4. **Test betting flow** (place bet → change bet → settle)
5. **Get user feedback** on UX before proceeding to Phase 2

Ready to start with Phase 1 mock implementation?
