import { useState, useCallback } from "react";
import type { ISuccessResult } from "@worldcoin/idkit";
import { supabase } from "../lib/supabase";

export type WorldIDAction = "goal-live-fund-match" | "goal-live-withdraw";

const SESSION_KEY = (action: WorldIDAction, wallet: string) =>
  `wid_verified:${action}:${wallet.toLowerCase()}`;

interface UseWorldIDResult {
  verified: boolean;
  isVerifying: boolean;
  error: string | null;
  submitProof: (
    result: ISuccessResult,
    action: WorldIDAction,
    walletAddress: string
  ) => Promise<boolean>;
  clearError: () => void;
}

export function useWorldID(
  action: WorldIDAction,
  walletAddress: string
): UseWorldIDResult {
  const sessionKey = SESSION_KEY(action, walletAddress);

  const [verified, setVerified] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(sessionKey) === "1";
    } catch {
      return false;
    }
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitProof = useCallback(
    async (
      result: ISuccessResult,
      _action: WorldIDAction,
      _walletAddress: string
    ): Promise<boolean> => {
      setIsVerifying(true);
      setError(null);

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const { data: { session } } = await supabase.auth.getSession();
        const authHeader = session?.access_token
          ? `Bearer ${session.access_token}`
          : `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;

        const res = await fetch(
          `${supabaseUrl}/functions/v1/verify-worldid`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
            body: JSON.stringify({
              merkle_root: result.merkle_root,
              nullifier_hash: result.nullifier_hash,
              proof: result.proof,
              verification_level: result.verification_level,
              action: _action,
              wallet_address: _walletAddress,
            }),
          }
        );

        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Verification failed");
          return false;
        }

        // Cache in sessionStorage — no re-prompt needed this session
        try {
          sessionStorage.setItem(SESSION_KEY(_action, _walletAddress), "1");
        } catch {
          // sessionStorage unavailable — no problem, just re-verify next session
        }

        setVerified(true);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verification failed");
        return false;
      } finally {
        setIsVerifying(false);
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  return { verified, isVerifying, error, submitProof, clearError };
}
