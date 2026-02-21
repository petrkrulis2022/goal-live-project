/**
 * Best-effort force-unmute of the page's HTML5 video element.
 * On DRM or iframe-embedded players this may silently fail — that's ok.
 */
export function tryUnmuteVideo(): boolean {
  try {
    const video = document.querySelector("video") as HTMLVideoElement | null;
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
