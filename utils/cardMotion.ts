import { card } from "./cardLayout";

/** Độ sáng và độ phóng của câu trong thẻ nhạc theo tiêu điểm cuộn (utils/lyricSpring.ts). */

const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

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
