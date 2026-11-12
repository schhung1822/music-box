const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource, browserFakes, fakeContext } = require("./helpers.cjs");

const lyrics = ["Câu một", "Câu hai", "Câu ba", "Câu bốn", "Câu năm"].map((text, i) => ({ id: String(i), time: i * 10, text }));
const sceneAt = (currentTime, extra = {}) => ({
  title: "Tên bài", artist: "Nghệ sĩ", manualLyricIndex: 0, duration: 100, currentTime, video: null, cover: null,
  reducedMotion: true, lyrics, variant: "card", ...extra,
  settings: { visualMode: "video", showLyrics: true, showProgress: true, showControls: true, aspectRatio: "9:16", clipDuration: 30, ...extra.settings },
});
const texts = ctx => ctx.calls.filter(call => call.name === "fillText");

test("Card layout: controls and lyrics only take room when shown, and the card always fits the frame", () => {
  const { card, cardOffsets, cardRecordingScale } = loadSource("utils/cardLayout.ts");
  const bare = cardOffsets({ progress: true, controls: false, lyrics: true });
  const full = cardOffsets({ progress: true, controls: true, lyrics: true });
  assert.ok(full.height > bare.height && full.lyrics > bare.lyrics);
  assert.ok(cardOffsets({ progress: false, controls: false, lyrics: false }).height < bare.height);
  assert.equal(bare.art, card.pad);
  const scale = cardRecordingScale({ showProgress: true, showLyrics: true });
  assert.ok(card.width * scale <= 1080 && bare.height * scale <= 1920, "card fits the 9:16 frame");
});

test("Card recording shows the current and the next lyric only, and no control buttons", () => {
  const env = browserFakes();
  try {
    const { renderCardScene } = loadSource("utils/renderCard.ts");
    const ctx = fakeContext({ width: 1080, height: 1920 });
    ctx.measureText = text => ({ width: Array.from(text).length * 8 });
    renderCardScene(ctx, sceneAt(20));
    const drawn = texts(ctx);
    const lyricFills = Object.fromEntries(drawn.filter(call => call.text.startsWith("Câu")).map(call => [call.text, call.fill]));
    assert.equal(lyricFills["Câu ba"], "rgba(255, 255, 255, 1)");
    assert.match(lyricFills["Câu bốn"], /^rgba\(255, 255, 255, 0\.4\d*\)$/);
    assert.deepEqual(Object.keys(lyricFills).sort(), ["Câu ba", "Câu bốn"], "earlier and later lines are hidden");
    assert.ok(drawn.some(call => call.text === "Tên bài") && drawn.some(call => call.text === "Nghệ sĩ"));
    assert.ok(drawn.some(call => call.text === "0:20") && drawn.some(call => call.text === "-1:20"), "elapsed and remaining time");
    assert.equal(drawn.some(call => call.text === "10"), false, "no skip-10s icon labels");
  } finally { env.restore(); }
});

test("Card recording is always 9:16 and shows the default thumbnail until a video or cover exists", () => {
  const env = browserFakes();
  try {
    const { renderCardScene } = loadSource("utils/renderCard.ts");
    const thumbnail = { naturalWidth: 700, naturalHeight: 650 };
    const ctx = fakeContext({ width: 1080, height: 1920 });
    ctx.measureText = text => ({ width: Array.from(text).length * 8 });
    renderCardScene(ctx, sceneAt(20, { placeholder: thumbnail, settings: { aspectRatio: "4:3" } }));
    assert.ok(ctx.calls.some(call => call.name === "scale" && call.args[0] === 1 && call.args[1] === 1), "4:3 setting is ignored");
    assert.ok(ctx.calls.some(call => call.name === "drawImage" && call.args[0] === thumbnail), "thumbnail is drawn in the square");
    const cover = { naturalWidth: 500, naturalHeight: 500 };
    const covered = fakeContext({ width: 1080, height: 1920 });
    covered.measureText = ctx.measureText;
    renderCardScene(covered, sceneAt(20, { placeholder: thumbnail, cover }));
    assert.ok(covered.calls.some(call => call.name === "drawImage" && call.args[0] === cover));
    assert.equal(covered.calls.some(call => call.name === "drawImage" && call.args[0] === thumbnail), false);
  } finally { env.restore(); }
});

