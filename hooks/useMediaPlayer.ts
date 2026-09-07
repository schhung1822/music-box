"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaybackState } from "../types/studio";

const emptyPlayback: PlaybackState = { currentTime: 0, duration: 0, seekableEnd: 0, isPlaying: false, ready: false };

// Nhiều tệp không ghi độ dài trong phần đầu (WebM do trình duyệt ghi, MP4 phân mảnh, MP3 biến tốc)
// nên `duration` là Infinity. Khi đó vẫn phát và tua được, chỉ là chưa biết tổng thời lượng.
function knownDuration(element: HTMLMediaElement) {
  return Number.isFinite(element.duration) && element.duration > 0 ? element.duration : 0;
}
function seekableEnd(element: HTMLMediaElement) {
  // "seekable" của tệp không khai báo độ dài thường là [0, Infinity), nên lấy thêm phần đã tải về
  // để thanh tua vẫn dùng được trong khoảng đã có.
  for (const ranges of [element.seekable, element.buffered]) {
    if (!ranges?.length) continue;
    const end = ranges.end(ranges.length - 1);
    if (Number.isFinite(end) && end > 0) return end;
  }
  return 0;
}

export function useMediaPlayer(audioUrl: string | undefined, videoUrl: string | undefined, enabled: boolean, volume: number, muted: boolean) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState(emptyPlayback);
  const [error, setError] = useState("");
  const playRequest = useRef({ value: 0 });

  const getElement = useCallback((): HTMLMediaElement | null => {
    if (!enabled) return null;
    return audioUrl ? audioRef.current : videoUrl ? videoRef.current : null;
  }, [audioUrl, videoUrl, enabled]);

  const pause = useCallback(() => {
    playRequest.current.value++;
    audioRef.current?.pause();
    videoRef.current?.pause();
  }, []);

  const syncVideo = useCallback((force = false) => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (!audioUrl || !videoUrl || !audio || !video || !video.duration || !Number.isFinite(video.duration)) return;
    const target = audio.currentTime % video.duration;
    if (force || Math.abs(video.currentTime - target) > 0.3) video.currentTime = target;
  }, [audioUrl, videoUrl]);

  const seek = useCallback((time: number) => {
    const element = getElement();
    if (!element || !Number.isFinite(time)) return;
    const limit = knownDuration(element) || seekableEnd(element);
    try { element.currentTime = Math.max(0, limit ? Math.min(time, limit) : time); }
    catch { return; }
    syncVideo(true);
    setState(previous => ({ ...previous, currentTime: element.currentTime }));
  }, [getElement, syncVideo]);

  const play = useCallback(async () => {
    const element = getElement();
    if (!element) { setError("Hãy chọn video hoặc âm thanh trong phần thiết lập."); return false; }
    const request = ++playRequest.current.value;
    if (element.ended) seek(0);
    try {
      setError("");
      const promise = element.play();
      if (audioUrl && videoUrl && videoRef.current) {
        syncVideo(true);
        void videoRef.current.play().catch(() => {
          if (request === playRequest.current.value) setError("Âm thanh đang phát nhưng video nền chưa phát được. Bạn có thể chọn video khác.");
        });
      }
      await promise;
      if (request !== playRequest.current.value) return false;
      return true;
    } catch (cause) {
      if (request !== playRequest.current.value || (cause instanceof DOMException && cause.name === "AbortError")) return false;
      videoRef.current?.pause();
      setError("Không phát được tệp này. Trình duyệt có thể chưa giải mã được định dạng; hãy thử MP4, WebM, MP3 hoặc WAV.");
      return false;
    }
  }, [getElement, seek, audioUrl, videoUrl, syncVideo]);

  useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (audio) { audio.volume = volume; audio.muted = muted; }
    if (video) { video.volume = volume; video.muted = Boolean(audioUrl) || muted; video.loop = Boolean(audioUrl); }
  }, [volume, muted, audioUrl]);

  useEffect(() => {
    const element = getElement();
    let frame = 0;
    let lastUpdate = 0;
    const update = () => {
      setState(element ? {
        currentTime: element.currentTime || 0,
        duration: knownDuration(element),
        seekableEnd: Math.max(knownDuration(element), seekableEnd(element)),
        isPlaying: !element.paused && !element.ended,
        // Đủ siêu dữ liệu là phát được, kể cả khi tệp không khai báo tổng thời lượng.
        ready: element.readyState >= 1,
      } : emptyPlayback);
    };
    const tick = (now: number) => {
      if (now - lastUpdate >= 80) { update(); syncVideo(); lastUpdate = now; }
      if (element && !element.paused && !element.ended) frame = requestAnimationFrame(tick);
    };
    const onPlay = () => { cancelAnimationFrame(frame); update(); frame = requestAnimationFrame(tick); };
    const onPause = () => { cancelAnimationFrame(frame); update(); if (audioUrl) videoRef.current?.pause(); };
    const onError = () => { onPause(); setError("Trình duyệt không đọc được tệp media này. Vui lòng chọn tệp khác."); };
    const events: [string, EventListener][] = [
      ["loadedmetadata", update], ["durationchange", update], ["progress", update], ["emptied", update], ["timeupdate", update],
      ["play", onPlay], ["pause", onPause], ["ended", onPause], ["error", onError],
    ];
    events.forEach(([name, handler]) => element?.addEventListener(name, handler));
    const initial = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(initial);
      events.forEach(([name, handler]) => element?.removeEventListener(name, handler));
    };
  }, [getElement, audioUrl, syncVideo]);

  useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    const token = playRequest.current;
    return () => { token.value++; audio?.pause(); video?.pause(); };
  }, []);

  return {
    ...state, error, clearError: () => setError(""),
    audioRef, videoRef, play, pause, seek, getElement,
    getCurrentTime: () => getElement()?.currentTime ?? 0,
  };
}
