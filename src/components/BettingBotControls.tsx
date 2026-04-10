/**
 * Betting Bot Control Component
 * Provides UI controls for managing the automated betting bot
 */

import React from 'react';
import { useBettingBot } from '@/hooks/useBettingBot';

interface BettingBotControlsProps {
  onStateChange?: (state: any) => void;
  minOdds?: number;
  maxOdds?: number;
  maxBetSize?: number;
}

export function BettingBotControls({
  onStateChange,
  minOdds = 1.5,
  maxOdds = 5,
  maxBetSize = 5,
}: BettingBotControlsProps) {
  const { state, isRunning, error, start, stop, getConfig, estimateOracleCost, verifyOracleResponse } =
    useBettingBot({
      minOddsThreshold: minOdds,
      maxOddsThreshold: maxOdds,
      maxBetSize,
    });

  React.useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const config = getConfig();

  return (
    <div className="betting-bot-controls border border-gray-300 rounded-lg p-4 bg-gray-50">
      <h2 className="text-lg font-bold mb-4">Betting Bot Control</h2>

      {error && <div className="text-red-600 mb-3 font-semibold">Error: {error}</div>}

      {/* Status */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="font-semibold">{isRunning ? 'Running' : 'Stopped'}</span>
        </div>
      </div>

      {/* Current Match */}
      {state?.currentMatch && (
        <div className="bg-white p-3 rounded mb-4 border border-gray-200">
          <h3 className="font-semibold mb-2">Current Match</h3>
          <p className="text-sm">
            {state.currentMatch.homeTeam} vs {state.currentMatch.awayTeam}
          </p>
          <p className="text-xs text-gray-600">{state.currentMatch.league}</p>
        </div>
      )}

      {/* Current Odds */}
      {state?.currentOdds && (
        <div className="bg-white p-3 rounded mb-4 border border-gray-200">
          <h3 className="font-semibold mb-2">Current Odds</h3>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-gray-600">Home: </span>
              <strong>{state.currentOdds.odds.homeWin}</strong>
            </div>
            <div>
              <span className="text-gray-600">Draw: </span>
              <strong>{state.currentOdds.odds.draw}</strong>
            </div>
            <div>
              <span className="text-gray-600">Away: </span>
              <strong>{state.currentOdds.odds.awayWin}</strong>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-2">Source: {state.currentOdds.source}</p>
        </div>
      )}

      {/* Configuration */}
      {config && (
        <div className="bg-white p-3 rounded mb-4 border border-gray-200">
          <h3 className="font-semibold mb-2">Configuration</h3>
          <div className="text-sm space-y-1">
            <p>
              <span className="text-gray-600">Max Bet: </span>
              <strong>${config.maxBetSize.toFixed(2)}</strong>
            </p>
            <p>
              <span className="text-gray-600">Odds Range: </span>
              <strong>
                {config.minOddsThreshold.toFixed(2)} - {config.maxOddsThreshold.toFixed(2)}
              </strong>
            </p>
            <p>
              <span className="text-gray-600">Refresh: </span>
              <strong>{(config.refreshIntervalMs / 1000).toFixed(1)}s</strong>
            </p>
            <p>
              <span className="text-gray-600">Chainlink: </span>
              <strong>{config.useChainlinkOracle ? 'Enabled' : 'Disabled'}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      {state && (
        <div className="bg-white p-3 rounded mb-4 border border-gray-200">
          <h3 className="font-semibold mb-2">Statistics</h3>
          <div className="text-sm space-y-1">
            <p>
              <span className="text-gray-600">Bets Placed: </span>
              <strong>{state.totalBetsPlaced}</strong>
            </p>
            <p>
              <span className="text-gray-600">Total Profit: </span>
              <strong className={state.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                ${state.totalProfit.toFixed(2)}
              </strong>
            </p>
            <p className="text-xs text-gray-600">
              Last Refresh: {new Date(state.lastRefetch).toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}

      {/* Oracle Info */}
      {config?.useChainlinkOracle && (
        <div className="bg-blue-50 p-3 rounded mb-4 border border-blue-200">
          <h3 className="font-semibold mb-2 text-blue-900">Chainlink Oracle</h3>
          <div className="text-sm text-blue-800 space-y-1">
            <p>Gas Cost Estimate: {estimateOracleCost() || 'N/A'}</p>
            <p>
              Response Valid: {verifyOracleResponse(3) ? <span className="text-green-600">✓</span> : <span className="text-red-600">✗</span>}
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={start}
          disabled={isRunning}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-semibold disabled:bg-gray-300 cursor-pointer hover:bg-green-700 transition"
        >
          Start Bot
        </button>
        <button
          onClick={stop}
          disabled={!isRunning}
          className="flex-1 px-4 py-2 bg-red-600 text-white rounded font-semibold disabled:bg-gray-300 cursor-pointer hover:bg-red-700 transition"
        >
          Stop Bot
        </button>
      </div>
    </div>
  );
}

export default BettingBotControls;
