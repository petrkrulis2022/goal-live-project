import React, { useEffect, useMemo, useState } from "react";
import {
  CLICKABLE_LAB_DEMO_MATCH,
  CLICKABLE_LAB_DEMO_PLAYERS,
} from "../data/clickableLabDemo";
import type { Player } from "../types";
import { MockPlayerMarkers, type MockTrackedPlayer } from "./MockPlayerMarkers";
import { VideoOverlayDebugGrid } from "./VideoOverlayDebugGrid";
import { useVideoCurrentTime } from "../hooks/useVideoCurrentTime";
import { useVideoOverlayBounds } from "../hooks/useVideoOverlayBounds";

const DEMO_STAKES = [5, 10, 20, 50];
const TRACK_LOOP_SECONDS = 12;
const STORAGE_KEY = "goal-live-clickable-lab-tracks-v1";

interface MarkerKeyframe {
  time: number;
  xPct: number;
  yPct: number;
}

interface MockMarkerTrack {
  id: string;
  playerId: string;
  team: "home" | "away";
  trackLabel: string;
  keyframes: MarkerKeyframe[];
}

interface StoredTrackPayload {
  tracks: MockMarkerTrack[];
}

function clampPct(value: number): number {
  return Math.max(0.04, Math.min(0.96, value));
}

function buildTrackKeyframes(
  baseX: number,
  baseY: number,
  team: "home" | "away",
  seed: number,
): MarkerKeyframe[] {
  const horizontalDirection = team === "home" ? 1 : -1;
  const horizontalSway = 0.012 + (seed % 3) * 0.005;
  const verticalSway = 0.01 + (seed % 4) * 0.004;
  const offset = (seed % 5) * 0.003;

  const keyframes = [
    { time: 0, xPct: baseX, yPct: baseY },
    {
      time: 3,
      xPct: clampPct(baseX + horizontalDirection * horizontalSway),
      yPct: clampPct(baseY - verticalSway + offset),
    },
    {
      time: 6,
      xPct: clampPct(baseX + horizontalDirection * (horizontalSway * 1.7)),
      yPct: clampPct(baseY + verticalSway * 0.4),
    },
    {
      time: 9,
      xPct: clampPct(baseX + horizontalDirection * (horizontalSway * 0.6)),
      yPct: clampPct(baseY + verticalSway + offset),
    },
    { time: TRACK_LOOP_SECONDS, xPct: baseX, yPct: baseY },
  ];

  return keyframes;
}

function getLoopTime(time: number): number {
  return (
    ((time % TRACK_LOOP_SECONDS) + TRACK_LOOP_SECONDS) % TRACK_LOOP_SECONDS
  );
}

function sanitizeTracks(value: unknown): MockMarkerTrack[] | null {
  if (!Array.isArray(value)) return null;

  const tracks = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<MockMarkerTrack> & {
      keyframes?: Array<Partial<MarkerKeyframe>>;
    };

    if (
      typeof candidate.id !== "string" ||
      typeof candidate.playerId !== "string" ||
      (candidate.team !== "home" && candidate.team !== "away") ||
      typeof candidate.trackLabel !== "string" ||
      !Array.isArray(candidate.keyframes)
    ) {
      return [];
    }

    const keyframes = candidate.keyframes
      .flatMap((keyframe) => {
        if (!keyframe) return [];
        if (
          typeof keyframe.time !== "number" ||
          typeof keyframe.xPct !== "number" ||
          typeof keyframe.yPct !== "number"
        ) {
          return [];
        }

        return [
          {
            time: keyframe.time,
            xPct: clampPct(keyframe.xPct),
            yPct: clampPct(keyframe.yPct),
          } satisfies MarkerKeyframe,
        ];
      })
      .sort((a, b) => a.time - b.time);

    if (keyframes.length < 2) return [];

    return [
      {
        id: candidate.id,
        playerId: candidate.playerId,
        team: candidate.team,
        trackLabel: candidate.trackLabel,
        keyframes,
      } satisfies MockMarkerTrack,
    ];
  });

  return tracks.length > 0 ? tracks : null;
}

