import { outputDimensions, type LyricLine } from "../types/studio";
import { card, cardAspectRatio, cardCredit, cardBackdropBlur, cardBackdropShade, cardOffsets, cardRecordingPlacement } from "./cardLayout";
import { cardLyricAlpha, cardLyricEmphasis } from "./cardMotion";
import { createFocusTracker, lyricTopAt } from "./lyricSpring";
import { wordsDoneMs } from "./lyricMotion";
import { fitLyricScale } from "./lyricFit";
import { activeLyricIndex } from "./lyrics";
import { formatRemaining, formatTime } from "./media";
import { blur, dimmedShare, drawSweepLines, drawVisual, drawWordReveal, font, lyricEffectOf, sweepFraction, white, wordElapsed, wrapText, type Scene } from "./renderScene";

/**
 * Bản vẽ của thẻ nhạc ở /card, dựng lại đúng thẻ trên giao diện (components/CardPlayer.tsx) nhưng không có
 * nút điều khiển: video ghi ra chỉ cần ảnh, tên bài, thanh thời gian và lời hát. Số đo lấy từ utils/cardLayout.ts.
 */

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const colors = {
  title: "#ffffff", credit: "rgba(255, 255, 255, 0.62)", artist: "rgba(255, 255, 255, 0.58)", time: "rgba(255, 255, 255, 0.55)",
  barTrack: "rgba(255, 255, 255, 0.28)", barFill: "rgba(255, 255, 255, 0.88)",
  glass: "rgba(110, 112, 120, 0.26)", sheenTop: "rgba(255, 255, 255, 0.13)", sheenBottom: "rgba(255, 255, 255, 0.04)", edge: "rgba(255, 255, 255, 0.16)",
  backdropTop: "#232a3a", backdropBottom: "#0e1014",
};

type Painter = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const imageReady = (source: HTMLImageElement | null | undefined): source is HTMLImageElement => Boolean(source && source.naturalWidth > 0 && source.naturalHeight > 0);

/** Nền: ảnh phủ kín khung, làm mờ, rồi phủ lớp tối. Chưa có ảnh thì dùng dải màu tối. */
function paintBackdrop(target: Painter, source: HTMLImageElement | null | undefined, width: number, height: number, radius: number) {
  const base = target.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, colors.backdropTop);
  base.addColorStop(1, colors.backdropBottom);
  target.fillStyle = base;
  target.fillRect(0, 0, width, height);
  if (imageReady(source)) {
    // Phóng thêm 12% để viền mờ không để lộ mép ảnh, cùng hệ số với giao diện.
    const scale = Math.max(width / source.naturalWidth, height / source.naturalHeight) * 1.12;
    const w = source.naturalWidth * scale;
    const h = source.naturalHeight * scale;
    if ("filter" in target) target.filter = `blur(${Math.round(radius * 100) / 100}px)`;
    try { target.drawImage(source, (width - w) / 2, (height - h) / 2, w, h); }
    catch { /* Ảnh vừa bị gỡ: giữ dải màu. */ }
    if ("filter" in target) target.filter = "none";
  }
  target.fillStyle = cardBackdropShade;
  target.fillRect(0, 0, width, height);
}

/** Những gì lớp tĩnh của bản ghi phụ thuộc vào. Đổi một trong số này thì lớp được vẽ lại. */
type Chrome = {
  width: number; height: number; cardX: number; cardY: number; cardWidth: number; cardHeight: number; scale: number;
  layout: ReturnType<typeof cardOffsets>; showProgress: boolean; title: string; artist: string; family: string;
};

