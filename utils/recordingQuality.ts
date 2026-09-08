import { outputDimensions, type DisplaySettings } from "../types/studio";
import { getSceneArtSize } from "./renderScene";

export const recordingFrameRate = 60;

/** Keep the visible source crop near native resolution, within a practical real-time canvas size. */
export function getRecordingQuality(settings: DisplaySettings, video: Pick<HTMLVideoElement, "videoWidth" | "videoHeight"> | null) {
  const [baseWidth, baseHeight] = outputDimensions[settings.aspectRatio];
  const cropSize = settings.visualMode === "video" && video ? Math.min(video.videoWidth, video.videoHeight) : 0;
  const nativeScale = Number.isFinite(cropSize) && cropSize > 0 ? cropSize / getSceneArtSize(settings) : 1;
  const scale = Math.min(3840 / Math.max(baseWidth, baseHeight), Math.max(1, nativeScale));
  // Multiples of the ratio's even dimensions preserve the exact ratio and suit video encoders.
  const [unitWidth, unitHeight] = settings.aspectRatio === "4:3" ? [8, 6] : [18, 32];
  const units = Math.min(Math.floor(3840 / Math.max(unitWidth, unitHeight)), Math.ceil(baseWidth * scale / unitWidth));
  const width = units * unitWidth;
  const height = units * unitHeight;
  return {
    width, height, frameRate: recordingFrameRate,
    // Allocate bitrate for every output pixel/frame instead of sharing a fixed 8 Mbps budget.
    videoBitsPerSecond: Math.round(Math.min(100_000_000, Math.max(24_000_000, width * height * recordingFrameRate * .16))),
    audioBitsPerSecond: 320_000,
  };
}

/** Keep a stable 60 Hz deadline despite rAF jitter or displays running at 59.94/120/144 Hz. */
export function createFramePacer(started: number, frameRate = recordingFrameRate) {
  const interval = 1000 / frameRate;
  let nextFrame = started + interval;
  return (now: number) => {
    if (now < nextFrame - .5) return false;
    nextFrame += Math.max(1, Math.floor((now - nextFrame) / interval) + 1) * interval;
    return true;
  };
}
