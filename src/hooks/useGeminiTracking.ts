import { useCallback, useEffect, useRef, useState } from "react";
import type { MockTrackedPlayer } from "../components/MockPlayerMarkers";
import {
  captureVideoFrame,
  detectTargetedPlayers,
  type TargetPlayerSpec,
} from "../services/geminiPlayerTracking";

export type GeminiTrackingStatus =
  | "idle"
  | "detecting"
  | "ok"
  | "error"
  | "no-video";

interface UseGeminiTrackingOptions {
  enabled: boolean;
  apiKey: string;
  /** Base interval between detections in ms. Default 10 000 ms (~6 RPM, safely under free-tier 15 RPM limit). */
  intervalMs?: number;
}

export interface GeminiTrackingResult {
  /** Override positions keyed by marker id. Empty when AI tracking is off. */
  overrides: Map<string, { xPct: number; yPct: number }>;
  status: GeminiTrackingStatus;
  /** How many of the targeted players Gemini found in the last frame. */
  lastCount: number;
  /** Error message if status === "error" */
  lastError: string | null;
}

/**
 * Runs periodic targeted Gemini frame analysis for a specific subset of markers
 * (those the user has opted in to AI tracking). Uses `detectTargetedPlayers`
 * which builds an explicit per-player prompt — far more reliable than generic detection.
 */
export function useGeminiTracking(
  /** Only the markers the user wants AI-tracked (filtered to aiTargetIds in the parent). */
  targetMarkers: MockTrackedPlayer[],
  options: UseGeminiTrackingOptions,
): GeminiTrackingResult {
  const [overrides, setOverrides] = useState<
    Map<string, { xPct: number; yPct: number }>
  >(new Map());
  const [status, setStatus] = useState<GeminiTrackingStatus>("idle");
  const [lastCount, setLastCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  // Stable refs so setTimeout callbacks always see current values.
  const markersRef = useRef(targetMarkers);
  markersRef.current = targetMarkers;
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const enabledRef = useRef(options.enabled);
  enabledRef.current = options.enabled;
  const apiKeyRef = useRef(options.apiKey);
  apiKeyRef.current = options.apiKey;
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const backoffMsRef = useRef(0);

  const baseMs = options.intervalMs ?? 10_000;

  const scheduleNext = useCallback(
    (delayMs: number) => {
      timerRef.current = window.setTimeout(() => {
        if (!enabledRef.current) return;
        void runCycle();
      }, delayMs);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function runCycle() {
    const markers = markersRef.current;
    if (markers.length === 0) {
      scheduleNext(baseMs);
      return Promise.resolve();
    }

    const frame = captureVideoFrame();
    if (!frame) {
      setStatus("no-video");
      scheduleNext(baseMs + backoffMsRef.current);
      return Promise.resolve();
    }

    setStatus("detecting");
    setLastError(null);

    // Build TargetPlayerSpec from markers, using any existing overrides for last-known positions.
    const targets: TargetPlayerSpec[] = markers.map((m) => {
      const prev = overridesRef.current.get(m.id);
      return {
        markerId: m.id,
        jersey: m.player.number ?? null,
        team: m.team as "home" | "away",
        name: m.player.name,
        lastX: prev?.xPct ?? m.xPct,
        lastY: prev?.yPct ?? m.yPct,
      };
    });

    return detectTargetedPlayers(frame, apiKeyRef.current, targets)
      .then((detected) => {
        backoffMsRef.current = 0;
        setLastCount(detected.size);
        setOverrides((prev) => {
          const next = new Map(prev);
          for (const [id, pos] of detected) {
            next.set(id, pos);
          }
          return next;
        });
        setStatus("ok");
        scheduleNext(baseMs);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        const is429 = msg.includes("429");
        if (is429) {
          backoffMsRef.current = Math.min(
            backoffMsRef.current > 0 ? backoffMsRef.current * 2 : baseMs,
            60_000,
          );
        } else {
          backoffMsRef.current = 0;
        }
        setLastError(msg);
        setStatus("error");
        scheduleNext(baseMs + backoffMsRef.current);
      });
  }

  useEffect(() => {
    if (!options.enabled) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      backoffMsRef.current = 0;
      setOverrides(new Map());
      setStatus("idle");
      setLastCount(0);
      setLastError(null);
      return;
    }

    backoffMsRef.current = 0;
    void runCycle();

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.enabled]);

  return { overrides, status, lastCount, lastError };
}
