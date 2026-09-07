export type SourceMode = "local" | "youtube";
export type VisualMode = "video" | "disc";
export type AspectRatio = "9:16" | "4:3";
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
  clipDuration: number;
};
// Khung dọc dành cho mạng xã hội, khung ngang 4:3 giữ bố cục giống bản desktop.
export const outputDimensions: Record<AspectRatio, [number, number]> = {
  "9:16": [1080, 1920], "4:3": [1440, 1080],
};
