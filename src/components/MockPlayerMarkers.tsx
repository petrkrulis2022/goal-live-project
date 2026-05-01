import React from "react";
import type { Player } from "../types";
import type { VideoOverlayBounds } from "../hooks/useVideoOverlayBounds";

export interface MockTrackedPlayer {
  id: string;
  player: Player;
  xPct: number;
  yPct: number;
  team: "home" | "away";
  trackLabel: string;
  positionMode: "keyframe" | "interpolated";
  renderTime: number;
  /** True when this marker is being actively tracked by Gemini AI */
  aiTracked?: boolean;
}

interface MockPlayerMarkersProps {
  bounds: VideoOverlayBounds;
  markers: MockTrackedPlayer[];
  selectedId?: string | null;
  editMode?: boolean;
  /** When true the overlay background becomes clickable (crosshair) to pin the selected player */
  pinMode?: boolean;
  onSelect: (marker: MockTrackedPlayer) => void;
  onUpdatePosition?: (
    markerId: string,
    position: { xPct: number; yPct: number },
  ) => void;
  /** Called when user clicks the overlay background in pin mode */
  onPinAt?: (position: { xPct: number; yPct: number }) => void;
}

function clientPointToNormalized(
  bounds: VideoOverlayBounds,
  clientX: number,
  clientY: number,
): { xPct: number; yPct: number } {
  const xPct = (clientX - bounds.left) / bounds.width;
  const yPct = (clientY - bounds.top) / bounds.height;

  return {
    xPct: Math.max(0.04, Math.min(0.96, xPct)),
    yPct: Math.max(0.04, Math.min(0.96, yPct)),
  };
}

export const MockPlayerMarkers: React.FC<MockPlayerMarkersProps> = ({
  bounds,
  markers,
  selectedId,
  editMode = false,
  pinMode = false,
  onSelect,
  onUpdatePosition,
  onPinAt,
}) => {
  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!pinMode || !onPinAt) return;
    // Only trigger when clicking the overlay background, not a child element
    if (event.target !== event.currentTarget) return;
    onPinAt(clientPointToNormalized(bounds, event.clientX, event.clientY));
  };

  return (
    <div
      onClick={handleContainerClick}
      style={{
        position: "fixed",
        left: `${bounds.left}px`,
        top: `${bounds.top}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
        zIndex: 2147483644,
        pointerEvents: pinMode ? "auto" : "none",
        cursor: pinMode ? "crosshair" : "default",
        background: pinMode ? "rgba(56,189,248,0.05)" : "transparent",
        transition: "background 0.2s ease",
      }}
    >
      <style>{`@keyframes ai-pulse { 0%,100%{box-shadow:0 0 0 2px rgba(245,158,11,0.5)} 50%{box-shadow:0 0 0 5px rgba(245,158,11,0)} }`}</style>
      {markers.map((marker) => {
        const isSelected = selectedId === marker.id;
        const accent = marker.team === "home" ? "#4ade80" : "#60a5fa";
        const size = isSelected ? 36 : 30;
        // Show only the last name to keep labels compact
        const lastName = marker.player.name.split(" ").slice(-1)[0];

        return (
          <div
            key={marker.id}
            style={{
              position: "absolute",
              left: `${marker.xPct * 100}%`,
              top: `${marker.yPct * 100}%`,
              // Center the circle on the player position; smooth tracking animation
              transform: "translate(-50%, -50%)",
              transition: "left 0.12s linear, top 0.12s linear",
              pointerEvents: "none",
            }}
          >
            {/* Player name label — floats above the circle */}
            <div
              style={{
                position: "absolute",
                bottom: `${size / 2 + 7}px`,
                left: "50%",
                transform: "translateX(-50%)",
                background: isSelected
                  ? "rgba(2,6,23,0.94)"
                  : "rgba(2,6,23,0.78)",
                border: `1px solid ${accent}${isSelected ? "88" : "44"}`,
                borderRadius: 5,
                padding: "2px 6px",
                color: isSelected ? accent : "#cbd5e1",
                fontSize: 10,
                fontWeight: 700,
                whiteSpace: "nowrap",
                pointerEvents: "none",
                boxShadow: isSelected
                  ? `0 0 8px ${accent}44`
                  : "0 2px 6px rgba(0,0,0,0.45)",
                letterSpacing: "0.02em",
                transition: "color 0.12s ease, border-color 0.12s ease",
              }}
            >
              {lastName}
            </div>

            {/* Jersey-number circle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(marker);
              }}
              onPointerDown={(event) => {
                if (
                  !editMode ||
                  selectedId !== marker.id ||
                  !onUpdatePosition
                ) {
                  return;
                }

                event.preventDefault();
                event.stopPropagation();

                const handleMove = (moveEvent: PointerEvent) => {
                  onUpdatePosition(
                    marker.id,
                    clientPointToNormalized(
                      bounds,
                      moveEvent.clientX,
                      moveEvent.clientY,
                    ),
                  );
                };

                const handleUp = () => {
                  window.removeEventListener("pointermove", handleMove);
                  window.removeEventListener("pointerup", handleUp);
                };

                handleMove(event.nativeEvent);
                window.addEventListener("pointermove", handleMove);
                window.addEventListener("pointerup", handleUp);
              }}
              title={`#${marker.player.number} ${marker.player.name} — click to bet on next goal`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: size,
                height: size,
                borderRadius: "50%",
                border: `2.5px solid ${isSelected ? "#ffffff" : `${accent}bb`}`,
                background: isSelected
                  ? `radial-gradient(circle at 35% 30%, #ffffff 0%, ${accent} 30%, #0f172a 100%)`
                  : `radial-gradient(circle at 35% 30%, ${accent}cc 0%, rgba(15,23,42,0.95) 80%)`,
                color: "#f8fafc",
                fontSize: isSelected ? 13 : 11,
                fontWeight: 900,
                opacity: marker.positionMode === "keyframe" ? 1 : 0.9,
                boxShadow: isSelected
                  ? `0 0 20px ${accent}bb, 0 0 40px ${accent}44, 0 8px 20px rgba(0,0,0,0.4)`
                  : `0 4px 14px rgba(0,0,0,0.35), 0 0 6px ${accent}33`,
                cursor:
                  editMode && isSelected
                    ? "grabbing"
                    : pinMode
                      ? "crosshair"
                      : "pointer",
                pointerEvents: "auto",
                transition:
                  "width 0.12s ease, height 0.12s ease, box-shadow 0.14s ease, border-color 0.12s ease",
                padding: 0,
              }}
            >
              {marker.player.number}
            </button>
            {marker.aiTracked && (
              <div
                style={{
                  position: "absolute",
                  top: -7,
                  right: -7,
                  background: "#f59e0b",
                  borderRadius: "50%",
                  width: 16,
                  height: 16,
                  fontSize: 7,
                  fontWeight: 900,
                  color: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 0 2px rgba(245,158,11,0.5)",
                  animation: "ai-pulse 1.5s ease-in-out infinite",
                  zIndex: 2,
                  pointerEvents: "none",
                }}
              >
                AI
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
