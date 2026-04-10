/**
 * Mock Sports Data Provider
 * Provides fake but realistic data for testing without external API calls
 * Production will replace with real Chainlink oracle data
 */

import { Match, OddsSnapshot, SportsDataProvider, MatchStatus, BetResolution } from '../types/sports';

const MOCK_MATCHES: Match[] = [
  {
    id: 'match_001',
    homeTeam: 'Arsenal',
    awayTeam: 'Manchester United',
    league: 'Premier League',
    startTime: Math.floor(Date.now() / 1000) + 86400, // Tomorrow
    status: MatchStatus.SCHEDULED,
  },
  {
    id: 'match_002',
    homeTeam: 'Liverpool',
    awayTeam: 'Manchester City',
    league: 'Premier League',
    startTime: Math.floor(Date.now() / 1000) + 172800, // In 2 days
    status: MatchStatus.SCHEDULED,
  },
  {
    id: 'match_003',
    homeTeam: 'Chelsea',
    awayTeam: 'Tottenham',
    league: 'Premier League',
    startTime: Math.floor(Date.now() / 1000) + 3600, // In 1 hour
    status: MatchStatus.LIVE,
    score: { home: 1, away: 1 },
  },
  {
    id: 'match_004',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    league: 'La Liga',
    startTime: Math.floor(Date.now() / 1000) - 3600, // Finished 1 hour ago
    status: MatchStatus.FINISHED,
    score: { home: 2, away: 1 },
  },
];

const MOCK_ODDS: Record<string, OddsSnapshot> = {
  match_001: {
    id: 'odds_001',
    matchId: 'match_001',
    timestamp: Math.floor(Date.now() / 1000),
    source: 'MOCK',
    odds: {
      homeWin: '1.85',
      draw: '3.50',
      awayWin: '4.20',
    },
  },
  match_002: {
    id: 'odds_002',
    matchId: 'match_002',
    timestamp: Math.floor(Date.now() / 1000),
    source: 'MOCK',
    odds: {
      homeWin: '2.10',
      draw: '3.25',
      awayWin: '3.50',
    },
  },
  match_003: {
    id: 'odds_003',
    matchId: 'match_003',
    timestamp: Math.floor(Date.now() / 1000),
    source: 'MOCK',
    odds: {
      homeWin: '2.80',
      draw: '3.10',
      awayWin: '2.50',
    },
  },
  match_004: {
    id: 'odds_004',
    matchId: 'match_004',
    timestamp: Math.floor(Date.now() / 1000) - 3600,
    source: 'MOCK',
    odds: {
      homeWin: '1.80',
      draw: '3.60',
      awayWin: '4.50',
    },
  },
};

export class MockSportsDataProvider implements SportsDataProvider {
  name = 'MockSportsDataProvider';
  private oddsListeners: Map<string, Set<(odds: OddsSnapshot) => void>> = new Map();
  private oddsUpdateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeOddsSimulation();
  }

  async getMatchById(matchId: string): Promise<Match | null> {
    return MOCK_MATCHES.find((m) => m.id === matchId) || null;
  }

  async getUpcomingMatches(limit: number = 10): Promise<Match[]> {
    const now = Math.floor(Date.now() / 1000);
    return MOCK_MATCHES.filter((m) => m.startTime > now && m.status === MatchStatus.SCHEDULED).slice(0, limit);
  }

  async getLiveMatches(): Promise<Match[]> {
    return MOCK_MATCHES.filter((m) => [MatchStatus.LIVE, MatchStatus.HALFTIME].includes(m.status));
  }

  async getOdds(matchId: string): Promise<OddsSnapshot | null> {
    return MOCK_ODDS[matchId] || null;
  }

  subscribeToLiveOdds(matchId: string, callback: (odds: OddsSnapshot) => void): () => void {
    if (!this.oddsListeners.has(matchId)) {
      this.oddsListeners.set(matchId, new Set());
    }
    this.oddsListeners.get(matchId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.oddsListeners.get(matchId);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  private initializeOddsSimulation() {
    // Simulate odds updates every 5 seconds for live matches
    this.oddsUpdateInterval = setInterval(() => {
      MOCK_MATCHES.filter((m) => m.status === MatchStatus.LIVE).forEach((match) => {
        const currentOdds = MOCK_ODDS[match.id];
        if (currentOdds) {
          // Simulate slight odds movement
          const variation = 0.02; // ±2%
          const newOdds: OddsSnapshot = {
            ...currentOdds,
            timestamp: Math.floor(Date.now() / 1000),
            odds: {
              homeWin: (parseFloat(currentOdds.odds.homeWin) * (1 + (Math.random() - 0.5) * variation)).toFixed(4),
              draw: (parseFloat(currentOdds.odds.draw) * (1 + (Math.random() - 0.5) * variation)).toFixed(4),
              awayWin: (parseFloat(currentOdds.odds.awayWin) * (1 + (Math.random() - 0.5) * variation)).toFixed(4),
            },
          };
          MOCK_ODDS[match.id] = newOdds;

          // Notify subscribers
          const listeners = this.oddsListeners.get(match.id);
          if (listeners) {
            listeners.forEach((callback) => callback(newOdds));
          }
        }
      });
    }, 5000);
  }

  destroy() {
    if (this.oddsUpdateInterval) {
      clearInterval(this.oddsUpdateInterval);
    }
  }
}
