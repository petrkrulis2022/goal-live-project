import { useState, useEffect, useCallback } from "react";

declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (
        event: string,
        handler: (...args: unknown[]) => void,
      ) => void;
    };
  }
}

const ADMIN_ADDRESS = "0xcb443c2db4025128964397CCb5BC4F4E8ab6A665";

export type WalletStatus =
  | "disconnected"
  | "connecting"
  | "wrong_wallet"
  | "authorized";

export function useAdminWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);

  function evaluate(addr: string | null) {
    if (!addr) {
      setStatus("disconnected");
      return;
    }
    if (addr.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
      setStatus("authorized");
    } else {
      setStatus("wrong_wallet");
    }
  }

  // On mount: check if already connected
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((res) => {
        const accounts = res as string[];
        const addr = accounts[0] ?? null;
        setAddress(addr);
        evaluate(addr);
      })
      .catch(() => {});
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;
    const handler = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      const addr = accounts[0] ?? null;
      setAddress(addr);
      evaluate(addr);
    };
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum!.removeListener("accountsChanged", handler);
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    if (!window.ethereum) {
      setError("MetaMask not detected. Install MetaMask to continue.");
      return;
    }
    setStatus("connecting");
    try {
      const res = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const accounts = res as string[];
      const addr = accounts[0] ?? null;
      setAddress(addr);
      evaluate(addr);
    } catch (e: unknown) {
      setStatus("disconnected");
      setError(e instanceof Error ? e.message : "Connection rejected");
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setStatus("disconnected");
  }, []);

  return {
    address,
    status,
    error,
    isAuthorized: status === "authorized",
    connect,
    disconnect,
    adminAddress: ADMIN_ADDRESS,
  };
}