function loadStoredTracks(): MockMarkerTrack[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTrackPayload;
    return sanitizeTracks(parsed?.tracks ?? null);
  } catch {
    return null;
  }
}

function saveStoredTracks(tracks: MockMarkerTrack[]): void {
  try {
    const payload: StoredTrackPayload = { tracks };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or serialization failures in the lab.
  }
}

function upsertKeyframe(
  keyframes: MarkerKeyframe[],
  nextFrame: MarkerKeyframe,
): MarkerKeyframe[] {
  const threshold = 0.18;
  const existingIndex = keyframes.findIndex(
    (keyframe) => Math.abs(keyframe.time - nextFrame.time) < threshold,
  );

  const nextKeyframes = [...keyframes];
  if (existingIndex >= 0) {
    nextKeyframes[existingIndex] = nextFrame;
  } else {
    nextKeyframes.push(nextFrame);
  }

  return nextKeyframes.sort((a, b) => a.time - b.time);
}

function interpolateTrackPosition(
  keyframes: MarkerKeyframe[],
  time: number,
): { xPct: number; yPct: number; positionMode: "keyframe" | "interpolated" } {
  if (keyframes.length === 0) {
    return { xPct: 0.5, yPct: 0.5, positionMode: "keyframe" };
  }

  if (keyframes.length === 1) {
    return {
      xPct: keyframes[0].xPct,
      yPct: keyframes[0].yPct,
      positionMode: "keyframe",
    };
  }

  const loopTime =
    ((time % TRACK_LOOP_SECONDS) + TRACK_LOOP_SECONDS) % TRACK_LOOP_SECONDS;
  const exact = keyframes.find(
    (keyframe) => Math.abs(keyframe.time - loopTime) < 0.01,
  );
  if (exact) {
    return {
      xPct: exact.xPct,
      yPct: exact.yPct,
      positionMode: "keyframe",
    };
  }

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const current = keyframes[index];
    const next = keyframes[index + 1];
    if (loopTime >= current.time && loopTime <= next.time) {
      const span = next.time - current.time || 1;
      const progress = (loopTime - current.time) / span;
      return {
        xPct: current.xPct + (next.xPct - current.xPct) * progress,
        yPct: current.yPct + (next.yPct - current.yPct) * progress,
        positionMode: "interpolated",
      };
    }
  }

  const fallback = keyframes[keyframes.length - 1];
  return {
    xPct: fallback.xPct,
    yPct: fallback.yPct,
    positionMode: "keyframe",
  };
}