/** Tấm kính, tên bài, tên nghệ sĩ, rãnh thanh tiến trình và tên nguồn: mọi thứ không đổi giữa các khung hình. Vẽ trong pixel logic. */
function paintChrome(ctx: CanvasRenderingContext2D, chrome: Chrome) {
  const { width, height, cardX, cardY, cardWidth, cardHeight, scale, layout, family } = chrome;
  const left = cardX + card.pad * scale;
  const inner = card.art * scale;
  drawGlass(ctx, width, height, cardX, cardY, cardWidth, cardHeight, scale);

  ctx.textAlign = "left";
  // Mọi chữ của thẻ đặt theo đường chân chữ để khớp với cách trình duyệt canh chữ trong hộp dòng.
  ctx.textBaseline = "alphabetic";
  font(ctx, family, 650, card.titleSize * scale, card.titleTracking * scale);
  ctx.fillStyle = colors.title;
  ctx.fillText(fitLine(ctx, chrome.title, inner), left, cardY + layout.title * scale + baseline(ctx, scale, card.titleSize * card.titleLine));
  font(ctx, family, "", card.artistSize * scale, 0);
  ctx.fillStyle = colors.artist;
  ctx.fillText(fitLine(ctx, chrome.artist, inner), left, cardY + layout.artist * scale + baseline(ctx, scale, card.artistSize * card.artistLine));

  if (chrome.showProgress) {
    const barHeight = card.barHeight * scale;
    ctx.fillStyle = colors.barTrack;
    ctx.beginPath(); ctx.roundRect(left, cardY + layout.bar * scale, inner, barHeight, barHeight / 2); ctx.fill();
  }

  // Tên nguồn ở cuối thẻ, canh giữa. Sans đậm nghiêng: Geist không có bản nghiêng thật nên cả trình duyệt lẫn canvas tự nghiêng chữ đậm.
  font(ctx, family, 700, card.creditSize * scale, card.creditTracking * scale);
  ctx.font = `italic ${ctx.font}`;
  ctx.fillStyle = colors.credit;
  ctx.textAlign = "center";
  ctx.fillText(cardCredit, cardX + cardWidth / 2, cardY + layout.credit * scale + baseline(ctx, scale, card.creditSize * card.creditLine));
  ctx.textAlign = "left";
}

// Nền mờ và bóng đổ của thẻ (một lần làm mờ 80 đơn vị) tốn vài chục mili giây mỗi lần, nhiều hơn cả ngân sách của một khung hình.
// Nên cả lớp tĩnh được vẽ một lần vào một canvas phụ rồi chép lại mỗi khung; chỉ video, thanh tiến trình và lời hát vẽ lại.
const staticLayers = new WeakMap<CanvasRenderingContext2D, { key: string; source: HTMLImageElement | null; ready: boolean; canvas: OffscreenCanvas }>();

/** Vẽ lớp tĩnh vào `ctx` (đã phóng sang pixel logic). Trả về false nếu môi trường không có canvas phụ, khi đó người gọi vẽ thẳng. */
function drawStaticLayer(ctx: CanvasRenderingContext2D, source: HTMLImageElement | null | undefined, chrome: Chrome) {
  if (typeof OffscreenCanvas === "undefined") return false;
  const { width: pixelWidth, height: pixelHeight } = ctx.canvas;
  const ready = imageReady(source);
  // Phông tải xong sau khi lớp được dựng thì chữ trong lớp đang là phông dự phòng, nên trạng thái phông cũng nằm trong khóa.
  const fonts = typeof document !== "undefined" && document.fonts ? document.fonts.status : "";
  const key = [pixelWidth, pixelHeight, chrome.cardX, chrome.cardY, chrome.scale, chrome.layout.height, chrome.showProgress, chrome.title, chrome.artist, chrome.family, fonts].join("|");
  let cached = staticLayers.get(ctx);
  if (!cached || cached.key !== key || cached.source !== (source ?? null) || cached.ready !== ready) {
    const canvas = new OffscreenCanvas(pixelWidth, pixelHeight);
    const painter = canvas.getContext("2d", { alpha: false }) as unknown as CanvasRenderingContext2D | null;
    if (!painter) return false;
    // Nền vẽ ở pixel thật của khung để độ nhòe không bị phóng theo; phần còn lại vẽ ở pixel logic.
    paintBackdrop(painter, source, pixelWidth, pixelHeight, cardBackdropBlur * Math.max(pixelWidth, pixelHeight));
    painter.scale(pixelWidth / chrome.width, pixelHeight / chrome.height);
    paintChrome(painter, chrome);
    cached = { key, source: source ?? null, ready, canvas };
    staticLayers.set(ctx, cached);
  }
  ctx.drawImage(cached.canvas as unknown as CanvasImageSource, 0, 0, chrome.width, chrome.height);
  return true;
}

