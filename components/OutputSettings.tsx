"use client";

import Link from "next/link";
import type { BackdropGate } from "../hooks/useBackdropGate";
import type { AspectRatio, BackgroundMode, DisplaySettings, LyricEffect, SourceMode, StudioVariant } from "../types/studio";
import { Icon } from "./Icon";

type OutputSettingsProps = {
  variant: StudioVariant; sourceMode: SourceMode; settings: DisplaySettings; background: BackgroundMode; backdropGate: BackdropGate;
  onChange: (settings: DisplaySettings) => void; onBackgroundChange: (background: BackgroundMode) => void; onCleanView: () => void;
};

// Nền mặc định là nền tối sẵn có; ba nền còn lại dựng bằng WebGL, lấy từ React Bits.
const backdrops = [
  { value: "default", icon: "backdrop", name: "Mặc định", note: "Nền tối, hai vệt sáng rất nhạt" },
  { value: "molten", icon: "flame", name: "Kim loại nóng chảy", note: "Sợi sáng uốn quanh con trỏ" },
  { value: "waves", icon: "waves", name: "Sóng gradient", note: "Mặt sóng trôi về phía chân trời" },
  { value: "liquid", icon: "droplet", name: "Ether lỏng", note: "Vệt màu loang như mực trong nước" },
] as const;

// Ba cách đổi câu lời. Cả giao diện và bản ghi dùng chung, nên cái thấy ở đây là cái được ghi.
const lyricEffects: { value: LyricEffect; icon: "lyrics" | "sweep" | "sparkle"; name: string; note: string }[] = [
  { value: "scroll", icon: "lyrics", name: "Trượt cuộn", note: "Câu cũ mờ dần, câu mới trượt vào chỗ" },
  { value: "sweep", icon: "sweep", name: "Tô chữ theo nhịp", note: "Ánh sáng chạy qua từng chữ như karaoke" },
  { value: "words", icon: "sparkle", name: "Hiện từng chữ", note: "Mỗi chữ trồi lên và rõ dần" },
];

const ratios: { value: AspectRatio; shape: [number, number]; name: string; lyrics: string }[] = [
  { value: "4:3", shape: [25, 19], name: "Khung ngang", lyrics: "Hiện nhiều câu như trên desktop" },
  { value: "9:16", shape: [13, 22], name: "Khung dọc", lyrics: "Hiện đúng một câu, chữ lớn" },
];

// Hai giao diện nằm ở hai trang riêng, nên đổi giao diện là tải lại trang và phải chọn lại tệp.
const variants: { value: StudioVariant; href: string; name: string; note: string }[] = [
  { value: "classic", href: "/", name: "Mặc định", note: "Ảnh bên trái, lời lớn bên phải" },
  { value: "card", href: "/card", name: "Thẻ nhạc", note: "Thẻ kính mờ trên nền ảnh, lời chạy từ dưới lên" },
];

const backdropNotes: Partial<Record<BackdropGate, string>> = {
  motion: "Bạn đang bật giảm chuyển động trong hệ điều hành, nên nền động tạm nghỉ. Lựa chọn vẫn được giữ.",
  webgl: "Trình duyệt này chưa dựng được WebGL 2, nên trang giữ nền mặc định.",
};

