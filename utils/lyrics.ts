import type { LyricLine } from "../types/studio";

// [mm:ss.xx] và <mm:ss.xx>: LRC chuẩn, LRC nâng cao theo từ, kèm dạng có giờ [hh:mm:ss.xx].
const leadingBracketStamp = /^\s*[[<](\d{1,3}):(\d{1,2})(?::(\d{1,2}))?(?:[.:](\d{1,3}))?[\]>]/;
const anyBracketStamp = /[[<]\d{1,3}:\d{1,2}(?::\d{1,2})?(?:[.:]\d{1,3})?[\]>]/g;
// "0:16", "1:23.45" hay "00:01:23" đứng đầu dòng, kiểu bản chép lời chép từ trang nhạc.
const leadingBareStamp = /^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?(?:\.(\d{1,3}))?(?:\s+|\s*[-–—|]\s*|$)/;
// Thẻ mô tả của LRC: [ar:…], [ti:…], [offset:…].
const metadataTag = /^\[[a-z]{2,}:[^\]]*\]$/i;

function stampSeconds(first: string, second: string, third?: string, fraction?: string) {
  const hours = third ? Number(first) : 0;
  const minutes = third ? Number(second) : Number(first);
  const seconds = third ? Number(third) : Number(second);
  if (seconds >= 60 || (third && minutes >= 60)) return null;
  return hours * 3600 + minutes * 60 + seconds + (fraction ? Number(fraction) / 10 ** fraction.length : 0);
}

function matchStamp(row: string, pattern: RegExp) {
  const match = row.match(pattern);
  if (!match) return null;
  const time = stampSeconds(match[1], match[2], match[3], match[4]);
  return time === null ? null : { time, length: match[0].length };
}

export function parsePlainLyrics(text: string): LyricLine[] {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    .map((text, index) => ({ id: `plain-${index}`, time: null, text }));
}

/**
 * Đọc lời bài hát và tự nhận ra mốc thời gian nếu nội dung có sẵn.
 * Chế độ `strict` dành cho tệp .lrc: chỉ giữ câu có mốc và báo lỗi khi không tìm thấy mốc nào.
 */
export function parseLyrics(source: string, { strict = false } = {}): LyricLine[] {
  const clean = source.replace(/^\uFEFF/, "");
  const offsetMatch = clean.match(/\[offset:\s*([+-]?\d+)\]/i);
  const offset = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0;
  const rows = clean.split(/\r?\n/).map(row => row.trim()).filter(row => row && !metadataTag.test(row));

  const bracketed = rows.some(row => matchStamp(row, leadingBracketStamp) !== null);
  // Mốc trần dễ trùng với lời hát, nên chỉ dùng khi phần lớn các dòng đều có.
  const bareCount = bracketed ? 0 : rows.filter(row => matchStamp(row, leadingBareStamp) !== null).length;
  const bare = bareCount >= 2 && bareCount >= rows.length * .4;

  const entries: { time: number | null; text: string }[] = [];
  const clamp = (time: number) => Math.max(0, time + offset);
  let pending: number[] = [];

  for (const row of rows) {
    const stamps: number[] = [];
    let rest = row;
    if (bracketed) {
      for (let found = matchStamp(rest, leadingBracketStamp); found; found = matchStamp(rest, leadingBracketStamp)) {
        stamps.push(found.time);
        rest = rest.slice(found.length);
      }
    } else if (bare) {
      const found = matchStamp(rest, leadingBareStamp);
      if (found) { stamps.push(found.time); rest = rest.slice(found.length); }
    }
    const text = rest.replace(anyBracketStamp, "").trim();

    if (stamps.length) {
      // Mốc đứng một mình thường thuộc về dòng lời ngay sau nó.
      if (!text && !strict) { pending.push(...stamps); continue; }
      pending.forEach(time => entries.push({ time: clamp(time), text: "" }));
      pending = [];
      stamps.forEach(time => entries.push({ time: clamp(time), text }));
    } else if (pending.length && text) {
      pending.forEach(time => entries.push({ time: clamp(time), text }));
      pending = [];
    } else if (!strict) {
      entries.push({ time: null, text });
    }
  }
  pending.forEach(time => entries.push({ time: clamp(time), text: "" }));

  if (strict && !entries.length) throw new Error("Không tìm thấy mốc thời gian hợp lệ, ví dụ [00:12.40]Lời bài hát.");
  const lines = entries.map((entry, index) => ({ id: `lyric-${index}`, ...entry }));
  // Chỉ sắp xếp khi mọi câu đều có mốc; nếu không, giữ nguyên thứ tự người dùng đã dán.
  if (lines.length && lines.every(line => line.time !== null)) lines.sort((a, b) => a.time! - b.time!);
  return lines;
}

export function parseLrc(source: string): LyricLine[] {
  return parseLyrics(source, { strict: true });
}

export function activeLyricIndex(lines: LyricLine[], currentTime: number) {
  let index = -1;
  let latestTime = -Infinity;
  lines.forEach((line, i) => {
    if (line.time !== null && line.time <= currentTime && line.time >= latestTime) {
      index = i;
      latestTime = line.time;
    }
  });
  return index;
}
function formatStamp(time: number) {
  const hundredths = Math.round(Math.max(0, time) * 100);
  const minutes = Math.floor(hundredths / 6000);
  const seconds = Math.floor(hundredths / 100) % 60;
  return `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths % 100).padStart(2, "0")}]`;
}

export function serializeLrc(lines: LyricLine[]) {
  return lines.filter(line => line.time !== null).sort((a, b) => a.time! - b.time!)
    .map(line => formatStamp(line.time!) + line.text).join("\n");
}

/** Dựng lại nội dung ô soạn thảo kèm mốc thời gian, để bấm "Áp dụng lời" lần nữa không làm mất mốc. */
export function formatLyricsDraft(lines: LyricLine[]) {
  return lines.map(line => line.time === null ? line.text : formatStamp(line.time) + line.text).join("\n");
}

/**
 * Dịch toàn bộ mốc thời gian đi một khoảng (giây, âm là cho lời hiện sớm hơn).
 * Câu chưa có mốc giữ nguyên; mốc bị đẩy xuống dưới 0 được giữ ở 0.
 */
export function shiftLyrics(lines: LyricLine[], seconds: number): LyricLine[] {
  if (!Number.isFinite(seconds) || seconds === 0) return lines;
  return lines.map(line => line.time === null ? line
    : { ...line, time: Math.max(0, Math.round((line.time + seconds) * 1000) / 1000) });
}
