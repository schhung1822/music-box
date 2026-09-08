"use client";

import type { BackdropGate } from "../hooks/useBackdropGate";
import type { AspectRatio, BackgroundMode, DisplaySettings, SourceMode } from "../types/studio";
import { Icon } from "./Icon";

type OutputSettingsProps = {
  sourceMode: SourceMode; settings: DisplaySettings; background: BackgroundMode; backdropGate: BackdropGate;
  onChange: (settings: DisplaySettings) => void; onBackgroundChange: (background: BackgroundMode) => void; onCleanView: () => void;
};

// Nền mặc định là nền tối sẵn có; ba nền còn lại dựng bằng WebGL, lấy từ React Bits.
const backdrops = [
  { value: "default", icon: "backdrop", name: "Mặc định", note: "Nền tối, hai vệt sáng rất nhạt" },
  { value: "molten", icon: "flame", name: "Kim loại nóng chảy", note: "Sợi sáng uốn quanh con trỏ" },
  { value: "waves", icon: "waves", name: "Sóng gradient", note: "Mặt sóng trôi về phía chân trời" },
  { value: "liquid", icon: "droplet", name: "Ether lỏng", note: "Vệt màu loang như mực trong nước" },
] as const;

const ratios: { value: AspectRatio; shape: [number, number]; name: string; lyrics: string }[] = [
  { value: "9:16", shape: [13, 22], name: "Khung dọc", lyrics: "Hiện đúng một câu, chữ lớn" },
  { value: "4:3", shape: [25, 19], name: "Khung ngang", lyrics: "Hiện nhiều câu như trên desktop" },
];

const backdropNotes: Partial<Record<BackdropGate, string>> = {
  motion: "Bạn đang bật giảm chuyển động trong hệ điều hành, nên nền động tạm nghỉ. Lựa chọn vẫn được giữ.",
  webgl: "Trình duyệt này chưa dựng được WebGL 2, nên trang giữ nền mặc định.",
};

export function OutputSettings({ sourceMode, settings, background, backdropGate, onChange, onBackgroundChange, onCleanView }: OutputSettingsProps) {
  return (
    <section aria-labelledby="display-heading">
      <h3 id="display-heading" className="settings-section-title">Chỉ giữ lại điều bạn muốn</h3>
      <fieldset className="mt-6" disabled={sourceMode === "youtube"}>
        <legend className="field-label">Kiểu hiển thị</legend>
        <div className="visual-mode-grid">
          <button type="button" className={`visual-mode-option${settings.visualMode === "video" ? " selected-mode" : ""}`} aria-pressed={settings.visualMode === "video"} onClick={() => onChange({ ...settings, visualMode: "video" })}><Icon name="video" size={27} /><strong>Video / ảnh bìa</strong><span>Khung vuông, tràn hình</span></button>
          <button type="button" className={`visual-mode-option${settings.visualMode === "disc" ? " selected-mode" : ""}`} aria-pressed={settings.visualMode === "disc"} onClick={() => onChange({ ...settings, visualMode: "disc" })}><Icon name="disc" size={29} /><strong>Đĩa quay</strong><span>Ảnh bìa ở tâm đĩa</span></button>
        </div>
      </fieldset>
      <p className="field-hint mt-3">{sourceMode === "youtube" ? "YouTube luôn hiển thị trình phát chính thức. Chế độ đĩa dùng với tệp trên máy." : "Đĩa quay theo nhạc và dừng khi tạm dừng. Chưa chọn ảnh bìa? Đĩa sẽ dùng hình minh họa."}</p>
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
      <p className="field-hint mt-3">Nền động vẽ bằng WebGL và chỉ hiện trên giao diện: bản ghi luôn dùng nền tối mặc định. Nền cũng tạm nghỉ trong lúc ghi hình.</p>
      {background !== "default" && backdropNotes[backdropGate] && <p className="field-error mt-2">{backdropNotes[backdropGate]}</p>}
      <div className="settings-divider" />
      <div className="switch-row">
        <label htmlFor="show-lyrics">Hiện lời bài hát<span>Áp dụng cho giao diện và bản ghi.</span></label>
        <input id="show-lyrics" className="toggle-input" type="checkbox" role="switch" checked={settings.showLyrics} onChange={event => onChange({ ...settings, showLyrics: event.target.checked })} />
      </div>
      <div className="switch-row">
        <label htmlFor="show-progress">Hiện thanh tiến trình<span>Giữ lại vị trí trong bài hát.</span></label>
        <input id="show-progress" className="toggle-input" type="checkbox" role="switch" checked={settings.showProgress} onChange={event => onChange({ ...settings, showProgress: event.target.checked })} />
      </div>
      <div className="switch-row">
        <label htmlFor="show-controls">Hiện thanh điều khiển trong bản ghi<span>Vẽ mốc thời gian và cụm nút phát vào video đã ghi.</span></label>
        <input id="show-controls" className="toggle-input" type="checkbox" role="switch" checked={settings.showControls} onChange={event => onChange({ ...settings, showControls: event.target.checked })} />
      </div>
      <button type="button" className="file-button mt-6" onClick={onCleanView}><Icon name="expand" size={16} /> Ẩn luôn thanh điều khiển</button>
      <p className="field-hint mt-3">Nhấn Esc hoặc chạm hai lần vào khung hình để mở lại. Thanh điều khiển vẫn hiện trong lúc ghi; bản ghi được vẽ riêng nên không dính giao diện.</p>
      <div className="settings-divider" />
      <fieldset>
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
      </fieldset>
      <p className="field-hint mt-3">WebM chất lượng cao · Mục tiêu 60 khung hình/giây · Độ phân giải tự động theo nguồn, tối đa 3840 px ở cạnh dài.</p>
    </section>
  );
}
