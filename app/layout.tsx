import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Khoảng lặng — Không gian âm nhạc của bạn",
  description: "Một không gian tối giản dành cho giai điệu, hình ảnh và lời bài hát. Mọi nội dung của bạn chỉ nằm trong trình duyệt.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
