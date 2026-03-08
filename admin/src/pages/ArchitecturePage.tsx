import { useState } from "react";
import { useNavigate } from "react-router-dom";

const NAVY = "#0C2840";
const CYAN = "#2EC5E0";
const LIGHT_BLUE = "#56C8E8";

const ON_REPORT_CODE = `// Called by Chainlink KeystoneForwarder after DON consensus
function onReport(
    bytes calldata /* metadata */,
    bytes calldata report
) external {
    require(
        msg.sender == keystoneForwarder,
        "GLB: only keystone forwarder"
    );

    (
        string memory matchId,
        uint256[] memory goalScorers,
        uint8 winnerRaw,
        uint8 homeGoals,
        uint8 awayGoals
    ) = abi.decode(report, (string, uint256[], uint8, uint8, uint8));

    _settleMatch(
        matchId,
        goalScorers,
        MatchOutcome(winnerRaw),
        homeGoals,
        awayGoals
    );
}`;

const SETTLE_CODE = `// Distribute USDC balances after CRE settled match result
function settleUserBalances(
    string calldata matchId,
    address[] calldata users,
    uint256[] calldata amounts
) external onlyRelayer {
    Match storage m = matches[matchId];
    require(m.isSettled, "GLB: match not settled by CRE");
    require(!m.balancesSettled, "GLB: already settled");
    m.balancesSettled = true;
    for (uint256 i = 0; i < users.length; i++) {
        matchBalance[matchId][users[i]] = amounts[i];
    }
    emit UserBalancesSettled(matchId, users.length);
}`;

interface FlowStep {
  id: number;
  icon: string;
  label: string;
  sublabel: string;
  color: string;
}

const FLOW_STEPS: FlowStep[] = [
  { id: 1, icon: "📡", label: "Sports Data API", sublabel: "Goalserve live feed", color: "#4A9EBA" },
  { id: 2, icon: "🔗", label: "Chainlink CRE DON", sublabel: "Decentralised Oracle Network", color: CYAN },
  { id: 3, icon: "⚡", label: "Keystone Forwarder", sublabel: "On-chain delivery layer", color: LIGHT_BLUE },
  { id: 4, icon: "📜", label: "GoalLiveBetting.sol", sublabel: "onReport() → _settleMatch()", color: "#2A8FA8" },
  { id: 5, icon: "💰", label: "USDC Payouts", sublabel: "Users withdraw winnings", color: "#1E7A90" },
];

const STEPS = [
  { n: "1", title: "Fund Match", text: "User calls fundMatch() — one MetaMask tx, USDC locked per match in smart contract escrow." },
  { n: "2", title: "Place Bets", text: "User places and changes bets via Supabase (instant, no tx, no gas). Platform relayer records bets on-chain as an immutable audit trail." },
  { n: "3", title: "Record On-chain", text: "Relayer calls recordBet() asynchronously. Builds provable history of every bet & change. Relayer cannot move funds — only record." },
  { n: "4", title: "CRE Settlement", text: "Chainlink CRE (DON) calls onReport() via KeystoneForwarder after reaching consensus on match result. Match is settled on-chain permanently." },
  { n: "5", title: "Distribute Balances", text: "Relayer calls settleUserBalances() with P&L computed from Supabase bets + on-chain result. Final payouts written on-chain — immutable." },
  { n: "6", title: "Withdraw", text: "User calls withdraw() to pull their final USDC balance. One MetaMask tx. Funds cannot be moved by anyone else." },
];

