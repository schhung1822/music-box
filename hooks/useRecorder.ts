"use client";

import { useEffect, useRef, useState } from "react";
import { renderScene, type Scene } from "../utils/renderScene";
import { createFramePacer, getRecordingQuality } from "../utils/recordingQuality";

type StartOptions = Omit<Scene, "currentTime" | "duration" | "reducedMotion"> & {
  element: HTMLMediaElement;
  play: () => Promise<boolean>;
  pause: () => void;
  onComplete?: () => void;
};
type AudioBridge = {
  context: AudioContext;
  destination: MediaStreamAudioDestinationNode;
  nodes: Map<HTMLMediaElement, MediaElementAudioSourceNode>;
  connected: MediaElementAudioSourceNode | null;
};
type RecordingResult = { url: string; filename: string; size: number; width: number; height: number; frameRate: number };

function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Không khởi động được media trong thời gian chờ. Hãy thử lại.")), milliseconds);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

async function waitForVideo(video: HTMLVideoElement) {
  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) return;
  if (video.error) throw new Error("Không đọc được video để ghi. Hãy thử một tệp khác.");
  let dispose = () => {};
  const ready = new Promise<void>((resolve, reject) => {
    const check = () => { if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) resolve(); };
    const fail = () => reject(new Error("Không đọc được video để ghi. Hãy thử một tệp khác."));
    video.addEventListener("loadeddata", check);
    video.addEventListener("canplay", check);
    video.addEventListener("error", fail);
    dispose = () => {
      video.removeEventListener("loadeddata", check);
      video.removeEventListener("canplay", check);
      video.removeEventListener("error", fail);
    };
    check();
  });
  try { await withTimeout(ready, 10000); }
  finally { dispose(); }
}

