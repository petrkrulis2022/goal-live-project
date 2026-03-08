import { useEffect, useRef, useState } from "react";

const NAVY = "#0C2840";
const CYAN = "#2EC5E0";
const LIGHT_BLUE = "#56C8E8";

const STAT_TEXT = "Live betting now accounts for an average of 54% of total monthly bet amounts, with some mature European markets seeing up to 70% of total bets placed live.";

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
        { x: w * 0.5,  y: h * 0.06, r: 14 },
        { x: w * 0.5,  y: h * 0.96, r: 11 },
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
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
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

      {/* ── Main card ── */}
      <div
        className="relative z-10 flex flex-col items-center text-center"
        style={{ gap: "2.5rem", padding: "2rem 1rem" }}
      >
        {/* Live badge — more distinctive */}
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
            style={{ maxWidth: 520, width: "82vw", display: "block" }}
          />
        </div>

        {/* Tagline */}
        <p
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "clamp(1rem, 2.2vw, 1.35rem)",
            color: "rgba(12,40,64,0.60)",
            maxWidth: 560,
            lineHeight: 1.55,
            margin: 0,
            fontStyle: "italic",
          }}
        >
          Gamified live sports betting powered by{" "}
          <span style={{ color: "#0A7B95", fontStyle: "normal", fontWeight: 600 }}>
            real-time on-chain odds oracles
          </span>
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

        {/* CTA buttons */}
        <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", justifyContent: "center" }}>
          {/* Admin Platform — solid navy, very distinct */}
          <a
            href="/dashboard"
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
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 30px rgba(12,40,64,0.35), 0 0 18px rgba(46,197,224,0.20)`;
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px rgba(12,40,64,0.22), inset 0 1px 0 rgba(255,255,255,0.06)`;
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            Admin Platform
          </a>

          {/* Launch App — light blue */}
          <a
            href="https://tvgo.t-mobile.cz/"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.65rem",
              padding: "0.95rem 2.4rem",
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
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 32px rgba(46,197,224,0.55)`;
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 22px rgba(46,197,224,0.35)`;
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Launch App
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
          Built for Chainlink Hackathon · 2026
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
