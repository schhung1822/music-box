import type { DisplaySettings, LyricLine } from "../types/studio";
import { activeLyricIndex } from "./lyrics";
import { formatTime } from "./media";
import { lyricScrollEase, lyricTransitionMs } from "./lyricMotion";

export type Scene = {
  title: string; artist: string; lyrics: LyricLine[]; manualLyricIndex: number;
  settings: DisplaySettings; currentTime: number; duration: number;
  video: HTMLVideoElement | null; cover: HTMLImageElement | null; reducedMotion: boolean;
  fontFamily?: string;
  /** Monotonic animation clock in milliseconds, independent of media time quantization. */
  animationTime?: number;
};

// Thời gian chuyển giữa hai câu lời, khớp với hiệu ứng trên giao diện.
const transitionSeconds = lyricTransitionMs / 1000;
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

// Màu lấy nguyên từ giao diện (app/globals.css) để bản ghi và trình phát không lệch tông.
const colors = {
  background: "#0b0d0c", frame: "#172019", title: "#f5f5f3", artist: "#949d90",
  barTrack: "#ffffff20", barFill: "#c5cbbf", timeLabel: "#7f887c",
  playBackground: "#e1e5dc", playIcon: "#172018", icon: "#a4ada0", volumeIcon: "#7f887c",
};
// Bo góc khung hình, tính theo cạnh khung. Dùng chung với .media-frame bên CSS.
export const frameRadiusRatio = .045;

/**
 * Số đo lấy thẳng từ CSS của trình phát, tính theo pixel giao diện.
 * Khung ngang dùng bố cục desktop, khung dọc dùng bố cục mobile — đúng như người dùng nhìn thấy.
 */
const desktop = {
  art: 480, songInfoTop: 25, titleSize: 32, titleLine: 1.3, titleTracking: -.9,
  artistTop: 7, artistSize: 15, artistLine: 1.5,
  progressTop: 26, barHeight: 3, timeTop: 10, timeSize: 11, timeLine: 1.5,
  controlsTop: 16, playSize: 58, iconSize: 40, transportGap: 25,
  lyricSize: 40, lyricLine: 1.42, lyricTracking: -1, lyricPad: 17,
};
const mobile = {
  art: 374, songInfoTop: 22, titleSize: 28, titleLine: 1.3, titleTracking: -.9,
  artistTop: 7, artistSize: 14, artistLine: 1.5,
  progressTop: 22, barHeight: 3, timeTop: 10, timeSize: 11, timeLine: 1.5,
  controlsTop: 12, playSize: 53, iconSize: 40, transportGap: 25,
  lyricSize: 25, lyricLine: 1.4, lyricTracking: -.7, lyricPad: 11,
  gridGap: 28,
};

function playerHeightFor(base: typeof desktop | typeof mobile, titleLines: number, controls: boolean) {
  return base.art + base.songInfoTop + titleLines * base.titleSize * base.titleLine
    + base.artistTop + base.artistSize * base.artistLine + base.progressTop + base.barHeight
    + (controls ? base.timeTop + base.timeSize * base.timeLine + base.controlsTop + base.playSize : 0);
}

/** Artwork size in the canonical composition, used when preserving uploaded video detail. */
export function getSceneArtSize(settings: DisplaySettings) {
  if (settings.aspectRatio === "4:3") return settings.showLyrics ? 560 : 620;
  const lyricBudget = settings.showLyrics ? mobile.gridGap + 4 * mobile.lyricSize * mobile.lyricLine : 0;
  const total = playerHeightFor(mobile, 2, settings.showControls) + lyricBudget;
  return mobile.art * Math.min(1080 / 430, (1920 - 40) / total);
}

// Đường vẽ lấy nguyên từ components/Icon.tsx (khung 24×24, nét 1.6, đầu tròn).
const icons = {
  sliders: { paths: ["M4 7h5m4 0h7M4 17h9m4 0h3"], circles: [[11, 7, 2], [15, 17, 2]] as [number, number, number][] },
  rewind: { paths: ["M3 9a9 9 0 1 1 0 7M3 4v5h5"], label: "10" },
  forward: { paths: ["M21 9a9 9 0 1 0 0 7m0-12v5h-5"], label: "10" },
  volume: { paths: ["m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"] },
};

