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
}

interface MockPlayerMarkersProps {
  bounds: VideoOverlayBounds;
  markers: MockTrackedPlayer[];
  selectedId?: string | null;
  editMode?: boolean;
  onSelect: (marker: MockTrackedPlayer) => void;
  onUpdatePosition?: (
    markerId: string,
    position: { xPct: number; yPct: number },
  ) => void;
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
  onSelect,
  onUpdatePosition,
}) => {
  return (
    <div
      style={{
        position: "fixed",
        left: `${bounds.left}px`,
        top: `${bounds.top}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
        zIndex: 2147483644,
        pointerEvents: "none",
      }}
    >
      {markers.map((marker) => {
        const isSelected = selectedId === marker.id;
        const accent = marker.team === "home" ? "#4ade80" : "#60a5fa";
        const opacity = marker.positionMode === "keyframe" ? 1 : 0.88;
        return (
          <button
            key={marker.id}
            type="button"
            onClick={() => onSelect(marker)}
            onPointerDown={(event) => {
              if (!editMode || selectedId !== marker.id || !onUpdatePosition) {
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
            title={`${marker.player.name} (${marker.trackLabel}) @ ${marker.renderTime.toFixed(1)}s`}
            style={{
              position: "absolute",
              left: `${marker.xPct * 100}%`,
              top: `${marker.yPct * 100}%`,
              transform: "translate(-50%, -50%)",
              pointerEvents: "auto",
              width: isSelected ? 34 : 28,
              height: isSelected ? 34 : 28,
              borderRadius: "999px",
              border: `2px solid ${isSelected ? "#ffffff" : `${accent}cc`}`,
              background: isSelected
                ? `radial-gradient(circle at 35% 30%, #ffffff 0%, ${accent} 35%, #0f172a 100%)`
                : `radial-gradient(circle at 35% 30%, ${accent} 0%, rgba(15,23,42,0.95) 75%)`,
              color: "#f8fafc",
              fontSize: isSelected ? 12 : 11,
              fontWeight: 900,
              opacity,
              boxShadow: isSelected
                ? `0 0 18px ${accent}aa, 0 10px 20px rgba(0,0,0,0.35)`
                : `0 6px 16px rgba(0,0,0,0.28)`,
              cursor:
                editMode && isSelected
                  ? "grabbing"
                  : editMode
                    ? "grab"
                    : "pointer",
              transition:
                "transform 0.12s ease, box-shadow 0.12s ease, width 0.12s ease, height 0.12s ease",
            }}
          >
            {marker.player.number}
          </button>
        );
      })}
    </div>
  );
};
