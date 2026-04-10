/**
 * React Hook for Betting Bot Management
 * Provides easy access to bot state and controls
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { BettingBotManager, createBettingBot } from './BettingBotManager';
import type { BettingBotConfig, BotState } from './BettingBotManager';

export function useBettingBot(initialConfig?: Partial<BettingBotConfig>) {
  const botRef = useRef<BettingBotManager | null>(null);
  const [botState, setBotState] = useState<BotState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize bot (once on mount)
  useEffect(() => {
    botRef.current = createBettingBot(initialConfig);
    return () => {
      if (botRef.current) {
        botRef.current.destroy();
      }
    };
  }, [initialConfig]);

  // Update bot state periodically
  useEffect(() => {
    if (!isRunning || !botRef.current) return;

    const updateInterval = setInterval(() => {
      if (botRef.current) {
        setBotState(botRef.current.getState());
      }
    }, 1000);

    return () => clearInterval(updateInterval);
  }, [isRunning]);

  const start = useCallback(async () => {
    if (!botRef.current) {
      setError('Bot not initialized');
      return;
    }

    try {
      setError(null);
      await botRef.current.start();
      setIsRunning(true);
      setBotState(botRef.current.getState());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start bot';
      setError(message);
    }
  }, []);

  const stop = useCallback(() => {
    if (!botRef.current) {
      setError('Bot not initialized');
      return;
    }

    try {
      setError(null);
      botRef.current.stop();
      setIsRunning(false);
      setBotState(botRef.current.getState());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop bot';
      setError(message);
    }
  }, []);

  const getConfig = useCallback(() => {
    return botRef.current?.getConfig() || null;
  }, []);

  const estimateOracleCost = useCallback(() => {
    return botRef.current?.estimateOracleCost() || null;
  }, []);

  const verifyOracleResponse = useCallback((confirmations?: number) => {
    return botRef.current?.verifyOracleResponse(confirmations) || false;
  }, []);

  return {
    state: botState,
    isRunning,
    error,
    start,
    stop,
    getConfig,
    estimateOracleCost,
    verifyOracleResponse,
  };
}
