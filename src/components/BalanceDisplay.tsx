import React from "react";
import type { BalanceState } from "../types";

interface BalanceDisplayProps {
  balance: BalanceState;
  walletAddress: string | null;
  onConnect: () => void;
  onTopUp?: () => void;
}

export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  balance,
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

  // Single horizontal line: address | $450.00 USDC | +Top Up | 🔒 $42.39
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

      {/* Balance */}
      <span style={{ color: "#ffffff", fontSize: "14px", fontWeight: 700 }}>
        ${balance.wallet.toFixed(2)}
      </span>
      <span style={{ color: "#9ca3af", fontSize: "11px" }}>USDC</span>

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
