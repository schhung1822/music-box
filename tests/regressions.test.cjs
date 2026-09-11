const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource, hookHarness, browserFakes, FakeMedia, FakeVideo } = require("./helpers.cjs");

const { parseLyrics, formatLyricsDraft, serializeLrc } = loadSource("utils/lyrics.ts");
const { validateMediaFile } = loadSource("utils/media.ts");

const pairs = lines => lines.map(({ time, text }) => ({ time, text }));

test("Pasted lyrics keep the timestamps they already carry", () => {
  // Dạng hay gặp nhất khi chép lời từ các trang nhạc: mốc LRC nằm ngay trước câu hát.
  assert.deepEqual(pairs(parseLyrics("[00:16.64] Em, ngày em đánh rơi nụ cười vào anh\n[00:22.81] Có nghĩ sau này em sẽ chờ")), [
    { time: 16.64, text: "Em, ngày em đánh rơi nụ cười vào anh" },
    { time: 22.81, text: "Có nghĩ sau này em sẽ chờ" },
  ]);
  // Không có khoảng trắng, có ngoặc nhọn của LRC nâng cao, và có cả dạng giờ:phút:giây.
  assert.deepEqual(pairs(parseLyrics("[00:05.10]Một\n<00:09>Hai\n[00:01:02.50]Ba")), [
    { time: 5.1, text: "Một" }, { time: 9, text: "Hai" }, { time: 62.5, text: "Ba" },
  ]);
  // Mốc trần và mốc đứng riêng một dòng, kiểu bản chép lời.
  assert.deepEqual(pairs(parseLyrics("0:16 Một\n1:05 Hai")), [{ time: 16, text: "Một" }, { time: 65, text: "Hai" }]);
  assert.deepEqual(pairs(parseLyrics("0:16\nMột\n0:22\nHai")), [{ time: 16, text: "Một" }, { time: 22, text: "Hai" }]);
  // Mốc dán lộn xộn được xếp lại theo thời gian.
  assert.deepEqual(parseLyrics("[00:30.00]Ba\n[00:10.00]Một\n[00:20.00]Hai").map(line => line.text), ["Một", "Hai", "Ba"]);
});

test("Lyrics without usable timestamps stay plain instead of being mangled", () => {
  assert.deepEqual(pairs(parseLyrics("Dòng một\nDòng hai")), [{ time: null, text: "Dòng một" }, { time: null, text: "Dòng hai" }]);
  // Một con số kiểu "24:7" trong lời hát không được hiểu nhầm thành mốc thời gian.
  assert.deepEqual(pairs(parseLyrics("I think 24:7 of you\nAnother line\nThird line")),
    [{ time: null, text: "I think 24:7 of you" }, { time: null, text: "Another line" }, { time: null, text: "Third line" }]);
  // Trộn câu có mốc và câu chưa có mốc thì giữ lại cả hai, đúng thứ tự đã dán.
  assert.deepEqual(pairs(parseLyrics("[00:10.00]Có mốc\nChưa có mốc\n[00:20.00]Có mốc nữa")),
    [{ time: 10, text: "Có mốc" }, { time: null, text: "Chưa có mốc" }, { time: 20, text: "Có mốc nữa" }]);
  assert.deepEqual(parseLyrics(""), []);
  assert.deepEqual(parseLyrics("   \n\n  "), []);
});

test("Lyrics survive a full round trip through the editor box", () => {
  const lines = parseLyrics("[00:02.10]First\nUntimed\n[01:00.00]Later");
  const draft = formatLyricsDraft(lines);
  assert.equal(draft, "[00:02.10]First\nUntimed\n[01:00.00]Later");
  assert.deepEqual(pairs(parseLyrics(draft)), pairs(lines));
  assert.equal(serializeLrc(lines), "[00:02.10]First\n[01:00.00]Later");
});

