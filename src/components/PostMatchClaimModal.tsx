import React, { useState } from "react";

interface PostMatchClaimModalProps {
  matchLabel: string;
  walletConnected: boolean;
  walletAddress?: string | null;
  estimatedPayout: number;
  claimableAmount: number;
  balancesSettled: boolean;
  withdrawn: boolean;
  onConnect: () => void | Promise<void>;
  onClaim: () => Promise<string>;
  onClose: () => void;
}

export const PostMatchClaimModal: React.FC<PostMatchClaimModalProps> = ({
  matchLabel,
  walletConnected,
  walletAddress,
  estimatedPayout,
  claimableAmount,
  balancesSettled,
  withdrawn,
  onConnect,
  onClaim,
  onClose,
}) => {
  const [pending, setPending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shortWallet =
    walletAddress && walletAddress.length > 10
      ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
      : walletAddress ?? null;

  const showEstimated = walletConnected && !balancesSettled;
  const showClaimable =
    walletConnected && balancesSettled && !withdrawn && claimableAmount > 0;
  const showNothingLeft =
    walletConnected && balancesSettled && !withdrawn && claimableAmount <= 0;

  async function handleClaim() {
    setPending(true);
    setError(null);
    try {
      const hash = await onClaim();
      setTxHash(hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="gl-interactive fixed inset-0 z-[2147483646] flex items-center justify-center bg-black/75 px-4 pointer-events-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#090d14] p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300/80">
              Post-Match Claim
            </p>
            <h3 className="mt-1 text-lg font-black text-white">{matchLabel}</h3>
            {shortWallet && (
              <p className="mt-1 text-[11px] text-gray-400">
                Connected wallet: {shortWallet}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-xl leading-none text-gray-500 hover:text-white"
          >
            x
          </button>
        </div>

        {!txHash && !walletConnected && (
          <>
            <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-950/20 px-4 py-3">
              <p className="text-sm font-semibold text-amber-200">
                Connect your wallet to see your possible winnings or remaining amount to claim.
              </p>
            </div>

            <p className="mb-4 text-xs leading-relaxed text-gray-400">
              Note: the claim is possible only after goal.live officially settles the game.
            </p>

            <button
              onClick={() => void onConnect()}
              className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-black"
            >
              Connect Wallet
            </button>
          </>
        )}

        {!txHash && showEstimated && (
          <>
            <div className="mb-4 rounded-xl border border-sky-400/20 bg-sky-950/20 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-sky-300">
                Possible winnings
              </p>
              <p className="mt-1 text-3xl font-black text-white">
                ${estimatedPayout.toFixed(2)}
              </p>
            </div>

            <div className="mb-4 rounded-xl border border-white/8 bg-black/30 px-4 py-3">
              <p className="text-sm font-semibold text-white">
                Official settlement still pending
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">
                Note: the claim is possible only after goal.live officially settles the game.
                Once settlement is complete, any winnings or remaining funds for this match
                will become claimable here.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white"
            >
              Close
            </button>
          </>
        )}

        {!txHash && showClaimable && (
          <>
            <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-emerald-300">
                Claimable now
              </p>
              <p className="mt-1 text-3xl font-black text-white">
                ${claimableAmount.toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-emerald-200/80">
                goal.live settlement is complete for this match
              </p>
            </div>

            {error && (
              <p className="mb-3 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <p className="mb-4 text-xs leading-relaxed text-gray-400">
              This claims your settled match balance from the match contract to your connected wallet.
            </p>

            <button
              onClick={handleClaim}
              disabled={pending}
              className={`w-full rounded-xl px-4 py-3 text-sm font-black ${
                pending
                  ? "cursor-not-allowed bg-gray-700 text-gray-400"
                  : "bg-emerald-400 text-black"
              }`}
            >
              {pending ? "Claiming..." : `Claim $${claimableAmount.toFixed(2)}`}
            </button>
          </>
        )}

        {!txHash && withdrawn && (
          <>
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-sm font-semibold text-white">Already claimed</p>
              <p className="mt-1 text-xs text-gray-400">
                Your post-match payout for this event has already been withdrawn.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white"
            >
              Close
            </button>
          </>
        )}

        {!txHash && showNothingLeft && (
          <>
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-sm font-semibold text-white">No funds left to claim</p>
              <p className="mt-1 text-xs text-gray-400">
                This match is settled and there is no remaining payout for this wallet.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white"
            >
              Close
            </button>
          </>
        )}

        {txHash && (
          <div className="text-center">
            <div className="mb-3 rounded-full bg-emerald-500/15 p-3 text-2xl text-emerald-300">
              OK
            </div>
            <p className="text-lg font-black text-white">Claim submitted</p>
            <p className="mt-2 text-sm text-gray-400">
              Your payout claim transaction was sent successfully.
            </p>
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block break-all text-xs text-emerald-300 underline"
            >
              {txHash}
            </a>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-black"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
