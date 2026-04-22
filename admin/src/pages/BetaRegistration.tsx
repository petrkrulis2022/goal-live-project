import { useState } from "react";
import { useNavigate } from "react-router-dom";

const NAVY = "#0C2840";
const CYAN = "#2EC5E0";

export default function BetaRegistration() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    telegram: "",
    discord: "",
    solanaWallet: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError("Please enter your name or nickname");
      return false;
    }
    if (!formData.telegram.trim()) {
      setError("Please enter your Telegram handle");
      return false;
    }
    if (!formData.discord.trim()) {
      setError("Please enter your Discord username");
      return false;
    }
    if (!formData.solanaWallet.trim()) {
      setError("Please enter your Solana devnet wallet address");
      return false;
    }
    // Basic wallet validation (Solana base58 address format)
    if (!formData.solanaWallet.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
      setError("Please enter a valid Solana wallet address");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Call Supabase edge function to save registration
      const supabaseUrl = "https://weryswulejhjkrmervnf.supabase.co";
      const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlcnlzd3VsZWpoamtybWVydm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjEyODEsImV4cCI6MjA4NzU5NzI4MX0.fxMn2LMdoFuYAln-34WUo1uUiWjSnlSzJlDS-sepdtc"; // Supabase anon key
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/beta-register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Registration failed. Please try again."
        );
      }

      setSubmitted(true);
      setTimeout(() => {
        navigate("/");
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{
        backgroundImage: "url('/page-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: NAVY,
        padding: "2rem 1rem",
      }}
    >
      {/* Header */}
      <button
        onClick={() => navigate("/")}
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          padding: "0.5rem 1rem",
          background: "transparent",
          border: `2px solid ${CYAN}`,
          borderRadius: 8,
          color: CYAN,
          fontFamily: "'DM Mono', monospace",
          fontSize: "0.8rem",
          cursor: "pointer",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          transition: "all 0.3s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = CYAN;
          e.currentTarget.style.color = "#fff";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = CYAN;
        }}
      >
        ← Back
      </button>

      {/* Main content */}
      <div
        style={{
          maxWidth: 600,
          width: "100%",
          marginTop: 40,
        }}
      >
        {!submitted ? (
          <>
            {/* Heading */}
            <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
              <h1
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: "clamp(1.8rem, 3.5vw, 2.4rem)",
                  color: NAVY,
                  margin: 0,
                  marginBottom: "0.5rem",
                  fontWeight: 700,
                }}
              >
                Join the Beta
              </h1>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "1rem",
                  color: "rgba(12,40,64,0.7)",
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                Get 50 USDC testnet to start. Win real mainnet USDC.
              </p>
            </div>

            {/* Info box */}
            <div
              style={{
                background: `rgba(46,197,224,0.1)`,
                border: `1px solid ${CYAN}`,
                borderRadius: 12,
                padding: "1rem",
                marginBottom: "2rem",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "0.85rem",
                  color: NAVY,
                  lineHeight: 1.6,
                  letterSpacing: "0.02em",
                }}
              >
                <strong>How it works:</strong> You'll receive 50 USDC on Solana
                devnet to test the MVP risk-free. All losses stay on testnet.
                But if you win, those winnings convert to real USDC on Solana
                mainnet. We're testing for 4 weeks and tracking all feedback.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {/* Name field */}
              <div style={{ marginBottom: "1.2rem" }}>
                <label
                  style={{
                    display: "block",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: NAVY,
                    marginBottom: "0.4rem",
                  }}
                >
                  Name or Nickname *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="How should we call you?"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: `1px solid rgba(46,197,224,0.3)`,
                    borderRadius: 8,
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "0.95rem",
                    color: NAVY,
                    boxSizing: "border-box",
                    transition: "all 0.3s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = CYAN;
                    e.currentTarget.style.boxShadow = `0 0 0 2px rgba(46,197,224,0.1)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(46,197,224,0.3)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Telegram field */}
              <div style={{ marginBottom: "1.2rem" }}>
                <label
                  style={{
                    display: "block",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: NAVY,
                    marginBottom: "0.4rem",
                  }}
                >
                  Telegram Handle *
                </label>
                <input
                  type="text"
                  name="telegram"
                  value={formData.telegram}
                  onChange={handleChange}
                  placeholder="@yourhandle"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: `1px solid rgba(46,197,224,0.3)`,
                    borderRadius: 8,
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "0.95rem",
                    color: NAVY,
                    boxSizing: "border-box",
                    transition: "all 0.3s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = CYAN;
                    e.currentTarget.style.boxShadow = `0 0 0 2px rgba(46,197,224,0.1)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(46,197,224,0.3)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Discord field */}
              <div style={{ marginBottom: "1.2rem" }}>
                <label
                  style={{
                    display: "block",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: NAVY,
                    marginBottom: "0.4rem",
                  }}
                >
                  Discord Username *
                </label>
                <input
                  type="text"
                  name="discord"
                  value={formData.discord}
                  onChange={handleChange}
                  placeholder="username#1234"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: `1px solid rgba(46,197,224,0.3)`,
                    borderRadius: 8,
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "0.95rem",
                    color: NAVY,
                    boxSizing: "border-box",
                    transition: "all 0.3s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = CYAN;
                    e.currentTarget.style.boxShadow = `0 0 0 2px rgba(46,197,224,0.1)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(46,197,224,0.3)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Solana Wallet field */}
              <div style={{ marginBottom: "1.8rem" }}>
                <label
                  style={{
                    display: "block",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: NAVY,
                    marginBottom: "0.4rem",
                  }}
                >
                  Solana Devnet Wallet Address *
                </label>
                <input
                  type="text"
                  name="solanaWallet"
                  value={formData.solanaWallet}
                  onChange={handleChange}
                  placeholder="Enter your devnet wallet address"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: `1px solid rgba(46,197,224,0.3)`,
                    borderRadius: 8,
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "0.95rem",
                    color: NAVY,
                    boxSizing: "border-box",
                    transition: "all 0.3s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = CYAN;
                    e.currentTarget.style.boxShadow = `0 0 0 2px rgba(46,197,224,0.1)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(46,197,224,0.3)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <p
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: "0.75rem",
                    color: "rgba(12,40,64,0.6)",
                    margin: "0.4rem 0 0",
                  }}
                >
                  We'll send your 50 USDC devnet here
                </p>
              </div>

              {/* Error message */}
              {error && (
                <div
                  style={{
                    background: "rgba(220,53,69,0.1)",
                    border: "1px solid rgba(220,53,69,0.3)",
                    borderRadius: 8,
                    padding: "0.75rem",
                    marginBottom: "1.5rem",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "0.9rem",
                    color: "#C82333",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "0.85rem",
                  background: CYAN,
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  boxShadow: `0 4px 20px rgba(46,197,224,0.4)`,
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = `0 6px 28px rgba(46,197,224,0.55)`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = `0 4px 20px rgba(46,197,224,0.4)`;
                }}
              >
                {loading ? "Registering..." : "Register for Beta"}
              </button>
            </form>

            {/* Community buttons */}
            <div
              style={{
                marginTop: "2rem",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.8rem",
              }}
            >
              <a
                href="https://t.me/goallive"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "0.65rem",
                  background: "transparent",
                  border: `1px solid ${CYAN}`,
                  borderRadius: 8,
                  color: CYAN,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  textDecoration: "none",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = CYAN;
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = CYAN;
                }}
              >
                Join Telegram
              </a>
              <a
                href="https://discord.gg/goallive"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "0.65rem",
                  background: "transparent",
                  border: `1px solid ${CYAN}`,
                  borderRadius: 8,
                  color: CYAN,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  textDecoration: "none",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = CYAN;
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = CYAN;
                }}
              >
                Join Discord
              </a>
            </div>
          </>
        ) : (
          /* Success state */
          <div
            style={{
              textAlign: "center",
              background: "rgba(46,197,224,0.08)",
              border: `2px solid ${CYAN}`,
              borderRadius: 16,
              padding: "2.5rem 1.5rem",
            }}
          >
            <div
              style={{
                fontSize: "3rem",
                marginBottom: "1rem",
              }}
            >
              ✓
            </div>
            <h2
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: "1.8rem",
                color: NAVY,
                margin: "0 0 0.5rem",
              }}
            >
              You're In!
            </h2>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "1rem",
                color: "rgba(12,40,64,0.75)",
                margin: "0 0 1rem",
                lineHeight: 1.6,
              }}
            >
              Check your Telegram and Discord for welcome onboarding. We'll send
              your 50 USDC devnet shortly.
            </p>
            <p
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "0.8rem",
                color: "rgba(12,40,64,0.6)",
                margin: 0,
              }}
            >
              Redirecting to home...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
