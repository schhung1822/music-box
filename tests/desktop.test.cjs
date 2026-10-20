const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { startStaticServer, resolveFile } = require("../desktop/static-server.cjs");
const { renderIcon, toBitmap } = require("../desktop/icon.cjs");

function sampleSite() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "khoanglang-site-"));
  fs.mkdirSync(path.join(root, "_next", "static"), { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), "<h1>home</h1>");
  fs.writeFileSync(path.join(root, "404.html"), "<h1>missing</h1>");
  fs.writeFileSync(path.join(root, "_next", "static", "app.js"), "console.log(1)");
  fs.writeFileSync(path.join(path.dirname(root), "secret.txt"), "outside");
  return root;
}

test("The desktop static server serves the export and never leaves its folder", async () => {
  const root = sampleSite();
  const { server, url } = await startStaticServer(root);
  try {
    const home = await fetch(`${url}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get("content-type"), /text\/html/);
    assert.equal(await home.text(), "<h1>home</h1>");
    const script = await fetch(`${url}/_next/static/app.js`);
    assert.match(script.headers.get("content-type"), /javascript/);
    const missing = await fetch(`${url}/nope`);
    assert.equal(missing.status, 404);
    assert.equal(await missing.text(), "<h1>missing</h1>");
    assert.equal((await fetch(`${url}/%2e%2e/secret.txt`)).status, 404);
    assert.equal((await fetch(`${url}/..%5Csecret.txt`)).status, 404);
    assert.equal((await fetch(`${url}/`, { method: "POST" })).status, 405);
    assert.equal(resolveFile(root, "/../secret.txt"), null);
  } finally { server.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test("Generated icons are fully opaque inside the artwork, transparent in the corners, and flag recording with a red dot", () => {
  const plain = renderIcon(64);
  assert.equal(plain[3], 0);
  const centre = (32 * 64 + 32) * 4;
  assert.equal(plain[centre + 3], 255);
  const red = renderIcon(64, { recording: true });
  const dot = (Math.round(64 * .23) * 64 + Math.round(64 * .77)) * 4;
  assert.ok(red[dot] > 200 && red[dot + 1] < 100);
  const bitmap = toBitmap(plain);
  assert.equal(bitmap.length, plain.length);
  assert.equal(bitmap[centre], plain[centre + 2]);
});
