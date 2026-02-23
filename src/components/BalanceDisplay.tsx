import React from "react";
import type { BalanceState } from "../types";

interface BalanceDisplayProps {
  balance: BalanceState;
  walletUsdcBalance: number;
  walletAddress: string | null;
  onConnect: () => void;
  onTopUp?: () => void;
}

export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  balance,
  walletUsdcBalance,
  walletAddress,
  onConnect,
  onTopUp,
}) => {
  const short = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : null;

  if (!walletAddress) {
    return (
      <button
        onClick={onConnect}
        className="gl-interactive"
        style={{
          background: "rgba(0,0,0,0.6)",
          border: "1px solid rgba(52,211,153,0.45)",
          borderRadius: "5px",
          color: "#34d399",
          fontSize: "13px",
          fontWeight: 700,
          padding: "4px 12px",
          cursor: "pointer",
        }}
      >
        Connect Wallet
      </button>
    );
  }

  // address | MetaMask: $703 USDC [+ Top Up] | In-App: $50.00 | 🔒 ...
  return (
    <div
      className="gl-interactive"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        background: "rgba(0,0,0,0.65)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: "6px",
        padding: "3px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {/* Wallet address */}
      <span
        style={{ color: "#9ca3af", fontSize: "11px", fontFamily: "monospace" }}
      >
        {short}
      </span>

      <span style={{ color: "rgba(255,255,255,0.20)", fontSize: "12px" }}>
        │
      </span>

      {/* MetaMask on-chain USDC — source */}
      <span style={{ color: "#6b7280", fontSize: "10px", fontWeight: 600 }}>
        MetaMask
      </span>
      <span style={{ color: "#d1d5db", fontSize: "13px", fontWeight: 700 }}>
        ${walletUsdcBalance.toFixed(2)}
      </span>
      <span style={{ color: "#6b7280", fontSize: "10px" }}>USDC</span>

      {/* Top Up button */}
      {onTopUp && (
        <button
          onClick={onTopUp}
          className="gl-interactive"
          style={{
            background: "rgba(6,78,59,0.6)",
            border: "1px solid rgba(52,211,153,0.45)",
            borderRadius: "4px",
            color: "#34d399",
            fontSize: "11px",
            fontWeight: 700,
            padding: "3px 9px",
            cursor: "pointer",
          }}
        >
          + Top Up
        </button>
      )}

      <span style={{ color: "rgba(255,255,255,0.20)", fontSize: "12px" }}>
        │
      </span>

      {/* In-App balance — what the user bets with */}
      <span style={{ color: "#6b7280", fontSize: "10px", fontWeight: 600 }}>
        In-App
      </span>
      <span style={{ color: "#ffffff", fontSize: "14px", fontWeight: 700 }}>
        ${balance.wallet.toFixed(2)}
      </span>
      <span style={{ color: "#9ca3af", fontSize: "11px" }}>USDC</span>

      {/* Locked amount — only when non-zero */}
      {balance.locked > 0 && (
        <>
          <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "10px" }}>
            │
          </span>
          <span style={{ color: "#fbbf24", fontSize: "11px", fontWeight: 600 }}>
            🔒 ${balance.locked.toFixed(2)}
          </span>
        </>
      )}

      {/* Pending win — only when non-zero */}
      {balance.provisional > 0 && (
        <>
          <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "10px" }}>
            │
          </span>
          <span style={{ color: "#34d399", fontSize: "11px", fontWeight: 600 }}>
            ⏳ +${balance.provisional.toFixed(2)}
          </span>
        </>
      )}
    </div>
  );
};