test("Everyday video and audio formats are accepted, wrong slots still rejected", () => {
  // Các đuôi tệp thường gặp trên máy người dùng, kể cả khi Windows không gán kiểu MIME.
  for (const [name, type] of [["clip.mov", "video/quicktime"], ["clip.mkv", ""], ["clip.avi", "video/x-msvideo"], ["clip.m4v", ""], ["clip.MP4", "video/mp4"]]) {
    assert.equal(validateMediaFile({ name, size: 10, type }, "video"), null, name);
  }
  // ".m4a" hay bị Windows khai báo là "video/mp4"; đuôi tệp phải được tin trước.
  for (const [name, type] of [["song.m4a", "video/mp4"], ["song.opus", "audio/ogg"], ["song.flac", ""], ["song.wma", "audio/x-ms-wma"], ["song.aiff", ""]]) {
    assert.equal(validateMediaFile({ name, size: 10, type }, "audio"), null, name);
  }
  for (const [name, type] of [["art.heic", "image/heic"], ["art.gif", "image/gif"], ["art.avif", ""]]) {
    assert.equal(validateMediaFile({ name, size: 10, type }, "cover"), null, name);
  }
  // Vẫn chặn chọn nhầm ô, tệp rỗng và đuôi lạ mạo danh kiểu MIME của ảnh.
  assert.ok(validateMediaFile({ name: "song.mp3", size: 10, type: "audio/mpeg" }, "cover"));
  assert.ok(validateMediaFile({ name: "clip.mp4", size: 10, type: "video/mp4" }, "audio"));
  assert.ok(validateMediaFile({ name: "clip.mov", size: 0, type: "video/quicktime" }, "video"));
  assert.ok(validateMediaFile({ name: "payload.exe", size: 10, type: "image/jpeg" }, "cover"));
  // Tệp không có đuôi vẫn dùng được nếu kiểu MIME đúng nhóm.
  assert.equal(validateMediaFile({ name: "recording", size: 10, type: "video/webm" }, "video"), null);
});

test("Media that never reports a duration still plays and seeks", async () => {
  const env = browserFakes();
  const harness = hookHarness();
  try {
    const { useMediaPlayer } = loadSource("hooks/useMediaPlayer.ts", harness.react);
    let player = harness.start(() => useMediaPlayer(undefined, "blob:video", true, .8, false));
    const video = new FakeVideo();
    // WebM do trình duyệt ghi ra, MP4 phân mảnh và MP3 biến tốc đều báo duration là Infinity.
    video.duration = Infinity;
    video.seekableEnd = Infinity;
    video.bufferedEnd = 8;
    player.videoRef.current = video;
    player.audioRef.current = new FakeMedia();
    harness.flush(); env.advance(); player = harness.render();

    assert.equal(player.ready, true, "tệp đã đọc được siêu dữ liệu thì phải bấm phát được");
    assert.equal(player.duration, 0, "chưa biết tổng thời lượng");
    assert.equal(player.seekableEnd, 8, "vẫn tua được trong phần đã tải về");
    assert.equal(await player.play(), true);
    assert.equal(video.paused, false);
    player.seek(3); assert.equal(video.currentTime, 3);
    player.seek(999); assert.equal(video.currentTime, 8);
    player.seek(-5); assert.equal(video.currentTime, 0);
  } finally { harness.unmount(); env.restore(); }
});

test("Recording accepts media that never reports a duration", async () => {
  const env = browserFakes();
  const harness = hookHarness();
  try {
    const { useRecorder } = loadSource("hooks/useRecorder.ts", harness.react);
    let recorder = harness.start(() => useRecorder()); harness.flush();
    const element = new FakeMedia();
    element.duration = Infinity;
    await recorder.start({
      element, title: "Song", artist: "Artist", lyrics: [{ id: "1", time: 0, text: "Line" }], manualLyricIndex: 0,
      settings: { visualMode: "disc", showLyrics: true, showProgress: true, aspectRatio: "9:16", videoFormat: "mp4", clipDuration: 15 },
      video: null, cover: null, play: async () => { await element.play(); return true; }, pause: () => element.pause(),
    });
    recorder = harness.render();
    assert.equal(recorder.error, "", "không được từ chối vì thiếu tổng thời lượng");
    assert.equal(recorder.status, "recording");
    recorder.stop(); await Promise.resolve(); recorder = harness.render();
    assert.equal(recorder.status, "idle");
    assert.ok(recorder.result.url);
  } finally { harness.unmount(); env.restore(); }
});

