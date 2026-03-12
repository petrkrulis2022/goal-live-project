import { useEffect, useRef, useState } from "react";
import { getPrimaryVideoElement } from "../utils/videoUtils";

export interface VideoOverlayBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

function rectEquals(
  a: VideoOverlayBounds | null,
  b: VideoOverlayBounds | null,
): boolean {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.left - b.left) < 1 &&
    Math.abs(a.top - b.top) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
}

function rectFromVideo(
  video: HTMLVideoElement | null,
): VideoOverlayBounds | null {
  if (!video) return null;
  const rect = video.getBoundingClientRect();
  if (rect.width < 80 || rect.height < 80) return null;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function useVideoOverlayBounds(
  enabled = true,
): VideoOverlayBounds | null {
  const [bounds, setBounds] = useState<VideoOverlayBounds | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!enabled) {
      setBounds(null);
      return;
    }

    const sync = () => {
      const nextVideo = getPrimaryVideoElement();
      if (videoRef.current !== nextVideo) {
        observerRef.current?.disconnect();
        videoRef.current = nextVideo;
        if (nextVideo && typeof ResizeObserver !== "undefined") {
          observerRef.current = new ResizeObserver(() => {
            setBounds((prev) => {
              const next = rectFromVideo(nextVideo);
              return rectEquals(prev, next) ? prev : next;
            });
          });
          observerRef.current.observe(nextVideo);
        }
      }

      const nextBounds = rectFromVideo(nextVideo);
      setBounds((prev) => (rectEquals(prev, nextBounds) ? prev : nextBounds));
    };

    sync();
    const interval = window.setInterval(sync, 250);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    document.addEventListener("fullscreenchange", sync);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
      document.removeEventListener("fullscreenchange", sync);
      observerRef.current?.disconnect();
      observerRef.current = null;
      videoRef.current = null;
    };
  }, [enabled]);

  return bounds;
}
