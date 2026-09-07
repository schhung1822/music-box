import type { MediaKind } from "../types/studio";

export function formatTime(seconds: number) {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Nhận mọi đuôi tệp trình duyệt có thể mở. Tệp không giải mã được sẽ báo lỗi lúc phát,
// nên danh sách này chỉ cần chặn nhầm ô chứ không chặn theo khả năng giải mã.
const extensions: Record<MediaKind, RegExp> = {
  video: /\.(mp4|m4v|webm|mov|qt|mkv|avi|ogv|ogm|3gp|3g2|mpe?g|m2ts|mts|ts|flv|wmv|asf|divx)$/i,
  audio: /\.(mp3|wav|wave|ogg|oga|opus|weba|m4a|m4b|aac|flac|wma|aif|aiff|aifc|amr|caf|mka|ape)$/i,
  cover: /\.(jpe?g|jfif|png|webp|gif|bmp|avif|heic|heif|tiff?|ico)$/i,
};
// Âm thanh và video dùng chung vỏ chứa: ".m4a" thường được khai báo là "video/mp4",
// còn ".webm" chỉ có tiếng lại là "audio/webm". Chỉ ảnh bìa mới bắt buộc đúng nhóm.
const allowedTypes: Record<MediaKind, RegExp> = { video: /^(video|audio)\//i, audio: /^(audio|video)\//i, cover: /^image\//i };
const labels: Record<MediaKind, string> = { video: "video", audio: "âm thanh", cover: "ảnh bìa" };

export function validateMediaFile(file: Pick<File, "name" | "size" | "type">, kind: MediaKind) {
  if (file.size === 0) return "Tệp đang trống. Vui lòng chọn tệp khác.";
  const type = file.type && file.type !== "application/octet-stream" ? file.type : "";
  if (/^(image|video|audio)\//i.test(type) && !allowedTypes[kind].test(type)) {
    return `Đây không giống tệp ${labels[kind]}. Hãy chọn đúng ô cho tệp này.`;
  }
  // Đuôi tệp được tin trước kiểu MIME vì Windows hay khai báo sai.
  if (extensions[kind].test(file.name)) return null;
  if (!/\.[a-z0-9]{1,5}$/i.test(file.name) && allowedTypes[kind].test(type)) return null;
  return `Định dạng này chưa mở được cho ô ${labels[kind]}. Hãy thử một định dạng khác.`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