test("A media element with no source stays unready", () => {
  const env = browserFakes();
  const harness = hookHarness();
  try {
    const { useMediaPlayer } = loadSource("hooks/useMediaPlayer.ts", harness.react);
    let player = harness.start(() => useMediaPlayer(undefined, undefined, true, .8, false));
    player.videoRef.current = new FakeVideo();
    player.audioRef.current = new FakeMedia();
    harness.flush(); env.advance(); player = harness.render();
    assert.equal(player.ready, false);
    assert.equal(player.getElement(), null);
  } finally { harness.unmount(); env.restore(); }
});

const { shiftLyrics } = loadSource("utils/lyrics.ts");
const { buildSearchUrl, rankMatches, searchLyrics } = loadSource("utils/lrclib.ts");
const { fakeContext } = require("./helpers.cjs");

test("Quick offset shifts every timestamp and leaves untimed lines alone", () => {
  const lines = [{ id: "a", time: 10, text: "A" }, { id: "b", time: null, text: "B" }, { id: "c", time: .3, text: "C" }];
  assert.deepEqual(shiftLyrics(lines, .5).map(line => line.time), [10.5, null, .8]);
  // Mốc bị đẩy xuống dưới 0 được giữ ở 0 thay vì thành số âm.
  assert.deepEqual(shiftLyrics(lines, -1).map(line => line.time), [9, null, 0]);
  assert.equal(shiftLyrics(lines, 0), lines);
  assert.deepEqual(lines.map(line => line.time), [10, null, .3]);
  // Bước mili giây không để lại sai số dấu phẩy động trong ô "Giây".
  assert.deepEqual(shiftLyrics([{ id: "x", time: 16.64, text: "X" }], .25).map(line => line.time), [16.89]);
  assert.deepEqual(shiftLyrics([{ id: "x", time: 16.64, text: "X" }], -.1).map(line => line.time), [16.54]);
});

test("LRCLIB queries are encoded and results ranked against the loaded track", () => {
  assert.equal(buildSearchUrl("Hello", "Adele"), "https://lrclib.net/api/search?track_name=Hello&artist_name=Adele");
  assert.equal(buildSearchUrl("Hello", "  "), "https://lrclib.net/api/search?q=Hello");
  assert.equal(buildSearchUrl("", "Adele"), "https://lrclib.net/api/search?q=Adele");
  // Dấu tiếng Việt và ký tự đặc biệt được mã hóa, không ghép thẳng vào URL.
  assert.equal(buildSearchUrl("Nắng & mưa", ""), "https://lrclib.net/api/search?q=N%E1%BA%AFng+%26+m%C6%B0a");

  const matches = [
    { id: 1, duration: 200, syncedLyrics: "", plainLyrics: "x" },
    { id: 2, duration: 301, syncedLyrics: "[00:01.00]x", plainLyrics: "x" },
    { id: 3, duration: 295, syncedLyrics: "[00:01.00]x", plainLyrics: "x" },
  ];
  // Bản có mốc lên trước, rồi tới bản có độ dài gần bài đang phát nhất.
  assert.deepEqual(rankMatches(matches, 296).map(match => match.id), [3, 2, 1]);
  assert.deepEqual(rankMatches(matches, 0).map(match => match.id), [2, 3, 1]);
  assert.deepEqual(matches.map(match => match.id), [1, 2, 3]);
});

test("LRCLIB problems turn into messages instead of crashes", async () => {
  const original = globalThis.fetch;
  try {
    await assert.rejects(() => searchLyrics("  ", " "), /Hãy nhập/);
    globalThis.fetch = async () => ({ ok: false, status: 429 });
    await assert.rejects(() => searchLyrics("a", ""), /giới hạn/);
    globalThis.fetch = async () => ({ ok: false, status: 500 });
    await assert.rejects(() => searchLyrics("a", ""), /thử lại sau/);
    globalThis.fetch = async () => { throw new TypeError("network down"); };
    await assert.rejects(() => searchLyrics("a", ""), /Không kết nối/);
    // Không có bản nào khớp thì trả danh sách rỗng, không phải lỗi.
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    assert.deepEqual(await searchLyrics("a", ""), []);
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ unexpected: true }) });
    assert.deepEqual(await searchLyrics("a", ""), []);
    // Phần tử hỏng bị bỏ qua, phần tử hợp lệ vẫn dùng được với giá trị mặc định an toàn.
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => [null, { id: "x" }, { id: 7, trackName: "T", duration: "bad" }] });
    const results = await searchLyrics("a", "");
    assert.equal(results.length, 1);
    assert.deepEqual([results[0].id, results[0].duration, results[0].syncedLyrics, results[0].artistName], [7, 0, "", ""]);
  } finally { globalThis.fetch = original; }
});

