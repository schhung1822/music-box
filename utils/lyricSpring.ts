import type { LyricLine } from "../types/studio";

/**
 * Chuyển động chuyển câu lời, dùng chung cho giao diện (components/LyricsPanel.tsx) và bản ghi (utils/renderCard.ts, utils/renderScene.ts),
 * ở cả thẻ nhạc và giao diện gốc.
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
const slowestRatio = 1.5;
/** Quãng trượt "bình thường" (khoảng 1,7 lần bước của một câu một dòng) trong thẻ nhạc, tính theo pixel thẻ. */
export const cardTravelReference = 64;

/** Độ cứng cho một quãng trượt `travel`; `reference` là quãng trượt bình thường, cùng đơn vị với `travel`. */
export function lyricSpringOmega(travel: number, reference = cardTravelReference) {
  return lyricSpringRate / Math.min(slowestRatio, Math.max(1, Math.sqrt(Math.abs(travel) / reference)));
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
 * Đường cong êm dành cho các chuyển động có thời lượng cố định (câu cũ mờ đi, câu mới hiện lên ở khung dọc): hình dạng của lò xo giảm chấn
 * tới hạn đi từ nghỉ, kéo giãn cho vừa [0, 1]. Bắt đầu êm thay vì bật ngay, rồi chậm dần tới đích.
 */
const glideStiffness = 7.5;
const glideNorm = 1 - (1 + glideStiffness) * Math.exp(-glideStiffness);
export function lyricGlideEase(progress: number) {
  const p = Math.min(1, Math.max(0, progress));
  const u = p * glideStiffness;
  return (1 - (1 + u) * Math.exp(-u)) / glideNorm;
}

export type FocusScene = { lyrics: LyricLine[]; animationTime?: number; reducedMotion: boolean; currentTime: number };

/**
 * Tiêu điểm cuộn của lời: chỉ số câu dạng số thực, bám theo `index` bằng lò xo. `travel(from, to)` là quãng trượt giữa hai tiêu điểm.
 * Khi ghi, lò xo sống cùng khung vẽ và theo đồng hồ `animationTime`; dựng cố định (không có `animationTime`) thì phát lại các mốc câu
 * từ đầu để cùng mốc thời gian luôn ra cùng kết quả. Mỗi nơi vẽ tạo một bộ theo dõi riêng, khóa theo canvas.
 */
export function createFocusTracker() {
  const springs = new WeakMap<object, { lyrics: LyricLine[]; spring: LyricSpring }>();
  return (key: object, scene: FocusScene, index: number, travel: (from: number, to: number) => number) => {
    const now = scene.animationTime;
    if (now === undefined) {
      if (scene.reducedMotion) return index;
      const cues = scene.lyrics.map((line, i) => ({ time: line.time, index: i }))
        .filter((cue): cue is { time: number; index: number } => cue.time !== null && cue.time <= scene.currentTime)
        .sort((a, b) => a.time - b.time || a.index - b.index);
      if (!cues.length) return index;
      const spring = createLyricSpring(-1);
      for (const cue of cues) spring.update(cue.index, cue.time * 1000, travel);
      return spring.update(index, scene.currentTime * 1000, travel);
    }
    let state = springs.get(key);
    // Bộ lời mới: bắt đầu thẳng ở câu hiện tại, không trượt từ bộ lời cũ sang.
    if (!state || state.lyrics !== scene.lyrics) {
      state = { lyrics: scene.lyrics, spring: createLyricSpring(index) };
      springs.set(key, state);
    }
    if (scene.reducedMotion) { state.spring.jump(index); return index; }
    return state.spring.update(index, now, travel);
  };
}
