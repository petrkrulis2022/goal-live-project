// Phantom Wallet utilities for connecting and getting user address

interface PhantomWindow extends Window {
  solana?: {
    isPhantom?: boolean;
    connect?: () => Promise<{ publicKey: { toString: () => string } }>;
    disconnect?: () => Promise<void>;
    publicKey?: { toString: () => string } | null;
  };
}

export const isPhantomInstalled = (): boolean => {
  const window = globalThis as unknown as PhantomWindow;
  return !!(window.solana && window.solana.isPhantom);
};

export const connectPhantomWallet = async (): Promise<string | null> => {
  try {
    const window = globalThis as unknown as PhantomWindow;

    if (!window.solana) {
      throw new Error("Phantom wallet not found. Please install it first.");
    }

    if (!window.solana.connect) {
      throw new Error("Phantom wallet connect method not available");
    }

    const response = await window.solana.connect();
    const publicKey = response.publicKey.toString();
    return publicKey;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to connect Phantom wallet: ${error.message}`);
    }
    throw error;
  }
};

export const disconnectPhantomWallet = async (): Promise<void> => {
  try {
    const window = globalThis as unknown as PhantomWindow;

    if (window.solana && window.solana.disconnect) {
      await window.solana.disconnect();
    }
  } catch (error) {
    console.error("Error disconnecting Phantom wallet:", error);
  }
};

export const getPhantomWalletAddress = (): string | null => {
  try {
    const window = globalThis as unknown as PhantomWindow;

    if (window.solana && window.solana.publicKey) {
      return window.solana.publicKey.toString();
    }
    return null;
  } catch (error) {
    console.error("Error getting Phantom wallet address:", error);
    return null;
  }
};