test("Portrait recordings show one lyric, 4:3 recordings show the desktop-style stack", () => {
  const env = browserFakes();
  try {
    const { renderScene } = loadSource("utils/renderScene.ts");
    const { outputDimensions } = loadSource("types/studio.ts");
    const lyrics = ["Câu một", "Câu hai", "Câu ba", "Câu bốn", "Câu năm"].map((text, i) => ({ id: String(i), time: i * 10, text }));
    const base = {
      title: "Bài hát", artist: "Nghệ sĩ", lyrics, manualLyricIndex: 0,
      settings: { visualMode: "disc", showLyrics: true, showProgress: true, clipDuration: 30 },
      currentTime: 20, duration: 100, video: null, cover: null, reducedMotion: true,
    };
    const lyricCalls = ctx => ctx.calls.filter(call => call.name === "fillText" && call.text.startsWith("Câu"));

    const [pw, ph] = outputDimensions["9:16"];
    const portrait = fakeContext({ width: pw, height: ph });
    renderScene(portrait, { ...base, settings: { ...base.settings, aspectRatio: "9:16" } });
    assert.deepEqual([...new Set(lyricCalls(portrait).map(call => call.text))], ["Câu ba"]);

    const [lw, lh] = outputDimensions["4:3"];
    const wide = fakeContext({ width: lw, height: lh });
    renderScene(wide, { ...base, settings: { ...base.settings, aspectRatio: "4:3" } });
    const drawn = lyricCalls(wide);
    const texts = [...new Set(drawn.map(call => call.text))];
    assert.deepEqual(texts, ["Câu một", "Câu hai", "Câu ba", "Câu bốn", "Câu năm"]);
    // Câu đang hát rõ nhất, các câu quanh nó mờ dần đúng như vùng lời trên giao diện.
    const fillOf = text => drawn.find(call => call.text === text).fill;
    assert.equal(fillOf("Câu ba"), "rgba(255, 255, 255, 1)");
    assert.equal(fillOf("Câu hai"), "rgba(255, 255, 255, 0.4)");
    assert.equal(fillOf("Câu bốn"), "rgba(255, 255, 255, 0.4)");
    assert.equal(fillOf("Câu một"), "rgba(255, 255, 255, 0.2)");
    const ys = texts.map(text => drawn.find(call => call.text === text).y);
    assert.deepEqual(ys, [...ys].sort((a, b) => a - b));
    // Cả khối lời nằm gọn trong khung, kể cả khi câu rất dài.
    const long = { ...base, settings: { ...base.settings, aspectRatio: "4:3" }, lyrics: lyrics.map(line => ({ ...line, text: "Một câu rất dài ".repeat(20) })) };
    const crowded = fakeContext({ width: lw, height: lh });
    renderScene(crowded, long);
    crowded.calls.filter(call => call.name === "fillText").forEach(call => {
      const fontHeight = Number(call.font.match(/(\d+)px/)[1]);
      assert.ok(call.y >= 0 && call.y + fontHeight <= lh, `chữ tràn khung tại y=${call.y}`);
    });
  } finally { env.restore(); }
});

function sceneAt(currentTime, extra = {}) {
  return {
    title: "Tên bài", artist: "Nghệ sĩ", manualLyricIndex: 0, duration: 60, currentTime,
    video: null, cover: null, reducedMotion: false, lyrics: [], ...extra,
    settings: { visualMode: "disc", showLyrics: true, showProgress: false, showControls: false, clipDuration: 30, ...extra.settings },
  };
}
const lyricDraws = ctx => ctx.calls.filter(call => call.name === "fillText" && !["Tên bài", "Nghệ sĩ"].includes(call.text) && !/^(\d+:\d\d|--:--)$/.test(call.text));

