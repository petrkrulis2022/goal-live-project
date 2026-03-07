import React, { useState } from "react";
import { matchContractService } from "../services/matchContract";

interface FundMatchModalProps {
  contractAddress: string;
  matchId: string;
  matchLabel: string;
  onClose: () => void;
  onSuccess: () => void;
  onFunded: (amount: number) => void;
}

export const FundMatchModal: React.FC<FundMatchModalProps> = ({
  contractAddress,
  matchId,
  matchLabel,
  onClose,
  onSuccess,
  onFunded,
}) => {
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<
    "idle" | "approving" | "funding" | "done" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash] = useState("");

  const parsed = parseFloat(amount);
  const valid = !isNaN(parsed) && parsed > 0;

  async function handleFund() {
    if (!valid) return;
    setErrorMsg("");
    try {
      setStep("approving");
      const hash = await matchContractService.fundMatch(
        contractAddress,
        matchId,
        parsed,
      );
      setTxHash(hash);
      setStep("done");
      onFunded(parsed);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Show friendly message for user rejection
      if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED")) {
        setErrorMsg("Transaction cancelled.");
      } else {
        setErrorMsg(msg.slice(0, 120));
      }
      setStep("error");
    }
  }

  const busy = step === "approving" || step === "funding";

  return (
    <div
      className="gl-interactive fixed inset-0 z-[2147483641] flex items-end justify-center pointer-events-auto"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="w-full max-w-sm bg-[#0e1015] border border-white/10 rounded-t-2xl px-5 pt-5 pb-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white font-bold text-base">Fund Match Pool</p>
            <p className="text-gray-400 text-[11px] mt-0.5">{matchLabel}</p>
          </div>
          {!busy && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white text-xl px-1"
            >
              ×
            </button>
          )}
        </div>

        {step === "done" ? (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
              <span className="text-emerald-400 text-2xl">✓</span>
            </div>
            <p className="text-white font-bold text-base mb-1">Funded!</p>
            <p className="text-gray-400 text-xs mb-2">
              Your USDC is locked in the match pool.
            </p>
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 text-[11px] hover:text-indigo-200"
            >
              View tx ↗
            </a>
          </div>
        ) : (
          <>
            {/* Match escrow info */}
            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl px-4 py-3 mb-4">
              <p className="text-indigo-300 text-[10px] font-semibold uppercase tracking-wide mb-1">
                Match Escrow Contract
              </p>
              <p className="text-white font-mono text-xs break-all">
                {contractAddress}
              </p>
              <a
                href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 text-[10px] hover:text-indigo-200 mt-1 inline-block"
              >
                View on Etherscan ↗
              </a>
            </div>

            {/* Balance hint */}

            {/* Amount input */}
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">
                $
              </span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setStep("idle");
                  setErrorMsg("");
                }}
                disabled={busy}
                className="w-full bg-gray-900 border border-white/15 rounded-xl pl-7 pr-16 py-3 text-white text-sm font-bold focus:outline-none focus:border-emerald-500/60 disabled:opacity-50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                USDC
              </span>
            </div>

            {/* Quick amounts */}
            <div className="flex gap-2 mb-4">
              {[5, 10, 25, 50].map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setAmount(String(v));
                    setStep("idle");
                    setErrorMsg("");
                  }}
                  disabled={busy}
                  className="flex-1 py-1.5 rounded-lg border border-white/12 text-gray-300 text-xs font-bold hover:border-emerald-500/50 hover:text-emerald-400 disabled:opacity-30 transition-colors"
                >
                  ${v}
                </button>
              ))}
            </div>

            {errorMsg && (
              <p className="text-red-400 text-xs mb-3 text-center">
                {errorMsg}
              </p>
            )}

            {/* CTA — MetaMask prompt */}
            <button
              onClick={handleFund}
              disabled={!valid || busy}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background:
                  valid && !busy
                    ? "linear-gradient(135deg, #10b981, #059669)"
                    : "rgba(16,185,129,0.3)",
                color: "#000",
              }}
            >
              {busy
                ? step === "approving"
                  ? "⏳ Confirm in MetaMask…"
                  : "⏳ Sending transaction…"
                : `⚡ Fund $${parsed > 0 ? parsed.toFixed(2) : "0.00"} via MetaMask`}
            </button>

            <p className="text-gray-600 text-[10px] text-center mt-2">
              2 MetaMask prompts: USDC approve + fundMatch
            </p>
          </>
        )}
      </div>
    </div>
  );
};