function buildMockMarkerTracks(players: Player[]): MockMarkerTrack[] {
  const starters = players.filter((player) => player.isStarter !== false);
  const byTeam = {
    home: starters.filter((player) => player.team === "home"),
    away: starters.filter((player) => player.team === "away"),
  };

  const positionGroups = ["goalkeeper", "defender", "midfielder", "forward"];
  const fallbackBuckets = [1, 3, 4, 3];

  const distributeTeam = (
    teamPlayers: Player[],
    team: "home" | "away",
  ): MockMarkerTrack[] => {
    const buckets = new Map<string, Player[]>();
    positionGroups.forEach((group) => buckets.set(group, []));

    teamPlayers.forEach((player) => {
      const normalized = player.position.toLowerCase();
      if (normalized.includes("goal")) buckets.get("goalkeeper")?.push(player);
      else if (normalized.includes("back") || normalized.includes("def")) {
        buckets.get("defender")?.push(player);
      } else if (normalized.includes("mid"))
        buckets.get("midfielder")?.push(player);
      else buckets.get("forward")?.push(player);
    });

    const used = new Set<string>();
    const columns = positionGroups.map((group, index) => {
      const groupPlayers = buckets.get(group) ?? [];
      if (groupPlayers.length > 0) {
        groupPlayers.forEach((player) => used.add(player.id));
        return groupPlayers;
      }

      const fallbackCount = fallbackBuckets[index];
      const remaining = teamPlayers.filter((player) => !used.has(player.id));
      const picked = remaining.slice(0, fallbackCount);
      picked.forEach((player) => used.add(player.id));
      return picked;
    });

    const extra = teamPlayers.filter((player) => !used.has(player.id));
    if (extra.length > 0) {
      columns[columns.length - 1] = [...columns[columns.length - 1], ...extra];
    }

    const xBase =
      team === "home" ? [0.1, 0.22, 0.34, 0.45] : [0.9, 0.78, 0.66, 0.55];

    return columns.flatMap((columnPlayers, columnIndex) => {
      return columnPlayers.map((player, playerIndex) => {
        const count = columnPlayers.length;
        const baseY =
          count === 1 ? 0.5 : 0.2 + (0.6 * playerIndex) / (count - 1);
        return {
          id: `${team}-${player.id}`,
          playerId: player.id,
          team,
          trackLabel: `${team === "home" ? "H" : "A"}-${columnIndex + 1}-${playerIndex + 1}`,
          keyframes: buildTrackKeyframes(
            xBase[columnIndex] ?? (team === "home" ? 0.45 : 0.55),
            baseY,
            team,
            columnIndex * 10 + playerIndex,
          ),
        } satisfies MockMarkerTrack;
      });
    });
  };

  return [
    ...distributeTeam(byTeam.home, "home"),
    ...distributeTeam(byTeam.away, "away"),
  ];
}

