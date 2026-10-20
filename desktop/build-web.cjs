// Dựng bản web xuất tĩnh vào desktop-web/ cho cửa sổ Electron. Dùng tập lệnh thay vì đặt biến môi trường trong
// package.json để chạy giống nhau trên PowerShell, cmd và bash.
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..");
const next = path.join(root, "node_modules", "next", "dist", "bin", "next");
const result = spawnSync(process.execPath, [next, "build"], {
  cwd: root, stdio: "inherit", env: { ...process.env, DESKTOP_BUILD: "1" },
});
process.exit(result.status ?? 1);
