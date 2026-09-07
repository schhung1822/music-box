"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MusicPlayer } from "./MusicPlayer";
import { MediaFrame } from "./MediaFrame";
import { LyricsPanel } from "./LyricsPanel";
import { MediaSetup } from "./MediaSetup";
import { LyricsEditor } from "./LyricsEditor";
import { OutputSettings } from "./OutputSettings";
import { RecordingPanel } from "./RecordingPanel";
import { Icon } from "./Icon";
import { useLocalFiles } from "../hooks/useLocalFiles";
import { useMediaPlayer } from "../hooks/useMediaPlayer";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { useRecorder } from "../hooks/useRecorder";
import type { DisplaySettings, LyricLine, MediaKind, SourceMode } from "../types/studio";
import { activeLyricIndex, parsePlainLyrics } from "../utils/lyrics";
import { formatTime } from "../utils/media";
import { youtubeVideoId } from "../utils/youtube";

// Lời minh họa viết riêng cho ứng dụng.
const initialLyrics = parsePlainLyrics("Mình để ngày trôi thật chậm\nQua những con đường thân quen\nChỉ còn giai điệu ở lại\nVà một khoảng trời bình yên\nĐể những âu lo ngủ yên\nNghe lòng mình thêm dịu êm");
type SettingsTab = "media" | "lyrics" | "display" | "record";

