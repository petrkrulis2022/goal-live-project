/**
 * Sports Data Module Exports
 * Central export point for all sports data functionality
 */

// Types
export * from './types/sports';

// Providers
export { MockSportsDataProvider } from './mock/MockSportsDataProvider';

// Utilities
export * from './utils/oddsUtils';

// Oracle Integration
export { ChainlinkOracleClient, createOracleConfigFromEnv } from './integration/ChainlinkOracleClient';

// Factory to get appropriate provider
import { SportsDataProvider } from './types/sports';
import { MockSportsDataProvider } from './mock/MockSportsDataProvider';

export function createSportsDataProvider(env: string = 'development'): SportsDataProvider {
  switch (env) {
    case 'production':
    case 'mainnet':
      // In production, we would use a real API provider here
      // For now, fall through to mock
    case 'development':
    case 'testnet':
    default:
      return new MockSportsDataProvider();
  }
}