test("Card recording drops the progress bar and lyrics when they are switched off", () => {
  const env = browserFakes();
  try {
    const { renderCardScene } = loadSource("utils/renderCard.ts");
    const ctx = fakeContext({ width: 1080, height: 1920 });
    ctx.measureText = text => ({ width: Array.from(text).length * 8 });
    renderCardScene(ctx, sceneAt(20, { settings: { showLyrics: false, showProgress: false } }));
    const drawn = texts(ctx).map(call => call.text);
    assert.deepEqual(drawn, ["Tên bài", "Nghệ sĩ", "@Hunq.lofi"]);
  } finally { env.restore(); }
});

test("Card recording scales its text with the export resolution and stays inside the frame", () => {
  const env = browserFakes();
  try {
    const { renderCardScene } = loadSource("utils/renderCard.ts");
    const [w, h] = [1080, 1920];
    const ctx = fakeContext({ width: w * 2, height: h * 2 });
    ctx.measureText = text => ({ width: Array.from(text).length * 8 });
    renderCardScene(ctx, sceneAt(20, { title: "Một tên bài rất dài ".repeat(8) }));
    assert.ok(ctx.calls.some(call => call.name === "scale" && call.args[0] === 2 && call.args[1] === 2));
    for (const call of texts(ctx)) { assert.ok(call.x >= 0 && call.x <= w); assert.ok(call.y >= 0 && call.y <= h); }
  } finally { env.restore(); }
});

test("Card recordings are always 1080x1920 and compressed, whatever the source video resolution", () => {
  const { getRecordingQuality } = loadSource("utils/recordingQuality.ts");
  const settings = { visualMode: "video", aspectRatio: "4:3", showLyrics: true, showProgress: true, videoZoom: 1 };
  const base = getRecordingQuality(settings, null, "card");
  assert.deepEqual([base.width, base.height], [1080, 1920]);
  for (const video of [{ videoWidth: 1920, videoHeight: 1080 }, { videoWidth: 7680, videoHeight: 4320 }, { videoWidth: 640, videoHeight: 360 }]) {
    const quality = getRecordingQuality(settings, video, "card");
    assert.deepEqual([quality.width, quality.height], [1080, 1920], "ignores a stored 4:3 ratio and the source resolution");
    assert.deepEqual([quality.videoBitsPerSecond, quality.audioBitsPerSecond], [base.videoBitsPerSecond, base.audioBitsPerSecond]);
  }
  const classic = getRecordingQuality({ ...settings, aspectRatio: "9:16" }, { videoWidth: 1920, videoHeight: 1080 });
  assert.ok(base.videoBitsPerSecond <= 10_000_000 && base.videoBitsPerSecond < classic.videoBitsPerSecond / 2, "much lighter than the classic export");
});

test("formatRemaining shows what is left, or a placeholder while the length is unknown", () => {
  const { formatRemaining } = loadSource("utils/media.ts");
  assert.equal(formatRemaining(8, 300), "-4:52");
  assert.equal(formatRemaining(400, 300), "-0:00");
  assert.equal(formatRemaining(8, 0), "--:--");
  assert.equal(formatRemaining(8, Infinity), "--:--");
});

test("Card recording fills the frame like the phone view: nearly full width, centred, inside the frame", () => {
  const { card, cardOffsets, cardRecordingPlacement } = loadSource("utils/cardLayout.ts");
  const { scale, x, y } = cardRecordingPlacement({ showProgress: true, showLyrics: true });
  const layout = cardOffsets({ progress: true, controls: false, lyrics: true });
  assert.ok(card.width * scale >= 1080 * .85, "card spans most of the width");
  assert.ok(Math.abs(x - (1080 - card.width * scale) / 2) < 1e-6, "horizontally centred");
  assert.ok(y >= 1920 * .04 && y + layout.height * scale <= 1920 * .96, "vertical margins kept");
  assert.ok(Math.abs(y - (1920 - layout.height * scale) / 2) < 1, "vertically centred");
});

