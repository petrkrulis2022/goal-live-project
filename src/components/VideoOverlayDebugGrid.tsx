import React from "react";
import type { VideoOverlayBounds } from "../hooks/useVideoOverlayBounds";

// Custom targeting-circle cursor — flat pitch-level ellipse (FIFA player marker style)
const PLAYER_TRACKER_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='88' height='88' viewBox='0 0 88 88'%3E%3Cellipse cx='44' cy='44' rx='34' ry='8' transform='rotate(12 44 44)' stroke='white' stroke-width='5.5' fill='none'/%3E%3Ccircle cx='44' cy='44' r='3' fill='white'/%3E%3C/svg%3E\") 44 44, crosshair";

interface VideoOverlayDebugGridProps {
  bounds: VideoOverlayBounds;
  rows?: number;
  cols?: number;
  onSelect?: (payload: {
    row: number;
    col: number;
    x: number;
    y: number;
    xPct: number;
    yPct: number;
  }) => void;
}

export const VideoOverlayDebugGrid: React.FC<VideoOverlayDebugGridProps> = ({
  bounds,
  rows = 6,
  cols = 10,
  onSelect,
}) => {
  const cells = Array.from({ length: rows * cols }, (_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return { row, col, key: `${row}-${col}` };
  });

  return (
    <div
      className="gl-interactive"
      style={{
        position: "fixed",
        left: `${bounds.left}px`,
        top: `${bounds.top}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
        zIndex: 2147483639,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          pointerEvents: "auto",
        }}
      >
        {cells.map((cell) => (
          <button
            key={cell.key}
            type="button"
            onClick={() => {
              const xPct = (cell.col + 0.5) / cols;
              const yPct = (cell.row + 0.5) / rows;
              onSelect?.({
                row: cell.row,
                col: cell.col,
                x: bounds.width * xPct,
                y: bounds.height * yPct,
                xPct,
                yPct,
              });
            }}
            style={{
              border: "1px solid rgba(16,185,129,0.07)",
              background: "rgba(16,185,129,0.01)",
              color: "rgba(255,255,255,0)",
              cursor: PLAYER_TRACKER_CURSOR,
              fontSize: "9px",
              fontWeight: 700,
              padding: 0,
              transition: "background 0.12s ease",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = "rgba(16,185,129,0.05)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "rgba(16,185,129,0.01)";
            }}
          >
            {cell.row + 1}:{cell.col + 1}
          </button>
        ))}
      </div>
    </div>
  );
};