export function OutputSettings({ variant, sourceMode, settings, background, backdropGate, onChange, onBackgroundChange, onCleanView }: OutputSettingsProps) {
  const card = variant === "card";
  return (
    <section aria-labelledby="display-heading">
      <h3 id="display-heading" className="settings-section-title">Chỉ giữ lại điều bạn muốn</h3>
      <fieldset className="mt-6" disabled={sourceMode === "youtube"}>
        <legend className="field-label">Kiểu hiển thị</legend>
        <div className="visual-mode-grid">
          <button type="button" className={`visual-mode-option${settings.visualMode === "video" ? " selected-mode" : ""}`} aria-pressed={settings.visualMode === "video"} onClick={() => onChange({ ...settings, visualMode: "video" })}><Icon name="video" size={27} /><strong>Video / ảnh bìa</strong><span>Khung vuông, tràn hình</span></button>
          <button type="button" className={`visual-mode-option${settings.visualMode === "disc" ? " selected-mode" : ""}`} aria-pressed={settings.visualMode === "disc"} onClick={() => onChange({ ...settings, visualMode: "disc" })}><Icon name="disc" size={29} /><strong>Đĩa quay</strong><span>Ảnh bìa ở tâm đĩa</span></button>
        </div>
        <p className="field-hint mt-3">Video bị cắt mép? Rê chuột lên khung video để thu nhỏ cho vừa khung hoặc phóng to. Bản ghi giữ đúng khung bạn thấy.</p>
      </fieldset>
      {!card && <>
      <div className="settings-divider" />
      <fieldset>
        <legend className="field-label">Nền trang</legend>
        <div className="visual-mode-grid backdrop-grid">
          {backdrops.map(item => (
            <button key={item.value} type="button" className={`visual-mode-option${background === item.value ? " selected-mode" : ""}`}
              aria-pressed={background === item.value} onClick={() => onBackgroundChange(item.value)}>
              <Icon name={item.icon} size={24} /><strong>{item.name}</strong><span>{item.note}</span>
            </button>
          ))}
        </div>
      </fieldset>
      {background !== "default" && backdropNotes[backdropGate] && <p className="field-error mt-2">{backdropNotes[backdropGate]}</p>}
      {background !== "default" && (
        <div className="switch-row mt-3">
          <label htmlFor="backdrop-in-video">Đưa nền động vào video<span>Bản ghi chép lại nền đang chạy. Tắt đi nếu máy yếu hoặc video bị giật.</span></label>
          <input id="backdrop-in-video" className="toggle-input" type="checkbox" role="switch" checked={settings.backdropInVideo} onChange={event => onChange({ ...settings, backdropInVideo: event.target.checked })} />
        </div>
      )}
      </>}
      <div className="settings-divider" />
      <fieldset>
        <legend className="field-label">Hiệu ứng chuyển lời</legend>
        <div className="effect-grid">
          {lyricEffects.map(item => (
            <button key={item.value} type="button" className={`visual-mode-option${(settings.lyricEffect ?? "scroll") === item.value ? " selected-mode" : ""}`}
              aria-pressed={(settings.lyricEffect ?? "scroll") === item.value} onClick={() => onChange({ ...settings, lyricEffect: item.value })}>
              <Icon name={item.icon} size={24} /><strong>{item.name}</strong><span>{item.note}</span>
            </button>
          ))}
        </div>
        {settings.lyricEffect === "sweep" && <p className="field-hint mt-3">Tô chữ cần lời có mốc thời gian (LRC hoặc đồng bộ thủ công). Lời chưa có mốc sẽ hiện sáng cả câu.</p>}
      </fieldset>
      <div className="settings-divider" />
      <div className="switch-row">
        <label htmlFor="show-lyrics">Hiện lời bài hát<span>Áp dụng cho giao diện và bản ghi.</span></label>
        <input id="show-lyrics" className="toggle-input" type="checkbox" role="switch" checked={settings.showLyrics} onChange={event => onChange({ ...settings, showLyrics: event.target.checked })} />
      </div>
      <div className="switch-row">
        <label htmlFor="show-progress">Hiện thanh tiến trình<span>Giữ lại vị trí trong bài hát.</span></label>
        <input id="show-progress" className="toggle-input" type="checkbox" role="switch" checked={settings.showProgress} onChange={event => onChange({ ...settings, showProgress: event.target.checked })} />
      </div>
      {!card && <div className="switch-row">
        <label htmlFor="show-controls">Hiện thanh điều khiển trong bản ghi<span>Vẽ mốc thời gian và cụm nút phát vào video đã ghi.</span></label>
        <input id="show-controls" className="toggle-input" type="checkbox" role="switch" checked={settings.showControls} onChange={event => onChange({ ...settings, showControls: event.target.checked })} />
      </div>}
      <button type="button" className="file-button mt-6" onClick={onCleanView}><Icon name="expand" size={16} /> Ẩn luôn thanh điều khiển</button>
      {card && <p className="field-hint mt-3">Thẻ nhạc không vẽ nút điều khiển vào video; bản ghi chỉ có ảnh, tên bài, thanh thời gian và lời hát.</p>}
      <div className="settings-divider" />
      {card ? <p className="field-hint">Thẻ nhạc chỉ ghi khung dọc 9:16.</p> : <fieldset>
        <legend className="field-label">Tỉ lệ bản ghi</legend>
        <div className="format-grid">
          {ratios.map(ratio => (
            <label key={ratio.value} className={`format-option${settings.aspectRatio === ratio.value ? " format-selected" : ""}`}>
              <input type="radio" name="aspect-ratio" value={ratio.value} checked={settings.aspectRatio === ratio.value} onChange={() => onChange({ ...settings, aspectRatio: ratio.value })} className="sr-only" />
              <span className="format-shape"><span style={{ width: ratio.shape[0], height: ratio.shape[1] }} /></span>
              <span>{ratio.value}</span><span className="field-hint">{ratio.name}</span>
              <span className="field-hint format-note">{ratio.lyrics}</span>
            </label>
          ))}
        </div>
      </fieldset>}
      <div className="settings-divider" />
      <fieldset>
        <legend className="field-label">Giao diện</legend>
        <div className="visual-mode-grid">
          {variants.map(item => (
            <Link key={item.value} href={item.href} prefetch={false} aria-current={item.value === variant ? "page" : undefined}
              className={`visual-mode-option${item.value === variant ? " selected-mode" : ""}`}>
              <Icon name={item.value === "card" ? "disc" : "backdrop"} size={24} /><strong>{item.name}</strong><span className="text-center">{item.note}</span>
            </Link>
          ))}
        </div>
        <p className="field-hint mt-3">Mỗi giao diện là một trang riêng. Đổi giao diện sẽ tải lại trang, nên các tệp và lời bạn đã chọn cần chọn lại.</p>
      </fieldset>
    </section>
  );
}
