/* eslint-disable @next/next/no-img-element -- Object URLs stay local and must not pass through an image optimizer. */
import type { RefObject } from "react";
import type { LocalAssets, SourceMode, VisualMode } from "../types/studio";

export function PlaceholderArtwork() {
  return <div className="placeholder-art" role="img" aria-label="Vầng trăng ấm trên những ngọn đồi xanh thẫm">
    <div className="artwork-glow" /><div className="artwork-sun" />
    <div className="landscape-ridge ridge-back" /><div className="landscape-ridge ridge-middle" />
    <div className="landscape-ridge ridge-front" /><div className="landscape-ridge ridge-near" /><div className="artwork-texture" />
  </div>;
}

type MediaFrameProps = {
  assets: LocalAssets; sourceMode: SourceMode; visualMode: VisualMode;
  currentTime: number; isPlaying: boolean;
  videoRef: RefObject<HTMLVideoElement | null>; audioRef: RefObject<HTMLAudioElement | null>;
  coverRef: RefObject<HTMLImageElement | null>; youtubeRef: RefObject<HTMLDivElement | null>;
  youtubeLoaded: boolean; onError: (message: string) => void;
};

export function MediaFrame({ assets, sourceMode, visualMode, currentTime, isPlaying, videoRef, audioRef, coverRef, youtubeRef, youtubeLoaded, onError }: MediaFrameProps) {
  const disc = sourceMode === "local" && visualMode === "disc";
  const localVideo = sourceMode === "local" && visualMode === "video" && Boolean(assets.video);
  return (
    <div className={`media-frame${disc ? " disc-frame" : ""}`}>
      <audio ref={audioRef} src={assets.audio?.url} preload="metadata" />
      <video
        ref={videoRef} src={assets.video?.url} playsInline preload="auto"
        className="local-video" hidden={!localVideo}
        onError={() => { if (assets.video) onError("Không đọc được video. Hãy thử tệp MP4 hoặc WebM khác."); }}
      />
      <div className="youtube-frame" ref={youtubeRef} hidden={sourceMode !== "youtube" || !youtubeLoaded} />
      <div className={disc ? "vinyl-disc" : "cover-art"} hidden={localVideo || (sourceMode === "youtube" && youtubeLoaded)}
        style={disc ? { transform: `rotate(${currentTime * 30}deg)`, transition: isPlaying ? "transform 90ms linear" : "none" } : undefined}>
        {disc && <div className="vinyl-grooves" />}
        <div className={disc ? "vinyl-label" : "cover-image"}>
          <PlaceholderArtwork />
        </div>
        {disc && <span className="vinyl-spindle" />}
      </div>
      <div className={disc ? "vinyl-cover" : "cover-image uploaded-cover"}
        hidden={!assets.cover || localVideo || sourceMode === "youtube"}
        style={disc ? { transform: `translate(-50%, -50%) rotate(${currentTime * 30}deg)`, transition: isPlaying ? "transform 90ms linear" : "none" } : undefined}>
        <img ref={coverRef} src={assets.cover?.url} alt="Ảnh bìa do bạn chọn" draggable={false}
          onLoad={event => { event.currentTarget.style.visibility = "visible"; }}
          onError={event => { event.currentTarget.style.visibility = "hidden"; if (assets.cover) onError("Không đọc được ảnh bìa. Hãy chọn JPG, PNG hoặc WebP khác."); }} />
        {disc && <span className="vinyl-spindle" />}
      </div>
    </div>
  );
}