export const ClickablePlayersLab: React.FC = () => {
  const [showGrid, setShowGrid] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [editTracks, setEditTracks] = useState(false);
  const [probe, setProbe] = useState<{
    row: number;
    col: number;
    xPct: number;
    yPct: number;
  } | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [selectedStake, setSelectedStake] = useState(10);
  const [betFeedback, setBetFeedback] = useState<{
    playerName: string;
    stake: number;
    payout: number;
  } | null>(null);
  const bounds = useVideoOverlayBounds(true);
  const playback = useVideoCurrentTime(true);
  const isReplayFallback = true;
  const effectiveMatch = CLICKABLE_LAB_DEMO_MATCH;
  const effectivePlayers = CLICKABLE_LAB_DEMO_PLAYERS;
  const playersById = useMemo(
    () => new Map(effectivePlayers.map((player) => [player.id, player])),
    [effectivePlayers],
  );

  const defaultMarkerTracks = useMemo(
    () => buildMockMarkerTracks(effectivePlayers),
    [effectivePlayers],
  );

  const [markerTracks, setMarkerTracks] = useState<MockMarkerTrack[]>(() => {
    if (typeof window === "undefined") {
      return buildMockMarkerTracks(CLICKABLE_LAB_DEMO_PLAYERS);
    }

    return (
      loadStoredTracks() ?? buildMockMarkerTracks(CLICKABLE_LAB_DEMO_PLAYERS)
    );
  });

  useEffect(() => {
    setMarkerTracks((current) => {
      if (current.length > 0) return current;
      return loadStoredTracks() ?? defaultMarkerTracks;
    });
  }, [defaultMarkerTracks]);

  useEffect(() => {
    saveStoredTracks(markerTracks);
  }, [markerTracks]);

  const markers = useMemo(
    () =>
      markerTracks.flatMap((track) => {
        const player = playersById.get(track.playerId);
        if (!player) return [];

        const position = interpolateTrackPosition(
          track.keyframes,
          playback.currentTime,
        );

        return [
          {
            id: track.id,
            player,
            xPct: position.xPct,
            yPct: position.yPct,
            team: track.team,
            trackLabel: track.trackLabel,
            positionMode: position.positionMode,
            renderTime: playback.currentTime,
          } satisfies MockTrackedPlayer,
        ];
      }),
    [markerTracks, playback.currentTime, playersById],
  );

  const selectedMarker = useMemo(
    () => markers.find((marker) => marker.id === selectedMarkerId) ?? null,
    [markers, selectedMarkerId],
  );

  const activeLoopTime = useMemo(
    () => getLoopTime(playback.currentTime),
    [playback.currentTime],
  );

  const statusLabel = useMemo(() => {
    if (!bounds) return "No visible video detected yet";
    const base = `Video ${Math.round(bounds.width)}x${Math.round(bounds.height)}`;
    const playbackState = playback.paused ? "paused" : "playing";
    return `${base} · ${playbackState} · t=${playback.currentTime.toFixed(1)}s · ${CLICKABLE_LAB_DEMO_MATCH.homeTeam} vs ${CLICKABLE_LAB_DEMO_MATCH.awayTeam}`;
  }, [bounds, playback.currentTime, playback.paused]);

  const expectedPayout = selectedMarker
    ? selectedStake * selectedMarker.player.odds
    : 0;

  const handleSelectMarker = (marker: MockTrackedPlayer) => {
    setSelectedMarkerId((current) => {
      if (current === marker.id) {
        return null;
      }

      return marker.id;
    });
    setSelectedStake(10);
    setBetFeedback(null);
  };

  const handlePlaceMockBet = () => {
    if (!selectedMarker) return;

    setBetFeedback({
      playerName: selectedMarker.player.name,
      stake: selectedStake,
      payout: expectedPayout,
    });
  };

  const handleUpdateMarkerPosition = (
    markerId: string,
    position: { xPct: number; yPct: number },
  ) => {
    const nextFrame: MarkerKeyframe = {
      time: activeLoopTime,
      xPct: clampPct(position.xPct),
      yPct: clampPct(position.yPct),
    };

    setMarkerTracks((current) =>
      current.map((track) => {
        if (track.id !== markerId) return track;
        return {
          ...track,
          keyframes: upsertKeyframe(track.keyframes, nextFrame),
        };
      }),
    );
  };

  const handleResetTracks = () => {
    setMarkerTracks(defaultMarkerTracks);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures in the lab reset path.
    }
  };

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2147483646,
          background: "rgba(2,6,23,0.94)",
          border: "1px solid rgba(52,211,153,0.42)",
          borderRadius: 10,
          padding: "10px 12px",
          minWidth: 280,
          boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          color: "#e5e7eb",
          fontFamily: "system-ui,sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                color: "#34d399",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              goal.live clickable lab
            </div>
            <div style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>
              {statusLabel}
            </div>
            {effectiveMatch && (
              <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>
                {markers.length} moving demo markers
                {isReplayFallback ? " · fallback lineup" : ""}
                {showMarkers ? " · synced to replay time" : ""}
                {editTracks ? " · drag selected marker to save keyframe" : ""}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setEditTracks((value) => !value)}
              disabled={!bounds || !showMarkers}
              style={{
                background: editTracks ? "#f59e0b" : "rgba(15,23,42,0.95)",
                border: "1px solid rgba(148,163,184,0.28)",
                borderRadius: 8,
                color: editTracks ? "#111827" : bounds ? "#e5e7eb" : "#64748b",
                cursor: bounds && showMarkers ? "pointer" : "not-allowed",
                fontSize: 12,
                fontWeight: 800,
                padding: "8px 10px",
              }}
            >
              {editTracks ? "Editing" : "Edit Tracks"}
            </button>
            <button
              type="button"
              onClick={() => setShowMarkers((value) => !value)}
              disabled={!bounds || markers.length === 0}
              style={{
                background: showMarkers ? "#38bdf8" : "rgba(15,23,42,0.95)",
                border: "1px solid rgba(148,163,184,0.28)",
                borderRadius: 8,
                color: showMarkers ? "#03121a" : bounds ? "#e5e7eb" : "#64748b",
                cursor:
                  bounds && markers.length > 0 ? "pointer" : "not-allowed",
                fontSize: 12,
                fontWeight: 800,
                padding: "8px 10px",
              }}
            >
              {showMarkers ? "Hide Markers" : "Show Markers"}
            </button>
            <button
              type="button"
              onClick={() => setShowGrid((value) => !value)}
              disabled={!bounds}
              style={{
                background: showGrid ? "#34d399" : "rgba(15,23,42,0.95)",
                border: "1px solid rgba(148,163,184,0.28)",
                borderRadius: 8,
                color: showGrid ? "#03120d" : bounds ? "#e5e7eb" : "#64748b",
                cursor: bounds ? "pointer" : "not-allowed",
                fontSize: 12,
                fontWeight: 800,
                padding: "8px 10px",
              }}
            >
              {showGrid ? "Hide Grid" : "Show Grid"}
            </button>
          </div>
        </div>
      </div>

      {showMarkers && bounds && markers.length > 0 && (
        <MockPlayerMarkers
          bounds={bounds}
          markers={markers}
          selectedId={selectedMarkerId}
          editMode={editTracks}
          onSelect={handleSelectMarker}
          onUpdatePosition={handleUpdateMarkerPosition}
        />
      )}

      {showMarkers && editTracks && bounds && selectedMarker && (
        <div
          style={{
            position: "fixed",
            left: 12,
            top: 72,
            zIndex: 2147483646,
            background: "rgba(2,6,23,0.94)",
            border: "1px solid rgba(245,158,11,0.42)",
            borderRadius: 10,
            padding: "9px 10px",
            color: "#e5e7eb",
            fontFamily: "system-ui,sans-serif",
            boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
            maxWidth: 280,
          }}
        >
          <div
            style={{
              color: "#f59e0b",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Edit Mode
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>
            Drag #{selectedMarker.player.number} {selectedMarker.player.name}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 3 }}>
            Saving keyframe at t={activeLoopTime.toFixed(2)}s in the{" "}
            {TRACK_LOOP_SECONDS}s loop.
          </div>
          <button
            type="button"
            onClick={handleResetTracks}
            style={{
              marginTop: 8,
              background: "transparent",
              border: "1px solid rgba(148,163,184,0.28)",
              borderRadius: 8,
              color: "#e5e7eb",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
              padding: "6px 8px",
            }}
          >
            Reset Saved Tracks
          </button>
        </div>
      )}

      {showGrid && bounds && (
        <VideoOverlayDebugGrid
          bounds={bounds}
          onSelect={({ row, col, xPct, yPct }) => {
            setProbe({ row, col, xPct, yPct });
          }}
        />
      )}

      {showGrid && probe && (
        <div
          style={{
            position: "fixed",
            left: 12,
            bottom: 12,
            zIndex: 2147483646,
            background: "rgba(2,6,23,0.94)",
            border: "1px solid rgba(52,211,153,0.35)",
            borderRadius: 10,
            padding: "8px 10px",
            color: "#e5e7eb",
            fontFamily: "system-ui,sans-serif",
            boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              color: "#34d399",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Probe
          </div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>
            Cell {probe.row + 1}:{probe.col + 1}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 11 }}>
            x {(probe.xPct * 100).toFixed(1)}% · y{" "}
            {(probe.yPct * 100).toFixed(1)}%
          </div>
        </div>
      )}

      {selectedMarker && (
        <div
          style={{
            position: "fixed",
            right: 12,
            bottom: 12,
            zIndex: 2147483646,
            background: "rgba(2,6,23,0.94)",
            border: `1px solid ${selectedMarker.team === "home" ? "rgba(74,222,128,0.45)" : "rgba(96,165,250,0.45)"}`,
            borderRadius: 10,
            padding: "12px 12px 14px",
            color: "#e5e7eb",
            fontFamily: "system-ui,sans-serif",
            width: 280,
            boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                color: selectedMarker.team === "home" ? "#4ade80" : "#60a5fa",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Mock next goal bet
            </div>
            <button
              type="button"
              onClick={() => setSelectedMarkerId(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
                padding: 0,
              }}
            >
              x
            </button>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>
            #{selectedMarker.player.number} {selectedMarker.player.name}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
            {selectedMarker.team === "home"
              ? effectiveMatch?.homeTeam
              : effectiveMatch?.awayTeam}{" "}
            · {selectedMarker.player.position}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 8,
              marginTop: 12,
            }}
          >
            {DEMO_STAKES.map((stake) => {
              const isActive = selectedStake === stake;
              return (
                <button
                  key={stake}
                  type="button"
                  onClick={() => setSelectedStake(stake)}
                  style={{
                    background: isActive
                      ? "linear-gradient(135deg, #f59e0b 0%, #fde68a 100%)"
                      : "rgba(15,23,42,0.95)",
                    border: "1px solid rgba(148,163,184,0.28)",
                    borderRadius: 8,
                    color: isActive ? "#111827" : "#e5e7eb",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 800,
                    padding: "8px 0",
                  }}
                >
                  ${stake}
                </button>
              );
            })}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 12,
            }}
          >
            <div
              style={{
                background: "rgba(15,23,42,0.85)",
                border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: 9,
                padding: "8px 10px",
              }}
            >
              <div style={{ color: "#94a3b8", fontSize: 10 }}>Stake</div>
              <div style={{ color: "#f8fafc", fontSize: 15, fontWeight: 800 }}>
                ${selectedStake}
              </div>
            </div>
            <div
              style={{
                background: "rgba(15,23,42,0.85)",
                border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: 9,
                padding: "8px 10px",
              }}
            >
              <div style={{ color: "#94a3b8", fontSize: 10 }}>Potential</div>
              <div style={{ color: "#fde68a", fontSize: 15, fontWeight: 800 }}>
                ${expectedPayout.toFixed(2)}
              </div>
            </div>
          </div>
          <div
            style={{
              color: "#fde68a",
              fontSize: 12,
              fontWeight: 700,
              marginTop: 10,
            }}
          >
            {selectedMarker.player.odds.toFixed(2)}x odds
          </div>
          <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>
            Track {selectedMarker.trackLabel} · {selectedMarker.positionMode} ·
            t=
            {selectedMarker.renderTime.toFixed(1)}s
          </div>
          {editTracks && (
            <div style={{ color: "#f59e0b", fontSize: 11, marginTop: 6 }}>
              Edit mode active: drag this marker on the pitch to store a
              keyframe.
            </div>
          )}
          <button
            type="button"
            onClick={handlePlaceMockBet}
            disabled={editTracks}
            style={{
              marginTop: 12,
              width: "100%",
              background: editTracks
                ? "rgba(71,85,105,0.8)"
                : "linear-gradient(135deg, rgb(16,185,129) 0%, rgb(56,189,248) 100%)",
              border: "none",
              borderRadius: 10,
              color: editTracks ? "#cbd5e1" : "#03121a",
              cursor: editTracks ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 900,
              padding: "11px 12px",
            }}
          >
            {editTracks ? "Betting Disabled In Edit Mode" : "Place Mock Bet"}
          </button>
        </div>
      )}

      {betFeedback && (
        <div
          style={{
            position: "fixed",
            right: 12,
            bottom: selectedMarker ? 260 : 12,
            zIndex: 2147483646,
            background: "rgba(2,6,23,0.96)",
            border: "1px solid rgba(16,185,129,0.4)",
            borderRadius: 10,
            padding: "10px 12px",
            color: "#e5e7eb",
            fontFamily: "system-ui,sans-serif",
            width: 250,
            boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              color: "#34d399",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Demo placed
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, marginTop: 2 }}>
            ${betFeedback.stake} on {betFeedback.playerName}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 3 }}>
            Potential payout ${betFeedback.payout.toFixed(2)} · mock flow only
          </div>
        </div>
      )}
    </>
  );
};