export function useRecorder() {
  const [status, setStatus] = useState<"idle" | "preparing" | "recording" | "stopping">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [error, setError] = useState("");
  const bridge = useRef<AudioBridge | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef(0);
  const resultUrl = useRef<string | null>(null);
  const generation = useRef({ value: 0 });
  const busy = useRef(false);
  const disposeSession = useRef<(() => void) | null>(null);
  const mounted = useRef(true);

  function cleanupStream() {
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (bridge.current?.connected) {
      bridge.current.connected.disconnect(bridge.current.destination);
      bridge.current.connected = null;
    }
    disposeSession.current?.();
    disposeSession.current = null;
  }

  async function resumeAudio() {
    if (bridge.current?.context.state === "suspended") await bridge.current.context.resume();
  }

  function stop() {
    generation.current.value++;
    if (recorder.current && recorder.current.state !== "inactive") {
      setStatus("stopping");
      recorder.current.stop();
    } else if (busy.current) {
      setStatus("stopping");
    }
  }

  async function start(options: StartOptions) {
    if (busy.current) return;
    if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function" || typeof AudioContext === "undefined") {
      setError("Trình duyệt chưa hỗ trợ ghi Canvas kèm âm thanh. Hãy mở bằng Chrome hoặc Edge trên máy tính.");
      return;
    }
    const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) { setError("Trình duyệt chưa hỗ trợ xuất WebM. Hãy thử Chrome hoặc Edge."); return; }
    // Đủ siêu dữ liệu là ghi được. Tệp không khai báo tổng thời lượng vẫn dừng đúng hẹn
    // nhờ mốc thời gian phát và đồng hồ dự phòng bên dưới.
    if (options.element.readyState < 1) {
      setError("Hãy đợi tệp tải xong trước khi ghi."); return;
    }

    busy.current = true;
    const request = ++generation.current.value;
    setError(""); setElapsed(0); setStatus("preparing");
    try {
      if (!bridge.current) {
        const context = new AudioContext();
        bridge.current = { context, destination: context.createMediaStreamDestination(), nodes: new Map(), connected: null };
      }
      const audio = bridge.current;
      await withTimeout(audio.context.resume(), 10000);
      if (generation.current.value !== request) throw new DOMException("Đã hủy", "AbortError");
      let node = audio.nodes.get(options.element);
      if (!node) {
        node = audio.context.createMediaElementSource(options.element);
        node.connect(audio.context.destination);
        audio.nodes.set(options.element, node);
      }
      if (audio.connected) audio.connected.disconnect(audio.destination);
      node.connect(audio.destination);
      audio.connected = node;
      // With a separate audio track, its metadata can arrive before the background video's.
      // Wait for actual video dimensions and its first frame before choosing export resolution.
      if (options.settings.visualMode === "video" && options.video) await waitForVideo(options.video);
      if (generation.current.value !== request) throw new DOMException("Đã hủy", "AbortError");
      const canvas = document.createElement("canvas");
      const { width, height, frameRate, videoBitsPerSecond, audioBitsPerSecond } = getRecordingQuality(options.settings, options.video);
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("Không tạo được khung vẽ. Hãy thử lại.");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // Vẽ bằng đúng phông của giao diện, và đợi phông tải xong để khung đầu tiên không bị lệch chữ.
      const fontFamily = typeof getComputedStyle === "function" && document.body ? getComputedStyle(document.body).fontFamily : undefined;
      await document.fonts?.ready;
      if (generation.current.value !== request) throw new DOMException("Đã hủy", "AbortError");
      const draw = (animationTime = performance.now()) => renderScene(ctx, { ...options, fontFamily, animationTime, currentTime: options.element.currentTime, duration: Number.isFinite(options.element.duration) ? options.element.duration : 0, reducedMotion });
      draw();
      const videoStream = canvas.captureStream(frameRate);
      stream.current = new MediaStream([...videoStream.getVideoTracks(), ...audio.destination.stream.getAudioTracks().map(track => track.clone())]);
      const mediaRecorder = new MediaRecorder(stream.current, { mimeType, videoBitsPerSecond, audioBitsPerSecond });
      recorder.current = mediaRecorder;
      const chunks: Blob[] = [];
      let failed = false;
      mediaRecorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      mediaRecorder.onerror = () => { failed = true; setError("Bản ghi bị gián đoạn. Hãy thử ghi một đoạn ngắn hơn."); stop(); };
      mediaRecorder.onstop = () => {
        cleanupStream();
        options.pause();
        recorder.current = null;
        busy.current = false;
        if (!mounted.current) return;
        if (!failed && chunks.length) {
          if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || mimeType });
          const url = URL.createObjectURL(blob);
          resultUrl.current = url;
          setResult({ url, filename: `khoang-lang-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.webm`, size: blob.size, width, height, frameRate });
        } else if (!failed) setError("Bản ghi chưa có dữ liệu. Hãy thử lại sau khi phát tệp.");
        setStatus("idle");
        options.onComplete?.();
      };
      const onEnded = () => stop();
      const onMediaError = () => { failed = true; setError("Tệp phát bị lỗi trong lúc ghi. Hãy thử một tệp khác."); stop(); };
      const onHidden = () => {
        if (document.hidden) { setError("Đã dừng ghi khi rời tab để tránh mất khung hình."); stop(); }
      };
      options.element.addEventListener("ended", onEnded);
      options.element.addEventListener("pause", onEnded);
      options.element.addEventListener("error", onMediaError);
      document.addEventListener("visibilitychange", onHidden);
      disposeSession.current = () => {
        options.element.removeEventListener("ended", onEnded);
        options.element.removeEventListener("pause", onEnded);
        options.element.removeEventListener("error", onMediaError);
        document.removeEventListener("visibilitychange", onHidden);
      };
      if (!(await withTimeout(options.play(), 15000))) throw new Error("Không bắt đầu được phát nhạc để ghi.");
      if (generation.current.value !== request) throw new DOMException("Đã hủy", "AbortError");
      draw();
      const started = performance.now();
      const clipStart = options.element.currentTime;
      const shouldDraw = createFramePacer(started, frameRate);
      let lastElapsed = 0;
      mediaRecorder.start(250);
      setStatus("recording");
      const tick = (now: number) => {
        if (mediaRecorder.state === "inactive") return;
        if (shouldDraw(now)) {
          try { draw(now); } catch { failed = true; setError("Không vẽ được media vào bản ghi. Hãy thử đổi tệp."); stop(); return; }
          const seconds = Math.floor((now - started) / 1000);
          if (seconds !== lastElapsed) { setElapsed(seconds); lastElapsed = seconds; }
          if (options.element.currentTime - clipStart >= options.settings.clipDuration || now - started >= (options.settings.clipDuration + 10) * 1000) { stop(); return; }
        }
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    } catch (cause) {
      cleanupStream();
      options.pause();
      recorder.current = null;
      busy.current = false;
      if (mounted.current) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error && cause.message.startsWith("Không") ? cause.message : "Không ghi được media này. Hãy thử MP3 + ảnh bìa hoặc video MP4 khác.");
        setStatus("idle");
      }
    }
  }

  function clearResult() {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    resultUrl.current = null;
    setResult(null);
  }

  useEffect(() => {
    mounted.current = true;
    const token = generation.current;
    return () => {
      mounted.current = false;
      token.value++;
      if (recorder.current) {
        recorder.current.onstop = null;
        recorder.current.onerror = null;
        recorder.current.ondataavailable = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      cancelAnimationFrame(frame.current);
      stream.current?.getTracks().forEach(track => track.stop());
      disposeSession.current?.();
      const audio = bridge.current;
      audio?.nodes.forEach(node => node.disconnect());
      if (audio) void audio.context.close();
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      bridge.current = null;
    };
  }, []);

  return { status, busy: status !== "idle", elapsed, result, error, clearError: () => setError(""), start, stop, clearResult, resumeAudio };
}
