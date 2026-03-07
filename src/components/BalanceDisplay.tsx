import React from "react";
import type { BalanceState } from "../types";
import type { MatchBalanceInfo } from "../hooks/useMatchBalance";

interface BalanceDisplayProps {
  balance: BalanceState;
  walletAddress: string | null;
  poolBalance?: number | null;
  matchBalanceInfo?: MatchBalanceInfo | null;
  onConnect: () => void;
  onTopUp?: () => void;
  onFundMatch?: () => void;
  onWithdraw?: () => void;
  onWithdrawMatch?: () => void;
}

export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  balance,
  walletAddress,
  poolBalance,
  matchBalanceInfo,
  onConnect,
  onTopUp,
  onFundMatch,
  onWithdraw,
  onWithdrawMatch,
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

  // Two-row 4+4 layout
  const sep = (
    <span style={{ color: "rgba(255,255,255,0.18)", fontSize: "11px" }}>│</span>
  );

  return (
    <div
      className="gl-interactive"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        background: "rgba(0,0,0,0.65)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: "6px",
        padding: "3px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {/* ROW 1: Pool (if available) | address | Fund | In-App $X USDC */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        {poolBalance != null && (
          <>
            <span style={{ fontSize: "10px" }}>🏦</span>
            <span
              style={{
                color: "#6b7280",
                fontSize: "9px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Pool
            </span>
            <span
              style={{ color: "#d1fae5", fontSize: "12px", fontWeight: 700 }}
            >
              ${poolBalance.toFixed(2)}
            </span>
            {sep}
          </>
        )}
        <span
          style={{
            color: "#9ca3af",
            fontSize: "11px",
            fontFamily: "monospace",
          }}
        >
          {short}
        </span>
        {sep}
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
              padding: "2px 8px",
              cursor: "pointer",
            }}
          >
            + Fund
          </button>
        )}
        {onFundMatch && (
          <button
            onClick={onFundMatch}
            className="gl-interactive"
            style={{
              background: "rgba(79,46,165,0.6)",
              border: "1px solid rgba(167,139,250,0.45)",
              borderRadius: "4px",
              color: "#a78bfa",
              fontSize: "11px",
              fontWeight: 700,
              padding: "2px 8px",
              cursor: "pointer",
            }}
          >
            ⚡ Match
          </button>
        )}
        {sep}
        <span style={{ color: "#6b7280", fontSize: "10px", fontWeight: 600 }}>
          In-App
        </span>
        <span style={{ color: "#ffffff", fontSize: "13px", fontWeight: 700 }}>
          ${balance.wallet.toFixed(2)}
        </span>
        <span style={{ color: "#9ca3af", fontSize: "10px" }}>USDC</span>
      </div>

      {/* ROW 2: Withdraw | Avail | Locked | Win | Provisional */}
      {((onWithdraw && balance.wallet > 0) || balance.locked > 0) && (
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          {onWithdraw && balance.wallet > 0 && (
            <>
              <button
                onClick={onWithdraw}
                className="gl-interactive"
                style={{
                  background: "rgba(30,58,138,0.5)",
                  border: "1px solid rgba(96,165,250,0.45)",
                  borderRadius: "4px",
                  color: "#60a5fa",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  cursor: "pointer",
                }}
              >
                ↓ Withdraw
              </button>
              {balance.locked > 0 && sep}
            </>
          )}
          {balance.locked > 0 && (
            <>
              <span
                style={{ color: "#6b7280", fontSize: "10px", fontWeight: 600 }}
              >
                Avail
              </span>
              <span
                style={{ color: "#d1fae5", fontSize: "12px", fontWeight: 700 }}
              >
                ${balance.available.toFixed(2)}
              </span>
              {sep}
              <span
                style={{ color: "#fbbf24", fontSize: "11px", fontWeight: 600 }}
              >
                🔒 ${balance.lockedThisGame.toFixed(2)}
              </span>
              <span
                style={{ color: "rgba(255,255,255,0.35)", fontSize: "9px" }}
              >
                game
              </span>
              {sep}
              <span
                style={{ color: "#a78bfa", fontSize: "10px", fontWeight: 600 }}
              >
                Win
              </span>
              <span
                style={{ color: "#c4b5fd", fontSize: "12px", fontWeight: 700 }}
              >
                ${balance.potentialPayout.toFixed(2)}
              </span>
              {balance.provisional > 0 && (
                <>
                  {sep}
                  <span
                    style={{
                      color: "#34d399",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    ⏳ +${balance.provisional.toFixed(2)}
                  </span>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ROW 3: On-chain match balance (deposit / payout / withdrawn) */}
      {matchBalanceInfo &&
        (matchBalanceInfo.balance > 0 ||
          matchBalanceInfo.withdrawn ||
          matchBalanceInfo.balancesSettled) && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ fontSize: "10px" }}>⛓</span>
            {matchBalanceInfo.withdrawn ? (
              <span
                style={{ color: "#6b7280", fontSize: "10px", fontWeight: 600 }}
              >
                withdrawn ✓
              </span>
            ) : matchBalanceInfo.balancesSettled ? (
              <>
                <span
                  style={{
                    color: "#34d399",
                    fontSize: "10px",
                    fontWeight: 600,
                  }}
                >
                  Payout
                </span>
                <span
                  style={{
                    color: matchBalanceInfo.balance > 0 ? "#34d399" : "#9ca3af",
                    fontSize: "12px",
                    fontWeight: 700,
                    animation:
                      matchBalanceInfo.balance > 0
                        ? "gl-pulse 1.5s ease-in-out infinite"
                        : undefined,
                  }}
                >
                  ${matchBalanceInfo.balance.toFixed(2)}
                </span>
                {matchBalanceInfo.balance > 0 && onWithdrawMatch && (
                  <>
                    {sep}
                    <button
                      onClick={onWithdrawMatch}
                      className="gl-interactive"
                      style={{
                        background: "rgba(6,78,59,0.7)",
                        border: "1px solid rgba(52,211,153,0.55)",
                        borderRadius: "4px",
                        color: "#34d399",
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        cursor: "pointer",
                      }}
                    >
                      ↓ Claim
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <span
                  style={{
                    color: "#6b7280",
                    fontSize: "10px",
                    fontWeight: 600,
                  }}
                >
                  Deposited
                </span>
                <span
                  style={{
                    color: "#fbbf24",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  ${matchBalanceInfo.balance.toFixed(2)}
                </span>
                <span style={{ color: "#9ca3af", fontSize: "9px" }}>
                  in pool
                </span>
              </>
            )}
          </div>
        )}
    </div>
  );
};