test("A long main lyric is shown in full over up to three lines", () => {
  const env = browserFakes();
  try {
    const { renderCardScene } = loadSource("utils/renderCard.ts");
    const words = n => Array.from({ length: n }, (_, i) => `từ${i % 10}`).join(" ");
    const draw = text => {
      const ctx = fakeContext({ width: 1080, height: 1920 });
      ctx.measureText = value => ({ width: Array.from(value).length * 18 });
      renderCardScene(ctx, sceneAt(5, { lyrics: [{ id: "a", time: 0, text }, { id: "b", time: 20, text: "Câu sau" }] }));
      return texts(ctx).filter(call => call.text.includes("từ")).map(call => call.text);
    };
    const full = words(19);
    const lines = draw(full);
    assert.equal(lines.join(" "), full, "no word is lost");
    assert.ok(lines.length >= 2 && lines.length <= 3);
    assert.ok(draw(words(60)).at(-1).endsWith("…"), "only an absurdly long line is cut");
  } finally { env.restore(); }
});

test("Lyric fitting shrinks only the lines that need it, and drawing never loses a word of a long main lyric", () => {
  const { fitLyricScale, lyricFitSteps } = loadSource("utils/lyricFit.ts");
  const width = (text, k) => Array.from(text).length * 10 * k;
  assert.equal(fitLyricScale(width, "ngắn", 312), 1);
  const long = "x".repeat(10).repeat(1) + (" abcdefghi").repeat(9);
  const k = fitLyricScale(width, long, 312);
  assert.ok(k < 1 && k >= lyricFitSteps.at(-1));
  assert.equal(fitLyricScale(width, (" abcdefghi").repeat(60), 312), lyricFitSteps.at(-1));
  const env = browserFakes();
  try {
    const { renderCardScene } = loadSource("utils/renderCard.ts");
    const text = (" từ" + "a".repeat(5)).repeat(10).trim();
    const ctx = fakeContext({ width: 1080, height: 1920 });
    ctx.measureText = value => ({ width: Array.from(value).length * Number(ctx.font.match(/(\d+(?:\.\d+)?)px/)[1]) * .55 });
    renderCardScene(ctx, sceneAt(5, { lyrics: [{ id: "a", time: 0, text }, { id: "b", time: 20, text: "Câu sau" }] }));
    const drawn = texts(ctx).filter(call => call.text.includes("từ"));
    assert.equal(drawn.map(call => call.text).join(" "), text, "the whole sentence is drawn, no ellipsis");
    assert.ok(drawn.length <= 3);
  } finally { env.restore(); }
});

test("The source credit is signed at the bottom of the card, centred, in bold italic sans", () => {
  const env = browserFakes();
  try {
    const { renderCardScene } = loadSource("utils/renderCard.ts");
    const { cardCredit, cardOffsets, cardRecordingPlacement } = loadSource("utils/cardLayout.ts");
    assert.equal(cardCredit, "@Hunq.lofi");
    const ctx = fakeContext({ width: 1080, height: 1920 });
    ctx.measureText = text => ({ width: Array.from(text).length * 8 });
    ctx.textAlign = "left";
    renderCardScene(ctx, sceneAt(20));
    const credit = texts(ctx).find(call => call.text === cardCredit);
    assert.ok(credit && /^italic 700 /.test(credit.font), credit && credit.font);
    const { scale, y, x } = cardRecordingPlacement({ showProgress: true, showLyrics: true });
    const layout = cardOffsets({ progress: true, controls: false, lyrics: true });
    assert.ok(Math.abs(credit.x - (x + 180 * scale)) < 1, "centred on the card");
    assert.ok(credit.y > y + layout.lyrics * scale && credit.y < y + layout.height * scale, "below the lyrics, inside the card");
    assert.ok(y + layout.height * scale <= 1920, "card stays inside the frame");
  } finally { env.restore(); }
});

