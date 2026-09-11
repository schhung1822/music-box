"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { DisplaySettings, SourceMode, VideoFormat } from "../types/studio";
import type { useRecorder } from "../hooks/useRecorder";
import { formatTime } from "../utils/media";
import { recordableFormats, videoFormatLabels } from "../utils/recordingQuality";
import { Icon } from "./Icon";

type Props = {
  recorder: ReturnType<typeof useRecorder>; sourceMode: SourceMode; settings: DisplaySettings;
  ready: boolean; active: boolean; currentTime: number;
  onSettingsChange: (settings: DisplaySettings) => void; onStart: () => void; onPreview: () => void;
};

// Trên máy chủ chưa có MediaRecorder, nên HTML dựng sẵn giữ nguyên phần ghi chú cho tới khi trình duyệt trả lời.
const keepSnapshot = () => () => {};
const noSnapshot = () => null;

const formats: { value: VideoFormat; note: string }[] = [
  { value: "mp4", note: "H.264, mở được gần như mọi nơi" },
  { value: "webm", note: "VP9 + Opus, tệp nhẹ hơn ở cùng chất lượng" },
];

export function RecordingPanel({ recorder, sourceMode, settings, ready, active, currentTime, onSettingsChange, onStart, onPreview }: Props) {
  const preview = useRef<HTMLVideoElement>(null);
  const recordable = useSyncExternalStore(keepSnapshot, recordableFormats, noSnapshot);
  useEffect(() => { if (!active || recorder.busy) preview.current?.pause(); }, [active, recorder.busy]);
  const fallbackFormat = recordable && !recordable[settings.videoFormat] ? formats.find(format => recordable[format.value])?.value : undefined;
  return (
    <section aria-labelledby="recording-heading">
      <h3 id="recording-heading" className="settings-section-title">Giữ lại một đoạn nhạc</h3>
      <p className="settings-description">Ghi trực tiếp hình ảnh và âm thanh thành video. Không cần chia sẻ màn hình.</p>
      <label htmlFor="clip-duration" className="field-label mt-6">Độ dài tối đa</label>
      <select id="clip-duration" className="text-field" disabled={recorder.busy} value={settings.clipDuration} onChange={event => onSettingsChange({ ...settings, clipDuration: Number(event.target.value) })}>
        {[15, 30, 45, 60, 120, 180].map(seconds => <option value={seconds} key={seconds}>{seconds} giây</option>)}
      </select>
      <p className="field-hint mt-3">Bắt đầu tại {formatTime(currentTime)}; tự dừng khi hết đoạn hoặc hết bài. Giữ tab này mở trong lúc ghi.</p>
      <fieldset className="mt-6" disabled={recorder.busy}>
        <legend className="field-label">Định dạng tệp</legend>
        <div className="format-grid">
          {formats.map(format => (
            <label key={format.value} className={`format-option${settings.videoFormat === format.value ? " format-selected" : ""}`}>
              <input type="radio" name="video-format" value={format.value} checked={settings.videoFormat === format.value}
                onChange={() => onSettingsChange({ ...settings, videoFormat: format.value })} className="sr-only" />
              <span>{videoFormatLabels[format.value]}</span>
              <span className="field-hint format-note">{format.note}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {fallbackFormat
        ? <p className="field-error mt-3">Trình duyệt này chưa ghi thẳng được {videoFormatLabels[settings.videoFormat]}. Bản ghi sẽ được lưu thành {videoFormatLabels[fallbackFormat]}.</p>
        : <p className="field-hint mt-3">MP4 dùng được ngay khi đăng lên mạng xã hội hoặc mở bằng trình phát có sẵn. Ghi thẳng MP4 cần Chrome hoặc Edge bản 130 trở lên.</p>}
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
          <p className="field-hint mt-3">{videoFormatLabels[recorder.result.format]}{recorder.result.codecs && ` · ${recorder.result.codecs}`} · {recorder.result.width} × {recorder.result.height} · Mục tiêu {recorder.result.frameRate} fps · {(recorder.result.size / 1024 / 1024).toFixed(1)} MB</p>
          {recorder.result.format !== recorder.result.requestedFormat && <p className="field-hint mt-2">Trình duyệt chưa ghi được {videoFormatLabels[recorder.result.requestedFormat]} nên bản ghi này là {videoFormatLabels[recorder.result.format]}.</p>}
          <div className="lrc-actions">
            <a className="primary-button" href={recorder.result.url} download={recorder.result.filename}><Icon name="download" size={16} /> Tải video {videoFormatLabels[recorder.result.format]}</a>
            <button type="button" className="file-button" onClick={recorder.clearResult}>Xóa bản ghi</button>
          </div>
        </div>
      )}
      <p className="field-hint mt-5">Bản ghi nằm trong bộ nhớ của trình duyệt. Hãy tải về trước khi tải lại trang.</p>
    </section>
  );
}