function font(ctx: CanvasRenderingContext2D, family: string, weight: number | "", size: number, tracking = 0) {
  ctx.font = `${weight === "" ? "" : `${weight} `}${Math.round(size * 100) / 100}px ${family}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${Math.round(tracking * 100) / 100}px`;
}
function blur(ctx: CanvasRenderingContext2D, radius: number) {
  if ("filter" in ctx) ctx.filter = radius > 0 ? `blur(${Math.round(radius * 100) / 100}px)` : "none";
}

/** Nền toả sáng của .studio-shell: hai vệt tròn rất nhạt hai bên. */
function drawBackdrop(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);
  const reach = Math.hypot(width, height);
  for (const [fx, color, stop] of [[.2, "#243127", .52], [.92, "#28232c", .55]] as [number, string, number][]) {
    ctx.save();
    ctx.translate(width * fx, height * .45);
    ctx.scale(1, height / width);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, reach * stop);
    glow.addColorStop(0, `${color}30`);
    glow.addColorStop(1, `${color}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(-width * 2, -height * 2, width * 4, height * 4);
    ctx.restore();
  }
}

const backdrops = new WeakMap<CanvasRenderingContext2D, OffscreenCanvas>();
function drawCachedBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
  if (typeof OffscreenCanvas === "undefined") { drawBackdrop(ctx, width, height); return; }
  let backdrop = backdrops.get(ctx);
  if (!backdrop || backdrop.width !== ctx.canvas.width || backdrop.height !== ctx.canvas.height) {
    backdrop = new OffscreenCanvas(ctx.canvas.width, ctx.canvas.height);
    const backgroundContext = backdrop.getContext("2d", { alpha: false });
    if (!backgroundContext) { drawBackdrop(ctx, width, height); return; }
    drawBackdrop(backgroundContext, backdrop.width, backdrop.height);
    backdrops.set(ctx, backdrop);
  }
  ctx.drawImage(backdrop, 0, 0, width, height);
}

function drawCrop(ctx: CanvasRenderingContext2D, source: HTMLVideoElement | HTMLImageElement, x: number, y: number, size: number) {
  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!width || !height) return false;
  const crop = Math.min(width, height);
  ctx.drawImage(source, (width - crop) / 2, (height - crop) / 2, crop, crop, x, y, size, size);
  return true;
}

function drawLandscape(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const sky = ctx.createLinearGradient(x, y, x + size, y + size);
  sky.addColorStop(0, "#253537"); sky.addColorStop(0.62, "#a49b76"); sky.addColorStop(1, "#394d41");
  ctx.fillStyle = sky; ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#e4c89e"; ctx.beginPath(); ctx.arc(x + size * .67, y + size * .34, size * .085, 0, Math.PI * 2); ctx.fill();
  ["#69735a", "#4b6049", "#34503d", "#213c30"].forEach((color, index) => {
    const top = y + size * (.5 + index * .13);
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, top);
    ctx.bezierCurveTo(x + size * .33, top - size * .15, x + size * .66, top + size * .18, x + size, top - size * .08);
    ctx.lineTo(x + size, y + size); ctx.lineTo(x, y + size); ctx.closePath(); ctx.fill();
  });
}

function drawVisual(ctx: CanvasRenderingContext2D, scene: Scene, x: number, y: number, size: number) {
  ctx.save();
  if (scene.settings.visualMode === "disc") {
    const radius = size * .48;
    ctx.translate(x + size / 2, y + size / 2);
    // Bóng đổ vẽ trước khi quay, nếu không nó sẽ quay vòng theo đĩa.
    ctx.save();
    ctx.shadowColor = "#00000088"; ctx.shadowBlur = size * .125; ctx.shadowOffsetY = size * .05;
    ctx.fillStyle = "#111411";
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (!scene.reducedMotion) ctx.rotate(scene.currentTime * Math.PI / 6);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, "#242724"); gradient.addColorStop(.5, "#111411"); gradient.addColorStop(1, "#272c27");
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    for (let r = radius * .54; r < radius; r += Math.max(3, size / 140)) {
      ctx.strokeStyle = "#ffffff0b"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    }
    const labelSize = size * .46;
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, labelSize / 2, 0, Math.PI * 2); ctx.clip();
    if (!scene.cover || !drawCrop(ctx, scene.cover, -labelSize / 2, -labelSize / 2, labelSize)) drawLandscape(ctx, -labelSize / 2, -labelSize / 2, labelSize);
    ctx.restore();
    ctx.fillStyle = "#111611"; ctx.beginPath(); ctx.arc(0, 0, size * .012, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.save();
    ctx.shadowColor = "#00000055"; ctx.shadowBlur = size * .167; ctx.shadowOffsetY = size * .05;
    ctx.fillStyle = colors.frame;
    ctx.beginPath(); ctx.roundRect(x, y, size, size, size * frameRadiusRatio); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.roundRect(x, y, size, size, size * frameRadiusRatio); ctx.clip();
    if (scene.video && scene.video.readyState >= 2 && drawCrop(ctx, scene.video, x, y, size)) { /* Local video has visual priority. */ }
    else if (scene.cover && drawCrop(ctx, scene.cover, x, y, size)) { /* The cover is also available for audio-only clips. */ }
    else drawLandscape(ctx, x, y, size);
  }
  ctx.restore();
}

/** Xuống dòng theo từ. Chỉ khi một từ dài hơn cả dòng mới đành cắt giữa từ. */
const textLayouts = new WeakMap<CanvasRenderingContext2D, Map<string, string[]>>();
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  let cache = textLayouts.get(ctx);
  if (!cache) { cache = new Map(); textLayouts.set(ctx, cache); }
  const key = `${ctx.font}|${ctx.letterSpacing}|${maxWidth}|${maxLines}|${text}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) { line = candidate; continue; }
    if (line) { lines.push(line); line = ""; }
    if (ctx.measureText(word).width <= maxWidth) { line = word; continue; }
    let chunk = "";
    for (const char of Array.from(word)) {
      if (chunk && ctx.measureText(chunk + char).width > maxWidth) { lines.push(chunk); chunk = char; }
      else chunk += char;
    }
    line = chunk;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  if (cache.size > 2000) cache.clear();
  cache.set(key, lines);
  return lines;
}

