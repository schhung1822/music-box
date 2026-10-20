/**
 * Cầu nối do desktop/preload.cjs gắn vào cửa sổ của bản Windows. Trang web thường không có nó.
 * Bản desktop tắt việc giảm tốc khi cửa sổ ở nền, nên ghi hình vẫn chạy đủ nhịp khi cửa sổ bị che hay ẩn xuống khay.
 */
export type DesktopBridge = {
  isDesktop: true; platform: string; version: string;
  /** Khi đang ghi, thu nhỏ cửa sổ sẽ ẩn xuống khay hệ thống thay vì làm Windows ngừng dựng hình. */
  setRecording: (active: boolean) => void;
  /** Nhận yêu cầu "Dừng ghi" từ menu khay. Trả về hàm huỷ đăng ký. */
  onStopRequest: (callback: () => void) => () => void;
};

declare global {
  interface Window { desktop?: DesktopBridge }
}

export function isDesktopApp() {
  return typeof window !== "undefined" && window.desktop?.isDesktop === true;
}
