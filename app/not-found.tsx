import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="eyebrow">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Khoảng lặng này chưa có.</h1>
      <p className="text-sm text-muted">Không tìm thấy trang bạn đang mở.</p>
      <Link href="/" className="primary-button mt-3">Quay về trình phát</Link>
    </main>
  );
}
