import { card } from "./cardLayout";

/**
 * Câu quá dài thì thu nhỏ chữ để hiện trọn thay vì cắt bớt. Chọn bậc lớn nhất mà câu còn nằm trong
 * `lyricMaxLines` dòng; hết bậc mà vẫn dài thì dùng bậc nhỏ nhất (lúc đó mới cắt ở dòng thứ `lyricHardLines`).
 * Giao diện và bản ghi dùng chung hàm này nên chữ ở hai nơi luôn cùng cỡ.
 */
export const lyricFitSteps = [1, .92, .84, .77, .7] as const;

/** Số dòng khi xuống dòng theo từ trong bề rộng `maxWidth`; từ nào dài hơn cả dòng thì bị cắt giữa từ. */
export function countWrappedLines(measure: (text: string) => number, text: string, maxWidth: number) {
  let lines = 0;
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) { line = candidate; continue; }
    if (line) { lines++; line = ""; }
    if (measure(word) <= maxWidth) { line = word; continue; }
    let chunk = "";
    for (const char of Array.from(word)) {
      if (chunk && measure(chunk + char) > maxWidth) { lines++; chunk = char; }
      else chunk += char;
    }
    line = chunk;
  }
  return lines + (line ? 1 : 0);
}

/** `widthAt(text, k)` là bề rộng của `text` khi chữ được thu về `k` lần cỡ gốc. */
export function fitLyricScale(widthAt: (text: string, scale: number) => number, text: string, maxWidth: number) {
  for (const step of lyricFitSteps) {
    if (countWrappedLines(value => widthAt(value, step), text, maxWidth) <= card.lyricMaxLines) return step;
  }
  return lyricFitSteps[lyricFitSteps.length - 1];
}
