import React, { useState } from "react";
import type { Player } from "../types";

interface PlayerButtonProps {
  player: Player;
  isCurrentBet: boolean;
  isSettled?: boolean;
  settledWon?: boolean;
  onClick: (player: Player) => void;
  disabled?: boolean;
  alignRight?: boolean;
}

export const PlayerButton: React.FC<PlayerButtonProps> = ({
  player,
  isCurrentBet,
  isSettled = false,
  settledWon = false,
  onClick,
  disabled = false,
  alignRight = false,
}) => {
  // Show last word of name as surname (Odds API stores as "First Last")
  const surname = player.name.split(" ").slice(-1)[0];
  const [pressed, setPressed] = useState(false);

  // ── 3D colour scheme ──────────────────────────────────────────────────────
  // Each button has: light-top → dark-bottom gradient (depth illusion)
  // + bright top-border (light catching the beveled edge)
  // + thick solid bottom shadow (the physical "thickness" of the button)
  // + deep inset shadow when pressed (crushes down into the screen)

  // Active bet = bright emerald GREEN
  let gradLight = isCurrentBet ? "#064e3b" : "#2c3654";
  let gradMid = isCurrentBet ? "#065f46" : "#1a2240";
  let gradDark = isCurrentBet ? "#022c22" : "#0c1428";
  let depthColor = isCurrentBet ? "#011a14" : "#050a18";
  let topBorder = isCurrentBet
    ? "rgba(52,211,153,0.90)"
    : "rgba(255,255,255,0.22)";
  let sideBorder = isCurrentBet
    ? "rgba(52,211,153,0.45)"
    : "rgba(255,255,255,0.08)";
  let botBorder = isCurrentBet ? "rgba(1,26,20,0.95)" : "rgba(5,10,24,0.90)";
  let nameColor = isCurrentBet ? "#d1fae5" : "#f0f4ff";
  let oddsColor = isCurrentBet ? "#34d399" : "#fde047";

  if (!isCurrentBet && isSettled) {
    gradLight = settledWon ? "#2d6e52" : "#5a1515";
    gradMid = settledWon ? "#1a4a35" : "#3a0c0c";
    gradDark = settledWon ? "#0a2a1e" : "#200606";
    depthColor = settledWon ? "#031a0e" : "#100202";
    topBorder = settledWon ? "rgba(110,231,183,0.45)" : "rgba(239,68,68,0.40)";
    sideBorder = settledWon ? "rgba(52,211,153,0.20)" : "rgba(239,68,68,0.15)";
    botBorder = settledWon ? "rgba(3,26,14,0.90)" : "rgba(15,2,2,0.90)";
    nameColor = settledWon ? "#6ee7b7" : "#fca5a5";
    oddsColor = nameColor;
  }

  const bg = `linear-gradient(180deg, ${gradLight} 0%, ${gradMid} 40%, ${gradDark} 100%)`;

  // Raised: thick bottom edge + outer glow + inner top highlight
  // Pressed: entire shadow collapses into inset, button sinks 4px
  const boxShadow = pressed
    ? [
        `inset 0 3px 8px rgba(0,0,0,0.75)`, // deep inset crush
        `inset 0 0 2px rgba(0,0,0,0.5)`,
        `0 1px 0 ${depthColor}`, // tiny residual edge
      ].join(", ")
    : [
        `0 5px 0 ${depthColor}`, // solid bottom thickness
        `0 6px 16px rgba(0,0,0,0.65)`, // ambient drop shadow
        `inset 0 1px 0 rgba(255,255,255,0.18)`, // top inner highlight
        `inset 0 -1px 0 rgba(0,0,0,0.35)`, // bottom inner shadow
      ].join(", ");

  const translateY = pressed ? "4px" : "0px"; // physically sinks 4px on press

  return (
    <button
      className="gl-interactive"
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => {
        setPressed(false);
        if (!disabled) onClick(player);
      }}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => {
        setPressed(false);
        if (!disabled) onClick(player);
      }}
      disabled={disabled}
      style={{
        display: "flex",
        // Number on INNER side (toward screen centre):
        // left column (alignRight=false)  → row-reverse → number on RIGHT
        // right column (alignRight=true)  → row         → number on LEFT
        flexDirection: alignRight ? "row" : "row-reverse",
        alignItems: "stretch",
        width: "100%",
        flex: 1,
        padding: "5px 6px",
        gap: "7px",
        background: bg,
        borderTop: `1px solid ${topBorder}`,
        borderLeft: `1px solid ${sideBorder}`,
        borderRight: `1px solid ${sideBorder}`,
        borderBottom: `1px solid ${botBorder}`,
        borderRadius: "8px",
        cursor: disabled ? "default" : "pointer",
        pointerEvents: "auto",
        boxSizing: "border-box",
        boxShadow,
        transform: `translateY(${translateY})`,
        transition: "box-shadow 0.07s, transform 0.07s, background 0.07s",
      }}
    >
      {/* LEFT: big jersey number spanning full button height */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          minWidth: "22px",
        }}
      >
        <span
          style={{
            color: isCurrentBet ? "#34d399" : "rgba(255,255,255,0.60)",
            fontSize: "26px",
            fontWeight: 900,
            lineHeight: 1,
            textShadow: isCurrentBet
              ? "0 0 16px rgba(52,211,153,0.85), 0 2px 4px rgba(0,0,0,0.9)"
              : "0 2px 4px rgba(0,0,0,0.9)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {player.number}
        </span>
      </div>

      {/* Thin divider */}
      <div
        style={{
          width: "1px",
          background: isCurrentBet
            ? "rgba(52,211,153,0.35)"
            : "rgba(255,255,255,0.10)",
          flexShrink: 0,
          alignSelf: "stretch",
        }}
      />

      {/* RIGHT: name line + odds line */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "3px",
          flex: 1,
          overflow: "hidden",
          // text aligns toward the number (inner side)
          textAlign: alignRight ? "left" : "right",
        }}
      >
        {/* Name */}
        <span
          style={{
            color: nameColor,
            fontSize: "14px",
            fontWeight: 800,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1,
            letterSpacing: "0.01em",
            textShadow: "0 1px 4px rgba(0,0,0,0.8)",
          }}
        >
          {surname}
          {isCurrentBet && (
            <span
              style={{
                marginLeft: "4px",
                color: "#34d399",
                fontSize: "11px",
                textShadow: "0 0 8px rgba(52,211,153,0.9)",
              }}
            >
              ★
            </span>
          )}
        </span>
        {/* Odds */}
        <span
          style={{
            color: oddsColor,
            fontSize: "15px",
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "0.02em",
            textShadow: `0 0 10px ${oddsColor}55, 0 1px 3px rgba(0,0,0,0.9)`,
          }}
        >
          {player.odds.toFixed(2)}×
        </span>
      </div>
    </button>
  );
};