test("Recorded lyrics break between words, never in the middle of one", () => {
  const env = browserFakes();
  try {
    const { renderScene } = loadSource("utils/renderScene.ts");
    const { outputDimensions } = loadSource("types/studio.ts");
    const text = "Những ngày mưa rơi trên phố vắng và anh vẫn nhớ em thật nhiều";
    const words = text.split(" ");
    const [width, height] = outputDimensions["4:3"];
    const ctx = fakeContext({ width, height });
    renderScene(ctx, sceneAt(5, { lyrics: [{ id: "1", time: 0, text }], settings: { aspectRatio: "4:3" }, reducedMotion: true }));
    const drawn = lyricDraws(ctx);
    assert.ok(drawn.length > 1, "câu dài phải được xuống dòng");
    // Ghép các dòng lại phải ra đúng câu gốc: không mất và không cắt đôi chữ nào.
    assert.equal(drawn.map(call => call.text).join(" "), text);
    drawn.forEach(call => call.text.split(" ").forEach(word => assert.ok(words.includes(word), `bị cắt giữa từ: ${word}`)));
    // Một "từ" dài hơn cả dòng thì vẫn phải cắt, nếu không sẽ tràn khung.
    const long = fakeContext({ width, height });
    renderScene(long, sceneAt(5, { lyrics: [{ id: "1", time: 0, text: "a".repeat(120) }], settings: { aspectRatio: "4:3" }, reducedMotion: true }));
    assert.ok(lyricDraws(long).length > 1);
  } finally { env.restore(); }
});

test("Lyric changes ease across instead of snapping", () => {
  const env = browserFakes();
  try {
    const { renderScene } = loadSource("utils/renderScene.ts");
    const { outputDimensions } = loadSource("types/studio.ts");
    const lyrics = ["Một", "Hai", "Ba"].map((text, i) => ({ id: String(i), time: i * 10, text }));
    const [pw, ph] = outputDimensions["9:16"];
    const portrait = at => sceneAt(at, { lyrics, settings: { aspectRatio: "9:16" } });

    // Ngay sau khi sang câu mới, câu cũ vẫn còn và đang mờ dần đi.
    const during = fakeContext({ width: pw, height: ph });
    renderScene(during, portrait(10.1));
    const mid = lyricDraws(during);
    assert.deepEqual(mid.map(call => call.text), ["Một", "Hai"]);
    const alphaOf = call => Number(call.fill.match(/([\d.]+)\)$/)[1]);
    assert.ok(alphaOf(mid[0]) > 0 && alphaOf(mid[0]) < 1, "câu cũ đang mờ dần");
    assert.ok(Math.abs(alphaOf(mid[0]) + alphaOf(mid[1]) - 1) < .01, "hai câu bù độ mờ cho nhau");
    assert.ok(mid[0].y < mid[1].y, "câu cũ trôi lên, câu mới đi lên theo sau");

    // Hết khoảng chuyển tiếp thì chỉ còn đúng câu hiện tại, rõ hoàn toàn.
    const settled = fakeContext({ width: pw, height: ph });
    renderScene(settled, portrait(11));
    const done = lyricDraws(settled);
    assert.deepEqual(done.map(call => call.text), ["Hai"]);
    assert.equal(done[0].fill, "rgba(255, 255, 255, 1)");

    // Người dùng chọn giảm chuyển động thì bỏ hẳn hiệu ứng.
    const calm = fakeContext({ width: pw, height: ph });
    renderScene(calm, { ...portrait(10.1), reducedMotion: true });
    assert.deepEqual(lyricDraws(calm).map(call => call.text), ["Hai"]);

    // Khung 4:3 cũng trượt: cùng một khối lời nằm ở hai vị trí khác nhau trong lúc chuyển.
    const [lw, lh] = outputDimensions["4:3"];
    const wideMid = fakeContext({ width: lw, height: lh });
    renderScene(wideMid, sceneAt(10.1, { lyrics, settings: { aspectRatio: "4:3" } }));
    const wideDone = fakeContext({ width: lw, height: lh });
    renderScene(wideDone, sceneAt(11, { lyrics, settings: { aspectRatio: "4:3" } }));
    const yOf = (ctx, text) => lyricDraws(ctx).find(call => call.text === text).y;
    assert.ok(yOf(wideMid, "Hai") > yOf(wideDone, "Hai"), "khối lời trượt dần lên vị trí cuối");
  } finally { env.restore(); }
});

