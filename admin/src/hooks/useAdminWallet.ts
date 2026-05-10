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
    solana?: {
      isPhantom?: boolean;
      connect: (opts?: {
        onlyIfTrusted?: boolean;
      }) => Promise<{ publicKey: { toString(): string } }>;
      disconnect: () => Promise<void>;
      publicKey: { toString(): string } | null;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (
        event: string,
        handler: (...args: unknown[]) => void,
      ) => void;
    };
  }
}

const ADMIN_SOLANA_PUBKEY = "Dn382aRJfXJwyE12Yck3mLSXtGeMQdcSJ7NR5wsQaJd5";

export type WalletType = "metamask" | "phantom";

export type WalletStatus =
  | "disconnected"
  | "connecting"
  | "wrong_wallet"
  | "authorized";

export function useAdminWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);

  function evaluateEth(addr: string | null) {
    if (!addr) {
      setStatus("disconnected");
      return;
    }
    // solana-goalserve branch: admin auth is Phantom-only.
    setStatus("wrong_wallet");
  }

  function evaluateSolana(pubkey: string | null) {
    if (!pubkey) {
      setStatus("disconnected");
      return;
    }
    if (pubkey === ADMIN_SOLANA_PUBKEY) {
      setStatus("authorized");
    } else {
      setStatus("wrong_wallet");
    }
  }

  // On mount: restore MetaMask session if already connected
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((res) => {
        const accounts = res as string[];
        const addr = accounts[0] ?? null;
        if (addr) {
          setAddress(addr);
          setWalletType("metamask");
          evaluateEth(addr);
        }
      })
      .catch(() => {});
  }, []);

  // Listen for MetaMask account changes
  useEffect(() => {
    if (!window.ethereum) return;
    const handler = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      const addr = accounts[0] ?? null;
      setAddress(addr);
      if (addr) {
        setWalletType("metamask");
        evaluateEth(addr);
      } else {
        setWalletType(null);
        setStatus("disconnected");
      }
    };
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum!.removeListener("accountsChanged", handler);
  }, []);

  // Listen for Phantom disconnect
  useEffect(() => {
    if (!window.solana) return;
    const handler = () => {
      if (walletType === "phantom") {
        setAddress(null);
        setWalletType(null);
        setStatus("disconnected");
      }
    };
    window.solana.on("disconnect", handler);
    return () => window.solana!.removeListener("disconnect", handler);
  }, [walletType]);

  const connectMetaMask = useCallback(async () => {
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
      setWalletType("metamask");
      evaluateEth(addr);
    } catch (e: unknown) {
      setStatus("disconnected");
      setError(e instanceof Error ? e.message : "Connection rejected");
    }
  }, []);

  const connectPhantom = useCallback(async () => {
    setError(null);
    if (!window.solana?.isPhantom) {
      setError("Phantom not detected. Install the Phantom browser extension.");
      return;
    }
    setStatus("connecting");
    try {
      const resp = await window.solana.connect();
      const pubkey = resp.publicKey.toString();
      setAddress(pubkey);
      setWalletType("phantom");
      evaluateSolana(pubkey);
    } catch (e: unknown) {
      setStatus("disconnected");
      setError(e instanceof Error ? e.message : "Connection rejected");
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (walletType === "phantom" && window.solana) {
      try {
        await window.solana.disconnect();
      } catch {
        /* ignore */
      }
    }
    setAddress(null);
    setWalletType(null);
    setStatus("disconnected");
  }, [walletType]);

  return {
    address,
    walletType,
    status,
    error,
    isAuthorized: status === "authorized",
    connect: connectMetaMask, // kept for backward compat
    connectMetaMask,
    connectPhantom,
    disconnect,
    adminAddress: ADMIN_SOLANA_PUBKEY,
  };
}