test("Lyric spring: starts gently, never overshoots, keeps its speed when retargeted, and ignores frame rate", () => {
  const { springStep, createLyricSpring, lyricSpringOmega, lyricSpringRate } = loadSource("utils/lyricSpring.ts");
  // Từ trạng thái nghỉ: không bật ngay với tốc độ lớn nhất như easing cố định.
  let [value, velocity] = [0, 0];
  const steps = [];
  for (let i = 0; i < 40; i++) {
    const next = springStep(value, velocity, 1, 1 / 60, lyricSpringRate);
    steps.push(next[0] - value);
    [value, velocity] = next;
    assert.ok(value <= 1 + 1e-9, "never passes the target");
  }
  assert.ok(steps[0] < steps[3], "accelerates from rest");
  assert.ok(value > .98, "nearly there after two thirds of a second");
  // Đúng theo thời gian thật dù khung hình thưa hay dày.
  const at = (frames, fps) => { let s = [0, 0]; for (let i = 0; i < frames; i++) s = springStep(s[0], s[1], 1, 1 / fps, lyricSpringRate); return s[0]; };
  assert.ok(Math.abs(at(60, 60) - at(15, 15)) < 1e-9 && Math.abs(at(60, 60) - at(2, 2)) < 1e-9);
  // Đổi đích giữa chừng thì vị trí và vận tốc nối liền, không khựng rồi chạy lại.
  const spring = createLyricSpring(0);
  const travel = () => 40;
  const trace = [];
  spring.update(1, 0, travel);
  for (let t = 16; t <= 600; t += 16) trace.push(spring.update(t < 160 ? 1 : 2, t, travel));
  const deltas = trace.slice(1).map((p, i) => p - trace[i]);
  const retarget = 160 / 16 - 1;
  assert.ok(deltas[retarget] > deltas[retarget - 1] * .5, "keeps moving through the new target");
  assert.ok(deltas.every(d => d >= -1e-9), "monotonic");
  assert.ok(Math.abs(trace.at(-1) - 2) < .02 && spring.update(2, 5000, travel) === 2 && spring.settled);
  // Câu trước càng cao thì chạy càng chậm, nhưng không quá 1,5 lần.
  assert.equal(lyricSpringOmega(30), lyricSpringRate);
  assert.ok(lyricSpringOmega(110) < lyricSpringOmega(60));
  assert.ok(Math.abs(lyricSpringOmega(5000) - lyricSpringRate / 1.5) < 1e-9);
});

test("Card lyrics glide from rest and a tall previous lyric travels more slowly, with no jump on the first frame", () => {
  const env = browserFakes();
  try {
    const { renderCardScene } = loadSource("utils/renderCard.ts");
    const words = n => Array.from({ length: n }, (_, i) => `từ${i % 10}`).join(" ");
    const track = previous => {
      const lyrics = [{ id: "a", time: 0, text: previous }, { id: "b", time: 10, text: "Câu hai" }, { id: "c", time: 20, text: "Câu ba" }];
      const ctx = fakeContext({ width: 1080, height: 1920 });
      ctx.measureText = value => ({ width: Array.from(value).length * 18 });
      const ys = [];
      for (let frame = 0; frame < 90; frame++) {
        ctx.calls.length = 0;
        const currentTime = frame === 0 ? 9.9 : 10 + (frame - 1) * .016;
        renderCardScene(ctx, sceneAt(currentTime, { lyrics, animationTime: frame * 16, reducedMotion: false }));
        ys.push(texts(ctx).find(call => call.text === "Câu hai").y);
      }
      return ys;
    };
    const short = track("Câu một"), tall = track(words(19));
    for (const ys of [short, tall]) {
      assert.ok(ys.slice(1).every((y, i) => y <= ys[i] + 1e-6), "the incoming line only moves up");
      const moves = ys.slice(1).map((y, i) => ys[i] - y);
      assert.equal(moves[0], 0, "no jump on the frame the new lyric starts");
      assert.ok(moves[1] > 0 && moves[1] < moves[5] / 2, "first frames are gentle, then it speeds up");
    }
    const settledAt = ys => ys.findIndex((y, i) => i > 2 && Math.abs(y - ys.at(-1)) < .5);
    assert.ok(settledAt(tall) > settledAt(short), "a tall lyric takes longer to slide away");
  } finally { env.restore(); }
});

