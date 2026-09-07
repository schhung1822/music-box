const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource, browserFakes, FakeVideo, fakeContext } = require("./helpers.cjs");
const { parseLrc, parsePlainLyrics, activeLyricIndex, serializeLrc } = loadSource("utils/lyrics.ts");
const { youtubeVideoId } = loadSource("utils/youtube.ts");
const { validateMediaFile, formatTime } = loadSource("utils/media.ts");

test("LRC parses fractions, repeated timestamps, global offsets and blank instrumental cues", () => {
  const result = parseLrc("[ar:Example]\n[00:12.40][00:18.200]First\n[00:22.005]\n[offset:-500]\n[00:70.00]invalid");
  assert.deepEqual(result.map(({time, text}) => ({time, text})), [
    {time:11.9,text:"First"}, {time:17.7,text:"First"}, {time:21.505,text:""},
  ]);
  assert.throws(() => parseLrc("[ar:Artist]\ninvalid data"));
  assert.equal(parseLrc("[00:00.1]A\n[offset:-1000]")[0].time, 0);
});

test("Lyric highlighting handles intro, unsorted edits, deleted timestamps and exact boundaries", () => {
  const lines = [{id:"a",time:20,text:"A"},{id:"b",time:null,text:"B"},{id:"c",time:5,text:"C"}];
  assert.equal(activeLyricIndex(lines, 0), -1);
  assert.equal(activeLyricIndex(lines, 5), 2);
  assert.equal(activeLyricIndex(lines, 19.9), 2);
  assert.equal(activeLyricIndex(lines, 20), 0);
  assert.equal(activeLyricIndex(lines.map(line => ({...line,time:null})), 30), -1);
});

test("LRC export rounds minute boundaries, excludes untimed lines, and does not mutate the source", () => {
  const lines = [{id:"a",time:59.999,text:"Later"},{id:"b",time:null,text:"Untimed"},{id:"c",time:2.1,text:"First"}];
  const before = structuredClone(lines);
  const output = serializeLrc(lines);
  assert.equal(output, "[00:02.10]First\n[01:00.00]Later");
  assert.deepEqual(lines, before);
  assert.deepEqual(parseLrc(output).map(line => line.time), [2.1,60]);
  assert.equal(parsePlainLyrics(" A \r\n\n B ").length, 2);
});

test("YouTube accepts official video URL forms and rejects unrelated hosts, schemes and playlists", () => {
  const id = "abcdefghijk";
  for (const url of ["https://youtu.be/"+id+"?t=10", "https://www.youtube.com/watch?v="+id, "https://m.youtube.com/shorts/"+id, "https://youtube.com/live/"+id, "https://youtube-nocookie.com/embed/"+id]) assert.equal(youtubeVideoId(url), id);
  for (const url of ["https://youtube.com.evil.test/watch?v="+id, "https://evil.test/"+id, "javascript:alert(1)", "https://youtube.com/playlist?list=123", "https://youtu.be/short"]) assert.equal(youtubeVideoId(url), null);
});

test("Media selection rejects empty, unsupported and mismatched files", () => {
  assert.equal(validateMediaFile({name:"music.mp3",size:10,type:"audio/mpeg"}, "audio"), null);
  assert.equal(validateMediaFile({name:"movie.mp4",size:10,type:""}, "video"), null);
  assert.ok(validateMediaFile({name:"movie.mp4",size:0,type:"video/mp4"}, "video"));
  assert.ok(validateMediaFile({name:"image.jpg",size:10,type:"audio/mpeg"}, "cover"));
  assert.ok(validateMediaFile({name:"image.exe",size:10,type:"image/jpeg"}, "cover"));
  assert.equal(formatTime(NaN), "0:00");
  assert.equal(formatTime(125.8), "2:05");
});

test("All canvas ratios keep text within the frame, rotate the disc and use thumbnail/video crop priority", () => {
  const env = browserFakes();
  try {
    const { renderScene } = loadSource("utils/renderScene.ts");
    const { outputDimensions } = loadSource("types/studio.ts");
    const cover = {naturalWidth:1600,naturalHeight:900};
    const video = new FakeVideo();
    for (const ratio of ["9:16","4:3"]) {
      const [width,height] = outputDimensions[ratio];
      const ctx = fakeContext({width,height});
      const scene = { title:"A long song title ".repeat(10),artist:"An artist",lyrics:[{id:"1",time:0,text:"A long lyric ".repeat(30)}],manualLyricIndex:0,settings:{visualMode:"disc",showLyrics:true,showProgress:true,aspectRatio:ratio,clipDuration:30},currentTime:12,duration:120,video,cover,reducedMotion:false };
      renderScene(ctx, scene);
      const textCalls = ctx.calls.filter(call => call.name === "fillText");
      assert.ok(textCalls.length >= 3);
      textCalls.forEach(call => {
        const fontHeight = Number(call.font.match(/(\d+)px/)[1]);
        assert.ok(call.y >= 0 && call.y + fontHeight <= height);
        assert.ok(call.x >= 0 && call.x <= width);
      });
      assert.equal(ctx.calls.find(call => call.name === "drawImage").args[0], cover);
      assert.ok(ctx.calls.some(call => call.name === "rotate"));
      const videoCtx = fakeContext({width,height});
      renderScene(videoCtx, {...scene, settings:{...scene.settings,visualMode:"video"}});
      assert.equal(videoCtx.calls.find(call => call.name === "drawImage").args[0], video);
      const calmCtx = fakeContext({width,height});
      renderScene(calmCtx, {...scene,reducedMotion:true,settings:{...scene.settings,showLyrics:false}});
      assert.equal(calmCtx.calls.some(call => call.name === "rotate"), false);
    }
  } finally { env.restore(); }
});
