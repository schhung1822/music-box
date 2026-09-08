"use client";

import { useSyncExternalStore } from "react";

/**
 * Nền động chỉ chạy khi trình duyệt dựng được WebGL 2 và người dùng không yêu cầu giảm chuyển động.
 * "pending" là kết quả lúc dựng sẵn phía máy chủ và ở lần dựng đầu trên trình duyệt, để không lệch bản dựng.
 */
export type BackdropGate = "pending" | "ready" | "motion" | "webgl";

const motionPreference = "(prefers-reduced-motion: reduce)";
let query: MediaQueryList | null = null;
let webgl2: boolean | null = null;

function motionQuery() {
  query ??= window.matchMedia(motionPreference);
  return query;
}

// Dựng thử một ngữ cảnh WebGL 2 là việc nặng, nên chỉ đo một lần cho cả phiên.
function hasWebGL2() {
  if (webgl2 === null) {
    try { webgl2 = Boolean(document.createElement("canvas").getContext("webgl2")); }
    catch { webgl2 = false; }
  }
  return webgl2;
}

function subscribe(onChange: () => void) {
  const media = motionQuery();
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readGate(): BackdropGate {
  if (motionQuery().matches) return "motion";
  return hasWebGL2() ? "ready" : "webgl";
}

const serverGate = (): BackdropGate => "pending";

export function useBackdropGate() {
  return useSyncExternalStore(subscribe, readGate, serverGate);
}
