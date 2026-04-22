import { useState } from "react";
import { useNavigate } from "react-router-dom";

const NAVY = "#0C2840";
const CYAN = "#2EC5E0";

// Solana branch admin wallet
const ADMIN_SOLANA_WALLET = "6xkodiNnAzDtGofYhvKfdzuNrn2xS96CLms6MVRCgApG";

// Sepolia/Hedera branch admin wallet
const ADMIN_ETH_WALLET = "0xcb443c2db4025128964397ccb5bc4f4e8ab6a665";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [walletAddress, setWalletAddress] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const normalizedInput = walletAddress.trim().toLowerCase();
      const normalizedSolana = ADMIN_SOLANA_WALLET.toLowerCase();
      const normalizedEth = ADMIN_ETH_WALLET.toLowerCase();

      if (
        normalizedInput === normalizedSolana ||
        normalizedInput === normalizedEth
      ) {
        // Store admin session
        localStorage.setItem("adminWallet", normalizedInput);
        localStorage.setItem("adminLoginTime", new Date().toISOString());

        // Redirect to dashboard
        navigate("/admin/dashboard");
      } else {
        setError(
          "Wallet not authorized. You must be the admin wallet to access this section.",
        );
      }
    } catch (err) {
      setError("Error processing wallet address. Please try again.");
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
            <strong>Solana Branch:</strong>
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
            {ADMIN_SOLANA_WALLET}
          </p>

          <p style={{ margin: "1rem 0 0.5rem 0" }}>
            <strong>Sepolia/Hedera Branch:</strong>
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
