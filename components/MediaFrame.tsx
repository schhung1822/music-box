/* eslint-disable @next/next/no-img-element -- Object URLs stay local and must not pass through an image optimizer. */
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { maxVideoZoom, type LocalAssets, type SourceMode, type VisualMode } from "../types/studio";
import { clampVideoOffset, clampVideoZoom, fitVideoZoom } from "../utils/media";
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
  /** Độ dời video theo cạnh khung: [ngang, dọc]. */
  videoOffset: [x: number, y: number]; onVideoOffsetChange: (x: number, y: number) => void;
  /** Ảnh thay cho phong cảnh vẽ sẵn khi chưa có video hay ảnh bìa; `placeholderRef` để bản ghi lấy lại đúng ảnh này. */
  placeholderSrc?: string; placeholderRef?: RefObject<HTMLImageElement | null>;
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

const nudgeStep = .02;

/** Nút dời video: nhấn một lần dời một nấc, giữ thì dời liên tục. Bàn phím dùng sự kiện click như nút thường. */
function NudgeButton({ label, icon, onNudge }: { label: string; icon: "up" | "down" | "left" | "right"; onNudge: () => void }) {
  const latest = useRef(onNudge);
  const timers = useRef<{ delay?: number; repeat?: number }>({});
  useEffect(() => { latest.current = onNudge; });
  const stop = () => { window.clearTimeout(timers.current.delay); window.clearInterval(timers.current.repeat); };
  useEffect(() => stop, []);
  return (
    <button type="button" className="icon-button" aria-label={label} title={label}
      onPointerDown={event => {
        if (event.button !== 0) return;
        stop(); latest.current();
        timers.current.delay = window.setTimeout(() => { timers.current.repeat = window.setInterval(() => latest.current(), 45); }, 350);
      }}
      onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onClick={event => { if (event.detail === 0) onNudge(); }}><Icon name={icon} size={15} /></button>
  );
}

/** Thanh dời video nằm trên đầu khung, cùng kiểu với thanh thu phóng ở đáy. Kéo thẳng trên video cũng được. */
function VideoPanControl({ offset, onChange }: { offset: [number, number]; onChange: (x: number, y: number) => void }) {
  const moved = offset[0] !== 0 || offset[1] !== 0;
  return (
    <div className="video-pan" role="group" aria-label="Vị trí video">
      <NudgeButton label="Dời video sang trái" icon="left" onNudge={() => onChange(offset[0] - nudgeStep, offset[1])} />
      <NudgeButton label="Dời video lên" icon="up" onNudge={() => onChange(offset[0], offset[1] - nudgeStep)} />
      <NudgeButton label="Dời video xuống" icon="down" onNudge={() => onChange(offset[0], offset[1] + nudgeStep)} />
      <NudgeButton label="Dời video sang phải" icon="right" onNudge={() => onChange(offset[0] + nudgeStep, offset[1])} />
      <button type="button" className="icon-button" aria-label="Canh giữa video" title="Canh giữa video" disabled={!moved} onClick={() => onChange(0, 0)}><Icon name="center" size={15} /></button>
    </div>
  );
}

export function MediaFrame({ assets, sourceMode, visualMode, currentTime, isPlaying, videoRef, audioRef, coverRef, youtubeRef, youtubeLoaded, onError, videoZoom, videoSize, zoomable, onVideoSize, onVideoZoomChange, videoOffset, onVideoOffsetChange, placeholderSrc, placeholderRef }: MediaFrameProps) {
  const drag = useRef<{ id: number; x: number; y: number; offsetX: number; offsetY: number; size: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const disc = sourceMode === "local" && visualMode === "disc";
  const localVideo = sourceMode === "local" && visualMode === "video" && Boolean(assets.video);
  const zoom = videoSize ? clampVideoZoom(videoZoom, ...videoSize) : 1;
  // Cùng giới hạn với drawCrop, nên bản ghi giữ đúng vị trí đang thấy.
  const [offsetX, offsetY] = videoSize ? clampVideoOffset(videoOffset[0], videoOffset[1], zoom, ...videoSize) : [0, 0];
  const pannable = localVideo && zoomable && Boolean(videoSize);
  // Hộp vuông đủ lớn để cạnh ngắn của video bằng `zoom` lần khung; object-fit: contain đặt video vào giữa hộp.
  // Cách đo này trùng với drawCrop bên renderScene, nên bản ghi giữ đúng khung đang thấy.
  const videoStyle: CSSProperties | undefined = videoSize ? {
    // maxWidth: Tailwind preflight giới hạn video ở 100% bề ngang, sẽ bóp méo hộp khi phóng to.
    inset: "auto", top: `${50 + offsetY * 100}%`, left: `${50 + offsetX * 100}%`, maxWidth: "none", objectFit: "contain", transform: "translate(-50%, -50%)",
    width: `${zoom / fitVideoZoom(...videoSize) * 100}%`, height: `${zoom / fitVideoZoom(...videoSize) * 100}%`,
  } : undefined;
  return (
    <div className={`media-frame${disc ? " disc-frame" : ""}${pannable ? " pannable" : ""}${panning ? " panning" : ""}`}
      onPointerDown={event => {
        if (!pannable || !videoSize || event.button !== 0 || (event.target as Element).closest(".video-zoom, .video-pan")) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, offsetX, offsetY, size: event.currentTarget.getBoundingClientRect().width || 1 };
        setPanning(true);
      }}
      onPointerMove={event => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId || !videoSize) return;
        onVideoOffsetChange(...clampVideoOffset(start.offsetX + (event.clientX - start.x) / start.size, start.offsetY + (event.clientY - start.y) / start.size, zoom, ...videoSize));
      }}
      onPointerUp={event => { if (drag.current?.id === event.pointerId) { drag.current = null; setPanning(false); } }}
      onPointerCancel={() => { drag.current = null; setPanning(false); }}>
      <audio ref={audioRef} src={assets.audio?.url} preload="metadata" />
      <video
        ref={videoRef} src={assets.video?.url} playsInline preload="auto"
        className="local-video" hidden={!localVideo} style={videoStyle}
        onLoadedMetadata={event => onVideoSize(event.currentTarget.videoWidth > 0 ? [event.currentTarget.videoWidth, event.currentTarget.videoHeight] : null)}
        onEmptied={() => onVideoSize(null)}
        onError={() => { if (assets.video) onError("Không đọc được video. Hãy thử tệp MP4 hoặc WebM khác."); }}
      />
      {pannable && <VideoPanControl offset={[offsetX, offsetY]} onChange={(x, y) => videoSize && onVideoOffsetChange(...clampVideoOffset(x, y, zoom, ...videoSize))} />}
      {localVideo && zoomable && videoSize && <VideoZoomControl zoom={zoom} fit={fitVideoZoom(...videoSize)} onChange={onVideoZoomChange} />}
      <div className="youtube-frame" ref={youtubeRef} hidden={sourceMode !== "youtube" || !youtubeLoaded} />
      <div className={disc ? "vinyl-disc" : "cover-art"} hidden={localVideo || (sourceMode === "youtube" && youtubeLoaded)}
        style={disc ? { transform: `rotate(${currentTime * 30}deg)`, transition: isPlaying ? "transform 90ms linear" : "none" } : undefined}>
        {disc && <div className="vinyl-grooves" />}
        <div className={disc ? "vinyl-label" : "cover-image"}>
          {placeholderSrc
            ? <img ref={placeholderRef} className="placeholder-image" src={placeholderSrc} alt="Ảnh mặc định" draggable={false} />
            : <PlaceholderArtwork />}
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