test("The recorded frame can carry a player-style control bar", () => {
  const env = browserFakes();
  try {
    const { renderScene } = loadSource("utils/renderScene.ts");
    const { outputDimensions } = loadSource("types/studio.ts");
    const clock = ctx => ctx.calls.filter(call => call.name === "fillText" && /^(\d+:\d\d|--:--)$/.test(call.text)).map(call => call.text);
    for (const ratio of ["9:16", "4:3"]) {
      const [width, height] = outputDimensions[ratio];
      const on = fakeContext({ width, height });
      renderScene(on, sceneAt(72, { duration: 200, settings: { aspectRatio: ratio, showControls: true }, reducedMotion: true }));
      assert.deepEqual(clock(on), ["1:12", "3:20"], ratio);
      // Chữ của thanh điều khiển cũng phải nằm gọn trong khung.
      on.calls.filter(call => call.name === "fillText").forEach(call => {
        const fontHeight = Number(call.font.match(/(\d+)px/)[1]);
        assert.ok(call.y >= 0 && call.y + fontHeight <= height, `${ratio} tràn khung tại y=${call.y}`);
      });
      const off = fakeContext({ width, height });
      renderScene(off, sceneAt(72, { duration: 200, settings: { aspectRatio: ratio, showControls: false }, reducedMotion: true }));
      assert.deepEqual(clock(off), [], `${ratio} phải tắt được thanh điều khiển`);
    }
    // Tệp chưa biết tổng thời lượng thì hiện --:-- thay vì số sai.
    const [width, height] = outputDimensions["9:16"];
    const unknown = fakeContext({ width, height });
    renderScene(unknown, sceneAt(5, { duration: Infinity, settings: { aspectRatio: "9:16", showControls: true }, reducedMotion: true }));
    assert.deepEqual(clock(unknown), ["0:05", "--:--"]);
  } finally { env.restore(); }
});

test("4:3 recording uses tighter margins and keeps the composition when resolution increases", () => {
  const env = browserFakes();
  try {
    const { renderScene, getSceneArtSize } = loadSource("utils/renderScene.ts");
    const video = new FakeVideo();
    const scene = sceneAt(5, { video, settings: { aspectRatio: "4:3", visualMode: "video" } });
    const normal = fakeContext({ width: 1440, height: 1080 });
    const detailed = fakeContext({ width: 2880, height: 2160 });
    renderScene(normal, scene);
    renderScene(detailed, scene);
    const art = normal.calls.find(call => call.name === "drawImage").args;
    assert.ok(art[5] < 110, "outer border is smaller than the previous 150px gap");
    assert.ok(art[7] > 480, "artwork fills more of the 4:3 frame");
    assert.equal(art[7], getSceneArtSize(scene.settings));
    assert.deepEqual(detailed.calls.find(call => call.name === "drawImage").args, art);
    assert.deepEqual(detailed.calls.find(call => call.name === "scale").args, [2, 2]);
  } finally { env.restore(); }
});

test("Recorded lyric layout stays continuous when neighbours enter and rapid cues interrupt", () => {
  const env = browserFakes();
  try {
    const { renderScene } = loadSource("utils/renderScene.ts");
    const lyrics = Array.from({ length: 10 }, (_, i) => ({ id: String(i), time: i === 4 ? 30.2 : i * 10, text: `Line ${i}` }));
    const at = time => {
      const ctx = fakeContext({ width: 1440, height: 1080 });
      renderScene(ctx, sceneAt(time, { lyrics, settings: { aspectRatio: "4:3" } }));
      return lyricDraws(ctx);
    };
    for (const time of [20, 20.42, 30, 30.2, 30.62]) {
      const before = at(time - .000001);
      const after = at(time);
      const shared = before.filter(call => after.some(next => next.text === call.text));
      assert.ok(shared.length >= 2);
      for (const line of shared) {
        const next = after.find(call => call.text === line.text);
        assert.ok(Math.abs(line.y - next.y) < .02, `line jumped at ${time}: ${line.text}`);
        const alpha = call => Number(call.fill.match(/([\d.]+)\)$/)[1]);
        assert.ok(Math.abs(alpha(line) - alpha(next)) < .002, `opacity jumped at ${time}`);
      }
    }
  } finally { env.restore(); }
});

