import React, { useCallback } from "react";
import { IDKitWidget, VerificationLevel, type ISuccessResult, type IErrorState } from "@worldcoin/idkit";
import { useWorldID, type WorldIDAction } from "../hooks/useWorldID";

interface WorldIDGateProps {
  action: WorldIDAction;
  walletAddress: string;
  /** Called once after on-chain ZK proof is verified — proceed with tx */
  onVerified: () => void;
  children: React.ReactNode;
}

const APP_ID = (import.meta.env.VITE_WORLD_APP_ID ?? "") as `app_${string}`;

/**
 * WorldIDGate — Wraps any action behind a World ID ZK proof.
 *
 * If already verified this session (sessionStorage cache), renders
 * children directly. Otherwise shows the "Verify with World ID" button.
 *
 * Uses `DeviceLegacy` preset (World ID v3 protocol) which works with
 * the Worldcoin Simulator for demo and the Developer Portal Cloud API.
 */
export const WorldIDGate: React.FC<WorldIDGateProps> = ({
  action,
  walletAddress,
  onVerified,
  children,
}) => {
  const { verified, isVerifying, error, submitProof, clearError } = useWorldID(
    action,
    walletAddress
  );

  const handleVerify = useCallback(
    async (result: ISuccessResult) => {
      const ok = await submitProof(result, action, walletAddress);
      if (ok) onVerified();
    },
    [submitProof, action, walletAddress, onVerified]
  );

  // Already verified this session — render children immediately
  if (verified) {
    return <>{children}</>;
  }

  // Not yet verified — show the World ID verification prompt
  return (
    <div className="w-full">
      {/* Human verification prompt */}
      <div className="flex flex-col items-center bg-indigo-950/40 border border-indigo-500/30 rounded-xl px-4 py-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          {/* World ID logo mark */}
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="15" stroke="#818cf8" strokeWidth="2"/>
            <circle cx="16" cy="16" r="6" stroke="#818cf8" strokeWidth="2"/>
            <path d="M16 1v4M16 27v4M1 16h4M27 16h4" stroke="#818cf8" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="text-white font-bold text-sm">Verify you&apos;re human</span>
        </div>
        <p className="text-gray-400 text-[11px] text-center mb-3 leading-tight">
          GOAL.LIVE uses World ID to ensure each player is a unique human.
          <br />
          One scan per action ·{" "}
          <span className="text-indigo-300">ZK proof on Sepolia</span>
        </p>

        {error && (
          <div className="w-full text-red-400 text-[11px] bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2 mb-3 text-center">
            {error}
            <button
              onClick={clearError}
              className="ml-2 text-red-300 hover:text-red-200 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <IDKitWidget
          app_id={APP_ID}
          action={action}
          signal={walletAddress}
          verification_level={VerificationLevel.Device}
          handleVerify={handleVerify}
          onSuccess={() => {
            // onSuccess fires after handleVerify resolves without error
          }}
          onError={(err: IErrorState) => {
            console.error("IDKit error:", err);
          }}
        >
          {({ open }: { open: () => void }) => (
            <button
              onClick={open}
              disabled={isVerifying || !APP_ID}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: isVerifying
                  ? "rgba(99,102,241,0.3)"
                  : "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "#fff",
              }}
            >
              {isVerifying ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="15" stroke="white" strokeWidth="2"/>
                    <circle cx="16" cy="16" r="6" stroke="white" strokeWidth="2"/>
                    <path d="M16 1v4M16 27v4M1 16h4M27 16h4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Verify with World ID
                </>
              )}
            </button>
          )}
        </IDKitWidget>

        {!APP_ID && (
          <p className="text-yellow-500 text-[10px] mt-2">
            VITE_WORLD_APP_ID not set — add it to .env.local
          </p>
        )}
      </div>
    </div>
  );
};
