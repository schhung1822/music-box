import { card } from "./cardLayout";

/**
 * Chuyển động lời của thẻ nhạc, dùng chung cho giao diện (components/LyricsPanel.tsx) và bản ghi (utils/renderCard.ts).
 *
 * Vị trí cuộn của lời là một "tiêu điểm" thực, đơn vị là chỉ số câu: 3,0 là câu thứ ba đứng sát mép trên, 3,5 là đang
 * trượt giữa câu ba và câu bốn. Tiêu điểm bám theo câu đang hát bằng một lò xo giảm chấn tới hạn thay cho đường cong cố định:
 * - Bắt đầu êm (vận tốc 0) thay vì bật ngay với tốc độ lớn nhất.
 * - Đổi câu giữa chừng thì giữ nguyên vận tốc đang có, nên hai câu sát nhau nối liền thay vì khựng rồi chạy lại.
 * - Công thức giải sẵn nên đúng theo thời gian thật dù khung hình bị trễ: trễ vài chục mili giây chỉ làm bước nhảy lớn hơn, không làm
 *   chuyển động chậm hoặc đứng.
 */

const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

/** Độ cứng của lò xo (1/giây). Ở mức này, chuyển động dài khoảng nửa giây và đã đi được 90% sau chừng một phần tư giây. */
export const lyricSpringRate = 15;
// Câu trước càng cao thì quãng trượt càng dài, nên lò xo chậm lại: tốc độ tối đa chỉ tăng theo căn bậc hai của quãng đường.
const referenceTravel = 64;
const slowestRatio = 1.5;

/** Độ cứng cho một quãng trượt `travel`, tính theo pixel thẻ (360 đơn vị bề ngang). */
export function lyricSpringOmega(travel: number) {
  return lyricSpringRate / Math.min(slowestRatio, Math.max(1, Math.sqrt(Math.abs(travel) / referenceTravel)));
}

/** Nghiệm đóng của lò xo giảm chấn tới hạn: trả về [vị trí, vận tốc] sau `seconds` giây. */
export function springStep(value: number, velocity: number, target: number, seconds: number, omega: number): [number, number] {
  if (!(seconds > 0)) return [value, velocity];
  const offset = value - target;
  const slope = velocity + omega * offset;
  const decay = Math.exp(-omega * seconds);
  return [target + (offset + slope * seconds) * decay, (velocity - omega * slope * seconds) * decay];
}

// Sai lệch nhỏ hơn mức này (khoảng một phần mười pixel) thì coi như đã tới nơi.
const restDistance = 5e-4;
const restVelocity = 5e-3;

/**
 * Lò xo giữ tiêu điểm. `update` đưa lò xo tới thời điểm `now` (mili giây) rồi trả về tiêu điểm.
 * `travel(from, to)` cho biết quãng trượt tính theo pixel thẻ giữa hai tiêu điểm, để chọn tốc độ.
 */
export function createLyricSpring(initial = 0) {
  let value = initial;
  let velocity = 0;
  let target = initial;
  let omega = lyricSpringRate;
  let time = Number.NaN;
  return {
    update(next: number, now: number, travel: (from: number, to: number) => number) {
      if (Number.isNaN(time)) time = now;
      [value, velocity] = springStep(value, velocity, target, (now - time) / 1000, omega);
      time = now;
      if (next !== target) { target = next; omega = lyricSpringOmega(travel(value, target)); }
      if (Math.abs(value - target) < restDistance && Math.abs(velocity) < restVelocity) { value = target; velocity = 0; }
      return value;
    },
    /** Nhảy tới ngay, không chuyển động (đổi bộ lời, đổi cỡ thẻ, giảm chuyển động). */
    jump(to: number) { value = to; target = to; velocity = 0; time = Number.NaN; },
    get settled() { return value === target && velocity === 0; },
    get value() { return value; },
  };
}
export type LyricSpring = ReturnType<typeof createLyricSpring>;

/** Vị trí đỉnh (pixel thẻ) của tiêu điểm `focus`, nội suy giữa đỉnh hai câu liền nhau. */
export function lyricTopAt(topOf: (index: number) => number, focus: number) {
  const anchor = Math.max(0, focus);
  const lower = Math.floor(anchor);
  return mix(topOf(lower), topOf(lower + 1), anchor - lower);
}

/**
 * Độ sáng của một câu theo khoảng cách tới tiêu điểm. Câu đang hát sáng nhất, câu kế tiếp mờ hơn, mọi câu khác ẩn.
 * Câu vừa hát tan dần khi trôi ra khỏi mép trên.
 */
export function cardLyricAlpha(distance: number) {
  if (distance <= -1 || distance >= 2) return 0;
  if (distance < 0) return 1 + distance;
  return distance < 1 ? mix(1, card.nextAlpha, distance) : mix(card.nextAlpha, 0, distance - 1);
}

/** Câu đang hát to hơn câu khác chút ít (1 so với .975). */
export function cardLyricEmphasis(distance: number) {
  return .975 + .025 * Math.max(0, 1 - Math.abs(distance));
}