export default function ArchitecturePage() {
  const navigate = useNavigate();
  const [activeCode, setActiveCode] = useState<"onReport" | "settle">("onReport");

  return (
    <div
      className="min-h-screen overflow-auto"
      style={{
        backgroundImage: "url('/page-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        color: NAVY,
        fontFamily: "'DM Mono', monospace",
      }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between"
        style={{
          padding: "0.85rem 2rem",
          background: "rgba(227,233,236,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid rgba(46,197,224,0.25)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <img src="/logo-icon.png" alt="" style={{ height: 40, width: "auto" }} />
          <div>
            <div style={{ fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(12,40,64,0.45)" }}>
              GOAL.LIVE
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: NAVY, letterSpacing: "0.04em" }}>
              CRE Architecture
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate("/")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1.2rem",
            background: NAVY,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: "0.78rem",
            letterSpacing: "0.06em",
            cursor: "pointer",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          ← Back
        </button>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.4rem 1.2rem",
              background: CYAN,
              borderRadius: 999,
              color: "#fff",
              fontSize: "0.72rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: "1.25rem",
              fontWeight: 600,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", boxShadow: "0 0 6px rgba(255,255,255,0.8)" }} />
            Chainlink CRE · On-chain Oracle Flow
          </div>
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
              fontWeight: 700,
              color: NAVY,
              margin: "0 0 0.75rem",
              lineHeight: 1.2,
            }}
          >
            How Trustless Live Betting Works
          </h1>
          <p style={{ color: "rgba(12,40,64,0.58)", fontSize: "0.88rem", maxWidth: 580, margin: "0 auto", lineHeight: 1.65 }}>
            Real-time match results flow from live sports feeds through the Chainlink Decentralised Oracle Network directly into the smart contract — no trusted intermediary, no tampering.
          </p>
        </div>

        {/* Flow Diagram */}
        <div
          style={{
            background: "rgba(255,255,255,0.45)",
            borderRadius: 20,
            border: `1px solid rgba(46,197,224,0.20)`,
            padding: "2rem 1.5rem",
            marginBottom: "2.5rem",
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(12,40,64,0.4)", marginBottom: "1.5rem", textAlign: "center" }}>
            Oracle Data Flow
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 0,
              flexWrap: "wrap",
              rowGap: "1rem",
            }}
          >
            {FLOW_STEPS.map((step, i) => (
              <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.5rem",
                    minWidth: 120,
                  }}
                >
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${step.color}22, ${step.color}44)`,
                      border: `2px solid ${step.color}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.5rem",
                      boxShadow: `0 4px 16px ${step.color}33`,
                    }}
                  >
                    {step.icon}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: NAVY, letterSpacing: "0.02em" }}>{step.label}</div>
                    <div style={{ fontSize: "0.62rem", color: "rgba(12,40,64,0.50)", marginTop: 2, letterSpacing: "0.02em" }}>{step.sublabel}</div>
                  </div>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <div style={{ display: "flex", alignItems: "center", margin: "0 0.25rem", paddingBottom: "1.8rem" }}>
                    <div style={{ width: 24, height: 2, background: `linear-gradient(90deg, ${FLOW_STEPS[i].color}, ${FLOW_STEPS[i + 1].color})` }} />
                    <div style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: `7px solid ${FLOW_STEPS[i + 1].color}` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 6-step architecture */}
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(12,40,64,0.4)", marginBottom: "1.25rem" }}>
            Architecture — V1 Trust-minimised Hybrid
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
            {STEPS.map((s) => (
              <div
                key={s.n}
                style={{
                  background: "rgba(255,255,255,0.45)",
                  border: `1px solid rgba(46,197,224,0.18)`,
                  borderRadius: 14,
                  padding: "1.1rem 1.25rem",
                  backdropFilter: "blur(8px)",
                  display: "flex",
                  gap: "0.9rem",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: CYAN,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    flexShrink: 0,
                    boxShadow: `0 2px 10px rgba(46,197,224,0.40)`,
                  }}
                >
                  {s.n}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem", color: NAVY, marginBottom: "0.3rem" }}>{s.title}</div>
                  <div style={{ fontSize: "0.74rem", color: "rgba(12,40,64,0.62)", lineHeight: 1.6 }}>{s.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Code section */}
        <div
          style={{
            background: "rgba(255,255,255,0.45)",
            borderRadius: 20,
            border: `1px solid rgba(46,197,224,0.20)`,
            overflow: "hidden",
            backdropFilter: "blur(8px)",
            marginBottom: "2.5rem",
          }}
        >
          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: `1px solid rgba(46,197,224,0.18)` }}>
            {(["onReport", "settle"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveCode(tab)}
                style={{
                  padding: "0.8rem 1.5rem",
                  background: activeCode === tab ? NAVY : "transparent",
                  color: activeCode === tab ? "#fff" : "rgba(12,40,64,0.55)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  letterSpacing: "0.08em",
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: activeCode === tab ? 600 : 400,
                  transition: "all 0.15s",
                }}
              >
                {tab === "onReport" ? "onReport() — CRE Entry Point" : "settleUserBalances()"}
              </button>
            ))}
          </div>
          {/* Description */}
          <div style={{ padding: "1rem 1.5rem 0.5rem", fontSize: "0.78rem", color: "rgba(12,40,64,0.65)", lineHeight: 1.65 }}>
            {activeCode === "onReport"
              ? "Called exclusively by the Chainlink KeystoneForwarder after the DON reaches consensus. Decodes the ABI-encoded match report and permanently settles the result on-chain. Cannot be called by any other address."
              : "Called by the platform relayer after CRE has settled the match result. Distributes final USDC balances to each user based on P&L computed from on-chain bets + oracle result. Once called, payouts are immutable."}
          </div>
          {/* Code block */}
          <pre
            style={{
              margin: 0,
              padding: "1rem 1.5rem 1.5rem",
              background: "transparent",
              fontSize: "0.78rem",
              color: NAVY,
              lineHeight: 1.7,
              overflowX: "auto",
              fontFamily: "'DM Mono', monospace",
            }}
          >
            <code>{activeCode === "onReport" ? ON_REPORT_CODE : SETTLE_CODE}</code>
          </pre>
        </div>

        {/* Trust model callout */}
        <div
          style={{
            background: `linear-gradient(135deg, rgba(46,197,224,0.12), rgba(86,200,232,0.08))`,
            border: `1.5px solid rgba(46,197,224,0.35)`,
            borderRadius: 16,
            padding: "1.5rem 1.75rem",
            display: "flex",
            gap: "1rem",
            alignItems: "flex-start",
          }}
        >
          <div style={{ fontSize: "1.4rem", flexShrink: 0, marginTop: 2 }}>🔒</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: NAVY, marginBottom: "0.4rem", letterSpacing: "0.04em" }}>
              Trust Model — V1 Hybrid
            </div>
            <div style={{ fontSize: "0.78rem", color: "rgba(12,40,64,0.70)", lineHeight: 1.7 }}>
              The relayer computes P&L from Supabase bet records but{" "}
              <strong style={{ color: NAVY }}>can never move funds</strong> — it can only set balance values and record bets.
              Final payouts are written on-chain and immutable once <code style={{ background: "rgba(46,197,224,0.15)", padding: "0 4px", borderRadius: 4 }}>settleUserBalances</code> runs.
              <br /><br />
              <strong style={{ color: NAVY }}>V2 path:</strong> Replace Supabase bets with on-chain <code style={{ background: "rgba(46,197,224,0.15)", padding: "0 4px", borderRadius: 4 }}>lockBet()</code> calls per bet, making P&L computation fully trustless on L2.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
