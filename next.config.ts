import type { NextConfig } from "next";

// Bản Windows nạp thẳng thư mục xuất tĩnh nên cần xuất tĩnh. Bản web giữ nguyên cách build cũ.
const desktop = process.env.DESKTOP_BUILD === "1";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Xuất tĩnh vào desktop-web/ (Next ghi bản xuất vào distDir), tách khỏi .next nên không đè lên máy chủ phát triển đang chạy.
  ...(desktop && { output: "export", distDir: "desktop-web" }),
};

export default nextConfig;