/** Tấm kính mờ của thẻ: bóng đổ chỉ ở ngoài thẻ (như box-shadow), rồi lớp phủ sáng nhẹ và viền mảnh. */
function drawGlass(ctx: CanvasRenderingContext2D, width: number, height: number, x: number, y: number, w: number, h: number, scale: number) {
  const radius = card.radius * scale;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(width, 0); ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip("evenodd");
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)"; ctx.shadowBlur = 80 * scale; ctx.shadowOffsetY = 28 * scale;
  ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
  ctx.restore();

  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = colors.glass; ctx.fill();
  const sheen = ctx.createLinearGradient(x, y, x + w * .55, y + h);
  sheen.addColorStop(0, colors.sheenTop);
  sheen.addColorStop(1, colors.sheenBottom);
  ctx.fillStyle = sheen; ctx.fill();
  ctx.lineWidth = scale;
  ctx.strokeStyle = colors.edge;
  ctx.beginPath(); ctx.roundRect(x + scale / 2, y + scale / 2, w - scale, h - scale, radius - scale / 2); ctx.stroke();
}

/**
 * Khoảng từ đỉnh hộp dòng tới đường chân chữ, tính đúng như trình duyệt: ascent và descent của phông được làm tròn
 * tới pixel ở cỡ chữ thật (cỡ trước khi phóng), rồi nửa khoảng giãn dòng được làm tròn xuống. Giao diện phóng thẻ
 * bằng transform nên bố cục tính ở cỡ thật; làm tròn ở cỡ đã phóng sẽ lệch chữ một hai pixel.
 * `unit` là số pixel canvas cho mỗi pixel thật; `lineHeight` tính theo pixel thật. Phải gọi sau khi đã đặt phông.
 */
function baseline(ctx: CanvasRenderingContext2D, unit: number, lineHeight: number) {
  const metrics = ctx.measureText("Mg");
  // Môi trường không đo được phông: xấp xỉ chữ nằm giữa hộp dòng.
  if (!Number.isFinite(metrics.fontBoundingBoxAscent) || !Number.isFinite(metrics.fontBoundingBoxDescent)) return lineHeight * unit * .62;
  const ascent = Math.round(metrics.fontBoundingBoxAscent / unit);
  const descent = Math.round(metrics.fontBoundingBoxDescent / unit);
  return (ascent + Math.floor((lineHeight - ascent - descent) / 2)) * unit;
}