test("Both recording ratios animate while media timestamps are unchanged", () => {
  const env = browserFakes();
  try {
    const { renderScene } = loadSource("utils/renderScene.ts");
    const lyrics = ["First", "Second", "Third"].map((text, i) => ({ id: String(i), time: i * 10, text }));
    for (const ratio of ["4:3", "9:16"]) {
      const ctx = fakeContext(ratio === "4:3" ? { width: 1440, height: 1080 } : { width: 1080, height: 1920 });
      const draw = (currentTime, animationTime, reducedMotion = false) => {
        ctx.calls.length = 0;
        renderScene(ctx, sceneAt(currentTime, { lyrics, animationTime, reducedMotion, settings: { aspectRatio: ratio } }));
        return lyricDraws(ctx);
      };
      draw(9.9, 0);
      draw(10, 16);
      const early = draw(10, 70).find(call => call.text === "Second");
      const later = draw(10, 180).find(call => call.text === "Second");
      assert.ok(early && later);
      assert.ok(early.y > later.y, `${ratio} moves with the animation clock`);
      assert.notEqual(early.fill, later.fill);
      const calm = draw(10, 190, true).find(call => call.text === "Second");
      assert.equal(calm.fill, "rgba(255, 255, 255, 1)");
    }
  } finally { env.restore(); }
});

test("Lyric wrapping is cached and does not reflow as emphasis changes", () => {
  const env = browserFakes();
  try {
    const { renderScene } = loadSource("utils/renderScene.ts");
    const ctx = fakeContext({ width: 1440, height: 1080 });
    let measurements = 0;
    ctx.measureText = text => {
      measurements++;
      return { width: text.length * (Number(ctx.font.split(" ")[0]) >= 700 ? 24 : 20) };
    };
    const lyrics = ["A long lyric with several words to wrap", "Another long lyric with several words to wrap"]
      .map((text, i) => ({ id: String(i), time: i * 10, text }));
    const scene = sceneAt(9.9, { lyrics, settings: { aspectRatio: "4:3" } });
    renderScene(ctx, scene);
    const before = lyricDraws(ctx).map(call => call.text);
    const initialMeasurements = measurements;
    ctx.calls.length = 0;
    renderScene(ctx, { ...scene, currentTime: 10.15 });
    assert.equal(measurements, initialMeasurements, "each frame reuses measured lines");
    assert.deepEqual(lyricDraws(ctx).map(call => call.text), before, "highlighting keeps the same word breaks");
    assert.ok(ctx.calls.some(call => call.name === "roundRect" && call.args[4] === 0), "lyric viewport is clipped");
  } finally { env.restore(); }
});

test("Portrait crossfades keep actual cue identities across unsorted timestamps and interrupted seeks", () => {
  const env = browserFakes();
  try {
    const { renderScene } = loadSource("utils/renderScene.ts");
    const lyrics = [
      { id: "a", time: 0, text: "First" },
      { id: "b", time: 30, text: "Unrelated" },
      { id: "c", time: 10, text: "Second" },
      { id: "d", time: 10.2, text: "Third" },
    ];
    const ctx = fakeContext({ width: 1080, height: 1920 });
    const draw = (time, clock) => {
      ctx.calls.length = 0;
      renderScene(ctx, sceneAt(time, { lyrics, animationTime: clock, settings: { aspectRatio: "9:16" } }));
      return lyricDraws(ctx);
    };
    assert.deepEqual(draw(10.1).map(call => call.text), ["First", "Second"]);
    assert.deepEqual(draw(10.25).map(call => call.text), ["First", "Second", "Third"]);
    draw(9.9, 0);
    draw(10, 10);
    const before = draw(10, 110);
    const interrupted = draw(10.2, 110);
    assert.deepEqual(interrupted, before, "interruption starts from the visible state");
    const later = draw(10.2, 210);
    assert.deepEqual(later.map(call => call.text), ["First", "Second", "Third"]);
    assert.ok(later.every(call => call.text !== "Unrelated"));
  } finally { env.restore(); }
});
