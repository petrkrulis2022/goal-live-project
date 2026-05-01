# PIERO-Style Real Player Tracking — Development Plan

## What PIERO Actually Does (Ross Video)

PIERO is a broadcast graphics and analysis tool used by Sky Sports, ESPN, etc.
Its player tracking works via two possible pipelines:

1. **Data-driven** — receives x,y (and optionally z) player coordinates from a
   tracking provider (Stats Perform Optical, Second Spectrum, ChyronHego TRACAB,
   Hawk-Eye) at 25 fps, then projects those real-world pitch coordinates onto
   the broadcast camera frame using a computed **homography matrix**.

2. **Vision-driven** — dedicated CV pipeline (object detection + ByteTrack /
   DeepSORT re-identification) running at 25+ fps on every frame. The tracker
   assigns persistent IDs across frames — it "follows" rather than "guesses".

The current Gemini approach in this repo does neither — it asks an LLM to guess
once every 10 seconds from a single JPEG with no temporal memory. It cannot
produce real tracking.

---

## The Goal-Live Approach (PIERO-equivalent)

### Option A — Stats Perform Live Tracking Feed (Preferred)

Stats Perform (already integrated via CRE) provides a **tracking data feed**
alongside event data. If the stadium has optical cameras (MA Cameras / TRACAB),
they produce:

```
Player positions: { playerId, x, y, speed, direction } at 25 Hz
Ball position:    { x, y, z } at 25 Hz
```

Coordinates are in the FIFA coordinate system:

- x: –52.5m → +52.5m (left to right, centre = 0)
- y: –34m → +34m (top to bottom, centre = 0)

**Pipeline:**

```
Stats Perform WebSocket feed
  → parse tracking frame (25 Hz)
  → pitch coords (x, y) metres
  → homography matrix (pitch → screen pixels)
  → overlay marker at (px, py) on video element
```

Stats Perform docs: https://developer.statsperform.com/tracking

---

### Option B — Browser-side CV (no data feed)

Run a real object-tracker entirely in the browser extension:

1. **Capture frames** at 10–25 fps from the `<video>` element
2. **Detect players** using a lightweight ONNX model (e.g. YOLOv8-nano) via
   `onnxruntime-web` — runs in a Web Worker so it doesn't block UI
3. **Track detections** across frames using a JS port of ByteTrack or SORT
   (Kalman filter + IoU assignment) — assigns persistent IDs per frame
4. **User pins** a specific detection to a known player once (click on the
   bounding box in the first frame), then the tracker keeps that ID
5. **Project marker** at the centre of the bounding box

This works offline with no API keys. Latency: ~50–100 ms per frame on a modern
laptop GPU via WebGL/WebGPU backend.

---

## Homography Matrix (Core of the PIERO Projection)

The homography `H` maps pitch metres to screen pixels. It needs to be computed
or estimated each time the camera angle changes (zoom, pan, cut).

### How to compute H

You need at least 4 corresponding point pairs:

- Known pitch landmarks (centre circle, penalty spots, corner flags) — fixed
  real-world coordinates in metres
- Their pixel positions in the current camera frame — detected via CV or clicked
  manually

```typescript
// Using opencv.js or a pure-JS implementation
const srcPoints = [
  { x: 0, y: 0 }, // centre spot      (metres)
  { x: -52.5, y: -34 }, // top-left corner
  { x: 52.5, y: -34 }, // top-right corner
  { x: 0, y: -34 }, // top midfield line
];
const dstPoints = [
  { x: 640, y: 360 }, // centre spot      (pixels in frame)
  { x: 42, y: 58 },
  { x: 1238, y: 58 },
  { x: 640, y: 58 },
];

const H = computeHomography(srcPoints, dstPoints);

function pitchToScreen(
  pitchX: number,
  pitchY: number,
): { px: number; py: number } {
  // Apply 3×3 homography matrix
  const [a, b, c, d, e, f, g, h, i] = H;
  const w = g * pitchX + h * pitchY + i;
  return {
    px: (a * pitchX + b * pitchY + c) / w,
    py: (d * pitchX + e * pitchY + f) / w,
  };
}
```

### Auto-updating H on camera cuts

Detect camera cuts via frame-to-frame pixel difference threshold. On a cut,
re-run pitch landmark detection (CV on field lines) and recompute H before
rendering the next frame.

---

## Implementation Phases

### Phase 1 — Homography foundation

- [ ] Implement `computeHomography(src[], dst[])` (pure TS, no OpenCV dependency)
- [ ] UI to click 4+ pitch landmarks on the video frame and assign their known
      pitch coordinates — stores the computed H matrix
- [ ] `pitchToScreen(x, y, H)` helper used by the overlay renderer
- [ ] Persist H per match (localStorage) — reuse across page reloads until a
      camera cut is detected

### Phase 2 — Stats Perform tracking feed

- [ ] Connect to Stats Perform tracking WebSocket endpoint (requires entitlement)
- [ ] Parse `TrackingFrame` messages at 25 Hz
- [ ] Map `trackingId` → `playerId` via the lineup/roster feed (already in CRE)
- [ ] Feed positions through `pitchToScreen()` → update overlay markers in
      `requestAnimationFrame` loop at 25 fps
- [ ] Graceful fallback to keyframe-interpolation demo when feed unavailable

### Phase 3 — Browser CV tracker (Option B fallback)

- [ ] Integrate YOLOv8-nano ONNX model via `onnxruntime-web` in a Web Worker
- [ ] Implement SORT tracker (Kalman + IoU) in TypeScript
- [ ] User-click to assign a tracking ID to a known player (e.g. "this bbox = Salah")
- [ ] Render markers from bounding box centres
- [ ] Camera-cut detection → reset tracker, re-detect

### Phase 4 — Auto homography calibration

- [ ] Train / use a pre-trained pitch line segmentation model (e.g. SoccerNet
      calibration model) to auto-detect field markings and compute H without
      manual clicks
- [ ] Update H continuously as camera pans/zooms

---

## Key Libraries / References

| Library                      | Purpose                                           |
| ---------------------------- | ------------------------------------------------- |
| `onnxruntime-web`            | Run ONNX models in browser (WebGL/WebGPU backend) |
| YOLOv8-nano                  | Lightweight player detection (~6 MB)              |
| `opencv.js` (WASM)           | Homography computation, feature matching          |
| SoccerNet Camera Calibration | Auto pitch line → H matrix                        |
| ByteTrack / SORT             | Multi-object tracking across frames               |
| Stats Perform Tracking API   | 25 Hz real coordinate feed                        |

---

## Current State vs. Goal

|                     | Current (Gemini) | Target (PIERO-style)                     |
| ------------------- | ---------------- | ---------------------------------------- |
| Update rate         | 1 per 10 s       | 25 fps                                   |
| Position source     | LLM guess        | Real coords / CV bbox                    |
| Temporal continuity | None             | Kalman-filtered, persistent IDs          |
| Accuracy            | Unreliable       | Sub-metre (data feed) / ~30px (CV)       |
| Camera changes      | Breaks           | Re-calibrates H automatically            |
| Cost                | Free tier Gemini | Stats Perform entitlement or local model |

---

## Notes

- The Stats Perform CRE integration in `src/services/real/dataService.ts` already
  handles event data. The tracking feed is a separate entitlement from Stats Perform —
  contact them for the WebSocket endpoint and auth token.
- The PIERO PDF in the repo root (`PIERO Tech Guide 3400DR-002-10.pdf`) contains
  the full PIERO API specification including how it consumes tracking data.
- For demo/hackathon purposes, Option B (browser CV) is the fastest path to
  plausible real-looking tracking without a data feed contract.
