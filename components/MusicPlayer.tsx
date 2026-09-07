import type { ReactNode, Ref } from "react";
import type { PlaybackState } from "../types/studio";
import { formatTime } from "../utils/media";
import { Icon } from "./Icon";

type MusicPlayerProps = {
  title: string; artist: string; children: ReactNode; playback: PlaybackState;
  cleanView: boolean; showProgress: boolean; muted: boolean; busy: boolean;
  settingsRef: Ref<HTMLButtonElement>;
  onOpenSettings: () => void; onToggle: () => void; onSeek: (time: number) => void; onMute: () => void;
};

export function MusicPlayer({ title, artist, children, playback, cleanView, showProgress, muted, busy, settingsRef, onOpenSettings, onToggle, onSeek, onMute }: MusicPlayerProps) {
  // Tệp không khai báo tổng thời lượng vẫn phát được; khi đó chỉ tua trong phần đã tải về.
  const scrubMax = playback.duration || playback.seekableEnd;
  const progress = playback.duration ? Math.min(100, playback.currentTime / playback.duration * 100) : 0;
  // Tua được cả trong lúc ghi; chỉ tạm dừng và tắt tiếng mới làm hỏng bản ghi đang chạy.
  const canScrub = playback.ready && scrubMax > 0;
  return (
    <section className="music-player" aria-labelledby="song-heading">
      {children}
      <div className="song-info">
        <h2 id="song-heading">{title.trim() || "Một khoảng lặng"}</h2>
        <p>{artist.trim() || "Âm thanh của bạn"}</p>
      </div>
      {showProgress && (
        <div className="playback-progress">
          {cleanView ? (
            <div className="progress-track" role="progressbar" aria-label="Tiến trình phát" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
              <span style={{ width: `${progress}%` }} />
            </div>
          ) : (
            <input aria-label="Tua bài hát" className="range-input" type="range" min="0" max={scrubMax || 1} step="0.1"
              value={Math.min(playback.currentTime, scrubMax || 1)} disabled={!canScrub}
              style={{ background: `linear-gradient(to right, #c5cbbf ${progress}%, #ffffff20 ${progress}%)` }}
              onChange={event => onSeek(Number(event.target.value))} />
          )}
          <div className="time-labels"><span>{formatTime(playback.currentTime)}</span><span>{playback.duration ? formatTime(playback.duration) : "--:--"}</span></div>
        </div>
      )}
      {!cleanView && (
        <div className="playback-controls">
          <button ref={settingsRef} type="button" className="icon-button settings-trigger" aria-label="Thiết lập" title="Thiết lập" aria-haspopup="dialog" onClick={onOpenSettings}><Icon name="sliders" size={20} /></button>
          <div className="transport-controls">
            <button type="button" className="icon-button" aria-label="Lùi 10 giây" disabled={!playback.ready} onClick={() => onSeek(playback.currentTime - 10)}><Icon name="rewind" size={23} /></button>
            <button type="button" className="play-button" aria-label={playback.isPlaying ? "Tạm dừng" : "Phát nhạc"} disabled={busy}
              title={busy ? "Đang ghi · dừng nhạc sẽ kết thúc bản ghi" : playback.ready ? undefined : "Chọn một tệp trong phần thiết lập"} onClick={playback.ready ? onToggle : onOpenSettings}>
              <Icon name={playback.isPlaying ? "pause" : "play"} size={30} />
            </button>
            <button type="button" className="icon-button" aria-label="Tiến 10 giây" disabled={!playback.ready} onClick={() => onSeek(playback.currentTime + 10)}><Icon name="forward" size={23} /></button>
          </div>
          <button type="button" className="icon-button volume-button" aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"} title={muted ? "Bật âm thanh" : "Tắt âm thanh"} onClick={onMute} disabled={busy}><Icon name={muted ? "muted" : "volume"} size={18} /></button>
        </div>
      )}
    </section>
  );
}
