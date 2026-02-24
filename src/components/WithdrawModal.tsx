import React, { useState } from "react";

interface WithdrawModalProps {
  /** Free in-app balance (already excludes funds locked in active bets) */
  inAppBalance: number;
  /** Amount locked in active bets — shown for context only */
  lockedAmount: number;
  /** In-app wallet address (signing from) */
  walletAddress: string;
  /** Player's external wallet address (destination) — ask if not set */
  playerAddress?: string;
  onWithdraw: (amount: number) => Promise<string>;
  onSavePlayerAddress: (addr: string) => void;
  onClose: () => void;
}

const PRESETS = [5, 10, 25, 50];

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  inAppBalance,
  lockedAmount,
  walletAddress,
  playerAddress,
  onWithdraw,
  onSavePlayerAddress,
  onClose,
}) => {
  const [amount, setAmount] = useState<string>("10");
  const [pending, setPending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addrInput, setAddrInput] = useState(playerAddress ?? "");
  const [editingAddr, setEditingAddr] = useState(!playerAddress);

  const effectivePlayerAddr = editingAddr
    ? addrInput
    : (playerAddress ?? addrInput);
  const addrValid = /^0x[0-9a-fA-F]{40}$/.test(effectivePlayerAddr);

  const saveAddr = () => {
    if (addrValid) {
      onSavePlayerAddress(effectivePlayerAddr);
      setEditingAddr(false);
    }
  };

  // inAppBalance is already the free amount — locked was deducted when bets were placed
  const available = Math.max(0, Math.round(inAppBalance * 100) / 100);
  const parsed = parseFloat(amount);
  const isValid =
    !isNaN(parsed) && parsed > 0 && parsed <= available && addrValid;

  const handleConfirm = async () => {
    if (!isValid) return;
    // Auto-save address if user typed it but didn't click Save
    if (editingAddr && addrValid) {
      onSavePlayerAddress(effectivePlayerAddr);
      setEditingAddr(false);
    }
    setPending(true);
    setError(null);
    try {
      const hash = await onWithdraw(parsed);
      setTxHash(hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setPending(false);
    }
  };

  const short = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;
  const isMock = txHash?.startsWith("0xmock_");

  return (
    <div
      className="gl-interactive fixed inset-0 z-[2147483641] flex items-end justify-center pointer-events-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-[#0e1015] border border-white/10 rounded-t-2xl px-5 pt-5 pb-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white font-bold text-base">Withdraw to Wallet</p>
            <p className="text-gray-400 text-[11px] font-mono mt-0.5">
              From {short} (in-app) · Sepolia
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl px-1"
          >
            ×
          </button>
        </div>

        {/* Player address — ask once, allow editing */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">
              Destination (player wallet)
            </span>
            {!editingAddr && playerAddress && (
              <button
                onClick={() => setEditingAddr(true)}
                className="text-blue-400 text-[10px] hover:text-blue-300"
              >
                Change
              </button>
            )}
          </div>
          {editingAddr ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={addrInput}
                onChange={(e) => setAddrInput(e.target.value)}
                placeholder="0x... your MetaMask player address"
                className="flex-1 bg-gray-800 border border-white/15 rounded-lg px-3 py-2 text-white text-xs font-mono outline-none focus:border-blue-500"
              />
              <button
                onClick={saveAddr}
                disabled={!addrValid}
                className={`px-3 py-2 rounded-lg text-xs font-bold ${
                  addrValid
                    ? "bg-blue-500 text-black"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                }`}
              >
                Save
              </button>
            </div>
          ) : (
            <p className="text-white text-xs font-mono bg-gray-900 border border-white/10 rounded-lg px-3 py-2 break-all">
              {effectivePlayerAddr || (
                <span className="text-gray-500">Not set</span>
              )}
            </p>
          )}
          {editingAddr && !addrValid && addrInput !== "" && (
            <p className="text-red-400 text-[10px] mt-1">
              Enter a valid 0x Ethereum address
            </p>
          )}
        </div>

        {!txHash ? (
          <>
            {/* Balance breakdown */}
            <div className="bg-gray-900/60 rounded-lg px-3 py-2.5 mb-4 border border-white/8 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 text-xs font-semibold">
                  Available to withdraw
                </span>
                <span className="text-emerald-400 font-bold text-sm">
                  ${available.toFixed(2)}
                </span>
              </div>
              {lockedAmount > 0 && (
                <div className="flex items-center justify-between pt-1 border-t border-white/8">
                  <span className="text-yellow-500/80 text-xs">
                    🔒 Also locked in active bets
                  </span>
                  <span className="text-yellow-400 text-xs font-bold">
                    ${lockedAmount.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {available === 0 ? (
              <p className="text-amber-400 text-xs bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-2 mb-4">
                No free in-app funds available. Top up or wait for bets to
                settle.
              </p>
            ) : (
              <>
                {/* Presets */}
                <div className="flex gap-2 mb-3">
                  {PRESETS.filter((p) => p <= available).map((p) => (
                    <button
                      key={p}
                      onClick={() => setAmount(String(p))}
                      className={`
                        flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors
                        ${
                          amount === String(p)
                            ? "bg-blue-500 border-blue-400 text-black"
                            : "bg-gray-800 border-white/10 text-gray-300 hover:border-white/30"
                        }
                      `}
                    >
                      ${p}
                    </button>
                  ))}
                  {available > 0 && (
                    <button
                      onClick={() =>
                        setAmount(available.toFixed(2).replace(/\.?0+$/, ""))
                      }
                      className={`
                        flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors
                        ${
                          parseFloat(amount) === available
                            ? "bg-blue-500 border-blue-400 text-black"
                            : "bg-gray-800 border-white/10 text-gray-300 hover:border-white/30"
                        }
                      `}
                    >
                      Max
                    </button>
                  )}
                </div>

                {/* Custom amount */}
                <div className="relative mb-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-gray-800 border border-white/15 rounded-lg pl-7 pr-16 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                    placeholder="Custom amount"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                    USDC
                  </span>
                </div>
                {!isValid && amount !== "" && (
                  <p className="text-red-400 text-[11px] mb-2">
                    {parseFloat(amount) > available
                      ? `Exceeds available balance ($${available.toFixed(2)})`
                      : "Enter a valid amount"}
                  </p>
                )}
              </>
            )}

            {/* Info */}
            <p className="text-gray-500 text-[11px] mb-4 leading-relaxed">
              Transfers USDC from your in-app wallet to the destination address
              via Sepolia. MetaMask will prompt you to sign from your in-app
              account ({short}).
            </p>

            {error && (
              <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2 mb-3">
                {error}
              </p>
            )}

            <button
              onClick={handleConfirm}
              disabled={!isValid || pending || available === 0}
              className={`
                w-full py-3 rounded-xl font-bold text-sm transition-all
                ${
                  isValid && !pending && available > 0
                    ? "bg-blue-500 hover:bg-blue-400 text-black cursor-pointer"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                }
              `}
            >
              {pending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Waiting for MetaMask…
                </span>
              ) : (
                `Withdraw $${isNaN(parsed) ? "0" : parsed.toFixed(2)} USDC`
              )}
            </button>
          </>
        ) : (
          /* Success state */
          <div className="flex flex-col items-center text-center py-2">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-3">
              <span className="text-blue-400 text-2xl">✓</span>
            </div>
            <p className="text-white font-bold text-base mb-1">
              Withdrawal Initiated!
            </p>
            <p className="text-gray-400 text-xs mb-4">
              ${parseFloat(amount).toFixed(2)} USDC is on its way to your
              wallet.
            </p>
            {!isMock && (
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 text-xs font-mono underline break-all mb-5"
              >
                {txHash!.slice(0, 22)}…{txHash!.slice(-8)}
              </a>
            )}
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-black font-bold rounded-xl text-sm"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
