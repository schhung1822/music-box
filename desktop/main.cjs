const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, session, shell } = require("electron");
const path = require("node:path");
const { startStaticServer } = require("./static-server.cjs");
const { renderIcon, toBitmap } = require("./icon.cjs");

// Các công tắc này phải đặt trước khi ứng dụng sẵn sàng.
// Mục đích chính: ghi hình vẫn chạy đủ nhịp khi cửa sổ bị cửa sổ khác che hoặc mất tiêu điểm.
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
// Windows tự phát hiện cửa sổ bị che và ngừng vẽ nó; tắt đi để rAF và WebGL của nền không dừng theo.
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
// GPU cũ nằm trong danh sách chặn của Chromium sẽ rơi về dựng phần mềm, nặng hơn nhiều cho WebGL và canvas.
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const dev = !app.isPackaged;
let appUrl = "";
let window = null;
let recording = false;
let tray = null;
let backgroundSince = 0;

const icon = (size, options) => nativeImage.createFromBitmap(toBitmap(renderIcon(size, options)), { width: size, height: size });

/**
 * Cửa sổ bị thu nhỏ hẳn thì Windows ngừng dựng hình, nên canvas và nền WebGL chỉ còn nhích 1 khung/giây.
 * Vì vậy khi đang ghi, "thu nhỏ" được hiểu là ẩn xuống khay: cửa sổ vẫn mở nhưng trong suốt hoàn toàn,
 * không bắt chuột và không hiện trên thanh tác vụ; Chromium vẫn coi nó là đang hiển thị và dựng đủ 60 khung.
 */
function enterBackground() {
  if (!window || tray) return;
  backgroundSince = Date.now();
  window.setOpacity(0);
  window.setIgnoreMouseEvents(true);
  window.setSkipTaskbar(true);
  tray = new Tray(icon(32, { recording: true }));
  tray.setToolTip("Khoảng lặng · đang ghi nền. Nhấp để mở lại.");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Hiện cửa sổ", click: leaveBackground },
    { label: "Dừng ghi", click: () => window?.webContents.send("recording:stop") },
  ]));
  tray.on("click", leaveBackground);
}

function leaveBackground() {
  if (tray) { tray.destroy(); tray = null; }
  if (!window) return;
  window.setIgnoreMouseEvents(false);
  window.setSkipTaskbar(false);
  window.setOpacity(1);
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  // Windows không cho cửa sổ tự giành tiêu điểm khi người dùng đang ở ứng dụng khác; nhấp nháy để họ biết bản ghi đã xong.
  if (!window.isFocused()) window.flashFrame(true);
}

function createWindow() {
  window = new BrowserWindow({
    width: 1360, height: 860, minWidth: 900, minHeight: 640,
    backgroundColor: "#0b0d0c", title: "Khoảng lặng", show: false, autoHideMenuBar: true, icon: icon(256),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false,
      // Không giảm tốc hoạt ảnh và bộ hẹn giờ khi cửa sổ ở nền; cũng giữ trạng thái "visible" cho Page Visibility.
      backgroundThrottling: false,
    },
  });
  window.once("ready-to-show", () => window?.show());
  window.on("closed", () => { window = null; recording = false; if (tray) { tray.destroy(); tray = null; } });
  window.on("minimize", () => {
    if (!recording) return;
    // Trong suốt trước rồi mới khôi phục, để cửa sổ không loé lên giữa chừng. Phải khôi phục sau khi Windows
    // thu nhỏ xong, nếu không lệnh khôi phục bị bỏ qua và cửa sổ vẫn nằm im không được dựng hình.
    window.setOpacity(0);
    enterBackground();
    setTimeout(() => window?.restore(), 50);
  });
  // Alt+Tab vào cửa sổ đang ẩn thì hiện lại. Chờ một nhịp vì cửa sổ vừa được khôi phục cũng nhận tiêu điểm.
  window.on("focus", () => { if (tray && Date.now() - backgroundSince > 1500) leaveBackground(); });

  const origin = new URL(appUrl).origin;
  // Liên kết ra ngoài mở bằng trình duyệt hệ thống, và trang chính không bao giờ bị điều hướng đi nơi khác.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== origin) event.preventDefault();
  });
  void window.loadURL(appUrl);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (!window) return;
    if (tray) leaveBackground();
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  ipcMain.on("recording:state", (event, active) => {
    // Chỉ nhận từ trang của chính ứng dụng.
    if (!window || event.sender !== window.webContents || !event.senderFrame?.url.startsWith(appUrl)) return;
    recording = active === true;
    // Ghi xong (hoặc lỗi) thì đưa cửa sổ về để người dùng thấy kết quả.
    if (!recording && tray) leaveBackground();
  });

  app.whenReady().then(async () => {
    if (!dev) Menu.setApplicationMenu(null);
    // Ứng dụng không cần quyền nào của trình duyệt (camera, vị trí, thông báo…), chỉ cho phép toàn màn hình.
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === "fullscreen"));
    const { url } = await startStaticServer(path.join(__dirname, "..", "desktop-web"));
    appUrl = url;
    createWindow();
    app.on("activate", () => { if (!window) createWindow(); });
  });

  app.on("window-all-closed", () => app.quit());
}