// Cùng thang độ mờ với vùng lời trên giao diện.
function lyricAlpha(distance: number) {
  return distance <= 0 ? 1 : distance >= 3 ? .09 : mix(distance < 1 ? 1 : distance < 2 ? .4 : .2, distance < 1 ? .4 : distance < 2 ? .2 : .09, distance % 1);
}
// Độ nhòe theo khoảng cách, khớp với .lyric-line[data-distance] bên CSS.
function lyricBlur(distance: number) {
  const stops = [0, 0, .75, 1.5, 0];
  const lower = Math.min(4, Math.floor(distance));
  return mix(stops[lower], stops[Math.min(4, lower + 1)], distance - Math.floor(distance));
}
const white = (alpha: number) => `rgba(255, 255, 255, ${Math.round(alpha * 1000) / 1000})`;

// Timed keyframes keep deterministic renders continuous; the recorder's monotonic clock
// continues those transitions smoothly even when the media clock repeats a timestamp.
type LyricKeyframe = { time: number; index: number; from: number };
const lyricTimelines = new WeakMap<LyricLine[], LyricKeyframe[]>();
const liveMotion = new WeakMap<CanvasRenderingContext2D, { lyrics: LyricLine[]; index: number; from: number; started: number }>();

function timelineFocus(scene: Scene, index: number) {
  if (scene.reducedMotion || index < 0) return index;
  let timeline = lyricTimelines.get(scene.lyrics);
  if (!timeline) {
    const cues = scene.lyrics.map((line, i) => ({ time: line.time, index: i }))
      .filter((cue): cue is { time: number; index: number } => cue.time !== null)
      .sort((a, b) => a.time - b.time || a.index - b.index);
    timeline = [];
    for (const cue of cues) {
      const previous = timeline[timeline.length - 1];
      const from = previous ? mix(previous.from, previous.index, lyricScrollEase((cue.time - previous.time) / transitionSeconds)) : -1;
      timeline.push({ ...cue, from });
    }
    lyricTimelines.set(scene.lyrics, timeline);
  }
  const cue = timeline.find(entry => entry.index === index);
  return cue ? mix(cue.from, index, lyricScrollEase((scene.currentTime - cue.time) / transitionSeconds)) : index;
}

