"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, Ref } from "react";
import type { PlaybackState } from "../types/studio";
import { card, cardBackdropSrc, cardCredit, cardOffsets, fitCardScale } from "../utils/cardLayout";
import { formatRemaining, formatTime } from "../utils/media";
import { Icon } from "./Icon";

/** Ảnh nền của trang: ảnh danh sách nhạc làm mờ. Bản ghi lấy lại chính phần tử ảnh này để vẽ nền. */
export function CardBackdrop({ imageRef }: { imageRef: Ref<HTMLImageElement> }) {
  return (
    <div className="card-backdrop" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- Ảnh nền nằm trong public/ và còn được bản ghi vẽ lại, không qua bộ tối ưu ảnh. */}
      <img ref={imageRef} src={cardBackdropSrc} alt="" draggable={false} onError={event => { event.currentTarget.style.visibility = "hidden"; }} />
    </div>
  );
}

type CardPlayerProps = {
  title: string; artist: string; playback: PlaybackState; children: ReactNode;
  /** Vùng lời hát nằm cuối thẻ; bỏ trống khi tắt lời. */
  lyrics?: ReactNode;
  cleanView: boolean; showProgress: boolean; muted: boolean; busy: boolean;
  settingsRef: Ref<HTMLButtonElement>;
  onOpenSettings: () => void; onToggle: () => void; onSeek: (time: number) => void; onMute: () => void;
};

/**
 * Thanh kéo kiểu iOS: rãnh bo tròn, phần đã đầy màu trắng, không có núm. Ô nhập thật nằm trong suốt phía trên
 * để bàn phím và màn hình cảm ứng vẫn hoạt động như thanh trượt thường.
 */
function Seek({ label, value, max, step, fraction, disabled, onChange }: { label: string; value: number; max: number; step: number; fraction: number; disabled?: boolean; onChange: (value: number) => void }) {
  return (
    <div className="card-seek" data-disabled={disabled || undefined}>
      <div className="card-track"><span style={{ width: `${fraction * 100}%` }} /></div>
      <input type="range" aria-label={label} min="0" max={max} step={step} value={value} disabled={disabled} onChange={event => onChange(Number(event.target.value))} />
    </div>
  );
}

export function CardPlayer({ title, artist, playback, children, lyrics, cleanView, showProgress, muted, busy, settingsRef, onOpenSettings, onToggle, onSeek, onMute }: CardPlayerProps) {
  const fit = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const controls = !cleanView;
  const hasLyrics = Boolean(lyrics);
  const layout = cardOffsets({ progress: showProgress, controls, lyrics: hasLyrics });

  // Thẻ luôn dựng ở cỡ 360 đơn vị rồi phóng cho vừa cửa sổ; ResizeObserver báo ngay lần đo đầu tiên.
  useLayoutEffect(() => {
    const element = fit.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setScale(fitCardScale(element.clientWidth, element.clientHeight, { progress: showProgress, controls, lyrics: hasLyrics }, 2.4)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [showProgress, controls, hasLyrics]);

  const scrubMax = playback.duration || playback.seekableEnd;
  const progress = playback.duration ? Math.min(1, playback.currentTime / playback.duration) : 0;
  const canScrub = playback.ready && scrubMax > 0;
  const style = {
    "--card-w": `${card.width}px`, "--card-h": `${layout.height}px`, "--card-scale": scale, "--card-pad": `${card.pad}px`, "--card-radius": `${card.radius}px`,
    "--card-info-top": `${card.infoTop}px`, "--card-title-size": `${card.titleSize}px`, "--card-title-line": card.titleLine, "--card-title-tracking": `${card.titleTracking}px`,
    "--card-artist-top": `${card.artistTop}px`, "--card-artist-size": `${card.artistSize}px`, "--card-artist-line": card.artistLine,
    "--card-bar-top": `${card.barTop}px`, "--card-bar-h": `${card.barHeight}px`, "--card-time-top": `${card.timeTop}px`, "--card-time-size": `${card.timeSize}px`, "--card-time-line": card.timeLine,
    "--card-controls-top": `${card.controlsTop}px`, "--card-controls-h": `${card.controlsHeight}px`,
    "--card-lyrics-top": `${card.lyricsTop}px`, "--card-credit-top": `${card.creditTop}px`, "--card-credit-size": `${card.creditSize}px`, "--card-credit-line": card.creditLine, "--card-credit-tracking": `${card.creditTracking}px`, "--card-lyrics-h": `${card.lyricPad + card.lyricRows}px`,
    "--card-lyric-size": `${card.lyricSize}px`, "--card-lyric-line": card.lyricLine, "--card-lyric-tracking": `${card.lyricTracking}px`, "--card-lyric-gap": `${card.lyricGap}px`,
    "--card-lyric-pad": `${card.lyricPad}px`, "--card-lyric-lines": card.lyricHardLines, "--card-next-alpha": card.nextAlpha,
  } as CSSProperties;

  return (
    <div ref={fit} className="card-fit">
      <div className="card-box" style={{ width: card.width * scale, height: layout.height * scale }}>
        <section className="card-player" aria-labelledby="song-heading" style={style}>
          <div className="card-art">{children}</div>
          <div className="card-info">
            <h2 id="song-heading">{title.trim() || "Hunq.lofi"}</h2>
            <p>{artist.trim() || "Tên nghệ sĩ"}</p>
          </div>
          {showProgress && (
            <div className="card-progress">
              {cleanView ? (
                <div className="card-track" role="progressbar" aria-label="Tiến trình phát" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><span style={{ width: `${progress * 100}%` }} /></div>
              ) : (
                <Seek label="Tua bài hát" value={Math.min(playback.currentTime, scrubMax || 1)} max={scrubMax || 1} step={.1} fraction={progress} disabled={!canScrub} onChange={onSeek} />
              )}
              <div className="card-times"><span>{formatTime(playback.currentTime)}</span><span>{formatRemaining(playback.currentTime, playback.duration)}</span></div>
            </div>
          )}
          {!cleanView && (
            <div className="card-controls">
                <button ref={settingsRef} type="button" className="card-button card-settings" aria-label="Thiết lập" title="Thiết lập" aria-haspopup="dialog" onClick={onOpenSettings}><Icon name="sliders" size={20} /></button>
                <div className="card-transport">
                  <button type="button" className="card-button" aria-label="Lùi 10 giây" title="Lùi 10 giây" disabled={!playback.ready} onClick={() => onSeek(playback.currentTime - 10)}><Icon name="skipBack" size={28} /></button>
                  <button type="button" className="card-button card-play" aria-label={playback.isPlaying ? "Tạm dừng" : "Phát nhạc"} disabled={busy}
                    title={busy ? "Đang ghi · dừng nhạc sẽ kết thúc bản ghi" : playback.ready ? undefined : "Chọn một tệp trong phần thiết lập"} onClick={playback.ready ? onToggle : onOpenSettings}>
                    <Icon name={playback.isPlaying ? "pause" : "play"} size={34} />
                  </button>
                  <button type="button" className="card-button" aria-label="Tiến 10 giây" title="Tiến 10 giây" disabled={!playback.ready} onClick={() => onSeek(playback.currentTime + 10)}><Icon name="skipForward" size={28} /></button>
                </div>
                <button type="button" className="card-button card-mute" aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"} title={muted ? "Bật âm thanh" : "Tắt âm thanh"} disabled={busy} onClick={onMute}><Icon name={muted ? "muted" : "volume"} size={20} /></button>
              </div>
          )}
          {lyrics}
          <p className="card-credit">{cardCredit}</p>
        </section>
      </div>
    </div>
  );
}
