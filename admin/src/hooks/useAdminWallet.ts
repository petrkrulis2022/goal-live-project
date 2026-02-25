import { useState, useEffect, useCallback } from "react";

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
    (window.ethereum as any)
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        const addr = accounts[0] ?? null;
        setAddress(addr);
        evaluate(addr);
      })
      .catch(() => {});
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;
    const handler = (accounts: string[]) => {
      const addr = accounts[0] ?? null;
      setAddress(addr);
      evaluate(addr);
    };
    (window.ethereum as any).on("accountsChanged", handler);
    return () =>
      (window.ethereum as any).removeListener("accountsChanged", handler);
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    if (!window.ethereum) {
      setError("MetaMask not detected. Install MetaMask to continue.");
      return;
    }
    setStatus("connecting");
    try {
      const accounts: string[] = await (window.ethereum as any).request({
        method: "eth_requestAccounts",
      });
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
