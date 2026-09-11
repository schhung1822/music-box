const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource, hookHarness, browserFakes, FakeMedia, FakeVideo } = require("./helpers.cjs");

test("Local media playback uses audio as master, mutes the video, wraps its timeline and stops both", async () => {
  const env = browserFakes();
  const harness = hookHarness();
  try {
    const { useMediaPlayer } = loadSource("hooks/useMediaPlayer.ts", harness.react);
    let volume = .7;
    let muted = false;
    let player = harness.start(() => useMediaPlayer("blob:audio","blob:video",true,volume,muted));
    const audio = new FakeMedia();
    const video = new FakeVideo();
    video.duration = 10;
    player.audioRef.current = audio; player.videoRef.current = video;
    harness.flush(); env.advance(); player = harness.render();
    assert.equal(player.ready,true);
    assert.equal(video.muted,true);
    assert.equal(video.loop,true);
    assert.equal(await player.play(),true);
    assert.equal(audio.paused,false); assert.equal(video.paused,false);
    player.seek(25);
    assert.equal(audio.currentTime,25); assert.equal(video.currentTime,5);
    player.seek(999); assert.equal(audio.currentTime,120);
    volume = .2; muted = true; player = harness.render(); harness.flush();
    assert.equal(audio.volume,.2); assert.equal(audio.muted,true);
    player.pause(); assert.equal(audio.paused,true); assert.equal(video.paused,true);
  } finally { harness.unmount(); env.restore(); }
});

test("Video-only playback retains its own audio and aborted play does not leave background video playing", async () => {
  const env = browserFakes();
  const harness = hookHarness();
  try {
    const { useMediaPlayer } = loadSource("hooks/useMediaPlayer.ts", harness.react);
    let player = harness.start(() => useMediaPlayer(undefined,"blob:video",true,.8,false));
    const video = new FakeVideo(); player.videoRef.current = video; player.audioRef.current = new FakeMedia();
    harness.flush(); env.advance(); player = harness.render();
    assert.equal(video.muted,false); assert.equal(video.loop,false);
    assert.equal(player.getElement(),video);
    await player.play(); player.pause(); assert.equal(video.paused,true);
    video.play = () => Promise.reject(new DOMException("Unsupported","NotSupportedError"));
    assert.equal(await player.play(),false);
    assert.ok(harness.render().error);
  } finally { harness.unmount(); env.restore(); }
});

test("Replacing and removing files revoke object URLs; unmount releases remaining assets", () => {
  const env = browserFakes();
  const harness = hookHarness();
  try {
    const { useLocalFiles } = loadSource("hooks/useLocalFiles.ts", harness.react);
    let files = harness.start(() => useLocalFiles()); harness.flush();
    const cover = {name:"cover.png",type:"image/png",size:100};
    files.replace("cover",cover); files = harness.render();
    const first = files.assets.cover.url;
    files.replace("cover",cover); files = harness.render();
    assert.ok(env.revoked.includes(first));
    const second = files.assets.cover.url;
    assert.ok(files.replace("cover",{...cover,name:"bad.exe"}));
    assert.equal(harness.render().assets.cover.url,second);
    files.replace("cover",null); assert.ok(env.revoked.includes(second));
    files.replace("audio",{name:"audio.mp3",type:"audio/mpeg",size:100});
    const last = harness.render().assets.audio.url;
    harness.unmount(); assert.ok(env.revoked.includes(last));
  } finally { env.restore(); }
});

function recordingOptions(element, extra = {}) {
  return {element,title:"Song",artist:"Artist",lyrics:[{id:"1",time:0,text:"Line"}],manualLyricIndex:0,settings:{visualMode:"disc",showLyrics:true,showProgress:true,aspectRatio:"9:16",videoFormat:"mp4",clipDuration:15},video:null,cover:null,play:async()=>{await element.play();return true;},pause:()=>element.pause(),...extra};
}

