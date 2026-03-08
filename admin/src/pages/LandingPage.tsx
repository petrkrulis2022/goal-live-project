import { useEffect, useRef } from "react";

// Animated pitch-line canvas background
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

      // Subtle grid of pitch lines
      ctx.strokeStyle = "rgba(74,222,128,0.055)";
      ctx.lineWidth = 1;
      const spacing = 80;
      for (let x = 0; x < w; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Animated diagonal scan line
      const scanY = ((t * 0.4) % (h + 200)) - 100;
      const grad = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
      grad.addColorStop(0, "rgba(74,222,128,0)");
      grad.addColorStop(0.5, "rgba(74,222,128,0.06)");
      grad.addColorStop(1, "rgba(74,222,128,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 60, w, 120);

      // Floating hexagon nodes
      const nodes = [
        { x: w * 0.12, y: h * 0.2, r: 28 },
        { x: w * 0.88, y: h * 0.15, r: 18 },
        { x: w * 0.06, y: h * 0.72, r: 22 },
        { x: w * 0.93, y: h * 0.65, r: 16 },
        { x: w * 0.5,  y: h * 0.08, r: 12 },
        { x: w * 0.5,  y: h * 0.95, r: 10 },
      ];
      nodes.forEach((n, i) => {
        const pulse = Math.sin(t * 0.02 + i * 1.1) * 0.5 + 0.5;
        ctx.strokeStyle = `rgba(74,222,128,${0.08 + pulse * 0.12})`;
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

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 1 }}
    />
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#050a06] text-white overflow-hidden flex flex-col items-center justify-center">
      {/* canvas backdrop */}
      <PitchCanvas />

      {/* radial glow under logo */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -60%)",
          width: 700,
          height: 700,
          background:
            "radial-gradient(ellipse at center, rgba(74,222,128,0.09) 0%, transparent 70%)",
        }}
      />

      {/* ── Main card ── */}
      <div
        className="relative z-10 flex flex-col items-center text-center"
        style={{ gap: "2.5rem" }}
      >
        {/* Live badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.3rem 1rem",
            border: "1px solid rgba(74,222,128,0.3)",
            borderRadius: 999,
            background: "rgba(74,222,128,0.07)",
            fontSize: "0.72rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#4ade80",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#4ade80",
              boxShadow: "0 0 6px #4ade80",
              animation: "pulse-dot 1.4s ease-in-out infinite",
              flexShrink: 0,
            }}
          />
          Chainlink CRE · Sepolia Testnet
        </div>

        {/* Logo */}
        <div style={{ lineHeight: 1 }}>
          <h1
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "clamp(5rem, 14vw, 10rem)",
              letterSpacing: "0.04em",
              background:
                "linear-gradient(135deg, #ffffff 30%, #4ade80 70%, #22c55e 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              margin: 0,
              padding: 0,
              textShadow: "none",
              filter: "drop-shadow(0 0 40px rgba(74,222,128,0.25))",
            }}
          >
            GOAL.LIVE
          </h1>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "clamp(1rem, 2.2vw, 1.35rem)",
            color: "rgba(255,255,255,0.6)",
            maxWidth: 560,
            lineHeight: 1.55,
            margin: 0,
            fontStyle: "italic",
          }}
        >
          Gamified live sports betting powered by{" "}
          <span style={{ color: "#4ade80", fontStyle: "normal" }}>
            real-time on-chain odds oracles
          </span>
        </p>

        {/* Divider */}
        <div
          style={{
            width: 60,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(74,222,128,0.5), transparent)",
          }}
        />

        {/* CTA buttons */}
        <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", justifyContent: "center" }}>
          {/* Admin button */}
          <a
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.85rem 2rem",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 12,
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.85rem",
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.8)",
              textDecoration: "none",
              transition: "all 0.2s ease",
              backdropFilter: "blur(8px)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.3)";
              (e.currentTarget as HTMLElement).style.color = "#fff";
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.14)";
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)";
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            Admin Platform
          </a>

          {/* Launch App button */}
          <a
            href="https://tvgo.t-mobile.cz/"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.85rem 2.2rem",
              background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
              border: "1px solid rgba(74,222,128,0.35)",
              borderRadius: 12,
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.85rem",
              letterSpacing: "0.08em",
              color: "#fff",
              textDecoration: "none",
              transition: "all 0.2s ease",
              boxShadow: "0 0 28px rgba(74,222,128,0.18)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 42px rgba(74,222,128,0.35)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 28px rgba(74,222,128,0.18)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Launch App
          </a>
        </div>

        {/* Footer note */}
        <p
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: "0.68rem",
            color: "rgba(255,255,255,0.2)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginTop: "0.5rem",
          }}
        >
          Built for Chainlink Hackathon · 2026
        </p>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}
