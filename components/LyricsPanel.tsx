"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { LyricLine } from "../types/studio";

type LyricsPanelProps = {
  lines: LyricLine[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  recordingMode: boolean;
};

// Cùng nhịp với hiệu ứng mờ dần trong CSS và với bản ghi trên canvas.
const scrollDuration = 420;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function LyricsPanel({ lines, activeIndex, onActiveIndexChange, recordingMode }: LyricsPanelProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const lineElements = useRef<(HTMLParagraphElement | null)[]>([]);
  const initialized = useRef(false);
  const animation = useRef(0);

  useEffect(() => () => cancelAnimationFrame(animation.current), []);

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
        const progress = Math.min(1, (now - startedAt) / scrollDuration);
        container.scrollTop = start + distance * easeOut(progress);
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
                {recordingMode ? line.text || "♪" : (
                  <button type="button" onClick={() => onActiveIndexChange(index)} aria-label={`Chuyển đến câu ${index + 1}: ${line.text || "Nhạc không lời"}`}>{line.text || "♪"}</button>
                )}
              </p>
            );
          })}
        </div>
      </div>
    </section>
  );
}