test("The static card layer (backdrop, glass, shadow, title, credit) is painted once and reused every frame", () => {
  const env = browserFakes();
  const had = Object.prototype.hasOwnProperty.call(globalThis, "OffscreenCanvas");
  const previous = globalThis.OffscreenCanvas;
  const layers = [];
  globalThis.OffscreenCanvas = class { constructor(width, height) { this.width = width; this.height = height; this.context = fakeContext(this); layers.push(this); } getContext() { return this.context; } };
  try {
    const { renderCardScene } = loadSource("utils/renderCard.ts");
    const ctx = fakeContext({ width: 1080, height: 1920 });
    ctx.measureText = text => ({ width: Array.from(text).length * 8 });
    for (let i = 0; i < 12; i++) { ctx.calls.length = 0; renderCardScene(ctx, sceneAt(20 + i * .1, { animationTime: i * 16 })); }
    const drawn = texts(ctx).map(call => call.text);
    assert.equal(layers.length, 1, "one layer for the whole run");
    assert.ok(!drawn.includes("Tên bài") && !drawn.includes("@Hunq.lofi"), "title and credit are not redrawn on the frame");
    assert.ok(drawn.includes("0:22") || drawn.some(text => /^\d:\d\d$/.test(text)), "time labels still change every frame");
    assert.ok(ctx.calls.some(call => call.name === "drawImage" && call.args[0] === layers[0]));
    const onLayer = texts(layers[0].context).map(call => call.text);
    assert.deepEqual(onLayer, ["Tên bài", "Nghệ sĩ", "@Hunq.lofi"]);
    renderCardScene(ctx, sceneAt(20, { animationTime: 999, title: "Tên khác" }));
    assert.equal(layers.length, 2, "a new title rebuilds the layer");
  } finally { if (had) globalThis.OffscreenCanvas = previous; else delete globalThis.OffscreenCanvas; env.restore(); }
});

test("Classic lyrics use the same spring: landscape stack glides from rest, portrait crossfade eases in", () => {
  const env = browserFakes();
  try {
    const { renderScene } = loadSource("utils/renderScene.ts");
    const { lyricGlideEase } = loadSource("utils/lyricSpring.ts");
    assert.equal(lyricGlideEase(0), 0);
    assert.equal(lyricGlideEase(1), 1);
    assert.ok(lyricGlideEase(.05) < .08 && lyricGlideEase(.5) > .85, "starts softly, then settles quickly");
    const words = n => Array.from({ length: n }, (_, i) => `từ${i % 10}`).join(" ");
    const track = (previous, ratio, size) => {
      const lyrics = [{ id: "a", time: 0, text: previous }, { id: "b", time: 10, text: "Câu hai" }, { id: "c", time: 20, text: "Câu ba" }];
      const ctx = fakeContext(size);
      ctx.measureText = value => ({ width: Array.from(value).length * 18 });
      const ys = [];
      for (let frame = 0; frame < 90; frame++) {
        ctx.calls.length = 0;
        const currentTime = frame === 0 ? 9.9 : 10 + (frame - 1) * .016;
        renderScene(ctx, { ...sceneAt(currentTime, { lyrics, animationTime: frame * 16, reducedMotion: false }), variant: "classic", settings: { visualMode: "video", showLyrics: true, showProgress: true, showControls: true, aspectRatio: ratio, clipDuration: 30 } });
        const call = texts(ctx).find(item => item.text === "Câu hai");
        ys.push(call ? call.y : NaN);
      }
      return ys;
    };
    const short = track("Câu một", "4:3", { width: 1440, height: 1080 });
    const tall = track(words(12), "4:3", { width: 1440, height: 1080 });
    for (const ys of [short, tall]) {
      assert.ok(ys.every(Number.isFinite));
      assert.ok(ys.slice(1).every((y, i) => y <= ys[i] + 1e-6), "the incoming line only moves up");
      const moves = ys.slice(1).map((y, i) => ys[i] - y);
      assert.equal(moves[0], 0, "no jump on the frame the new lyric starts");
      assert.ok(moves[1] > 0 && moves[1] < moves[5] / 2, "starts gently, then speeds up");
    }
    const settledAt = ys => ys.findIndex((y, i) => i > 2 && Math.abs(y - ys.at(-1)) < .5);
    assert.ok(settledAt(tall) > settledAt(short), "a tall lyric takes longer to slide away");
  } finally { env.restore(); }
});
