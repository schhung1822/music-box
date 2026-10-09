/* eslint-disable @next/next/no-img-element -- Object URLs stay local and must not pass through an image optimizer. */
import type { CSSProperties, RefObject } from "react";
import { maxVideoZoom, type LocalAssets, type SourceMode, type VisualMode } from "../types/studio";
import { clampVideoZoom, fitVideoZoom } from "../utils/media";
import { Icon } from "./Icon";

export function PlaceholderArtwork() {
  return <div className="placeholder-art" role="img" aria-label="Vầng trăng ấm trên những ngọn đồi xanh thẫm">
    <div className="artwork-glow" /><div className="artwork-sun" />
    <div className="landscape-ridge ridge-back" /><div className="landscape-ridge ridge-middle" />
    <div className="landscape-ridge ridge-front" /><div className="landscape-ridge ridge-near" /><div className="artwork-texture" />
  </div>;
}

export type VideoSize = [width: number, height: number];

type MediaFrameProps = {
  assets: LocalAssets; sourceMode: SourceMode; visualMode: VisualMode;
  currentTime: number; isPlaying: boolean;
  videoRef: RefObject<HTMLVideoElement | null>; audioRef: RefObject<HTMLAudioElement | null>;
  coverRef: RefObject<HTMLImageElement | null>; youtubeRef: RefObject<HTMLDivElement | null>;
  youtubeLoaded: boolean; onError: (message: string) => void;
  videoZoom: number; videoSize: VideoSize | null; zoomable: boolean;
  onVideoSize: (size: VideoSize | null) => void; onVideoZoomChange: (zoom: number) => void;
};

const zoomStep = .1;

/** Thanh thu phóng nằm ngay trên khung, để người dùng thấy video đổi trong lúc kéo. */
function VideoZoomControl({ zoom, fit, onChange }: { zoom: number; fit: number; onChange: (zoom: number) => void }) {
  const set = (value: number) => onChange(Math.min(maxVideoZoom, Math.max(fit, Math.round(value * 100) / 100)));
  const fitted = zoom <= fit + .005;
  return (
    <div className="video-zoom" role="group" aria-label="Thu phóng video">
      <button type="button" className="icon-button" aria-label="Thu nhỏ video" disabled={fitted} onClick={() => set(zoom - zoomStep)}><Icon name="minus" size={15} /></button>
      <input type="range" className="range-input" aria-label="Mức thu phóng video" aria-valuetext={`${Math.round(zoom * 100)}%`}
        min={fit} max={maxVideoZoom} step={.01} value={zoom} onChange={event => set(Number(event.target.value))} />
      <button type="button" className="icon-button" aria-label="Phóng to video" disabled={zoom >= maxVideoZoom} onClick={() => set(zoom + zoomStep)}><Icon name="plus" size={15} /></button>
      <span className="video-zoom-value">{Math.round(zoom * 100)}%</span>
      {fit < 1 && <button type="button" className="video-zoom-preset" onClick={() => set(fitted ? 1 : fit)}>{fitted ? "Lấp đầy" : "Vừa khung"}</button>}
    </div>
  );
}

export function MediaFrame({ assets, sourceMode, visualMode, currentTime, isPlaying, videoRef, audioRef, coverRef, youtubeRef, youtubeLoaded, onError, videoZoom, videoSize, zoomable, onVideoSize, onVideoZoomChange }: MediaFrameProps) {
  const disc = sourceMode === "local" && visualMode === "disc";
  const localVideo = sourceMode === "local" && visualMode === "video" && Boolean(assets.video);
  const zoom = videoSize ? clampVideoZoom(videoZoom, ...videoSize) : 1;
  // Hộp vuông đủ lớn để cạnh ngắn của video bằng `zoom` lần khung; object-fit: contain đặt video vào giữa hộp.
  // Cách đo này trùng với drawCrop bên renderScene, nên bản ghi giữ đúng khung đang thấy.
  const videoStyle: CSSProperties | undefined = videoSize ? {
    // maxWidth: Tailwind preflight giới hạn video ở 100% bề ngang, sẽ bóp méo hộp khi phóng to.
    inset: "auto", top: "50%", left: "50%", maxWidth: "none", objectFit: "contain", transform: "translate(-50%, -50%)",
    width: `${zoom / fitVideoZoom(...videoSize) * 100}%`, height: `${zoom / fitVideoZoom(...videoSize) * 100}%`,
  } : undefined;
  return (
    <div className={`media-frame${disc ? " disc-frame" : ""}`}>
      <audio ref={audioRef} src={assets.audio?.url} preload="metadata" />
      <video
        ref={videoRef} src={assets.video?.url} playsInline preload="auto"
        className="local-video" hidden={!localVideo} style={videoStyle}
        onLoadedMetadata={event => onVideoSize(event.currentTarget.videoWidth > 0 ? [event.currentTarget.videoWidth, event.currentTarget.videoHeight] : null)}
        onEmptied={() => onVideoSize(null)}
        onError={() => { if (assets.video) onError("Không đọc được video. Hãy thử tệp MP4 hoặc WebM khác."); }}
      />
      {localVideo && zoomable && videoSize && <VideoZoomControl zoom={zoom} fit={fitVideoZoom(...videoSize)} onChange={onVideoZoomChange} />}
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