/** Một dòng, rút gọn bằng "…" tới từng ký tự như `text-overflow: ellipsis` thay vì tới từng từ. */
function fitLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = Array.from(text);
  while (cut.length && ctx.measureText(`${cut.join("").trimEnd()}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.join("").trimEnd()}…`;
}

/** `fit` là hệ số thu nhỏ chữ của câu dài; `lineHeight` là chiều cao một dòng của câu này; `baseline` là khoảng từ đỉnh câu tới chân chữ dòng đầu. */
type Entry = { index: number; wrapped: string[]; top: number; height: number; fit: number; lineHeight: number; baseline: number };
const stacks = new WeakMap<CanvasRenderingContext2D, { lyrics: LyricLine[]; key: string; entries: Entry[] }>();

const trackFocus = createFocusTracker();

/**
 * Lời chạy từ dưới lên: các câu xếp thành một cột liên tục và cột trượt lên để câu đang hát đứng sát mép trên
 * vùng lời, câu kế tiếp ngay phía dưới. Đo cột đúng một lần để đổi câu không làm các dòng nhảy.
 */
function drawCardLyrics(ctx: CanvasRenderingContext2D, scene: Scene, x: number, viewTop: number, width: number, scale: number, index: number, family: string) {
  const size = card.lyricSize * scale;
  const lineHeight = size * card.lyricLine;
  const lineHeightOf = (fit: number) => lineHeight * fit;
  const gap = card.lyricGap * scale;
  const pad = card.lyricPad * scale;
  const viewBottom = viewTop + pad + card.lyricRows * scale;
  const effect = lyricEffectOf(scene);
  ctx.textAlign = "left";

  const key = `${family}|${scale}|${width}`;
  let layout = stacks.get(ctx);
  if (!layout || layout.lyrics !== scene.lyrics || layout.key !== key) {
    let offset = 0;
    const entries = scene.lyrics.map((line, i) => {
      const text = line.text || "♪";
      const fit = fitLyricScale((value, k) => { font(ctx, family, 750, size * k, card.lyricTracking * scale * k); return ctx.measureText(value).width; }, text, width);
      font(ctx, family, 750, size * fit, card.lyricTracking * scale * fit);
      const wrapped = wrapText(ctx, text, width, card.lyricHardLines);
      const height = wrapped.length * lineHeightOf(fit);
      // Đo một lần ở cỡ chữ thật của câu; mỗi khung chỉ nhân với độ phóng to nhỏ của câu đang hát.
      const entry = { index: i, wrapped, top: offset, height, fit, lineHeight: lineHeightOf(fit), baseline: baseline(ctx, scale, card.lyricSize * fit * card.lyricLine) };
      offset += height + gap;
      return entry;
    });
    layout = { lyrics: scene.lyrics, key, entries };
    stacks.set(ctx, layout);
  }
  const { entries } = layout;
  if (!entries.length) return;

  const topOf = (i: number) => i < entries.length ? entries[i].top : entries[entries.length - 1].top + entries[entries.length - 1].height + gap;
  const focus = trackFocus(ctx, scene, index, (from, to) => Math.abs(lyricTopAt(topOf, to) - lyricTopAt(topOf, from)) / scale);
  // Trước câu đầu tiên chưa có câu nào đang hát: câu đầu vẫn nằm ở mép trên, ở vai trò câu kế tiếp.
  const origin = viewTop + pad - lyricTopAt(topOf, focus);

  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, viewTop, width, viewBottom - viewTop, 0); ctx.clip();
  // Mép trên và mép dưới mờ dần, giống mặt nạ của vùng lời trên giao diện.
  const fadeAt = (y: number, rowHeight = lineHeight) => {
    const center = y + rowHeight / 2;
    return clamp01(Math.min((center - viewTop) / pad, (viewBottom - center) / (14 * scale)));
  };
  entries.forEach(entry => {
    const distance = entry.index - focus;
    const alpha = cardLyricAlpha(distance);
    const entryTop = origin + entry.top;
    if (alpha <= .004 || entryTop + entry.height < viewTop || entryTop > viewBottom) return;
    const emphasis = cardLyricEmphasis(distance);
    const fontSize = size * entry.fit * emphasis;
    font(ctx, family, 750, fontSize, card.lyricTracking * scale * entry.fit * emphasis);
    const step = entry.lineHeight * emphasis;
    const fade = (y: number) => fadeAt(y, step);
    const top = entryTop + entry.height * (1 - emphasis) / 2 + entry.baseline * emphasis;
    const current = entry.index === index;
    if (current && effect === "sweep") {
      drawSweepLines(ctx, entry.wrapped, x, top, step, sweepFraction(ctx, scene, index), alpha, alpha * dimmedShare, fade);
      return;
    }
    if (current && effect === "words") {
      const elapsed = wordElapsed(ctx, scene, index);
      const count = entry.wrapped.reduce((sum, line) => sum + line.split(" ").filter(Boolean).length, 0);
      if (elapsed < wordsDoneMs(count)) { drawWordReveal(ctx, entry.wrapped, x, top, step, fontSize, elapsed, alpha, 0, fade); return; }
    }
    entry.wrapped.forEach((line, n) => {
      const y = top + n * step;
      const visible = fade(y);
      if (visible <= 0) return;
      ctx.fillStyle = white(alpha * visible);
      ctx.fillText(line, x, y);
    });
  });
  ctx.restore();
  blur(ctx, 0);
}