test("Recording resolution preserves the visible 1080p crop, keeps exact ratios and bounds very large sources", () => {
  const { getRecordingQuality } = loadSource("utils/recordingQuality.ts");
  const { getSceneArtSize } = loadSource("utils/renderScene.ts");
  const { outputDimensions } = loadSource("types/studio.ts");
  for (const aspectRatio of ["4:3", "9:16"]) {
    for (const showLyrics of [true, false]) {
      const settings = { ...recordingOptions(new FakeMedia()).settings, visualMode: "video", aspectRatio, showLyrics };
      const base = getRecordingQuality(settings, null);
      assert.deepEqual([base.width, base.height], outputDimensions[aspectRatio]);
      const hd = getRecordingQuality(settings, { videoWidth: 1920, videoHeight: 1080 });
      const visiblePixels = getSceneArtSize(settings) * hd.width / outputDimensions[aspectRatio][0];
      assert.ok(visiblePixels >= 1080, `${aspectRatio}: preserve the uploaded crop's 1080 rows`);
      const large = getRecordingQuality(settings, { videoWidth: 7680, videoHeight: 4320 });
      assert.equal(Math.max(large.width, large.height), 3840);
      assert.equal(large.width / large.height, outputDimensions[aspectRatio][0] / outputDimensions[aspectRatio][1]);
      assert.equal(large.width % 2, 0); assert.equal(large.height % 2, 0);
      assert.ok(large.videoBitsPerSecond > base.videoBitsPerSecond);
      assert.ok(large.videoBitsPerSecond <= 100_000_000);
      const small = getRecordingQuality(settings, { videoWidth: 640, videoHeight: 360 });
      assert.deepEqual(small, base);
      const disc = getRecordingQuality({ ...settings, visualMode: "disc" }, { videoWidth: 7680, videoHeight: 4320 });
      assert.deepEqual(disc, base);
    }
  }
});

test("Recording cadence stays near 60 fps across display refresh rates and recovers from stalls", () => {
  const { createFramePacer } = loadSource("utils/recordingQuality.ts");
  for (const refreshRate of [59.94, 60, 120, 144]) {
    const due = createFramePacer(0);
    let count = 0;
    for (let i = 1; i <= Math.floor(refreshRate * 10); i++) {
      if (due(i * 1000 / refreshRate)) count++;
    }
    assert.ok(count >= 598 && count <= 600, `${refreshRate} Hz produced ${count} frames in 10s`);
  }
  const due = createFramePacer(0);
  assert.equal(due(16.5), true);
  assert.equal(due(20), false);
  assert.equal(due(500), true);
  assert.equal(due(501), false);
  assert.equal(due(516.67), true);
});

test("Recorder draws on successive 60 Hz frames and requests native-sized high-quality video", async () => {
  const env = browserFakes();
  const harness = hookHarness();
  try {
    const { useRecorder } = loadSource("hooks/useRecorder.ts", harness.react);
    const recorder = harness.start(() => useRecorder()); harness.flush();
    const element = new FakeVideo();
    await recorder.start(recordingOptions(element, { video: element, settings: { ...recordingOptions(element).settings, visualMode: "video", aspectRatio: "4:3" } }));
    const canvas = env.canvases[0];
    assert.ok(canvas.width > 1440); assert.ok(canvas.height > 1080);
    assert.equal(canvas.rate, 60);
    assert.equal(canvas.context.imageSmoothingEnabled, true);
    assert.equal(canvas.context.imageSmoothingQuality, "high");
    const first = performance.now() + 20;
    const drawCount = () => canvas.context.calls.filter(call => call.name === "drawImage" && call.args[0] === element).length;
    let previous = drawCount();
    for (let i = 0; i < 60; i++) {
      element.currentTime = i / 60;
      env.advance(first + i * 1000 / 60);
      const current = drawCount();
      assert.equal(current, previous + 1, `draw on frame ${i}`);
      previous = current;
    }
    recorder.stop(); await Promise.resolve();
    const result = harness.render().result;
    assert.equal(result.width, canvas.width); assert.equal(result.height, canvas.height);
  } finally { harness.unmount(); env.restore(); }
});

test("Audio with a loading background video waits for native video dimensions before recording", async () => {
  const env = browserFakes();
  const harness = hookHarness();
  try {
    const { useRecorder } = loadSource("hooks/useRecorder.ts", harness.react);
    const recorder = harness.start(() => useRecorder()); harness.flush();
    const audio = new FakeMedia();
    const video = new FakeVideo();
    video.readyState = 0; video.videoWidth = 0; video.videoHeight = 0;
    const preparing = recorder.start(recordingOptions(audio, { video, settings: { ...recordingOptions(audio).settings, visualMode: "video", aspectRatio: "4:3" } }));
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    assert.equal(harness.render().status, "preparing");
    assert.equal(env.canvases.length, 0);
    video.videoWidth = 1920; video.videoHeight = 1080; video.readyState = 2;
    video.dispatchEvent(new Event("loadeddata"));
    await preparing;
    assert.equal(harness.render().status, "recording");
    assert.ok(env.canvases[0].width > 1440);
    recorder.stop(); await Promise.resolve();
  } finally { harness.unmount(); env.restore(); }
});

