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
  return {element,title:"Song",artist:"Artist",lyrics:[{id:"1",time:0,text:"Line"}],manualLyricIndex:0,settings:{visualMode:"disc",showLyrics:true,showProgress:true,aspectRatio:"9:16",clipDuration:15},video:null,cover:null,play:async()=>{await element.play();return true;},pause:()=>element.pause(),...extra};
}

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
    assert.equal(env.canvases[0].width,1080); assert.equal(env.canvases[0].height,1920); assert.equal(env.canvases[0].rate,30);
    assert.equal(env.recordings[0].stream.getVideoTracks().length,1);
    assert.equal(env.recordings[0].stream.getAudioTracks().length,1);
    recorder.stop(); await Promise.resolve(); recorder = harness.render();
    assert.equal(recorder.status,"idle"); assert.ok(recorder.result.url);
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