export function renderCardScene(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { settings } = scene;
  const [width, height] = outputDimensions[cardAspectRatio];
  const { scale, x: cardX, y: cardY } = cardRecordingPlacement(settings);
  const layout = cardOffsets({ progress: settings.showProgress, controls: false, lyrics: settings.showLyrics });
  const cardWidth = card.width * scale;
  const cardHeight = layout.height * scale;
  const left = cardX + card.pad * scale;
  const inner = card.art * scale;
  const family = scene.fontFamily || "Arial, Helvetica, sans-serif";

  ctx.save();
  // Bố cục dùng pixel logic; độ phân giải xuất cao hơn thì chữ và ảnh nét hơn chứ thẻ không đổi cỡ.
  ctx.scale(ctx.canvas.width / width, ctx.canvas.height / height);
  blur(ctx, 0);
  const chrome: Chrome = { width, height, cardX, cardY, cardWidth, cardHeight, scale, layout, showProgress: settings.showProgress, title: scene.title || "Hunq.lofi", artist: scene.artist || "Âm thanh của bạn", family };
  if (!drawStaticLayer(ctx, scene.cardBackdrop, chrome)) {
    // Không có canvas phụ (môi trường cũ): vẽ thẳng từng khung.
    paintBackdrop(ctx, scene.cardBackdrop, width, height, cardBackdropBlur * Math.max(ctx.canvas.width, ctx.canvas.height));
    paintChrome(ctx, chrome);
  }

  // Chưa có video hay ảnh bìa thì dùng ảnh thumbnail mặc định thay cho phong cảnh vẽ sẵn.
  drawVisual(ctx, scene.cover || !scene.placeholder ? scene : { ...scene, cover: scene.placeholder }, left, cardY + layout.art * scale, inner);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  if (settings.showProgress) {
    const known = Number.isFinite(scene.duration) && scene.duration > 0;
    const fraction = known ? clamp01(scene.currentTime / scene.duration) : 0;
    const barY = cardY + layout.bar * scale;
    const barHeight = card.barHeight * scale;
    if (fraction > 0) {
      ctx.fillStyle = colors.barFill;
      ctx.beginPath(); ctx.roundRect(left, barY, inner * fraction, barHeight, barHeight / 2); ctx.fill();
    }
    font(ctx, family, "", card.timeSize * scale, 0);
    ctx.fillStyle = colors.time;
    const timeY = cardY + layout.times * scale + baseline(ctx, scale, card.timeSize * card.timeLine);
    ctx.textAlign = "left";
    ctx.fillText(formatTime(scene.currentTime), left, timeY);
    ctx.textAlign = "right";
    ctx.fillText(formatRemaining(scene.currentTime, scene.duration), left + inner, timeY);
    ctx.textAlign = "left";
  }

  if (settings.showLyrics) {
    const timed = scene.lyrics.some(line => line.time !== null);
    const index = timed ? activeLyricIndex(scene.lyrics, scene.currentTime) : scene.manualLyricIndex;
    drawCardLyrics(ctx, scene, left, cardY + layout.lyrics * scale, inner, scale, index, family);
  }
  ctx.restore();
}
