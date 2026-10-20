import type { LyricLine } from "../types/studio";

// Shared with the live lyric panel so scrolling and recorded motion finish together.
export const lyricTransitionMs = 420;
export const lyricScrollEase = (progress: number) => 1 - (1 - Math.min(1, Math.max(0, progress))) ** 3;

// Hiệu ứng "hiện từng chữ": mỗi chữ trồi lên và rõ dần, chữ sau trễ hơn chữ trước một chút.
// Giá trị dùng chung với CSS của vùng lời để bản ghi giống giao diện.
export const wordRevealMs = 560;
const wordStaggerMs = 70;
const wordRevealBudgetMs = 640;

/** Độ trễ của chữ thứ `index`. Câu dài thì các chữ sát nhau hơn để cả câu hiện xong trong chừng một giây. */
export function wordDelayMs(index: number, count: number) {
  return index * Math.min(wordStaggerMs, wordRevealBudgetMs / Math.max(1, count));
}

/** Tiến độ hiện của một chữ, 0 đến 1, sau `elapsedMs` kể từ lúc câu thành câu hiện tại. */
export function wordProgress(elapsedMs: number, index: number, count: number) {
  return lyricScrollEase((elapsedMs - wordDelayMs(index, count)) / wordRevealMs);
}

/** Thời điểm chữ cuối hiện xong. Sau mốc này vẽ nguyên câu một lượt cho nhanh. */
export function wordsDoneMs(count: number) {
  return wordDelayMs(Math.max(0, count - 1), count) + wordRevealMs;
}

/** Chiều rộng vùng chuyển sáng của hiệu ứng tô chữ, tính theo phần trăm độ dài câu. */
export const sweepSoftness = .05;

/**
 * Tiến độ tô sáng của câu `index` tại thời điểm `time`, 0 đến 1. Tô xong trước khi câu kế tiếp bắt đầu;
 * câu cuối hoặc khoảng nghỉ rất dài thì tô theo độ dài chữ. Lời không có mốc thời gian được coi là đã tô hết.
 */
export function lyricSweep(lines: LyricLine[], index: number, time: number) {
  const line = lines[index];
  if (!line || line.time === null) return 1;
  let next = Infinity;
  for (const other of lines) if (other.time !== null && other.time > line.time && other.time < next) next = other.time;
  const natural = Math.min(6, Math.max(1.2, Array.from(line.text).length * .13));
  const duration = Number.isFinite(next) ? Math.max(.4, Math.min((next - line.time) * .9, natural * 2.5)) : natural;
  return Math.min(1, Math.max(0, (time - line.time) / duration));
}

/**
 * Điểm dừng của dải chuyển sáng: [phần đã tô đầy, hết vùng mờ], đều trong 0..1 hoặc lệch ra ngoài.
 * Ở 0 cả câu mờ, ở 1 cả câu sáng, ở giữa có một đường biên mềm.
 */
export function sweepEdge(progress: number): [number, number] {
  const end = progress * (1 + sweepSoftness);
  return [end - sweepSoftness, end];
}

/**
 * Đồng hồ nội suy: currentTime của thẻ media đứng yên giữa hai lần cập nhật, khiến vệt tô giật theo từng bậc.
 * Cộng thêm thời gian trôi thật từ lần cập nhật gần nhất (tối đa 0,1 giây) để vệt tô chạy đều.
 */
export function createSmoothClock() {
  let media = Number.NaN;
  let at = 0;
  return (mediaTime: number, now: number, playing = true) => {
    if (mediaTime !== media) { media = mediaTime; at = now; }
    return playing ? mediaTime + Math.min(.1, Math.max(0, now - at) / 1000) : mediaTime;
  };
}
