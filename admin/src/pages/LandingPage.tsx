import { useEffect, useRef, useState } from "react";

const NAVY = "#0C2840";
const CYAN = "#2EC5E0";
const LIGHT_BLUE = "#56C8E8";

const DEMO_VIDEO_URL = "";
const EXTENSION_BETA_URL =
  "https://github.com/petrkrulis2022/goal-live-project";
const CONTACT_URL = "mailto:hello@goal.live";

const DEPLOYMENTS = [
  {
    name: "GoalLiveBetting V1 (Sepolia)",
    address: "0x0ac469B0DE6C5d67fb904C54A1f7cA8c8bf347Bc",
    url: "https://sepolia.etherscan.io/address/0x0ac469B0DE6C5d67fb904C54A1f7cA8c8bf347Bc",
  },
  {
    name: "Chainlink KeystoneForwarder",
    address: "0x15fc6ae953e024d975e77382eeec56a9101f9f88",
    url: "https://sepolia.etherscan.io/address/0x15fc6ae953e024d975e77382eeec56a9101f9f88",
  },
  {
    name: "USDC (Circle Sepolia)",
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    url: "https://sepolia.etherscan.io/address/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
];

const STAT_TEXT =
  "Live in-game betting is already larger than pre-match betting in many markets. We are bringing that real-time behavior onchain with a mainstream-first UX.";

function TypewriterBanner() {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    // Start after a short delay so the page renders first
    const start = setTimeout(() => {
      const interval = setInterval(() => {
        idx.current++;
        setDisplayed(STAT_TEXT.slice(0, idx.current));
        if (idx.current >= STAT_TEXT.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, 28);
      return () => clearInterval(interval);
    }, 600);
    return () => clearTimeout(start);
  }, []);

  return (
    <div
      className="absolute z-20"
      style={{
        top: 0,
        left: 0,
        right: 0,
        padding: "0.9rem 2rem 0.9rem 220px",
        background: "transparent",
        borderBottom: "none",
        backdropFilter: "none",
        minHeight: 48,
        display: "flex",
        alignItems: "center",
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: "'DM Mono', monospace",
          fontSize: "0.92rem",
          color: NAVY,
          letterSpacing: "0.02em",
          lineHeight: 1.55,
          fontWeight: 600,
        }}
      >
        {displayed}
        {!done && (
          <span
            style={{
              display: "inline-block",
              width: 2,
              height: "1em",
              background: CYAN,
              marginLeft: 2,
              verticalAlign: "text-bottom",
              animation: "blink-cursor 0.7s step-end infinite",
            }}
          />
        )}
      </p>
    </div>
  );
}

function PitchCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    let t = 0;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      const w = canvas!.width;
      const h = canvas!.height;

      // Animated scan line
      const scanY = ((t * 0.35) % (h + 200)) - 100;
      const grad = ctx.createLinearGradient(0, scanY - 80, 0, scanY + 80);
      grad.addColorStop(0, "rgba(46,197,224,0)");
      grad.addColorStop(0.5, "rgba(46,197,224,0.06)");
      grad.addColorStop(1, "rgba(46,197,224,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 80, w, 160);

      // Floating hexagon nodes
      const nodes = [
        { x: w * 0.08, y: h * 0.18, r: 30 },
        { x: w * 0.92, y: h * 0.22, r: 20 },
        { x: w * 0.04, y: h * 0.75, r: 24 },
        { x: w * 0.96, y: h * 0.68, r: 18 },
        { x: w * 0.5, y: h * 0.06, r: 14 },
        { x: w * 0.5, y: h * 0.96, r: 11 },
      ];
      nodes.forEach((n, i) => {
        const pulse = Math.sin(t * 0.02 + i * 1.1) * 0.5 + 0.5;
        ctx.strokeStyle = `rgba(46,197,224,${0.22 + pulse * 0.28})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const angle = (Math.PI / 3) * s - Math.PI / 6;
          const px = n.x + n.r * Math.cos(angle);
          const py = n.y + n.r * Math.sin(angle);
          s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      });

      t++;
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 pointer-events-none" />;
}

export default function LandingPage() {
  return (
    <div
      className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{
        backgroundImage: "url('/page-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: NAVY,
      }}
    >
      <PitchCanvas />

      <TypewriterBanner />

      {/* Logo icon — top left corner */}
      <div
        className="absolute z-20 pointer-events-none"
        style={{ top: 20, left: 24 }}
      >
        <img
          src="/logo-icon.png"
          alt=""
          style={{ height: 96, width: "auto", display: "block" }}
        />
      </div>

      {/* Reviewer-first landing content */}
      <div
        className="relative z-10 flex flex-col items-center text-center"
        style={{ gap: "2.2rem", padding: "4.5rem 1rem 3rem" }}
      >
        {/* Live badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.6rem",
            padding: "0.45rem 1.3rem",
            border: `2px solid ${CYAN}`,
            borderRadius: 999,
            background: CYAN,
            fontSize: "0.76rem",
            letterSpacing: "0.20em",
            textTransform: "uppercase",
            color: "#fff",
            fontFamily: "'DM Mono', monospace",
            fontWeight: 500,
            boxShadow: `0 2px 18px rgba(46,197,224,0.35)`,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 0 6px rgba(255,255,255,0.8)",
              animation: "pulse-dot 1.4s ease-in-out infinite",
              flexShrink: 0,
            }}
          />
          Chainlink CRE · Sepolia Testnet
        </div>

        {/* Logo */}
        <div style={{ lineHeight: 1 }}>
          <img
            src="/logo.png"
            alt="goal.live"
            style={{ maxWidth: 500, width: "80vw", display: "block" }}
          />
        </div>

        {/* Hero copy */}
        <p
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "clamp(1.05rem, 2.3vw, 1.45rem)",
            color: "rgba(12,40,64,0.72)",
            maxWidth: 760,
            lineHeight: 1.5,
            margin: 0,
            fontStyle: "italic",
          }}
        >
          Gamified live event prediction markets powered by{" "}
          <span
            style={{ color: "#0A7B95", fontStyle: "normal", fontWeight: 600 }}
          >
            real-time on-chain odds oracles
          </span>
        </p>

        <p
          style={{
            margin: 0,
            maxWidth: 820,
            color: "rgba(12,40,64,0.78)",
            fontFamily: "'Inter', sans-serif",
            fontSize: "clamp(0.95rem, 1.5vw, 1.05rem)",
            lineHeight: 1.65,
          }}
        >
          We built the MVP on Sepolia for fastest Chainlink CRE development and
          iteration. The same trust model is being prepared for Base Sepolia and
          Base mainnet rollout.
        </p>

        {/* Divider */}
        <div
          style={{
            width: 60,
            height: 2,
            borderRadius: 2,
            background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)`,
          }}
        />

        {/* Core sections */}
        <div
          style={{
            width: "min(980px, 92vw)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "0.9rem",
            textAlign: "left",
          }}
        >
          {[
            {
              title: "What Makes It Different",
              text: "Users can place and change positions during the live match, not just before kickoff. It feels like a multiplayer game, while final settlement remains transparent and onchain.",
            },
            {
              title: "Why Base Is A Fit",
              text: "Base combines mainstream distribution through Coinbase with a fast app ecosystem. We bring a category expansion: live sports and event prediction, not only static markets.",
            },
            {
              title: "Who It Is For",
              text: "Mainstream live-event fans and communities on any device. Wallet complexity is increasingly abstracted away so non-crypto users can participate.",
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                background: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(46,197,224,0.28)",
                borderRadius: 16,
                padding: "1rem 1rem 1.05rem",
                boxShadow: "0 8px 24px rgba(12,40,64,0.06)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 0.45rem",
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#0A7B95",
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  margin: 0,
                  color: "rgba(12,40,64,0.8)",
                  fontSize: "0.93rem",
                  lineHeight: 1.55,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {item.text}
              </p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <section
          style={{
            width: "min(980px, 92vw)",
            background: "rgba(255,255,255,0.76)",
            border: "1px solid rgba(46,197,224,0.24)",
            borderRadius: 18,
            padding: "1rem",
          }}
        >
          <h3
            style={{
              margin: "0 0 0.9rem",
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.82rem",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#0A7B95",
            }}
          >
            How It Works
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.8rem",
              textAlign: "left",
            }}
          >
            {[
              "1. Users place and adjust live bets instantly during match events.",
              "2. Offchain services provide fast UX while preserving a verifiable audit trail.",
              "3. Chainlink CRE triggers decentralized result settlement and onchain payouts.",
            ].map((step) => (
              <div
                key={step}
                style={{
                  border: "1px solid rgba(12,40,64,0.1)",
                  borderRadius: 12,
                  padding: "0.8rem",
                  background: "rgba(255,255,255,0.7)",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "0.92rem",
                  lineHeight: 1.5,
                  color: "rgba(12,40,64,0.84)",
                }}
              >
                {step}
              </div>
            ))}
          </div>
        </section>

        {/* Media section */}
        <section
          id="demo"
          style={{
            width: "min(980px, 92vw)",
            background: "rgba(255,255,255,0.76)",
            border: "1px solid rgba(46,197,224,0.24)",
            borderRadius: 18,
            padding: "1rem",
            textAlign: "left",
          }}
        >
          <h3
            style={{
              margin: "0 0 0.85rem",
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.82rem",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#0A7B95",
            }}
          >
            Product Demo And Screenshots
          </h3>

          {DEMO_VIDEO_URL ? (
            <div style={{ marginBottom: "0.9rem" }}>
              <iframe
                title="goal.live demo"
                src={DEMO_VIDEO_URL}
                style={{
                  width: "100%",
                  height: "min(56vw, 460px)",
                  border: "1px solid rgba(12,40,64,0.15)",
                  borderRadius: 12,
                  background: "#0b1f31",
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div
              style={{
                border: "1px dashed rgba(12,40,64,0.3)",
                borderRadius: 12,
                padding: "0.9rem",
                marginBottom: "0.9rem",
                color: "rgba(12,40,64,0.75)",
                background: "rgba(255,255,255,0.75)",
                fontFamily: "'Inter', sans-serif",
                fontSize: "0.9rem",
              }}
            >
              Demo video slot is ready. Add your recording URL here after
              upload. Champions League highlight cut can be dropped in without
              changing layout.
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.8rem",
            }}
          >
            {[
              "Extension overlay view",
              "Admin event workflow",
              "Settlement proof view",
            ].map((label) => (
              <div
                key={label}
                style={{
                  border: "1px dashed rgba(46,197,224,0.5)",
                  borderRadius: 12,
                  minHeight: 148,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  padding: "0.8rem",
                  color: "rgba(12,40,64,0.72)",
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "0.78rem",
                  letterSpacing: "0.03em",
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.85), rgba(46,197,224,0.06))",
                }}
              >
                {label}
                <br />
                screenshot slot
              </div>
            ))}
          </div>
        </section>

        {/* Credibility */}
        <section
          style={{
            width: "min(980px, 92vw)",
            background: "rgba(255,255,255,0.76)",
            border: "1px solid rgba(46,197,224,0.24)",
            borderRadius: 18,
            padding: "1rem",
            textAlign: "left",
          }}
        >
          <h3
            style={{
              margin: "0 0 0.85rem",
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.82rem",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#0A7B95",
            }}
          >
            Public Contracts And Trust Layer
          </h3>
          <p
            style={{
              margin: "0 0 0.85rem",
              color: "rgba(12,40,64,0.78)",
              fontFamily: "'Inter', sans-serif",
              fontSize: "0.93rem",
              lineHeight: 1.55,
            }}
          >
            Core settlement logic is onchain. CRE orchestrates decentralized
            reporting while users get instant product interactions in the app
            layer.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "0.6rem",
            }}
          >
            {DEPLOYMENTS.map((d) => (
              <a
                key={d.address}
                href={d.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  textDecoration: "none",
                  border: "1px solid rgba(12,40,64,0.12)",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.82)",
                  padding: "0.7rem 0.75rem",
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#0A7B95",
                    marginBottom: "0.34rem",
                  }}
                >
                  {d.name}
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: "0.78rem",
                    color: NAVY,
                    wordBreak: "break-all",
                  }}
                >
                  {d.address}
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* How it works link */}
        <a
          href="/architecture"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.4rem 1.1rem",
            background: "rgba(46,197,224,0.12)",
            border: `1px solid rgba(46,197,224,0.35)`,
            borderRadius: 999,
            fontFamily: "'DM Mono', monospace",
            fontSize: "0.76rem",
            letterSpacing: "0.08em",
            color: NAVY,
            textDecoration: "none",
            fontWeight: 500,
            marginTop: "-0.5rem",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              `rgba(46,197,224,0.22)`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              `rgba(46,197,224,0.12)`;
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          How it works · CRE Architecture
        </a>

        {/* CTA buttons */}
        <div
          style={{
            display: "flex",
            gap: "1.25rem",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <a
            href="#demo"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.65rem",
              padding: "0.95rem 2.2rem",
              background: `linear-gradient(135deg, ${NAVY} 0%, #0a1f33 100%)`,
              border: `1.5px solid rgba(46,197,224,0.40)`,
              borderRadius: 14,
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.9rem",
              letterSpacing: "0.07em",
              fontWeight: 500,
              color: "#fff",
              textDecoration: "none",
              transition: "all 0.2s ease",
              boxShadow: `0 4px 20px rgba(12,40,64,0.22), inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
          >
            Watch 60s Demo
          </a>

          <a
            href={EXTENSION_BETA_URL}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.65rem",
              padding: "0.95rem 2.1rem",
              background: `linear-gradient(135deg, ${LIGHT_BLUE} 0%, ${CYAN} 100%)`,
              border: `1.5px solid rgba(255,255,255,0.35)`,
              borderRadius: 14,
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.9rem",
              letterSpacing: "0.07em",
              fontWeight: 500,
              color: "#fff",
              textDecoration: "none",
              transition: "all 0.2s ease",
              boxShadow: `0 4px 22px rgba(46,197,224,0.35)`,
              textShadow: "0 1px 2px rgba(0,0,0,0.15)",
            }}
          >
            Try Extension Beta
          </a>

          <a
            href={CONTACT_URL}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.65rem",
              padding: "0.95rem 2.2rem",
              background: "rgba(255,255,255,0.7)",
              border: `1.5px solid rgba(12,40,64,0.18)`,
              borderRadius: 14,
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.9rem",
              letterSpacing: "0.07em",
              fontWeight: 500,
              color: NAVY,
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
          >
            Contact Team
          </a>

          <a
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.65rem",
              padding: "0.95rem 2.2rem",
              background: "rgba(255,255,255,0.7)",
              border: `1.5px solid rgba(46,197,224,0.38)`,
              borderRadius: 14,
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.9rem",
              letterSpacing: "0.07em",
              fontWeight: 500,
              color: NAVY,
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
          >
            Admin Platform
          </a>
        </div>

        {/* Footer note */}
        <p
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: "0.75rem",
            color: "rgba(12,40,64,0.70)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginTop: "0.5rem",
            fontWeight: 600,
          }}
        >
          Built for Chainlink Hackathon · 2026 · Availability depends on
          jurisdiction
        </p>
      </div>

      <style>{`
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}
