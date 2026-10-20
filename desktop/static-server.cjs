// Phục vụ bản Next xuất tĩnh (thư mục desktop-web/) qua http://127.0.0.1.
// Không dùng file:// vì đường dẫn tuyệt đối /_next/... sẽ hỏng, và khung YouTube cần một nguồn http hợp lệ.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".webp": "image/webp",
  ".woff": "font/woff", ".woff2": "font/woff2", ".map": "application/json", ".wasm": "application/wasm",
};

function isFile(file) {
  try { return fs.statSync(file).isFile(); } catch { return false; }
}

/** Tìm tệp cho một đường dẫn URL như Next xuất tĩnh mong đợi: /x → x.html → x/index.html. Trả về null nếu không có. */
function resolveFile(root, url) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(url, "http://local").pathname); }
  catch { return null; }
  const candidates = pathname.endsWith("/") ? [`${pathname}index.html`] : [pathname, `${pathname}.html`, `${pathname}/index.html`];
  for (const candidate of candidates) {
    const file = path.join(root, candidate);
    const relative = path.relative(root, file);
    // Chặn "../" thoát khỏi thư mục gốc.
    if (relative.startsWith("..") || path.isAbsolute(relative)) continue;
    if (isFile(file)) return file;
  }
  return null;
}

function createStaticServer(root) {
  const base = path.resolve(root);
  return http.createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const found = resolveFile(base, request.url ?? "/");
    const file = found ?? path.join(base, "404.html");
    if (!isFile(file)) { response.writeHead(404).end(); return; }
    response.writeHead(found ? 200 : 404, {
      "Content-Type": types[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    if (request.method === "HEAD") { response.end(); return; }
    fs.createReadStream(file).on("error", () => response.destroy()).pipe(response);
  });
}

/** Mở máy chủ ở cổng ngẫu nhiên, chỉ nghe trên vòng lặp nội bộ. */
function startStaticServer(root) {
  const server = createStaticServer(root);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

module.exports = { createStaticServer, startStaticServer, resolveFile };
