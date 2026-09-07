"use client";

import { useEffect, useRef } from "react";
import type { DisplaySettings, SourceMode } from "../types/studio";
import type { useRecorder } from "../hooks/useRecorder";
import { formatTime } from "../utils/media";
import { Icon } from "./Icon";

type Props = {
  recorder: ReturnType<typeof useRecorder>; sourceMode: SourceMode; settings: DisplaySettings;
  ready: boolean; active: boolean; currentTime: number;
  onSettingsChange: (settings: DisplaySettings) => void; onStart: () => void; onPreview: () => void;
};

export function RecordingPanel({ recorder, sourceMode, settings, ready, active, currentTime, onSettingsChange, onStart, onPreview }: Props) {
  const preview = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (!active || recorder.busy) preview.current?.pause(); }, [active, recorder.busy]);
  return (
    <section aria-labelledby="recording-heading">
      <h3 id="recording-heading" className="settings-section-title">Giữ lại một đoạn nhạc</h3>
      <p className="settings-description">Ghi trực tiếp hình ảnh và âm thanh thành video. Không cần chia sẻ màn hình.</p>
      <label htmlFor="clip-duration" className="field-label mt-6">Độ dài tối đa</label>
      <select id="clip-duration" className="text-field" disabled={recorder.busy} value={settings.clipDuration} onChange={event => onSettingsChange({ ...settings, clipDuration: Number(event.target.value) })}>
        {[15, 30, 45, 60, 120, 180].map(seconds => <option value={seconds} key={seconds}>{seconds} giây</option>)}
      </select>
      <p className="field-hint mt-3">Bắt đầu tại {formatTime(currentTime)}; tự dừng khi hết đoạn hoặc hết bài. Giữ tab này mở trong lúc ghi.</p>
      {sourceMode === "youtube" && <p className="field-hint mt-4">YouTube chỉ dùng để tham khảo. Hãy chọn tệp trên máy để ghi và tải video.</p>}
      {!ready && sourceMode === "local" && <p className="field-hint mt-4">Chọn video hoặc âm thanh trước khi bắt đầu.</p>}
      {recorder.busy ? (
        <button type="button" className="primary-button w-full mt-5" onClick={recorder.stop}><Icon name="stop" size={16} /> Dừng ghi · {formatTime(recorder.elapsed)}</button>
      ) : (
        <button type="button" className="primary-button w-full mt-5" disabled={sourceMode !== "local" || !ready} onClick={onStart}><Icon name="record" size={16} /> Bắt đầu ghi</button>
      )}
      {recorder.error && <p role="alert" className="field-error mt-4">{recorder.error}</p>}
      {recorder.result && !recorder.busy && (
        <div className="recording-result">
          <h4 className="field-label">Bản ghi của bạn</h4>
          <video ref={preview} src={recorder.result.url} controls playsInline preload="metadata" className="recording-preview" onPlay={onPreview} />
          <p className="field-hint mt-3">{recorder.result.width} × {recorder.result.height} · {(recorder.result.size / 1024 / 1024).toFixed(1)} MB</p>
          <div className="lrc-actions">
            <a className="primary-button" href={recorder.result.url} download={recorder.result.filename}><Icon name="download" size={16} /> Tải video WebM</a>
            <button type="button" className="file-button" onClick={recorder.clearResult}>Xóa bản ghi</button>
          </div>
        </div>
      )}
      <p className="field-hint mt-5">Bản ghi nằm trong bộ nhớ của trình duyệt. Hãy tải về trước khi tải lại trang.</p>
    </section>
  );
}
