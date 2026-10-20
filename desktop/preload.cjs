// Chạy trước mã trang, trong ngữ cảnh cô lập. Trang chỉ nhận vài hàm hẹp thay vì cả ipcRenderer.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
  /** Báo cho tiến trình chính biết có đang ghi hay không: khi đang ghi, thu nhỏ cửa sổ sẽ ẩn xuống khay thay vì tắt dựng hình. */
  setRecording: active => ipcRenderer.send("recording:state", active === true),
  /** Nghe yêu cầu "Dừng ghi" từ menu khay hệ thống. Trả về hàm huỷ đăng ký. */
  onStopRequest: callback => {
    const handler = () => callback();
    ipcRenderer.on("recording:stop", handler);
    return () => ipcRenderer.removeListener("recording:stop", handler);
  },
});
