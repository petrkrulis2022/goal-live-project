import { useState, useEffect, useCallback } from "react";
import { services } from "../services";
import type { WalletState } from "../types/services.types";

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState | null>(() =>
    services.wallet.getState(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topUpPending, setTopUpPending] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const [withdrawPending, setWithdrawPending] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = services.wallet.onStateChange(setWallet);
    return unsubscribe;
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await services.wallet.connect();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    services.wallet.disconnect();
  }, []);

  const topUp = useCallback(async (amount: number): Promise<string> => {
    setTopUpPending(true);
    setTopUpError(null);
    try {
      return await services.wallet.topUp(amount);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Top-up failed";
      setTopUpError(msg);
      throw e;
    } finally {
      setTopUpPending(false);
    }
  }, []);

  const withdraw = useCallback(async (amount: number): Promise<string> => {
    setWithdrawPending(true);
    setWithdrawError(null);
    try {
      return await services.wallet.withdraw(amount);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Withdrawal failed";
      setWithdrawError(msg);
      throw e;
    } finally {
      setWithdrawPending(false);
    }
  }, []);

  const setPlayerAddress = useCallback((address: string) => {
    services.wallet.setPlayerAddress(address);
  }, []);

  const refreshBalance = useCallback(async () => {
    await services.wallet.getBalance();
  }, []);

  return {
    wallet,
    connect,
    disconnect,
    loading,
    error,
    topUp,
    topUpPending,
    topUpError,
    withdraw,
    withdrawPending,
    withdrawError,
    setPlayerAddress,
    refreshBalance,
  };
}
