"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { LyricEffect, LyricLine } from "../types/studio";
import { createSmoothClock, lyricScrollEase, lyricSweep, lyricTransitionMs, sweepEdge, wordDelayMs } from "../utils/lyricMotion";

type LyricsPanelProps = {
  lines: LyricLine[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  recordingMode: boolean;
  /** Cách đổi câu: trượt cuộn, tô chữ theo nhịp hoặc hiện từng chữ. */
  effect: LyricEffect;
  isPlaying: boolean;
  /** Mốc phát hiện tại, đọc thẳng từ trình phát để vệt tô chạy đều chứ không theo nhịp cập nhật của giao diện. */
  getTime: () => number;
};

/** Nội dung của câu đang hát theo hiệu ứng. Các câu khác giữ nguyên chữ thường. */
function ActiveText({ text, effect }: { text: string; effect: LyricEffect }) {
  if (effect === "sweep") return <span className="lyric-sweep">{text}</span>;
  if (effect === "words") {
    const words = text.split(/s+/).filter(Boolean);
    return <>{words.map((word, index) => (
      <span key={index}>{index > 0 && " "}<span className="lyric-word" style={{ "--delay": `${wordDelayMs(index, words.length)}ms` } as CSSProperties}>{word}</span></span>
    ))}</>;
  }
  return <>{text}</>;
}

// Cùng nhịp với hiệu ứng mờ dần trong CSS và với bản ghi trên canvas.

export function LyricsPanel({ lines, activeIndex, onActiveIndexChange, recordingMode, effect, isPlaying, getTime }: LyricsPanelProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const lineElements = useRef<(HTMLParagraphElement | null)[]>([]);
  const initialized = useRef(false);
  const animation = useRef(0);

  const timeSource = useRef(getTime);
  useEffect(() => { timeSource.current = getTime; });
  useEffect(() => () => cancelAnimationFrame(animation.current), []);

  // Tô chữ theo nhịp: cập nhật thẳng biến CSS của câu đang hát theo từng khung hình khi đang phát,
  // không đi qua state của React (state chỉ cập nhật khoảng mười hai lần mỗi giây nên vệt tô sẽ giật).
  useEffect(() => {
    if (effect !== "sweep") return;
    const element = viewport.current?.querySelector<HTMLElement>(".lyric-sweep");
    if (!element) return;
    const clock = createSmoothClock();
    const paint = (now: number) => {
      const [from, to] = sweepEdge(lyricSweep(lines, activeIndex, clock(timeSource.current(), now, isPlaying)));
      element.style.setProperty("--sweep-from", `${from * 100}%`);
      element.style.setProperty("--sweep-to", `${to * 100}%`);
    };
    paint(performance.now());
    if (!isPlaying) return;
    let frame = 0;
    const tick = (now: number) => { paint(now); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [effect, lines, activeIndex, isPlaying]);

  useLayoutEffect(() => {
    const container = viewport.current;
    if (!container) return;

    // Cuộn bằng requestAnimationFrame thay vì behavior:"smooth" để chuyển động của vùng lời
    // kết thúc đúng lúc với hiệu ứng mờ dần, thay vì mỗi thứ chạy một nhịp.
    function glideTo(target: number, animate: boolean) {
      if (!container) return;
      cancelAnimationFrame(animation.current);
      const start = container.scrollTop;
      const distance = target - start;
      if (!animate || Math.abs(distance) < 1) { container.scrollTop = target; return; }
      const startedAt = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / lyricTransitionMs);
        container.scrollTop = start + distance * lyricScrollEase(progress);
        if (progress < 1) animation.current = requestAnimationFrame(step);
      };
      animation.current = requestAnimationFrame(step);
    }

    function centerActiveLine(smooth: boolean) {
      const line = lineElements.current[Math.max(0, activeIndex)];
      if (!container || !line) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const containerBounds = container.getBoundingClientRect();
      const lineBounds = line.getBoundingClientRect();
      glideTo(
        container.scrollTop + lineBounds.top - containerBounds.top - container.clientHeight / 2 + lineBounds.height / 2,
        smooth && !reduceMotion,
      );
    }

    centerActiveLine(initialized.current);
    initialized.current = true;
    let previousSize = `${container.clientWidth}-${container.clientHeight}-${lineElements.current[activeIndex]?.clientHeight}`;
    const observer = new ResizeObserver(() => {
      const size = `${container.clientWidth}-${container.clientHeight}-${lineElements.current[activeIndex]?.clientHeight}`;
      if (size !== previousSize) centerActiveLine(false);
      previousSize = size;
    });
    observer.observe(container);
    const activeLine = lineElements.current[activeIndex];
    if (activeLine) observer.observe(activeLine);
    return () => observer.disconnect();
  }, [activeIndex, lines, recordingMode]);

  return (
    <section className="lyrics-panel" aria-label="Lời bài hát">
      <div ref={viewport} className="lyrics-viewport" aria-label="Các câu lời quanh câu hiện tại">
        <div className="lyrics-lines">
          {lines.map((line, index) => {
            const distance = Math.abs(index - activeIndex);
            return (
              <p
                key={line.id}
                ref={(element) => { lineElements.current[index] = element; }}
                className={`lyric-line${distance === 0 ? " active-lyric" : ""}`}
                data-distance={Math.min(distance, 4)}
                style={{ opacity: distance === 0 ? 1 : distance === 1 ? 0.4 : distance === 2 ? 0.2 : 0.09 }}
                aria-current={distance === 0 ? "true" : undefined}
              >
                {recordingMode ? <ActiveText text={line.text || "♪"} effect={distance === 0 ? effect : "scroll"} /> : (
                  <button type="button" onClick={() => onActiveIndexChange(index)} aria-label={`Chuyển đến câu ${index + 1}: ${line.text || "Nhạc không lời"}`}><ActiveText text={line.text || "♪"} effect={distance === 0 ? effect : "scroll"} /></button>
                )}
              </p>
            );
          })}
        </div>
      </div>
    </section>
  );
}
