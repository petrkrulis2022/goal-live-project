import { useEffect, useState } from "react";
import { getPrimaryVideoElement } from "../utils/videoUtils";

export interface VideoPlaybackState {
  currentTime: number;
  duration: number | null;
  paused: boolean;
  hasVideo: boolean;
}

function statesEqual(a: VideoPlaybackState, b: VideoPlaybackState): boolean {
  return (
    Math.abs(a.currentTime - b.currentTime) < 0.05 &&
    a.duration === b.duration &&
    a.paused === b.paused &&
    a.hasVideo === b.hasVideo
  );
}

export function useVideoCurrentTime(enabled = true): VideoPlaybackState {
  const [state, setState] = useState<VideoPlaybackState>({
    currentTime: 0,
    duration: null,
    paused: true,
    hasVideo: false,
  });

  useEffect(() => {
    if (!enabled) {
      setState({
        currentTime: 0,
        duration: null,
        paused: true,
        hasVideo: false,
      });
      return;
    }

    const sync = () => {
      const video = getPrimaryVideoElement();
      const nextState: VideoPlaybackState = {
        currentTime: video?.currentTime ?? 0,
        duration:
          video && Number.isFinite(video.duration) ? video.duration : null,
        paused: video?.paused ?? true,
        hasVideo: !!video,
      };

      setState((prev) => (statesEqual(prev, nextState) ? prev : nextState));
    };

    sync();
    const interval = window.setInterval(sync, 120);

    return () => {
      window.clearInterval(interval);
    };
  }, [enabled]);

  return state;
}
