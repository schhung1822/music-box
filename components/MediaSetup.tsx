"use client";

import { useId, useRef, useState } from "react";
import type { LocalAssets, MediaKind, SourceMode } from "../types/studio";
import { Icon } from "./Icon";

// Hộp thoại chọn tệp của hệ điều hành ẩn hẳn những tệp nằm ngoài "accept", nên danh sách phải rộng:
// Windows không gán kiểu MIME cho nhiều đuôi (.mkv, .flac), vì vậy liệt kê cả đuôi lẫn nhóm MIME.
const mediaTypes = {
  video: { label: "Chọn video", icon: "video", accept: "video/*,.mp4,.m4v,.webm,.mov,.mkv,.avi,.ogv,.3gp,.mpg,.mpeg,.ts,.flv,.wmv", formats: "MP4, WebM, MOV, MKV…" },
  audio: { label: "Chọn âm thanh", icon: "music", accept: "audio/*,.mp3,.wav,.ogg,.oga,.opus,.m4a,.aac,.flac,.wma,.aiff,.amr", formats: "MP3, WAV, M4A, FLAC…" },
  cover: { label: "Chọn ảnh bìa", icon: "image", accept: "image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.heic", formats: "JPG, PNG, WebP…" },
} as const;

function FilePicker({ kind, assets, onFileChange }: { kind: MediaKind; assets: LocalAssets; onFileChange: (kind: MediaKind, file: File | null) => string | null }) {
  const config = mediaTypes[kind];
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const file = assets[kind]?.file;
  return (
    <div className="file-picker">
      <label className={`upload-tile${file ? " file-selected" : ""}`}>
        <input ref={input} type="file" aria-label={config.label} aria-describedby={error ? `${id}-error` : undefined} aria-invalid={Boolean(error)} accept={config.accept}
          onChange={event => {
            const selected = event.target.files?.[0];
            if (!selected) return;
            setError(onFileChange(kind, selected) || "");
            event.target.value = "";
          }} />
        <Icon name={file ? "check" : config.icon} size={22} />
        <span className="file-name" title={file?.name}>{file ? file.name : config.label}</span>
        <span className="file-formats">{file ? "Đã chọn · nhấn để đổi" : config.formats}</span>
      </label>
      {file && <button type="button" aria-label={`Xóa tệp: ${file.name}`} className="remove-file" onClick={() => { onFileChange(kind, null); setError(""); }}><Icon name="close" size={12} /> Xóa</button>}
      {error && <p id={`${id}-error`} role="alert" className="field-error">{error}</p>}
    </div>
  );
}

type MediaSetupProps = {
  title: string; artist: string; onTitleChange: (value: string) => void; onArtistChange: (value: string) => void;
  sourceMode: SourceMode; onSourceModeChange: (value: SourceMode) => void;
  assets: LocalAssets; onFileChange: (kind: MediaKind, file: File | null) => string | null;
  onYouTubeLoad: (url: string) => string | null;
  volume: number; muted: boolean; onVolumeChange: (value: number) => void; onMutedChange: (value: boolean) => void;
};

export function MediaSetup({ title, artist, onTitleChange, onArtistChange, sourceMode, onSourceModeChange, assets, onFileChange, onYouTubeLoad, volume, muted, onVolumeChange, onMutedChange }: MediaSetupProps) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [error, setError] = useState("");
  return (
    <section aria-labelledby="media-heading">
      <h3 id="media-heading" className="settings-section-title">Bắt đầu từ một giai điệu</h3>
      <p className="settings-description">Tệp được phát trực tiếp từ thiết bị của bạn.</p>
      <div className="segmented-control mt-6" role="group" aria-label="Nguồn phát">
        <button type="button" aria-pressed={sourceMode === "local"} onClick={() => onSourceModeChange("local")}>Tệp trên máy</button>
        <button type="button" aria-pressed={sourceMode === "youtube"} onClick={() => onSourceModeChange("youtube")}>YouTube</button>
      </div>
      <div hidden={sourceMode !== "local"} className="mt-5">
        <div className="upload-grid">{(["video", "audio", "cover"] as const).map(kind => <FilePicker key={kind} kind={kind} assets={assets} onFileChange={onFileChange} />)}</div>
        <p className="field-hint mt-3">Khi chọn cả hai, âm thanh là nhạc nền chính; video phát lặp làm hình nền. Ảnh bìa cũng được dùng trên đĩa quay.</p>
        <p className="field-hint mt-2">Nếu trình duyệt không mở được một định dạng lạ, ứng dụng sẽ báo ngay để bạn đổi tệp khác.</p>
      </div>
      <form hidden={sourceMode !== "youtube"} className="mt-5" onSubmit={event => { event.preventDefault(); setError(onYouTubeLoad(youtubeUrl) || ""); }}>
        <label htmlFor="youtube-url" className="field-label">Liên kết YouTube</label>
        <input id="youtube-url" type="url" required className="text-field" placeholder="Dán liên kết video YouTube" value={youtubeUrl} onChange={event => setYoutubeUrl(event.target.value)} />
        <button type="submit" className="primary-button mt-3">Mở video</button>
        {error && <p className="field-error mt-3" role="alert">{error}</p>}
        <p className="field-hint mt-3">Trình phát YouTube chính thức cần kết nối mạng. Chỉ dùng để xem và nghe; không tải nội dung hoặc ghi xuất từ YouTube.</p>
      </form>
      <div className="metadata-fields">
        <div><label htmlFor="song-title" className="field-label">Tên bài hát</label><input id="song-title" className="text-field" placeholder="Một khoảng lặng" value={title} maxLength={160} onChange={event => onTitleChange(event.target.value)} /></div>
        <div><label htmlFor="artist" className="field-label">Nghệ sĩ</label><input id="artist" className="text-field" placeholder="Âm thanh của bạn" value={artist} maxLength={160} onChange={event => onArtistChange(event.target.value)} /></div>
      </div>
      <div className="settings-divider" />
      <label htmlFor="volume" className="field-label">Âm lượng · {Math.round(volume * 100)}%</label>
      <input id="volume" className="range-input volume-range" type="range" min="0" max="1" step="0.01" value={volume} onChange={event => { onVolumeChange(Number(event.target.value)); onMutedChange(false); }} />
      <label className="checkbox-label mt-4"><input type="checkbox" checked={muted} onChange={event => onMutedChange(event.target.checked)} /> Tắt âm thanh</label>
    </section>
  );
}