function lyricFocus(ctx: CanvasRenderingContext2D, scene: Scene, index: number) {
  const now = scene.animationTime;
  if (now === undefined) return timelineFocus(scene, index);
  let motion = liveMotion.get(ctx);
  if (!motion || motion.lyrics !== scene.lyrics || scene.reducedMotion) {
    motion = { lyrics: scene.lyrics, index, from: index, started: now - lyricTransitionMs };
    liveMotion.set(ctx, motion);
  }
  const focus = mix(motion.from, motion.index, lyricScrollEase((now - motion.started) / lyricTransitionMs));
  if (motion.index !== index) {
    motion = { lyrics: scene.lyrics, index, from: focus, started: now };
    liveMotion.set(ctx, motion);
  }
  return scene.reducedMotion ? index : focus;
}

type PortraitLayer = { index: number; alpha: number; shift: number };
type PortraitKeyframe = { time: number; index: number; from: PortraitLayer[] };
const portraitTimelines = new WeakMap<LyricLine[], PortraitKeyframe[]>();
const portraitMotion = new WeakMap<CanvasRenderingContext2D, { lyrics: LyricLine[]; index: number; from: PortraitLayer[]; started: number }>();

function blendPortrait(from: PortraitLayer[], index: number, progress: number): PortraitLayer[] {
  const outgoing = from.filter(layer => layer.index !== index)
    .map(layer => ({ ...layer, alpha: layer.alpha * (1 - progress), shift: mix(layer.shift, -1, progress) }));
  const previous = from.find(layer => layer.index === index);
  if (index >= 0) outgoing.push({ index, alpha: mix(previous?.alpha ?? 0, 1, progress), shift: mix(previous?.shift ?? 1, 0, progress) });
  return outgoing.filter(layer => layer.alpha > .001);
}

function singleLyricLayers(ctx: CanvasRenderingContext2D, scene: Scene, index: number): PortraitLayer[] {
  const settled = index < 0 ? [] : [{ index, alpha: 1, shift: 0 }];
  const now = scene.animationTime;
  if (now !== undefined) {
    let motion = portraitMotion.get(ctx);
    if (!motion || motion.lyrics !== scene.lyrics || scene.reducedMotion) {
      motion = { lyrics: scene.lyrics, index, from: settled, started: now - lyricTransitionMs };
      portraitMotion.set(ctx, motion);
    }
    const layers = blendPortrait(motion.from, motion.index, lyricScrollEase((now - motion.started) / lyricTransitionMs));
    if (motion.index !== index) portraitMotion.set(ctx, { lyrics: scene.lyrics, index, from: layers, started: now });
    return scene.reducedMotion ? settled : layers;
  }
  if (scene.reducedMotion || index < 0) return settled;
  let timeline = portraitTimelines.get(scene.lyrics);
  if (!timeline) {
    const cues = scene.lyrics.map((line, i) => ({ time: line.time, index: i }))
      .filter((cue): cue is { time: number; index: number } => cue.time !== null)
      .sort((a, b) => a.time - b.time || a.index - b.index);
    timeline = [];
    for (const cue of cues) {
      const previous = timeline[timeline.length - 1];
      const from = previous ? blendPortrait(previous.from, previous.index, lyricScrollEase((cue.time - previous.time) / transitionSeconds)) : [];
      timeline.push({ ...cue, from });
    }
    portraitTimelines.set(scene.lyrics, timeline);
  }
  const cue = timeline.find(entry => entry.index === index);
  return cue ? blendPortrait(cue.from, index, lyricScrollEase((scene.currentTime - cue.time) / transitionSeconds)) : settled;
}

type Metrics = {
  wide: boolean; scale: number; art: number; artX: number; playerTop: number;
  lyricX: number; lyricWidth: number; lyricTop: number; lyricHeight: number; family: string;
};

