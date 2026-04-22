import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  connectPhantomWallet,
  isPhantomInstalled,
} from "../utils/phantomWallet";

const NAVY = "#0C2840";
const CYAN = "#2EC5E0";

// Authorized admin wallets (Goal.Live accounts)
const AUTHORIZED_ADMIN_WALLETS = [
  "cr8j96n1rocid1rezwzrzpt4z3jpb8oq13h8dhtmzqtyh", // Solana devnet original
  "dn382arjfxjwyE12yck3mlsxtgemqdcSj7nr5wsqajd5", // Phantom wallet
];

// Goal.Live EVM address (associated with same account)
const ADMIN_ETH_WALLET = "0xcb443c2db4025128964397ccb5bc4f4e8ab6a665";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [walletAddress, setWalletAddress] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validateAndLogin = (address: string) => {
    const normalizedInput = address.trim().toLowerCase();
    const authorizedSolana = AUTHORIZED_ADMIN_WALLETS.map((w) => w.toLowerCase());
    const normalizedEth = ADMIN_ETH_WALLET.toLowerCase();

    if (
      authorizedSolana.includes(normalizedInput) ||
      normalizedInput === normalizedEth
    ) {
      // Store admin session
      localStorage.setItem("adminWallet", normalizedInput);
      localStorage.setItem("adminLoginTime", new Date().toISOString());

      // Redirect to dashboard
      navigate("/admin/dashboard");
      return true;
    } else {
      setError(
        "Wallet not authorized. You must be the admin wallet to access this section.",
      );
      return false;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      validateAndLogin(walletAddress);
    } catch (err) {
      setError("Error processing wallet address. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhantomLogin = async () => {
    setError("");
    setIsLoading(true);

    try {
      if (!isPhantomInstalled()) {
        setError(
          "Phantom wallet not found. Please install it from https://phantom.app",
        );
        setIsLoading(false);
        return;
      }

      const address = await connectPhantomWallet();
      if (address) {
        setWalletAddress(address);
        // Validate and login with the connected address
        validateAndLogin(address);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to connect Phantom wallet. Please try again.");
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8f9fa",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "2rem",
          maxWidth: 500,
          width: "100%",
          boxShadow: "0 10px 30px rgba(12,40,64,0.1)",
        }}
      >
        <h1
          style={{
            fontSize: "1.75rem",
            fontFamily: "'DM Serif Display', serif",
            color: NAVY,
            marginBottom: "0.5rem",
            textAlign: "center",
          }}
        >
          Admin Login
        </h1>

        <p
          style={{
            fontSize: "0.9rem",
            color: "rgba(12,40,64,0.6)",
            textAlign: "center",
            marginBottom: "2rem",
          }}
        >
          Enter your admin wallet address to access the beta registrations
          dashboard.
        </p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                fontFamily: "'DM Mono', monospace",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: NAVY,
                marginBottom: "0.5rem",
                fontWeight: 600,
              }}
            >
              Wallet Address
            </label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => {
                setWalletAddress(e.target.value);
                setError("");
              }}
              placeholder="Enter your admin wallet (Solana or Ethereum)"
              style={{
                width: "100%",
                padding: "0.75rem",
                border: `2px solid ${CYAN}`,
                borderRadius: 8,
                fontFamily: "'DM Mono', monospace",
                fontSize: "0.85rem",
                boxSizing: "border-box",
                transition: "all 0.2s ease",
              }}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div
              style={{
                background: "rgba(255,0,0,0.1)",
                border: "1px solid rgba(255,0,0,0.3)",
                borderRadius: 8,
                padding: "0.75rem",
                marginBottom: "1rem",
                color: "#c33",
                fontSize: "0.9rem",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!walletAddress.trim() || isLoading}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: walletAddress.trim() && !isLoading ? CYAN : "#ccc",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.9rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              cursor:
                walletAddress.trim() && !isLoading ? "pointer" : "not-allowed",
              transition: "all 0.2s ease",
              boxShadow:
                walletAddress.trim() && !isLoading
                  ? `0 4px 15px rgba(46,197,224,0.3)`
                  : "none",
            }}
          >
            {isLoading ? "Checking..." : "Login"}
          </button>
        </form>

        {/* Phantom Wallet Connection Section */}
        <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid #eee" }}>
          <p
            style={{
              fontSize: "0.8rem",
              textAlign: "center",
              color: "rgba(12,40,64,0.6)",
              marginBottom: "1rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Or Connect with Wallet
          </p>

          <button
            type="button"
            onClick={handlePhantomLogin}
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: !isLoading ? "#512DA8" : "#ccc",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.9rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              cursor: !isLoading ? "pointer" : "not-allowed",
              transition: "all 0.2s ease",
              boxShadow: !isLoading
                ? "0 4px 15px rgba(81, 45, 168, 0.3)"
                : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            <span>🅿️</span>
            {isLoading ? "Connecting..." : "Connect Phantom"}
          </button>
        </div>

        <div
          style={{
            marginTop: "2rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid #eee",
            fontSize: "0.8rem",
            color: "rgba(12,40,64,0.5)",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          <p style={{ margin: "0 0 0.5rem 0" }}>
            <strong>Authorized Solana Wallets:</strong>
          </p>
          {AUTHORIZED_ADMIN_WALLETS.map((wallet, idx) => (
            <p
              key={idx}
              style={{
                margin: idx === 0 ? "0 0 0.5rem 0" : "0.5rem 0",
                wordBreak: "break-all",
                fontSize: "0.75rem",
                background: "#f5f5f5",
                padding: "0.5rem",
                borderRadius: 4,
              }}
            >
              {wallet === AUTHORIZED_ADMIN_WALLETS[1] ? "🅿️ Phantom: " : ""}
              {wallet}
            </p>
          ))}

          <p style={{ margin: "1rem 0 0.5rem 0" }}>
            <strong>EVM Address:</strong>
          </p>
          <p
            style={{
              margin: 0,
              wordBreak: "break-all",
              fontSize: "0.75rem",
              background: "#f5f5f5",
              padding: "0.5rem",
              borderRadius: 4,
            }}
          >
            {ADMIN_ETH_WALLET}
          </p>
        </div>
      </div>
    </div>
  );
}