test("MP4 asks for H.264 by name before any weaker pairing and reports the codecs actually written", async () => {
  const { describeCodecs, containerOf } = loadSource("utils/recordingQuality.ts");
  assert.equal(describeCodecs('video/mp4;codecs="avc1.640028, mp4a.40.2"'), "H.264 + AAC");
  assert.equal(describeCodecs("video/mp4;codecs=avc1.420015,opus"), "H.264 + Opus");
  assert.equal(describeCodecs("video/mp4;codecs=vp9,opus"), "VP9 + Opus");
  assert.equal(describeCodecs("video/webm"), "");
  assert.equal(containerOf("video/mp4;codecs=avc1"), "mp4");
  assert.equal(containerOf("video/webm;codecs=vp9,opus"), "webm");
  const cases = [
    [() => true, "video/mp4;codecs=avc1.640034,mp4a.40.2"],
    // Máy thiếu bộ mã hóa AAC (bản Windows N chẳng hạn) vẫn phải giữ hình H.264, chỉ đổi phần tiếng.
    [type => type.startsWith("video/mp4") && !type.includes("mp4a"), "video/mp4;codecs=avc1.640034,opus"],
    // Chromium tự chọn cho "video/mp4" trống có thể ra VP9 trong vỏ MP4, nên đó chỉ là nước cuối.
    [type => type === "video/mp4" || type.startsWith("video/webm"), "video/mp4"],
  ];
  for (const [supported, expected] of cases) {
    const env = browserFakes();
    const harness = hookHarness();
    try {
      env.onlyRecordable(supported);
      const { useRecorder } = loadSource("hooks/useRecorder.ts", harness.react);
      let recorder = harness.start(() => useRecorder()); harness.flush();
      await recorder.start(recordingOptions(new FakeMedia()));
      assert.equal(env.recordings[0].options.mimeType, expected);
      recorder = harness.render(); recorder.stop(); await Promise.resolve();
      assert.equal(harness.render().result.codecs, describeCodecs(expected));
    } finally { harness.unmount(); env.restore(); }
  }
});

test("Chooses the requested container, names the file after it and falls back when the browser cannot write it", async () => {
  const cases = [
    { requested: "mp4", supported: () => true, mimePrefix: "video/mp4", format: "mp4" },
    { requested: "webm", supported: () => true, mimePrefix: "video/webm", format: "webm" },
    // Chrome/Edge dưới bản 130 chỉ ghi được WebM: bản ghi vẫn phải chạy, chỉ đổi vùng chứa.
    { requested: "mp4", supported: type => type.startsWith("video/webm"), mimePrefix: "video/webm", format: "webm" },
    { requested: "webm", supported: type => type.startsWith("video/mp4"), mimePrefix: "video/mp4", format: "mp4" },
  ];
  for (const { requested, supported, mimePrefix, format } of cases) {
    const env = browserFakes();
    const harness = hookHarness();
    try {
      env.onlyRecordable(supported);
      const { useRecorder } = loadSource("hooks/useRecorder.ts", harness.react);
      let recorder = harness.start(() => useRecorder()); harness.flush();
      const element = new FakeMedia();
      const options = recordingOptions(element);
      await recorder.start({ ...options, settings: { ...options.settings, videoFormat: requested } });
      assert.ok(env.recordings[0].options.mimeType.startsWith(mimePrefix), `${requested} → ${env.recordings[0].options.mimeType}`);
      recorder = harness.render(); recorder.stop(); await Promise.resolve(); recorder = harness.render();
      assert.equal(recorder.result.format, format);
      assert.equal(recorder.result.requestedFormat, requested);
      assert.ok(recorder.result.filename.endsWith("." + format), recorder.result.filename);
    } finally { harness.unmount(); env.restore(); }
  }
});

test("A browser without any supported container reports it instead of starting a recording", async () => {
  const env = browserFakes();
  const harness = hookHarness();
  try {
    env.onlyRecordable(() => false);
    const { useRecorder } = loadSource("hooks/useRecorder.ts", harness.react);
    let recorder = harness.start(() => useRecorder()); harness.flush();
    await recorder.start(recordingOptions(new FakeMedia()));
    recorder = harness.render();
    assert.equal(recorder.status, "idle");
    assert.match(recorder.error, /MP4/);
    assert.equal(env.recordings.length, 0);
  } finally { harness.unmount(); env.restore(); }
});

test("Recorder combines canvas and audio, stops tracks, reuses audio source across recordings and revokes downloads", async () => {
  const env = browserFakes();
  const harness = hookHarness();
  try {
    const { useRecorder } = loadSource("hooks/useRecorder.ts", harness.react);
    let recorder = harness.start(() => useRecorder()); harness.flush();
    const element = new FakeMedia();
    let completed = 0;
    await recorder.start(recordingOptions(element,{onComplete:()=>completed++}));
    recorder = harness.render();
    assert.equal(recorder.status,"recording");
    assert.equal(env.canvases[0].width,1080); assert.equal(env.canvases[0].height,1920); assert.equal(env.canvases[0].rate,60);
    assert.ok(env.recordings[0].options.videoBitsPerSecond >= 24_000_000);
    assert.equal(env.recordings[0].options.audioBitsPerSecond,320_000);
    assert.equal(env.recordings[0].stream.getVideoTracks().length,1);
    assert.equal(env.recordings[0].stream.getAudioTracks().length,1);
    recorder.stop(); await Promise.resolve(); recorder = harness.render();
    assert.equal(recorder.status,"idle"); assert.ok(recorder.result.url); assert.equal(recorder.result.frameRate,60);
    assert.equal(completed,1); assert.equal(element.paused,true);
    assert.ok(env.recordings[0].stream.getTracks().every(track=>track.stopped));
    const previousUrl = recorder.result.url;
    await recorder.start(recordingOptions(element));
    recorder = harness.render(); recorder.stop(); await Promise.resolve(); recorder = harness.render();
    assert.equal(env.contexts[0].sourceCount,1);
    assert.ok(env.revoked.includes(previousUrl));
    const currentUrl = recorder.result.url;
    recorder.clearResult(); assert.ok(env.revoked.includes(currentUrl));
  } finally { harness.unmount(); env.restore(); }
});

