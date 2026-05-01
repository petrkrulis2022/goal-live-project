/**
 * Phase 2 – Gemini 2.0 Flash multimodal player detection.
 * Captures a frame from the video element, sends it to Gemini, and returns
 * detected player positions as normalised (0-1) percentages.
 *
 * NOTE: The API key is stored here for local-dev convenience only.
 *       Do not publish this extension to the Chrome Web Store with a live key.
 */

export interface GeminiDetectedPlayer {
  /** 0–100, percentage from left edge of frame */
  x: number;
  /** 0–100, percentage from top edge of frame */
  y: number;
  team: "home" | "away" | "unknown";
  /** Jersey number if Gemini can read it, otherwise null */
  jersey: number | null;
}

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/** Description of one specific player to locate in a targeted detection call. */
export interface TargetPlayerSpec {
  /** Marker id — returned as-is in the result for direct lookup */
  markerId: string;
  jersey: number | null;
  team: "home" | "away";
  name: string;
  /** Last known position (0–1 normalised) so Gemini knows where to look */
  lastX: number;
  lastY: number;
}

/** Capture the largest currently-playing <video> element as a base64 JPEG string. */
export function captureVideoFrame(): string | null {
  const videos = Array.from(
    document.querySelectorAll<HTMLVideoElement>("video"),
  );
  // Prefer a playing, large video (avoids ads / small thumbnails)
  const video =
    videos.find(
      (v) =>
        !v.paused &&
        v.readyState >= 2 &&
        v.videoWidth > 320 &&
        v.videoHeight > 180,
    ) ?? videos.find((v) => v.videoWidth > 0);

  if (!video) return null;

  try {
    const maxW = 640; // keep requests small for speed
    const scale = Math.min(1, maxW / video.videoWidth);
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    // Strip the "data:image/jpeg;base64," prefix
    return dataUrl.split(",")[1] ?? null;
  } catch {
    return null;
  }
}

/** Send a captured frame to Gemini and parse the player list response. */
export async function detectPlayersWithGemini(
  frameBase64: string,
  apiKey: string,
): Promise<GeminiDetectedPlayer[]> {
  const prompt = `This is a live football (soccer) match broadcast frame.
Find every player visible on the pitch (ignore crowd, substitutes bench, and TV graphics).
For each player return their position as percentage coordinates where x=0 is the left edge and x=100 is the right edge of the frame, y=0 is the top and y=100 is the bottom.
Try to read jersey numbers if they are visible.
Classify each player's team as "home" (first/lighter kit) or "away" (second/darker kit). Use "unknown" only if you genuinely cannot tell.
Return ONLY a valid JSON array – no markdown, no explanation – like this example:
[{"x":45.2,"y":60.1,"team":"home","jersey":9},{"x":72.3,"y":45.8,"team":"away","jersey":null}]`;

  const text = await callGeminiRaw(frameBase64, apiKey, prompt, 1024);
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as unknown[];
    return parsed.filter(
      (p): p is GeminiDetectedPlayer =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as Record<string, unknown>).x === "number" &&
        typeof (p as Record<string, unknown>).y === "number",
    );
  } catch {
    return [];
  }
}

/**
 * Targeted detection: given a small list of specific players (with last known
 * position + jersey), asks Gemini to locate only those players.
 * Returns a map of markerId → new normalised (0–1) position.
 */
export async function detectTargetedPlayers(
  frameBase64: string,
  apiKey: string,
  targets: TargetPlayerSpec[],
): Promise<Map<string, { xPct: number; yPct: number }>> {
  const result = new Map<string, { xPct: number; yPct: number }>();
  if (targets.length === 0) return result;

  const targetList = targets
    .map((t, i) => {
      const jersey =
        t.jersey !== null ? `jersey #${t.jersey}` : "unknown jersey number";
      const side =
        t.team === "home"
          ? "home team (lighter coloured kit)"
          : "away team (darker coloured kit)";
      const ax = Math.round(t.lastX * 100);
      const ay = Math.round(t.lastY * 100);
      return `${i + 1}. ${t.name} — ${jersey}, ${side}, last seen near x=${ax}% y=${ay}%`;
    })
    .join("\n");

  const prompt = `This is a live football (soccer) match broadcast frame.
Locate these specific players and return their CURRENT position in the frame:
${targetList}

Rules:
- x=0 is the left edge, x=100 is the right edge; y=0 is the top, y=100 is the bottom.
- Return one object per player in the SAME ORDER as listed above.
- Each object: "index" (1-based integer), "x" (number 0-100), "y" (number 0-100), "found" (true if confident, false if guessing).
- Return ONLY a valid JSON array, no markdown, no text outside the array.
Example: [{"index":1,"x":45.2,"y":60.1,"found":true},{"index":2,"x":72.3,"y":45.8,"found":false}]`;

  const text = await callGeminiRaw(frameBase64, apiKey, prompt, 512);
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return result;

  try {
    const parsed = JSON.parse(match[0]) as Array<{
      index: number;
      x: number;
      y: number;
      found: boolean;
    }>;
    for (const item of parsed) {
      if (
        typeof item.index !== "number" ||
        typeof item.x !== "number" ||
        typeof item.y !== "number"
      )
        continue;
      const target = targets[item.index - 1];
      if (!target) continue;
      // Accept both confident and best-guess results — caller can decide
      result.set(target.markerId, {
        xPct: Math.max(0.02, Math.min(0.98, item.x / 100)),
        yPct: Math.max(0.02, Math.min(0.98, item.y / 100)),
      });
    }
  } catch {
    // ignore parse errors — return empty map
  }

  return result;
}

/** POST a frame + prompt to Gemini, return raw response text. */
async function callGeminiRaw(
  frameBase64: string,
  apiKey: string,
  prompt: string,
  maxOutputTokens: number,
): Promise<string> {
  const response = await fetch(`${GEMINI_API_BASE}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: "image/jpeg", data: frameBase64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Gemini ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text as string) ?? "";
}
