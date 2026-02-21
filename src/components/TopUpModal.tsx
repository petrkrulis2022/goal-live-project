import React, { useState } from "react";

interface TopUpModalProps {
  /** Current on-chain USDC balance (for display) */
  walletBalance: number;
  walletAddress: string;
  onTopUp: (amount: number) => Promise<string>;
  onClose: () => void;
}

const PRESETS = [5, 10, 25, 50];

export const TopUpModal: React.FC<TopUpModalProps> = ({
  walletBalance,
  walletAddress,
  onTopUp,
  onClose,
}) => {
  const [amount, setAmount] = useState<string>("10");
  const [pending, setPending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseFloat(amount);
  const isValid = !isNaN(parsed) && parsed > 0 && parsed <= walletBalance;

  const handleConfirm = async () => {
    if (!isValid) return;
    setPending(true);
    setError(null);
    try {
      const hash = await onTopUp(parsed);
      setTxHash(hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setPending(false);
    }
  };

  const short = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;

  return (
    <div
      className="gl-interactive fixed inset-0 z-[2147483641] flex items-end justify-center pointer-events-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-[#0e1015] border border-white/10 rounded-t-2xl px-5 pt-5 pb-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white font-bold text-base">Top Up In-App Balance</p>
            <p className="text-gray-400 text-[11px] font-mono mt-0.5">{short} · Sepolia</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl px-1">×</button>
        </div>

        {!txHash ? (
          <>
            {/* Wallet balance info */}
            <div className="bg-gray-900/60 rounded-lg px-3 py-2.5 mb-4 flex items-center justify-between border border-white/8">
              <span className="text-gray-400 text-xs">Wallet USDC (Sepolia)</span>
              <span className="text-white font-bold text-sm">${walletBalance.toFixed(2)}</span>
            </div>

            {/* Presets */}
            <div className="flex gap-2 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(String(p))}
                  className={`
                    flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors
                    ${amount === String(p)
                      ? "bg-emerald-500 border-emerald-400 text-black"
                      : "bg-gray-800 border-white/10 text-gray-300 hover:border-white/30"}
                  `}
                >
                  ${p}
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="relative mb-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-gray-800 border border-white/15 rounded-lg pl-7 pr-16 py-2.5 text-white text-sm outline-none focus:border-emerald-500"
                placeholder="Custom amount"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">USDC</span>
            </div>
            {!isValid && amount !== "" && (
              <p className="text-red-400 text-[11px] mb-2">
                {parseFloat(amount) > walletBalance
                  ? `Exceeds wallet balance ($${walletBalance.toFixed(2)})`
                  : "Enter a valid amount"}
              </p>
            )}

            {/* Info */}
            <p className="text-gray-500 text-[11px] mb-4 leading-relaxed">
              Transfers USDC from your MetaMask wallet to your goal.live in-app balance via Sepolia.
              You will sign one MetaMask transaction.
            </p>

            {error && (
              <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2 mb-3">{error}</p>
            )}

            <button
              onClick={handleConfirm}
              disabled={!isValid || pending}
              className={`
                w-full py-3 rounded-xl font-bold text-sm transition-all
                ${isValid && !pending
                  ? "bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"}
              `}
            >
              {pending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Waiting for MetaMask…
                </span>
              ) : (
                `Confirm Top Up $${isNaN(parsed) ? "0" : parsed.toFixed(2)}`
              )}
            </button>
          </>
        ) : (
          /* Success state */
          <div className="flex flex-col items-center text-center py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
              <span className="text-emerald-400 text-2xl">✓</span>
            </div>
            <p className="text-white font-bold text-base mb-1">Top Up Sent!</p>
            <p className="text-gray-400 text-xs mb-4">
              ${parsed.toFixed(2)} USDC added to your in-app balance.
            </p>
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 text-xs font-mono underline break-all mb-5"
            >
              {txHash.slice(0, 22)}…{txHash.slice(-8)}
            </a>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-black font-bold rounded-xl text-sm"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
