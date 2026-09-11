import { outputDimensions, type DisplaySettings, type VideoFormat } from "../types/studio";
import { getSceneArtSize } from "./renderScene";

export const recordingFrameRate = 60;

// Hỏi rõ từng codec, từ bộ đôi phổ biến nhất trở xuống:
// H.264 + AAC mở được ở mọi nơi; máy thiếu bộ mã hóa AAC (bản Windows N chẳng hạn) vẫn ghi
// được hình H.264 và chỉ đổi phần tiếng sang Opus. "video/mp4" trống nằm cuối vì Chromium có
// thể lặng lẽ nhét VP9 vào vỏ MP4 — vẫn nhận, nhưng phải nói rõ codec thật cho người dùng.
const codecCandidates: Record<VideoFormat, string[]> = {
  mp4: [
    "video/mp4;codecs=avc1.640034,mp4a.40.2",
    "video/mp4;codecs=avc1.640028,mp4a.40.2",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4;codecs=avc1.640034,opus",
    "video/mp4;codecs=avc1.640028,opus",
    "video/mp4;codecs=avc1,opus",
    "video/mp4;codecs=avc1.640034",
    "video/mp4;codecs=avc1",
    "video/mp4",
  ],
  webm: ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"],
};

const codecNames: [RegExp, string][] = [
  [/^avc[13]|^h264$/, "H.264"], [/^hv?[ec]1/, "H.265"], [/^vp0?9/, "VP9"], [/^vp0?8/, "VP8"], [/^av01/, "AV1"],
  [/^mp4a|^aac$/, "AAC"], [/^opus$/i, "Opus"], [/^vorbis$/, "Vorbis"],
];

/** Tên codec thật sự được ghi, lấy từ mimeType mà MediaRecorder trả về sau khi khởi tạo. */
export function describeCodecs(mimeType: string) {
  const codecs = /codecs\*?="?([^";]+)/i.exec(mimeType)?.[1];
  if (!codecs) return "";
  return codecs.split(",").map(part => {
    const id = part.trim();
    return codecNames.find(([pattern]) => pattern.test(id.toLowerCase()))?.[1] ?? id;
  }).join(" + ");
}

/** Vùng chứa thật sự, suy từ mimeType chứ không từ thứ đã yêu cầu. */
export function containerOf(mimeType: string): VideoFormat {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}

export const videoFormatLabels: Record<VideoFormat, string> = { mp4: "MP4", webm: "WebM" };

function supportsVideoFormat(format: VideoFormat) {
  return typeof MediaRecorder !== "undefined" && codecCandidates[format].some(type => MediaRecorder.isTypeSupported(type));
}

let cachedSupport: Record<VideoFormat, boolean> | null = null;
/**
 * Ghi thẳng MP4 cần Chrome/Edge 130 trở lên; những bản cũ hơn chỉ ghi được WebM.
 * Khả năng này cố định suốt phiên làm việc nên chỉ hỏi trình duyệt một lần và giữ nguyên tham chiếu.
 */
export function recordableFormats() {
  return (cachedSupport ??= { mp4: supportsVideoFormat("mp4"), webm: supportsVideoFormat("webm") });
}

/** Chọn định dạng người dùng muốn, tự lùi về định dạng còn lại nếu trình duyệt chưa ghi được. */
export function pickRecordingFormat(preferred: VideoFormat) {
  if (typeof MediaRecorder === "undefined") return null;
  const order: VideoFormat[] = preferred === "webm" ? ["webm", "mp4"] : ["mp4", "webm"];
  for (const format of order) {
    const mimeType = codecCandidates[format].find(type => MediaRecorder.isTypeSupported(type));
    if (mimeType) return { format, mimeType };
  }
  return null;
}

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
