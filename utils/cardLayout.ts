import { outputDimensions, type DisplaySettings } from "../types/studio";

/** Giao diện thẻ nhạc chỉ ghi khung dọc 9:16, bất kể tỉ lệ nào đang lưu trong thiết lập. */
export const cardAspectRatio = "9:16" as const;

/**
 * Số đo của thẻ nhạc ở /card, tính theo "pixel thẻ": thẻ luôn rộng 360 đơn vị rồi được phóng cho vừa
 * cửa sổ (giao diện) hoặc vừa khung hình (bản ghi). Giao diện đọc các số này qua biến CSS và bản ghi
 * đọc thẳng, nên hai bên xuống dòng và canh chữ giống hệt nhau.
 */
export const card = {
  width: 360, pad: 24, radius: 24,
  /** Khung vuông của video/ảnh bìa. */
  art: 312,
  infoTop: 16, titleSize: 20, titleLine: 1.3, titleTracking: -.4,
  artistTop: 2, artistSize: 16, artistLine: 1.4,
  barTop: 12, barHeight: 5, timeTop: 6, timeSize: 12, timeLine: 1.3,
  controlsTop: 4, controlsHeight: 44,
  lyricsTop: 12,
  /** Khoảng mờ dần ở mép trên của vùng lời, nơi câu cũ trôi ra. Câu đang hát đứng ngay dưới khoảng này. */
  lyricPad: 12,
  /** Đủ chỗ cho bốn dòng chữ: câu đang hát ba dòng cộng một dòng của câu kế, hoặc hai cộng hai. */
  lyricRows: 124,
  /** Câu vượt ba dòng thì thu nhỏ chữ (utils/lyricFit.ts); thu hết cỡ mà vẫn dài hơn bốn dòng mới bị cắt bằng "…". */
  lyricSize: 21, lyricLine: 1.3, lyricTracking: -.5, lyricGap: 10, lyricMaxLines: 3, lyricHardLines: 4,
  /** Độ mờ của câu kế tiếp; các câu xa hơn ẩn hẳn. */
  nextAlpha: .42,
  /** Dòng tên nguồn ở cuối thẻ: sans đậm nghiêng, canh giữa. */
  creditTop: 8, creditSize: 16, creditLine: 1.4, creditTracking: .6,
  bottom: 18,
} as const;

/** Tên nguồn ký ở cuối thẻ, cả trên giao diện lẫn trong bản ghi. */
export const cardCredit = "@Hunq.lofi";

export type CardParts = { progress: boolean; controls: boolean; lyrics: boolean };

/** Vị trí dọc của từng khối trong thẻ, cùng chiều cao tổng. Khối nào tắt thì không chiếm chỗ. */
export function cardOffsets({ progress, controls, lyrics }: CardParts) {
  let y = card.pad;
  const art = y;
  y += card.art + card.infoTop;
  const title = y;
  y += card.titleSize * card.titleLine + card.artistTop;
  const artist = y;
  y += card.artistSize * card.artistLine;
  let bar = 0, times = 0, controlsY = 0, lyricsY = 0;
  if (progress) {
    y += card.barTop; bar = y;
    y += card.barHeight + card.timeTop; times = y;
    y += card.timeSize * card.timeLine;
  }
  if (controls) {
    y += card.controlsTop; controlsY = y;
    y += card.controlsHeight;
  }
  if (lyrics) {
    y += card.lyricsTop; lyricsY = y;
    y += card.lyricPad + card.lyricRows;
  }
  y += card.creditTop;
  const credit = y;
  y += card.creditSize * card.creditLine;
  return { art, title, artist, bar, times, controls: controlsY, lyrics: lyricsY, credit, height: y + card.bottom };
}

/** Phóng thẻ cho vừa một hộp, không quá `max` lần. */
export function fitCardScale(boxWidth: number, boxHeight: number, parts: CardParts, max = Infinity) {
  const scale = Math.min(boxWidth / card.width, boxHeight / cardOffsets(parts).height, max);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

// Mép chừa quanh thẻ trong khung hình, tính theo tỉ lệ của khung. Thẻ phóng cho gần kín bề ngang (khoảng 88%) và nằm giữa
// khung, giống giao diện khi mở trên điện thoại. Muốn lời hát cao hơn (tránh phần mô tả của TikTok ở đáy) thì tăng `bottom`:
// thẻ sẽ nhỏ lại và dồn lên trên.
const safe = { top: .05, bottom: .05, side: .06 };

/** Chỗ đặt thẻ trong bản ghi (pixel logic của khung 1080×1920): tỉ lệ phóng và góc trên-trái. Bản ghi không vẽ nút điều khiển. */
export function cardRecordingPlacement(settings: Pick<DisplaySettings, "showProgress" | "showLyrics">) {
  const [width, height] = outputDimensions[cardAspectRatio];
  const parts = { progress: settings.showProgress, controls: false, lyrics: settings.showLyrics };
  const scale = fitCardScale(width * (1 - 2 * safe.side), height * (1 - safe.top - safe.bottom), parts);
  // Nằm giữa phần khung còn lại sau khi chừa mép trên và mép dưới.
  const room = height * (1 - safe.top - safe.bottom);
  return { scale, x: (width - card.width * scale) / 2, y: height * safe.top + (room - cardOffsets(parts).height * scale) / 2 };
}

/** Tỉ lệ phóng của thẻ trong bản ghi. */
export function cardRecordingScale(settings: Pick<DisplaySettings, "showProgress" | "showLyrics">) {
  return cardRecordingPlacement(settings).scale;
}

/** Ảnh nền thẻ nhạc, nằm trong public/background/. Đổi sang bg2…bg5 hoặc ảnh khác ở đây. */
export const cardBackdropSrc = "/background/bg1.jpg";
/** Ảnh hiện trong khung vuông khi chưa chọn video hay ảnh bìa. */
export const cardThumbnailSrc = "/background/thumbanail.jpg";
/** Độ nhòe của ảnh nền, theo cạnh dài của khung. Giao diện dùng cùng hệ số (.8vmax) ở app/globals.css. */
export const cardBackdropBlur = .008;
/** Lớp tối phủ lên ảnh nền để thẻ và chữ nổi lên. Cùng giá trị với .card-backdrop::after. */
export const cardBackdropShade = "rgba(8, 9, 12, 0.26)";
