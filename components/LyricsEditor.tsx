"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LyricLine } from "../types/studio";
import { formatLyricsDraft, parseLyrics, serializeLrc, shiftLyrics } from "../utils/lyrics";
import { downloadBlob, formatTime } from "../utils/media";
import { Icon } from "./Icon";
import { LyricsSearch } from "./LyricsSearch";

type LyricsEditorProps = {
  lines: LyricLine[]; activeIndex: number;
  onApply: (lines: LyricLine[]) => void;
  onUpdate: (lines: LyricLine[]) => void;
  onSelect: (index: number) => void; getCurrentTime: () => number;
  isPlaying: boolean; currentTime: number; duration: number; ready: boolean;
  title: string; artist: string;
  onTogglePlay: () => void; active: boolean;
};

// Bước dịch nhanh, tính bằng giây. Số âm cho lời hiện sớm hơn, số dương cho lời hiện trễ hơn.
const quickSteps = [-1, -.5, -.1, .1, .5, 1];
function stepLabel(step: number) {
  const size = Math.abs(step);
  return `${step > 0 ? "+" : "−"}${size < 1 ? `${Math.round(size * 1000)}ms` : `${size}s`}`;
}

export function LyricsEditor({ lines, activeIndex, onApply, onUpdate, onSelect, getCurrentTime, currentTime, duration, isPlaying, ready, title, artist, onTogglePlay, active }: LyricsEditorProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [syncIndex, setSyncIndex] = useState<number | null>(null);
  const [shift, setShift] = useState(0);
  const [stepMs, setStepMs] = useState(250);
  const syncArea = useRef<HTMLDivElement>(null);
  const importRequest = useRef(0);
  useEffect(() => () => { importRequest.current++; }, []);

  // Xem trước ngay khi gõ: mốc thời gian dán kèm lời được nhận ra mà không cần thao tác thêm.
  const preview = useMemo(() => parseLyrics(draft), [draft]);
  const previewTimed = useMemo(() => preview.filter(line => line.time !== null).length, [preview]);
  const timedCount = lines.filter(line => line.time !== null).length;

  const stamp = useCallback(() => {
    if (syncIndex === null || syncIndex >= lines.length) return;
    if (!isPlaying) { setError("Hãy phát nhạc trước khi đánh dấu câu."); return; }
    const time = Math.round(getCurrentTime() * 100) / 100;
    onUpdate(lines.map((line, index) => index === syncIndex ? { ...line, time } : line));
    setSyncIndex(syncIndex + 1);
    setError("");
  }, [syncIndex, lines, isPlaying, getCurrentTime, onUpdate]);

  useEffect(() => {
    if (!active || syncIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.code !== "Space" || event.repeat || !(target instanceof Element)) return;
      if (target.closest("input, textarea, select, button, a, [contenteditable]:not([contenteditable='false'])")) return;
      event.preventDefault();
      stamp();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, syncIndex, stamp]);

  function replaceLines(next: LyricLine[], note: string) {
    importRequest.current++;
    onApply(next);
    setDraft(formatLyricsDraft(next));
    setSyncIndex(null);
    setShift(0);
    setMessage(note);
    setError("");
  }

  function applyShift(delta: number) {
    if (!Number.isFinite(delta) || delta === 0) return;
    if (!timedCount) { setError("Chưa có mốc thời gian nào để dịch. Hãy tìm lời có mốc hoặc tự đánh dấu trước."); return; }
    onUpdate(shiftLyrics(lines, delta));
    setShift(value => Math.round((value + delta) * 1000) / 1000);
    setError(""); setMessage("");
  }

  function applyDraft() {
    if (!preview.length) { setError("Hãy nhập ít nhất một câu lời bài hát."); return; }
    if (preview.length > 2000) { setError("Vui lòng giới hạn lời bài hát trong 2.000 câu."); return; }
    importRequest.current++;
    onApply(preview);
    setSyncIndex(null);
    setShift(0);
    setMessage(previewTimed
      ? `Đã áp dụng ${preview.length} câu, trong đó ${previewTimed} câu giữ nguyên mốc thời gian có sẵn.`
      : "Đã áp dụng lời. Bạn có thể đánh dấu thời gian khi nghe nhạc.");
    setError("");
  }

  async function importFile(file: File) {
    const request = ++importRequest.current;
    if (!/\.(lrc|txt)$/i.test(file.name)) { setError("Vui lòng chọn tệp có đuôi .lrc hoặc .txt."); return; }
    if (file.size > 2_000_000) { setError("Tệp lời quá lớn. Hãy chọn tệp dưới 2 MB."); return; }
    try {
      const parsed = parseLyrics(await file.text());
      if (!parsed.length) throw new Error("Tệp lời đang trống.");
      if (parsed.length > 2000) throw new Error("Vui lòng chọn tệp có tối đa 2.000 câu.");
      if (request !== importRequest.current) return;
      const timed = parsed.filter(line => line.time !== null).length;
      replaceLines(parsed, timed ? `Đã nhập ${parsed.length} câu, ${timed} câu có mốc thời gian.` : `Đã nhập ${parsed.length} câu chưa có mốc thời gian.`);
    } catch (cause) {
      if (request === importRequest.current) setError(cause instanceof Error ? cause.message : "Không đọc được tệp lời.");
    }
  }

  return (
    <section aria-labelledby="lyrics-editor-heading">
      <h3 id="lyrics-editor-heading" className="settings-section-title">Để lời hát kể câu chuyện</h3>
      <LyricsSearch defaultTrack={title} defaultArtist={artist} duration={duration} onApply={(next, match) => {
        const timed = next.filter(line => line.time !== null).length;
        const name = match.trackName || "bản vừa chọn";
        replaceLines(next, timed
          ? `Đã lấy lời ${name} · ${timed}/${next.length} câu có mốc thời gian. Chưa khớp thì dịch nhanh ở phần dưới.`
          : `Đã lấy lời ${name}, bản này chưa có mốc thời gian.`);
      }} />
      <div className="settings-divider" />
      <label htmlFor="lyrics-draft" className="field-label">Nội dung lời bài hát</label>
      <textarea id="lyrics-draft" className="text-field lyrics-textarea" placeholder={"Dán lời bài hát tại đây…\nMỗi dòng là một câu. Lời kèm mốc kiểu [00:16.64] sẽ được giữ nguyên mốc."} value={draft} maxLength={30000}
        onChange={event => { setDraft(event.target.value); setMessage(""); }} />
      <div className="editor-actions">
        <span className="field-hint">{preview.length} câu{previewTimed ? ` · ${previewTimed} câu có sẵn mốc thời gian` : ""}</span>
        <button type="button" className="primary-button" onClick={applyDraft}>Áp dụng lời</button>
      </div>
      <div className="lrc-actions">
        <label className="file-button"><Icon name="upload" size={15} /> Nhập LRC
          <input type="file" accept=".lrc,.txt,text/plain" aria-label="Nhập tệp lời LRC hoặc TXT" onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ""; }} />
        </label>
        <button type="button" className="file-button" disabled={!timedCount} onClick={() => downloadBlob(new Blob([serializeLrc(lines)], { type: "text/plain;charset=utf-8" }), "loi-bai-hat.lrc")}><Icon name="download" size={15} /> Tải LRC</button>
      </div>
      {message && <p role="status" className="field-success mt-3">{message}</p>}
      {error && <p role="alert" className="field-error mt-3">{error}</p>}
      <div className="settings-divider" />
      <div ref={syncArea} tabIndex={-1} className="sync-area">
        <div className="editor-actions">
          <h4 className="field-label">Đồng bộ theo nhạc</h4>
          <button type="button" className="file-button" disabled={!ready} onClick={onTogglePlay}><Icon name={isPlaying ? "pause" : "play"} size={14} />{isPlaying ? "Tạm dừng" : "Phát nhạc"}</button>
        </div>
        {syncIndex === null ? (
          <button type="button" className="primary-button mt-4" disabled={!ready || !lines.length} onClick={() => {
            const first = lines.findIndex(line => line.time === null);
            setSyncIndex(first < 0 ? 0 : first);
            syncArea.current?.focus();
          }}>Bắt đầu đánh dấu</button>
        ) : (
          <div className="sync-prompt">
            <p className="field-hint">{syncIndex < lines.length ? `Câu ${syncIndex + 1} / ${lines.length} · Nhấn phím cách khi câu bắt đầu` : "Đã đánh dấu xong."}</p>
            <p className="sync-current">{lines[syncIndex]?.text || (syncIndex >= lines.length ? "Lời đã sẵn sàng." : "♪")}</p>
            <div className="lrc-actions">
              <button type="button" className="primary-button" disabled={!isPlaying || syncIndex >= lines.length} onClick={stamp}>Đánh dấu lúc {formatTime(currentTime)}</button>
              <button type="button" className="file-button" onClick={() => setSyncIndex(null)}>Kết thúc</button>
            </div>
          </div>
        )}
        <button type="button" className="text-button mt-4" disabled={!lines.length} onClick={() => {
          onUpdate(lines.map(line => ({ ...line, time: null }))); setSyncIndex(0); setShift(0); syncArea.current?.focus();
        }}>Xóa mốc và đồng bộ lại từ đầu</button>
      </div>
      <div className="offset-panel">
        <h4 className="field-label">Dịch nhanh toàn bộ mốc</h4>
        <p className="field-hint">Lời chạy trễ hơn nhạc thì bấm dấu trừ, chạy sớm hơn thì bấm dấu cộng. Áp dụng cho cả {timedCount} câu đang có mốc.</p>
        <div className="offset-row" role="group" aria-label="Dịch nhanh toàn bộ mốc thời gian">
          {quickSteps.map(step => (
            <button key={step} type="button" className="file-button" disabled={!timedCount} onClick={() => applyShift(step)}>{stepLabel(step)}</button>
          ))}
        </div>
        <div className="offset-custom">
          <label htmlFor="offset-step" className="field-hint">Bước riêng</label>
          <input id="offset-step" className="text-field" type="number" min="1" max="60000" step="10" value={stepMs}
            onChange={event => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) setStepMs(Math.min(60000, Math.max(1, Math.round(next))));
            }} />
          <span className="field-hint">ms</span>
          <button type="button" className="file-button" disabled={!timedCount} onClick={() => applyShift(-stepMs / 1000)}>− Sớm hơn</button>
          <button type="button" className="file-button" disabled={!timedCount} onClick={() => applyShift(stepMs / 1000)}>+ Trễ hơn</button>
        </div>
        {shift !== 0 && (
          <p className="offset-summary" role="status">
            Đã dịch {shift > 0 ? "+" : "−"}{Math.abs(shift).toFixed(2)} giây so với lời gốc.
            <button type="button" className="text-button" onClick={() => applyShift(-shift)}>Đưa về mốc gốc</button>
          </p>
        )}
      </div>
      <div className="timestamp-list">
        {lines.map((line, index) => (
          <div className={`timestamp-row${index === activeIndex ? " selected-timestamp" : ""}`} key={line.id}>
            <button type="button" className="timestamp-text" onClick={() => onSelect(index)}>{index + 1}. {line.text || "♪"}</button>
            <input className="text-field" type="number" min="0" step="0.01" placeholder="Giây" aria-label={`Mốc thời gian câu ${index + 1}, tính bằng giây`} value={line.time ?? ""}
              onChange={event => {
                const time = event.target.value === "" ? null : Number(event.target.value);
                if (time !== null && (!Number.isFinite(time) || time < 0)) return;
                onUpdate(lines.map((item, i) => i === index ? { ...item, time } : item));
              }} />
            <button type="button" className="icon-button" aria-label={`Xóa mốc câu ${index + 1}`} disabled={line.time === null} onClick={() => onUpdate(lines.map((item, i) => i === index ? { ...item, time: null } : item))}><Icon name="close" size={14} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}
