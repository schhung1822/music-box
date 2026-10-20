// Mở cửa sổ Electron từ thư mục dự án. ELECTRON_RUN_AS_NODE (VS Code và một số công cụ đặt sẵn) khiến
// electron.exe chạy như Node thường, nên phải bỏ biến này đi, nếu không `app` sẽ không tồn tại.
const { spawn } = require("node:child_process");
const path = require("node:path");

const electron = require("electron");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

spawn(electron, [path.join(__dirname, ".."), ...process.argv.slice(2)], { stdio: "inherit", env })
  .on("exit", code => process.exit(code ?? 0));
