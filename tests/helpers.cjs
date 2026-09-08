const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

function loadSource(relative, react) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const original = mod.require.bind(mod);
    mod.require = request => {
      if (request === "react" && react) return react;
      if (request.startsWith(".")) {
        const base = path.resolve(path.dirname(filename), request);
        const resolved = [base, base + ".ts", base + ".tsx", base + ".cjs"].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
        if (resolved && /\.tsx?$/.test(resolved)) return load(resolved);
      }
      return original(request);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, filename);
    return mod.exports;
  }
  return load(path.resolve(__dirname, "..", relative));
}

// A small hook harness for native-API unit tests, not a browser substitute.
function hookHarness() {
  let cursor = 0;
  const slots = [];
  let pending = [];
  let factory;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, value => { slots[index].value = typeof value === "function" ? value(slots[index].value) : value; }];
    },
    useRef(value) { const index = cursor++; return (slots[index] ??= { current: value }); },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { value: callback, deps };
      return slots[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) {
        pending.push(() => {
          slots[index]?.cleanup?.();
          slots[index] = { deps, cleanup: effect() };
        });
      }
    },
  };
  return {
    react,
    start(fn) { factory = fn; return this.render(); },
    render() { cursor = 0; return factory(); },
    flush() { const effects = pending; pending = []; effects.forEach(effect => effect()); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

function timeRanges(end) {
  return end > 0 ? { length: 1, start: () => 0, end: () => end } : { length: 0, start: () => 0, end: () => 0 };
}

class FakeMedia extends EventTarget {
  constructor() { super(); this.currentTime = 0; this.duration = 120; this.readyState = 4; this.paused = true; this.ended = false; this.volume = 1; this.muted = false; this.loop = false; this.playCalls = 0; this.seekableEnd = 0; this.bufferedEnd = 0; }
  get seekable() { return timeRanges(this.seekableEnd); }
  get buffered() { return timeRanges(this.bufferedEnd); }
  play() { this.playCalls++; this.paused = false; this.ended = false; this.dispatchEvent(new Event("play")); return Promise.resolve(); }
  pause() { if (this.paused) return; this.paused = true; this.dispatchEvent(new Event("pause")); }
}
class FakeVideo extends FakeMedia { constructor() { super(); this.videoWidth = 1920; this.videoHeight = 1080; } }

function fakeContext(canvas) {
  const calls = [];
  const ctx = { canvas, calls, font: "16px Arial", fillStyle: "", strokeStyle: "", textAlign: "left", textBaseline: "top",
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    measureText: text => ({ width: Array.from(text).length * 21 }),
    fillText(text, x, y) { calls.push({ name: "fillText", text, x, y, font: this.font, fill: this.fillStyle }); },
  };
  for (const method of ["fillRect", "beginPath", "arc", "fill", "moveTo", "bezierCurveTo", "lineTo", "closePath", "save", "restore", "translate", "rotate", "scale", "clip", "stroke", "roundRect", "drawImage"]) {
    ctx[method] = (...args) => calls.push({ name: method, args });
  }
  return ctx;
}

function browserFakes() {
  const originals = new Map();
  const set = (key, value) => { originals.set(key, globalThis[key]); globalThis[key] = value; };
  const frames = new Map();
  let nextFrame = 0;
  set("requestAnimationFrame", callback => { frames.set(++nextFrame, callback); return nextFrame; });
  set("cancelAnimationFrame", id => frames.delete(id));
  set("HTMLVideoElement", FakeVideo);
  const win = new EventTarget();
  Object.assign(win, { setTimeout, clearTimeout, setInterval, clearInterval, matchMedia: () => ({ matches: false }) });
  set("window", win);
  const document = new EventTarget();
  document.hidden = false;
  const canvases = [];
  class FakeTrack {
    constructor(kind) { this.kind = kind; this.stopped = false; }
    stop() { this.stopped = true; }
    clone() { return new FakeTrack(this.kind); }
  }
  class FakeStream {
    constructor(tracks) { this.tracks = tracks; }
    getTracks() { return this.tracks; }
    getVideoTracks() { return this.tracks.filter(track => track.kind === "video"); }
    getAudioTracks() { return this.tracks.filter(track => track.kind === "audio"); }
  }
  class FakeCanvas {
    constructor() { this.width = 0; this.height = 0; this.context = fakeContext(this); canvases.push(this); }
    getContext() { return this.context; }
    captureStream(rate) { this.rate = rate; return new FakeStream([new FakeTrack("video")]); }
  }
  document.createElement = name => { if (name === "canvas") return new FakeCanvas(); throw new Error("Unexpected element: " + name); };
  set("document", document);
  set("HTMLCanvasElement", FakeCanvas);
  set("MediaStream", FakeStream);
  const contexts = [];
  class FakeAudioContext {
    constructor() { this.state = "running"; this.destination = {}; this.sourceCount = 0; contexts.push(this); }
    resume() { return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
    createMediaStreamDestination() { return { stream: new FakeStream([new FakeTrack("audio")]) }; }
    createMediaElementSource() {
      this.sourceCount++;
      const connections = new Set();
      return { connections, connect: target => connections.add(target), disconnect: target => { if (target) connections.delete(target); else connections.clear(); } };
    }
  }
  set("AudioContext", FakeAudioContext);
  const recordings = [];
  class FakeRecorder {
    static isTypeSupported(type) { return type.startsWith("video/webm"); }
    constructor(stream, options) { this.stream = stream; this.options = options; this.mimeType = options.mimeType; this.state = "inactive"; recordings.push(this); }
    start(timeslice) { this.timeslice = timeslice; this.state = "recording"; }
    stop() {
      this.state = "inactive";
      queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(["mock-encoded-data"]) }); this.onstop?.(); });
    }
  }
  set("MediaRecorder", FakeRecorder);
  class FakePath2D { constructor(data) { this.data = data; } }
  set("Path2D", FakePath2D);
  const revoked = [];
  let objectId = 0;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = () => "blob:unit-test-" + ++objectId;
  URL.revokeObjectURL = url => revoked.push(url);
  return {
    canvases, contexts, recordings, revoked, frames, document, FakeAudioContext,
    advance(now = performance.now() + 100) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(now)); },
    restore() { originals.forEach((value, key) => { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; },
  };
}
module.exports = { loadSource, hookHarness, browserFakes, FakeMedia, FakeVideo, fakeContext };
