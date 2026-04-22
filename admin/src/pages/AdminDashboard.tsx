import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const NAVY = "#0C2840";
const CYAN = "#2EC5E0";
const LIGHT_GRAY = "#f5f5f5";

interface BetaTester {
  id: string;
  created_at: string;
  name: string;
  telegram: string;
  discord: string;
  solana_wallet: string;
  status: string;
  testnet_usdc_sent: boolean;
  testnet_send_date: string | null;
  mainnet_winnings: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<BetaTester[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Check admin access
  useEffect(() => {
    const adminWallet = localStorage.getItem("adminWallet");
    if (!adminWallet) {
      navigate("/admin");
      return;
    }
  }, [navigate]);

  // Load registrations
  useEffect(() => {
    loadRegistrations();
  }, []);

  const loadRegistrations = async () => {
    try {
      setIsLoading(true);
      setError("");

      const supabaseUrl = "https://weryswulejhjkrmervnf.supabase.co";
      const supabaseAnonKey =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlcnlzd3VsZWpoamtybWVydm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjEyODEsImV4cCI6MjA4NzU5NzI4MX0.fxMn2LMdoFuYAln-34WUo1uUiWjSnlSzJlDS-sepdtc";

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Use RPC function to bypass PostgREST schema cache issues
      const { data, error: fetchError } = await supabase.rpc(
        "get_beta_testers_list"
      );

      if (fetchError) {
        setError(
          "Unable to fetch registrations. The database may still be initializing. Try refreshing in a moment.",
        );
        console.error("RPC Error:", fetchError);
        setRegistrations([]);
      } else {
        setRegistrations((data as BetaTester[]) || []);
      }
    } catch (err) {
      setError("Failed to load registrations");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminWallet");
    localStorage.removeItem("adminLoginTime");
    navigate("/admin");
  };

  const handleSendNotification = async (registration: BetaTester) => {
    try {
      // Call edge function to send notification
      const response = await fetch(
        "https://weryswulejhjkrmervnf.supabase.co/functions/v1/send-notification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlcnlzd3VsZWpoamtybWVydm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjEyODEsImV4cCI6MjA4NzU5NzI4MX0.fxMn2LMdoFuYAln-34WUo1uUiWjSnlSzJlDS-sepdtc`,
          },
          body: JSON.stringify({
            registrationId: registration.id,
            name: registration.name,
            telegram: registration.telegram,
            discord: registration.discord,
            wallet: registration.solana_wallet,
          }),
        },
      );

      if (response.ok) {
        alert(`Notification sent to ${registration.name}!`);
      } else {
        alert("Failed to send notification");
      }
    } catch (err) {
      alert("Error sending notification");
      console.error(err);
    }
  };

  const filteredRegistrations =
    filterStatus === "all"
      ? registrations
      : registrations.filter((r) => r.status === filterStatus);

