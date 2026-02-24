import React, { useState, useEffect } from "react";

interface TopUpModalProps {
  /** In-app wallet address — the deposit target */
  depositAddress: string;
  /** Current in-app USDC balance (auto-updates when deposit detected) */
  currentBalance: number;
  onRefresh: () => void;
  onClose: () => void;
}

export const TopUpModal: React.FC<TopUpModalProps> = ({
  depositAddress,
  currentBalance,
  onRefresh,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialBalance] = useState(currentBalance);
  const detected = currentBalance > initialBalance;

  const short = `${depositAddress.slice(0, 6)}…${depositAddress.slice(-4)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(depositAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 2000);
  };

  // Auto-close 3 s after deposit detected
  useEffect(() => {
    if (detected) {
      const t = setTimeout(onClose, 3000);
      return () => clearTimeout(t);
    }
  }, [detected, onClose]);

  return (
    <div
      className="gl-interactive fixed inset-0 z-[2147483641] flex items-end justify-center pointer-events-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-[#0e1015] border border-white/10 rounded-t-2xl px-5 pt-5 pb-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white font-bold text-base">
              Fund In-App Balance
            </p>
            <p className="text-gray-400 text-[11px] mt-0.5">
              Send USDC to your in-app wallet · Sepolia
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl px-1"
          >
            ×
          </button>
        </div>

        {detected ? (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
              <span className="text-emerald-400 text-2xl">✓</span>
            </div>
            <p className="text-white font-bold text-base mb-1">
              Deposit Detected!
            </p>
            <p className="text-gray-400 text-xs mb-2">
              Your in-app balance has been updated.
            </p>
            <p className="text-emerald-400 font-bold text-lg">
              ${currentBalance.toFixed(2)} USDC
            </p>
          </div>
        ) : (
          <>
            {/* Current balance */}
            <div className="bg-gray-900/60 rounded-lg px-3 py-2 mb-4 flex items-center justify-between border border-white/8">
              <span className="text-gray-400 text-xs">
                Current In-App Balance
              </span>
              <span className="text-white font-bold text-sm">
                ${currentBalance.toFixed(2)} USDC
              </span>
            </div>

            <p className="text-gray-400 text-xs mb-3 leading-relaxed">
              Send USDC (Sepolia) from any external wallet to the address below.
              Balance updates automatically within ~15 seconds.
            </p>

            {/* Deposit address */}
            <div className="bg-gray-900 border border-white/12 rounded-xl px-4 py-3 mb-3">
              <p className="text-gray-500 text-[10px] mb-1 font-semibold uppercase tracking-wide">
                Your In-App Wallet Address
              </p>
              <p className="text-white font-mono text-xs break-all leading-relaxed">
                {depositAddress}
              </p>
            </div>

            {/* Copy + Refresh */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleCopy}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  copied
                    ? "bg-emerald-600 text-black"
                    : "bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer"
                }`}
              >
                {copied ? "✓ Copied!" : "Copy Address"}
              </button>
              <button
                onClick={handleRefresh}
                className="px-4 py-2.5 rounded-xl border border-white/15 text-gray-300 text-sm hover:border-white/30 transition-colors"
              >
                {refreshing ? (
                  <span className="inline-block w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
                ) : (
                  "↺ Refresh"
                )}
              </button>
            </div>

            <p className="text-gray-600 text-[10px] text-center">
              {short} · Sepolia · USDC only
            </p>
          </>
        )}
      </div>
    </div>
  );
};