test("Cancelling preparation keeps the recording lock until asynchronous setup settles", async () => {
  const env = browserFakes();
  const harness = hookHarness();
  try {
    let resume;
    env.FakeAudioContext.prototype.resume = () => new Promise(resolve => { resume = resolve; });
    const { useRecorder } = loadSource("hooks/useRecorder.ts", harness.react);
    let recorder = harness.start(() => useRecorder()); harness.flush();
    const element = new FakeMedia();
    const preparing = recorder.start(recordingOptions(element));
    recorder = harness.render(); assert.equal(recorder.status,"preparing");
    recorder.stop(); recorder = harness.render(); assert.equal(recorder.status,"stopping");
    await recorder.start(recordingOptions(element));
    assert.equal(env.contexts.length,1);
    resume(); await preparing; recorder = harness.render();
    assert.equal(recorder.status,"idle"); assert.equal(recorder.error,""); assert.equal(recorder.result,null);
    assert.equal(env.recordings.length,0);
  } finally { harness.unmount(); env.restore(); }
});

test("Recordings stop at the requested duration and when leaving the tab", async () => {
  const env = browserFakes();
  const harness = hookHarness();
  try {
    const { useRecorder } = loadSource("hooks/useRecorder.ts", harness.react);
    let recorder = harness.start(() => useRecorder()); harness.flush();
    const element = new FakeMedia();
    await recorder.start(recordingOptions(element));
    element.currentTime = 15;
    env.advance(performance.now()+1000);
    await Promise.resolve(); recorder = harness.render();
    assert.equal(recorder.status,"idle"); assert.ok(recorder.result);
    await recorder.start(recordingOptions(element));
    env.document.hidden = true; env.document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve(); recorder = harness.render();
    assert.equal(recorder.status,"idle"); assert.ok(recorder.error);
  } finally { harness.unmount(); env.restore(); }
});

test("YouTube creates a player only in its own mode, controls playback and destroys it on exit", async () => {
  const env = browserFakes();
  const harness = hookHarness();
  try {
    const instances = [];
    window.location = {origin:"http://localhost:3000"};
    env.document.createElement = () => ({});
    class FakeYouTube {
      constructor(element, options) { this.options = options; this.time = 0; this.playing = 2; this.iframe = {}; this.destroyed = false; instances.push(this); }
      getCurrentTime() { return this.time; }
      getDuration() { return 100; }
      getPlayerState() { return this.playing; }
      playVideo() { this.playing = 1; this.options.events.onStateChange({target:this}); }
      pauseVideo() { this.playing = 2; this.options.events.onStateChange({target:this}); }
      seekTo(time) { this.time = time; }
      setVolume(volume) { this.volume = volume; }
      mute() { this.muted = true; }
      unMute() { this.muted = false; }
      getIframe() { return this.iframe; }
      destroy() { this.destroyed = true; }
    }
    window.YT = {Player:FakeYouTube};
    const {useYouTubePlayer} = loadSource("hooks/useYouTubePlayer.ts", harness.react);
    let enabled = false;
    let player = harness.start(() => useYouTubePlayer("abcdefghijk",enabled,.6,false));
    player.containerRef.current = {replaceChildren() {}};
    harness.flush(); assert.equal(instances.length,0);
    enabled = true; player = harness.render(); harness.flush(); await Promise.resolve();
    assert.equal(instances.length,1);
    instances[0].options.events.onReady({target:instances[0]});
    player = harness.render(); harness.flush();
    assert.equal(player.ready,true); assert.equal(instances[0].volume,60);
    await player.play(); assert.equal(harness.render().isPlaying,true);
    player.seek(1000); assert.equal(instances[0].time,100);
    player.pause(); assert.equal(harness.render().isPlaying,false);
    enabled = false; player = harness.render(); harness.flush();
    assert.equal(instances[0].destroyed,true); assert.equal(player.ready,false);
  } finally { harness.unmount(); env.restore(); }
});