  const unsentUsdc = registrations.filter((r) => !r.testnet_usdc_sent).length;
  const sentUsdc = registrations.filter((r) => r.testnet_usdc_sent).length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: LIGHT_GRAY,
        padding: "2rem 1rem",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
            background: "#fff",
            padding: "1.5rem",
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(12,40,64,0.1)",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.75rem",
                fontFamily: "'DM Serif Display', serif",
                color: NAVY,
                margin: 0,
                marginBottom: "0.5rem",
              }}
            >
              Beta Registrations
            </h1>
            <p
              style={{
                fontSize: "0.9rem",
                color: "rgba(12,40,64,0.6)",
                margin: 0,
              }}
            >
              Manage and track beta tester registrations
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={() => (window.location.href = "/dashboard")}
              style={{
                padding: "0.5rem 1rem",
                background: "#2EC5E0",
                color: NAVY,
                border: "none",
                borderRadius: 6,
                fontSize: "0.85rem",
                fontFamily: "'DM Mono', monospace",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              🎮 Game Admin Platform
            </button>
            <button
              onClick={() => navigate("/admin/messages")}
              style={{
                padding: "0.5rem 1rem",
                background: CYAN,
                color: NAVY,
                border: "none",
                borderRadius: 6,
                fontSize: "0.85rem",
                fontFamily: "'DM Mono', monospace",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              📧 Messages
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: "0.5rem 1rem",
                background: "#f0f0f0",
                border: `1px solid #ddd`,
                borderRadius: 6,
                fontSize: "0.85rem",
                fontFamily: "'DM Mono', monospace",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "1.5rem",
              borderRadius: 12,
              boxShadow: "0 2px 8px rgba(12,40,64,0.1)",
            }}
          >
            <p
              style={{
                fontSize: "0.85rem",
                color: "rgba(12,40,64,0.6)",
                margin: "0 0 0.5rem 0",
                fontFamily: "'DM Mono', monospace",
              }}
            >
              TOTAL REGISTRATIONS
            </p>
            <p
              style={{
                fontSize: "2rem",
                fontWeight: "bold",
                color: NAVY,
                margin: 0,
              }}
            >
              {registrations.length}
            </p>
          </div>

          <div
            style={{
              background: "#fff",
              padding: "1.5rem",
              borderRadius: 12,
              boxShadow: "0 2px 8px rgba(12,40,64,0.1)",
            }}
          >
            <p
              style={{
                fontSize: "0.85rem",
                color: "rgba(12,40,64,0.6)",
                margin: "0 0 0.5rem 0",
                fontFamily: "'DM Mono', monospace",
              }}
            >
              USDC DISTRIBUTED
            </p>
            <p
              style={{
                fontSize: "2rem",
                fontWeight: "bold",
                color: CYAN,
                margin: 0,
              }}
            >
              {sentUsdc}
            </p>
            <p
              style={{
                fontSize: "0.75rem",
                color: "#999",
                margin: "0.5rem 0 0",
              }}
            >
              {unsentUsdc} pending
            </p>
          </div>

          <div
            style={{
              background: "#fff",
              padding: "1.5rem",
              borderRadius: 12,
              boxShadow: "0 2px 8px rgba(12,40,64,0.1)",
            }}
          >
            <p
              style={{
                fontSize: "0.85rem",
                color: "rgba(12,40,64,0.6)",
                margin: "0 0 0.5rem 0",
                fontFamily: "'DM Mono', monospace",
              }}
            >
              ALLOCATION (100K USDC)
            </p>
            <p
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: NAVY,
                margin: 0,
              }}
            >
              {(((registrations.length * 1000) / 100000) * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Filter */}
        <div
          style={{
            background: "#fff",
            padding: "1rem",
            borderRadius: 12,
            marginBottom: "2rem",
            boxShadow: "0 2px 8px rgba(12,40,64,0.1)",
            display: "flex",
            gap: "1rem",
            alignItems: "center",
          }}
        >
          <label
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.85rem",
              color: NAVY,
              fontWeight: 600,
            }}
          >
            Filter:
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: "0.5rem",
              border: `1px solid ${CYAN}`,
              borderRadius: 6,
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            <option value="all">All Status</option>
            <option value="registered">Registered</option>
            <option value="usdc_sent">USDC Sent</option>
            <option value="active">Active</option>
          </select>
          <button
            onClick={loadRegistrations}
            disabled={isLoading}
            style={{
              padding: "0.5rem 1rem",
              background: CYAN,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.85rem",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              background: "rgba(255,200,0,0.1)",
              border: `1px solid rgba(255,200,0,0.3)`,
              borderRadius: 8,
              padding: "1rem",
              marginBottom: "2rem",
              color: "#ff9800",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Registrations Table */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(12,40,64,0.1)",
          }}
        >
          {filteredRegistrations.length === 0 ? (
            <div
              style={{
                padding: "3rem",
                textAlign: "center",
                color: "rgba(12,40,64,0.5)",
              }}
            >
              <p style={{ fontSize: "1rem", margin: 0 }}>
                {isLoading
                  ? "Loading registrations..."
                  : "No registrations yet"}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: LIGHT_GRAY,
                      borderBottom: `2px solid #ddd`,
                    }}
                  >
                    <th
                      style={{
                        padding: "1rem",
                        textAlign: "left",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: NAVY,
                      }}
                    >
                      Name
                    </th>
                    <th
                      style={{
                        padding: "1rem",
                        textAlign: "left",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: NAVY,
                      }}
                    >
                      Telegram
                    </th>
                    <th
                      style={{
                        padding: "1rem",
                        textAlign: "left",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: NAVY,
                      }}
                    >
                      Discord
                    </th>
                    <th
                      style={{
                        padding: "1rem",
                        textAlign: "left",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: NAVY,
                      }}
                    >
                      Wallet
                    </th>
                    <th
                      style={{
                        padding: "1rem",
                        textAlign: "left",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: NAVY,
                      }}
                    >
                      USDC Sent
                    </th>
                    <th
                      style={{
                        padding: "1rem",
                        textAlign: "left",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: NAVY,
                      }}
                    >
                      Registered
                    </th>
                    <th
                      style={{
                        padding: "1rem",
                        textAlign: "left",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: NAVY,
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegistrations.map((reg, idx) => (
                    <tr
                      key={reg.id}
                      style={{
                        borderBottom: "1px solid #eee",
                        background: idx % 2 === 0 ? "#fff" : LIGHT_GRAY,
                      }}
                    >
                      <td
                        style={{
                          padding: "1rem",
                          fontSize: "0.9rem",
                          color: NAVY,
                          fontWeight: 500,
                        }}
                      >
                        {reg.name}
                      </td>
                      <td
                        style={{
                          padding: "1rem",
                          fontSize: "0.85rem",
                          color: "rgba(12,40,64,0.7)",
                        }}
                      >
                        {reg.telegram}
                      </td>
                      <td
                        style={{
                          padding: "1rem",
                          fontSize: "0.85rem",
                          color: "rgba(12,40,64,0.7)",
                        }}
                      >
                        {reg.discord}
                      </td>
                      <td
                        style={{
                          padding: "1rem",
                          fontSize: "0.75rem",
                          color: "rgba(12,40,64,0.6)",
                          fontFamily: "'DM Mono', monospace",
                          wordBreak: "break-all",
                          maxWidth: 150,
                        }}
                      >
                        {reg.solana_wallet.substring(0, 8)}...
                        {reg.solana_wallet.substring(
                          reg.solana_wallet.length - 4,
                        )}
                      </td>
                      <td style={{ padding: "1rem", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.25rem 0.75rem",
                            background: reg.testnet_usdc_sent
                              ? "rgba(76, 175, 80, 0.2)"
                              : "rgba(200,200,200,0.2)",
                            color: reg.testnet_usdc_sent ? "#4CAF50" : "#999",
                            borderRadius: 4,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {reg.testnet_usdc_sent ? "✓ Sent" : "Pending"}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "1rem",
                          fontSize: "0.8rem",
                          color: "rgba(12,40,64,0.6)",
                        }}
                      >
                        {new Date(reg.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <button
                          onClick={() => handleSendNotification(reg)}
                          style={{
                            padding: "0.4rem 0.8rem",
                            background: CYAN,
                            color: "#fff",
                            border: "none",
                            borderRadius: 4,
                            fontSize: "0.75rem",
                            fontFamily: "'DM Mono', monospace",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                        >
                          Notify
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
