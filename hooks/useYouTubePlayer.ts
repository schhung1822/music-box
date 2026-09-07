"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaybackState } from "../types/studio";

type YouTubePlayer = {
  playVideo(): void; pauseVideo(): void; seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number; getDuration(): number; getPlayerState(): number;
  setVolume(value: number): void; mute(): void; unMute(): void; destroy(): void; getIframe(): HTMLIFrameElement;
};
type PlayerEvent = { target: YouTubePlayer; data?: number };
type YouTubeAPI = { Player: new (element: HTMLElement, options: {
  videoId: string; width: string; height: string; host: string;
  playerVars: Record<string, string | number>;
  events: { onReady: (event: PlayerEvent) => void; onStateChange: (event: PlayerEvent) => void; onError: (event: PlayerEvent) => void };
}) => YouTubePlayer };
declare global {
  interface Window { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<YouTubeAPI> | null = null;
function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YouTubeAPI>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => fail(), 15000);
    function fail() {
      window.clearTimeout(timeout);
      script.remove();
      window.onYouTubeIframeAPIReady = previous;
      apiPromise = null;
      reject(new Error("Không kết nối được YouTube. Kiểm tra mạng rồi thử lại."));
    }
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else fail();
    };
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  });
  return apiPromise;
}

export function useYouTubePlayer(videoId: string | null, enabled: boolean, volume: number, muted: boolean, revision = 0) {
  const containerRef = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const [state, setState] = useState<PlaybackState & { id: string | null }>({ currentTime: 0, duration: 0, seekableEnd: 0, isPlaying: false, ready: false, id: null });
  const [error, setError] = useState("");

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !videoId || !container) return;
    let disposed = false;
    let instance: YouTubePlayer | null = null;
    let interval = 0;
    let ready = false;
    const timeout = window.setTimeout(() => {
      if (!disposed && !ready) setError("YouTube chưa sẵn sàng. Hãy kiểm tra mạng hoặc thử một video khác.");
    }, 20000);
    const update = () => {
      if (disposed || !instance || !ready) return;
      const duration = instance.getDuration() || 0;
      setState({ id: videoId, ready: true, currentTime: instance.getCurrentTime() || 0, duration, seekableEnd: duration, isPlaying: instance.getPlayerState() === 1 });
    };
    void loadYouTubeAPI().then(api => {
      if (disposed) return;
      setError("");
      setState({ id: videoId, ready: false, currentTime: 0, duration: 0, seekableEnd: 0, isPlaying: false });
      const mount = document.createElement("div");
      container.replaceChildren(mount);
      instance = new api.Player(mount, {
        videoId, width: "100%", height: "100%", host: "https://www.youtube-nocookie.com",
        playerVars: { origin: window.location.origin, playsinline: 1, controls: 0, rel: 0, hl: "vi" },
        events: {
          onReady: event => {
            if (disposed) return;
            player.current = event.target;
            ready = true;
            window.clearTimeout(timeout);
            event.target.getIframe().title = "Trình phát video YouTube";
            update();
            interval = window.setInterval(update, 160);
          },
          onStateChange: update,
          onError: event => {
            if (disposed) return;
            ready = false;
            window.clearTimeout(timeout);
            setState({ id: videoId, ready: false, currentTime: 0, duration: 0, seekableEnd: 0, isPlaying: false });
            setError(event.data === 100 ? "Video không tồn tại hoặc đã được đặt riêng tư." : "YouTube không cho phát video này ở đây. Hãy thử liên kết khác.");
          },
        },
      });
    }).catch(cause => { if (!disposed) setError(cause instanceof Error ? cause.message : "Không tải được YouTube."); });
    return () => {
      disposed = true;
      clearInterval(interval);
      clearTimeout(timeout);
      player.current = null;
      instance?.destroy();
      container.replaceChildren();
    };
  }, [videoId, enabled, revision]);

  useEffect(() => {
    if (!enabled || !state.ready) return;
    player.current?.setVolume(volume * 100);
    if (muted) player.current?.mute(); else player.current?.unMute();
  }, [enabled, volume, muted, state.ready, state.id]);

  const play = useCallback(async () => { if (!player.current) return false; player.current.playVideo(); return true; }, []);
  const pause = useCallback(() => player.current?.pauseVideo(), []);
  const seek = useCallback((time: number) => {
    const instance = player.current;
    if (instance && Number.isFinite(time)) instance.seekTo(Math.max(0, Math.min(time, instance.getDuration())), true);
  }, []);
  const valid = enabled && state.id === videoId;
  return {
    currentTime: valid ? state.currentTime : 0, duration: valid ? state.duration : 0, seekableEnd: valid ? state.seekableEnd : 0,
    isPlaying: valid && state.isPlaying, ready: valid && state.ready,
    error: enabled ? error : "", clearError: () => setError(""),
    containerRef, play, pause, seek, getCurrentTime: () => player.current?.getCurrentTime() ?? 0,
  };
}
