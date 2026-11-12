// Hai giao diện cùng một bộ máy phát và ghi hình: "classic" là trang gốc, "card" là thẻ nhạc kính mờ ở /card.
export type StudioVariant = "classic" | "card";
export type SourceMode = "local" | "youtube";
export type VisualMode = "video" | "disc";
// Nền trang: "default" là nền tối sẵn có, ba giá trị còn lại là nền WebGL của React Bits.
export type BackgroundMode = "default" | "molten" | "waves" | "liquid";
export type AspectRatio = "9:16" | "4:3";
// Định dạng tệp xuất ra: MP4 (H.264 + AAC) mở được ở hầu hết nơi, WebM (VP9 + Opus) nén tốt hơn.
export type VideoFormat = "mp4" | "webm";
// Cách lời hát chuyển câu: trượt cuộn (mặc định), tô sáng chạy theo nhịp hát, hoặc hiện từng chữ.
export type LyricEffect = "scroll" | "sweep" | "words";
export type MediaKind = "video" | "audio" | "cover";
export type LocalAsset = { file: File; url: string };
export type LocalAssets = Partial<Record<MediaKind, LocalAsset>>;
export type LyricLine = { id: string; time: number | null; text: string };
export type PlaybackState = { currentTime: number; duration: number; seekableEnd: number; isPlaying: boolean; ready: boolean };
export type DisplaySettings = {
  visualMode: VisualMode;
  showLyrics: boolean;
  showProgress: boolean;
  showControls: boolean;
  aspectRatio: AspectRatio;
  videoFormat: VideoFormat;
  clipDuration: number;
  /** Thu phóng video trong khung vuông: 1 là lấp đầy khung (cạnh ngắn vừa khung), nhỏ hơn 1 là thu nhỏ để thấy thêm hình. */
  videoZoom: number;
  /** Dời video trong khung, tính theo cạnh khung: dương là sang phải/xuống dưới, 0 là canh giữa. */
  videoOffsetX: number;
  videoOffsetY: number;
  lyricEffect: LyricEffect;
  /** Đưa nền động đang chạy vào video. Chỉ có tác dụng khi chọn một nền WebGL. */
  backdropInVideo: boolean;
};
export const maxVideoZoom = 2;
// Khung dọc dành cho mạng xã hội, khung ngang 4:3 giữ bố cục giống bản desktop.
export const outputDimensions: Record<AspectRatio, [number, number]> = {
  "9:16": [1080, 1920], "4:3": [1440, 1080],
};