/** Dựng lại đúng bố cục của trình phát: lưới hai cột khi ngang, xếp dọc khi đứng. */
function measure(ctx: CanvasRenderingContext2D, scene: Scene, width: number, height: number): Metrics {
  const wide = width > height;
  const family = scene.fontFamily || "Arial, Helvetica, sans-serif";
  const base = wide ? desktop : mobile;
  // Số dòng tiêu đề không đổi theo tỉ lệ phóng, nên đo trước ở pixel giao diện.
  font(ctx, family, 650, base.titleSize, base.titleTracking);
  const titleLines = wrapText(ctx, scene.title || "Một khoảng lặng", base.art, 2).length;
  const playerHeight = playerHeightFor(base, titleLines, scene.settings.showControls);

  if (wide) {
    const art = getSceneArtSize(scene.settings);
    const scale = art / desktop.art;
    const gap = 96;
    const lyricWidth = art * 1.08;
    const mainX = (width - art - gap - lyricWidth) / 2;
    const lyricViewport = 600 * scale;
    return {
      wide, scale, art, artX: scene.settings.showLyrics ? mainX : (width - art) / 2,
      playerTop: (height - playerHeight * scale) / 2,
      lyricX: mainX + art + gap, lyricWidth,
      lyricTop: (height - lyricViewport) / 2, lyricHeight: lyricViewport, family,
    };
  }
  // Khung dọc: bố cục mobile phóng cho vừa khung, vẫn chừa chỗ cho một câu lời.
  const lyricBudget = scene.settings.showLyrics ? 4 * mobile.lyricSize * mobile.lyricLine : 0;
  const total = playerHeight + (scene.settings.showLyrics ? mobile.gridGap : 0) + lyricBudget;
  const art = getSceneArtSize(scene.settings);
  const scale = art / mobile.art;
  const top = (height - total * scale) / 2;
  return {
    wide, scale, art, artX: (width - art) / 2, playerTop: top,
    lyricX: (width - art) / 2, lyricWidth: art,
    lyricTop: top + (playerHeight + mobile.gridGap) * scale, lyricHeight: lyricBudget * scale, family,
  };
}

function drawIcon(ctx: CanvasRenderingContext2D, icon: { paths: string[]; circles?: [number, number, number][]; label?: string }, centerX: number, centerY: number, size: number, family: string) {
  if (typeof Path2D === "undefined") return;
  ctx.save();
  ctx.translate(centerX - size / 2, centerY - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = ctx.fillStyle;
  icon.paths.forEach(data => ctx.stroke(new Path2D(data)));
  icon.circles?.forEach(([cx, cy, r]) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); });
  if (icon.label) {
    font(ctx, family, "", 9);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(icon.label, 7, 16);
  }
  ctx.restore();
}