export function Studio() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [sourceMode, setSourceMode] = useState<SourceMode>("local");
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [youtubeRevision, setYoutubeRevision] = useState(0);
  const [volume, setVolume] = useState(.8);
  const [muted, setMuted] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>(initialLyrics);
  const [manualIndex, setManualIndex] = useState(2);
  const [cleanView, setCleanView] = useState(false);
  const [settings, setSettings] = useState<DisplaySettings>({ visualMode: "video", showLyrics: true, showProgress: true, showControls: true, aspectRatio: "9:16", clipDuration: 30 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("media");
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const coverRef = useRef<HTMLImageElement>(null);
  const wasClean = useRef(false);
  const files = useLocalFiles();
  const local = useMediaPlayer(files.assets.audio?.url, files.assets.video?.url, sourceMode === "local", volume, muted);
  const youtube = useYouTubePlayer(youtubeId, sourceMode === "youtube", volume, muted, youtubeRevision);
  const recorder = useRecorder();
  const playback = sourceMode === "local" ? local : youtube;
  // Thanh điều khiển chỉ ẩn ở chế độ xem sạch. Lúc ghi vẫn hiện, vì bản ghi được vẽ riêng
  // trên canvas nên giao diện không lọt vào video.
  const hiddenControls = cleanView;
  const timedLyrics = lyrics.some(line => line.time !== null);
  const activeIndex = timedLyrics ? activeLyricIndex(lyrics, playback.currentTime) : Math.min(manualIndex, lyrics.length - 1);
  const error = notice || playback.error;

  function openSettings(nextTab?: SettingsTab) {
    if (nextTab) setTab(nextTab);
    // showModal() ném lỗi nếu hộp thoại đang mở sẵn, chẳng hạn khi bản ghi kết thúc lúc hộp thoại còn mở.
    if (!dialog.current?.open) dialog.current?.showModal();
    setSettingsOpen(true);
  }

  function pauseAll() { local.pause(); youtube.pause(); }

  async function togglePlayback() {
    if (recorder.busy) return;
    if (playback.isPlaying) playback.pause();
    else {
      try { await recorder.resumeAudio(); await playback.play(); }
      catch { setNotice("Không khởi động được âm thanh. Hãy nhấn phát để thử lại."); }
    }
  }

  function changeSource(next: SourceMode) {
    if (recorder.busy) return;
    pauseAll(); setSourceMode(next); setNotice("");
  }

  function changeFile(kind: MediaKind, file: File | null) {
    if (recorder.busy) return "Vui lòng dừng ghi trước khi đổi tệp.";
    if (kind !== "cover") pauseAll();
    const fileError = files.replace(kind, file);
    if (!fileError) {
      setNotice(""); local.clearError();
      if (file && kind !== "cover" && !title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
    }
    return fileError;
  }

  function loadYouTube(url: string) {
    const id = youtubeVideoId(url);
    if (!id) return "Liên kết YouTube chưa hợp lệ. Hãy dán liên kết của một video.";
    pauseAll(); setYoutubeId(id); setYoutubeRevision(value => value + 1); setSourceMode("youtube"); setNotice("");
    return null;
  }

  // Thay toàn bộ lời thì quay lại câu đầu; sửa mốc thời gian thì giữ nguyên câu đang chọn.
  const applyLyrics = useCallback((next: LyricLine[]) => { setLyrics(next); setManualIndex(0); }, []);
  const updateLyrics = useCallback((next: LyricLine[]) => setLyrics(next), []);
  function selectLyric(index: number) {
    if (recorder.busy) return;
    const time = lyrics[index]?.time;
    if (time !== null && time !== undefined && playback.ready) playback.seek(time);
    setManualIndex(index);
  }

  function enterCleanView() {
    dialog.current?.close();
    setCleanView(true);
  }

  function startRecording() {
    const element = local.getElement();
    if (sourceMode !== "local" || !element) return;
    dialog.current?.close();
    setCleanView(false);
    void recorder.start({
      element, title, artist, lyrics, manualLyricIndex: manualIndex, settings,
      video: files.assets.video ? local.videoRef.current : null,
      cover: files.assets.cover ? coverRef.current : null,
      play: local.play, pause: local.pause,
      onComplete: () => openSettings("record"),
    });
  }

  useEffect(() => {
    if (settingsOpen) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [settingsOpen]);

  useEffect(() => {
    if (hiddenControls) { wasClean.current = true; main.current?.focus({ preventScroll: true }); }
    else if (wasClean.current) { settingsButton.current?.focus({ preventScroll: true }); wasClean.current = false; }
  }, [hiddenControls]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || settingsOpen) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, button, a, [contenteditable]:not([contenteditable='false'])")) return;
      if (event.key === "Escape") {
        if (recorder.busy) recorder.stop();
        else setCleanView(false);
      }
      if (event.code === "Space" && playback.ready && !recorder.busy) { event.preventDefault(); void togglePlayback(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={`studio-shell minimal-studio${hiddenControls ? " recording-mode" : ""}`}>
      <main ref={main} id="main-content" className="studio-main" tabIndex={-1} aria-label="Không gian âm nhạc"
        onDoubleClick={hiddenControls ? () => setCleanView(false) : undefined}>
        <h1 className="sr-only">Không gian âm nhạc của bạn</h1>
        <div className={`studio-grid${!settings.showLyrics ? " player-only" : ""}`}>
          <MusicPlayer title={title} artist={artist} playback={playback} cleanView={hiddenControls} showProgress={settings.showProgress}
            muted={muted || volume === 0} busy={recorder.busy} settingsRef={settingsButton}
            onOpenSettings={() => openSettings()} onToggle={() => void togglePlayback()} onSeek={playback.seek} onMute={() => {
              if (muted || volume === 0) { setMuted(false); if (volume === 0) setVolume(.8); }
              else setMuted(true);
            }}>
            <MediaFrame assets={files.assets} sourceMode={sourceMode} visualMode={settings.visualMode} currentTime={playback.currentTime} isPlaying={playback.isPlaying}
              audioRef={local.audioRef} videoRef={local.videoRef} coverRef={coverRef} youtubeRef={youtube.containerRef} youtubeLoaded={Boolean(youtubeId)} onError={setNotice} />
          </MusicPlayer>
          {settings.showLyrics && <LyricsPanel lines={lyrics} activeIndex={activeIndex} onActiveIndexChange={selectLyric} recordingMode={hiddenControls} />}
        </div>
      </main>
      {error && !hiddenControls && <div className="status-notice" role="alert"><p>{error}</p><button type="button" className="icon-button" aria-label="Đóng thông báo" onClick={() => { setNotice(""); playback.clearError(); }}><Icon name="close" size={15} /></button></div>}
      {cleanView && !recorder.busy && <button type="button" className="capture-exit" onClick={() => setCleanView(false)}>Hiện thanh điều khiển</button>}
      {recorder.busy && <button type="button" className="recording-indicator" onClick={recorder.stop} aria-label="Dừng ghi"><span />{recorder.status === "preparing" ? "Đang chuẩn bị…" : recorder.status === "stopping" ? "Đang lưu…" : `Đang ghi · ${formatTime(recorder.elapsed)}`}<Icon name="stop" size={15} /></button>}
      {!recorder.busy && recorder.error && !settingsOpen && <button className="recording-feedback" type="button" onClick={() => openSettings("record")}>Xem thông báo bản ghi</button>}
      <dialog ref={dialog} className="settings-dialog" aria-labelledby="settings-heading" onClose={() => setSettingsOpen(false)}
        onClick={event => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current?.close();
        }}>
        <div className="settings-header"><div><p className="eyebrow">KHÔNG GIAN CỦA BẠN</p><h2 id="settings-heading">Thiết lập</h2></div><button type="button" className="icon-button" onClick={() => dialog.current?.close()} aria-label="Đóng thiết lập"><Icon name="close" /></button></div>
        <div className="settings-tabs" role="group" aria-label="Nhóm thiết lập">
          <button type="button" aria-pressed={tab === "media"} onClick={() => setTab("media")}><Icon name="music" size={15} />Nguồn phát</button>
          <button type="button" aria-pressed={tab === "lyrics"} onClick={() => setTab("lyrics")}><Icon name="lyrics" size={15} />Lời hát</button>
          <button type="button" aria-pressed={tab === "display"} onClick={() => setTab("display")}><Icon name="disc" size={15} />Hiển thị</button>
          <button type="button" aria-pressed={tab === "record"} onClick={() => setTab("record")}><Icon name="record" size={15} />Ghi hình</button>
        </div>
        <div className="settings-content">
          <fieldset disabled={recorder.busy} hidden={tab !== "media"}><MediaSetup title={title} artist={artist} onTitleChange={setTitle} onArtistChange={setArtist}
            sourceMode={sourceMode} onSourceModeChange={changeSource} assets={files.assets} onFileChange={changeFile} onYouTubeLoad={loadYouTube}
            volume={volume} muted={muted} onVolumeChange={setVolume} onMutedChange={setMuted} /></fieldset>
          <fieldset disabled={recorder.busy} hidden={tab !== "lyrics"}><LyricsEditor lines={lyrics} activeIndex={activeIndex} onApply={applyLyrics} onUpdate={updateLyrics} onSelect={selectLyric} title={title} artist={artist} duration={playback.duration}
            getCurrentTime={playback.getCurrentTime} currentTime={playback.currentTime} isPlaying={playback.isPlaying} ready={playback.ready}
            onTogglePlay={() => void togglePlayback()} active={settingsOpen && tab === "lyrics" && !recorder.busy} /></fieldset>
          <fieldset disabled={recorder.busy} hidden={tab !== "display"}><OutputSettings sourceMode={sourceMode} settings={settings} onChange={setSettings} onCleanView={enterCleanView} /></fieldset>
          <div hidden={tab !== "record"}><RecordingPanel recorder={recorder} sourceMode={sourceMode} settings={settings} ready={local.ready} active={settingsOpen && tab === "record"}
            currentTime={playback.currentTime} onSettingsChange={setSettings} onStart={startRecording} onPreview={pauseAll} /></div>
        </div>
        <div className="settings-footer"><Icon name="lock" size={13} /><p>Tệp và nội dung chỉ nằm trong trình duyệt. Tải lại trang sẽ xóa các thiết lập.</p></div>
      </dialog>
    </div>
  );
}
