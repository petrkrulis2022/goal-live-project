/**
 * Best-effort force-unmute of the page's HTML5 video element.
 * On DRM or iframe-embedded players this may silently fail — that's ok.
 */
export function getPrimaryVideoElement(): HTMLVideoElement | null {
  try {
    const videos = Array.from(document.querySelectorAll("video"));
    if (videos.length === 0) return null;

    const candidates = videos
      .map((video) => ({
        video,
        rect: video.getBoundingClientRect(),
      }))
      .filter(({ rect }) => rect.width > 80 && rect.height > 80)
      .sort(
        (a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height,
      );

    return candidates[0]?.video ?? null;
  } catch {
    return null;
  }
}

export function tryUnmuteVideo(): boolean {
  try {
    const video = getPrimaryVideoElement();
    if (!video) return false;
    if (video.muted) {
      video.muted = false;
      console.info("[goal.live] Video unmuted");
    }
    if (video.volume < 0.3) {
      video.volume = 0.7;
    }
    return true;
  } catch {
    console.warn(
      "[goal.live] Could not control video element (may be in cross-origin iframe)",
    );
    return false;
  }
}