/** Thanh điều khiển vẽ vào bản ghi, dựng lại đúng hàng nút của trình phát. */
function drawControls(ctx: CanvasRenderingContext2D, scene: Scene, metrics: Metrics, x: number, y: number) {
  const base = metrics.wide ? desktop : mobile;
  const { scale, art, family } = metrics;
  font(ctx, family, "", base.timeSize * scale);
  ctx.textBaseline = "top";
  ctx.fillStyle = colors.timeLabel;
  ctx.textAlign = "left";
  ctx.fillText(formatTime(scene.currentTime), x, y);
  ctx.textAlign = "right";
  ctx.fillText(Number.isFinite(scene.duration) && scene.duration > 0 ? formatTime(scene.duration) : "--:--", x + art, y);

  const rowTop = y + base.timeSize * base.timeLine * scale + base.controlsTop * scale;
  const play = base.playSize * scale;
  const centerY = rowTop + play / 2;
  const centerX = x + art / 2;
  const icon = base.iconSize * scale * .5;
  const step = play / 2 + base.transportGap * scale + icon / 2;
  ctx.fillStyle = colors.icon;
  drawIcon(ctx, icons.rewind, centerX - step, centerY, icon, family);
  drawIcon(ctx, icons.forward, centerX + step, centerY, icon, family);
  ctx.fillStyle = colors.icon;
  drawIcon(ctx, icons.sliders, x + icon / 2, centerY, icon, family);
  ctx.fillStyle = colors.volumeIcon;
  drawIcon(ctx, icons.volume, x + art - icon / 2, centerY, icon, family);
  ctx.fillStyle = colors.playBackground;
  ctx.beginPath(); ctx.arc(centerX, centerY, play / 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors.playIcon;
  if (typeof Path2D !== "undefined") {
    const glyph = play * .48;
    ctx.save();
    ctx.translate(centerX - glyph / 2 + glyph * .06, centerY - glyph / 2);
    ctx.scale(glyph / 24, glyph / 24);
    ctx.fill(new Path2D("m8 4 12 8-12 8Z"));
    ctx.restore();
  }
}

/** Khung ngang: xếp câu hiện tại cùng vài câu quanh nó, trượt mượt khi đổi câu. */
type LyricEntry = { index: number; wrapped: string[]; top: number; height: number };
const lyricStacks = new WeakMap<CanvasRenderingContext2D, { lyrics: LyricLine[]; key: string; entries: LyricEntry[] }>();

function drawLyricStack(ctx: CanvasRenderingContext2D, scene: Scene, metrics: Metrics, index: number) {
  const focus = lyricFocus(ctx, scene, index);
  const { scale, lyricX, lyricWidth, lyricTop, lyricHeight, family } = metrics;
  const size = desktop.lyricSize * scale;
  const lineHeight = size * desktop.lyricLine;
  const gap = desktop.lyricPad * 2 * scale;
  const top = lyricTop;
  const bottom = lyricTop + lyricHeight;
  const padding = 6 * scale;
  ctx.textAlign = "left";

  // Measure a stable stack once. Changing the active line must never remove neighbours
  // or change wrapping, both of which used to make the recording jump between frames.
  const key = `${family}|${scale}|${lyricWidth}`;
  let layout = lyricStacks.get(ctx);
  if (!layout || layout.lyrics !== scene.lyrics || layout.key !== key) {
    let offset = 0;
    font(ctx, family, 750, size, desktop.lyricTracking * scale);
    const entries = scene.lyrics.map((line, i) => {
      const wrapped = wrapText(ctx, line.text || "♪", lyricWidth - 2 * padding, 4);
      const height = wrapped.length * lineHeight;
      const entry = { index: i, wrapped, top: offset, height };
      offset += height + gap;
      return entry;
    });
    layout = { lyrics: scene.lyrics, key, entries };
    lyricStacks.set(ctx, layout);
  }
  const { entries } = layout;
  if (!entries.length) return;

  const centerFor = (lyricIndex: number) => {
    const entry = entries[Math.min(entries.length - 1, Math.max(0, lyricIndex))];
    return entry.top + entry.height / 2;
  };
  const lower = Math.floor(focus);
  const center = mix(centerFor(lower), centerFor(lower + 1), focus - lower);
  const start = lyricTop + lyricHeight / 2 - center;

  ctx.save();
  ctx.beginPath(); ctx.roundRect(lyricX, top, lyricWidth, lyricHeight, 0); ctx.clip();
  entries.forEach(entry => {
    if (start + entry.top + entry.height < top || start + entry.top > bottom) return;
    const distance = Math.abs(entry.index - focus);
    const emphasis = .975 + .025 * Math.max(0, 1 - distance);
    const alpha = lyricAlpha(distance);
    font(ctx, family, Math.round(600 + 150 * Math.max(0, 1 - distance)), size * emphasis, desktop.lyricTracking * scale * emphasis);
    blur(ctx, lyricBlur(distance) * scale);
    entry.wrapped.forEach((line, n) => {
      const y = start + entry.top + entry.height * (1 - emphasis) / 2 + n * lineHeight * emphasis;
      if (y + lineHeight < top || y > bottom) return;
      const relative = (y + lineHeight / 2 - top) / lyricHeight;
      const fade = Math.max(0, Math.min(1, relative / .18, (1 - relative) / .2));
      ctx.fillStyle = white(alpha * fade);
      ctx.fillText(line, lyricX + padding * emphasis, y);
    });
  });
  ctx.restore();
  blur(ctx, 0);
}

/** Khung dọc: một câu chữ lớn, câu cũ mờ dần trôi lên nhường chỗ cho câu mới. */
function drawSingleLyric(ctx: CanvasRenderingContext2D, scene: Scene, metrics: Metrics, index: number) {
  const layers = singleLyricLayers(ctx, scene, index);
  const { scale, lyricX, lyricWidth, lyricTop, lyricHeight, family } = metrics;
  const size = mobile.lyricSize * scale;
  const lineHeight = size * mobile.lyricLine;
  const slide = size * .5;
  ctx.textAlign = "left";
  ctx.save();
  ctx.beginPath(); ctx.roundRect(lyricX, lyricTop, lyricWidth, lyricHeight, 0); ctx.clip();
  const draw = (text: string, weight: number, alpha: number, shift: number) => {
    if (!text || alpha <= .01) return;
    font(ctx, family, weight, size, mobile.lyricTracking * scale);
    ctx.fillStyle = white(alpha);
    const wrapped = wrapText(ctx, text, lyricWidth, 4);
    const top = lyricTop + (lyricHeight - wrapped.length * lineHeight) / 2 + shift;
    wrapped.forEach((line, i) => ctx.fillText(line, lyricX, top + i * lineHeight));
  };
  layers.forEach(layer => draw(scene.lyrics[layer.index]?.text || "♪", 750, layer.alpha, slide * layer.shift));
  ctx.restore();
}

export function renderScene(ctx: CanvasRenderingContext2D, scene: Scene) {
  // Layout uses logical pixels; increasing export resolution also increases the artwork
  // and text detail without creating a larger empty border around a 480px player.
  const [width, height] = scene.settings.aspectRatio === "4:3" ? [1440, 1080] : [1080, 1920];
  ctx.save();
  ctx.scale(ctx.canvas.width / width, ctx.canvas.height / height);
  blur(ctx, 0);
  drawCachedBackdrop(ctx, width, height);
  const metrics = measure(ctx, scene, width, height);
  const { scale, art, artX, playerTop, family } = metrics;
  const base = metrics.wide ? desktop : mobile;

  drawVisual(ctx, scene, artX, playerTop, art);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const titleY = playerTop + art + base.songInfoTop * scale;
  const titleSize = base.titleSize * scale;
  font(ctx, family, 650, titleSize, base.titleTracking * scale);
  ctx.fillStyle = colors.title;
  const titleLines = wrapText(ctx, scene.title || "Một khoảng lặng", art, 2);
  titleLines.forEach((line, i) => ctx.fillText(line, artX, titleY + i * titleSize * base.titleLine));

  const artistY = titleY + titleLines.length * titleSize * base.titleLine + base.artistTop * scale;
  const artistSize = base.artistSize * scale;
  font(ctx, family, "", artistSize, 0);
  ctx.fillStyle = colors.artist;
  ctx.fillText(wrapText(ctx, scene.artist || "Âm thanh của bạn", art, 1)[0] ?? "", artX, artistY);

  const barY = artistY + artistSize * base.artistLine + base.progressTop * scale;
  const barHeight = base.barHeight * scale;
  if (scene.settings.showProgress) {
    const fraction = Number.isFinite(scene.duration) && scene.duration > 0 ? Math.min(1, Math.max(0, scene.currentTime / scene.duration)) : 0;
    ctx.fillStyle = colors.barTrack;
    ctx.beginPath(); ctx.roundRect(artX, barY, art, barHeight, barHeight / 2); ctx.fill();
    ctx.fillStyle = colors.barFill;
    ctx.beginPath(); ctx.roundRect(artX, barY, art * fraction, barHeight, barHeight / 2); ctx.fill();
    // Chấm tròn của thanh tua, giống ::-webkit-slider-thumb.
    ctx.beginPath(); ctx.arc(artX + art * fraction, barY + barHeight / 2, 3.5 * scale, 0, Math.PI * 2); ctx.fill();
  }
  if (scene.settings.showControls) drawControls(ctx, scene, metrics, artX, barY + barHeight + base.timeTop * scale);

  if (scene.settings.showLyrics) {
    const timed = scene.lyrics.some(line => line.time !== null);
    const index = timed ? activeLyricIndex(scene.lyrics, scene.currentTime) : scene.manualLyricIndex;
    if (metrics.wide) drawLyricStack(ctx, scene, metrics, index);
    else drawSingleLyric(ctx, scene, metrics, index);
  }
  ctx.restore();
}
