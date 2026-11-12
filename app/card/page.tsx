import type { Metadata } from "next";
import { Studio } from "@/components/Studio";

export const metadata: Metadata = {
  title: "Hunq.lofi - Fantasic",
  description: "Thẻ nhạc kính mờ trên nền danh sách nhạc: video vuông, thanh thời gian và lời chạy từ dưới lên. Mọi nội dung của bạn chỉ nằm trong trình duyệt.",
};

export default function CardPage() {
  return <Studio variant="card" />;
}
