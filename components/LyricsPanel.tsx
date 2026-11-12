"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { LyricEffect, LyricLine } from "../types/studio";
import { card as cardMetrics } from "../utils/cardLayout";
import { cardLyricAlpha, cardLyricEmphasis } from "../utils/cardMotion";
import { cardTravelReference, createLyricSpring, lyricSpringOmega, lyricTopAt, springStep, type LyricSpring } from "../utils/lyricSpring";
import { fitLyricScale } from "../utils/lyricFit";
import { createSmoothClock, lyricSweep, sweepEdge, wordDelayMs } from "../utils/lyricMotion";

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
  /**
   * "center": câu đang hát ở giữa vùng lời, nhiều câu quanh nó (giao diện gốc).
   * "card": câu đang hát sát mép trên, chỉ thấy thêm câu kế tiếp; lời trôi từ dưới lên (thẻ nhạc ở /card).
   */
  layout?: "center" | "card";
};

/** Nội dung của câu đang hát theo hiệu ứng. Các câu khác giữ nguyên chữ thường. */
function ActiveText({ text, effect }: { text: string; effect: LyricEffect }) {
  if (effect === "sweep") return <span className="lyric-sweep">{text}</span>;
  if (effect === "words") {
    const words = text.split(/\s+/).filter(Boolean);
    return <>{words.map((word, index) => (
      <span key={index}>{index > 0 && " "}<span className="lyric-word" style={{ "--delay": `${wordDelayMs(index, words.length)}ms` } as CSSProperties}>{word}</span></span>
    ))}</>;
  }
  return <>{text}</>;
}

// Cùng nhịp với hiệu ứng mờ dần trong CSS và với bản ghi trên canvas.

export function LyricsPanel({ lines, activeIndex, onActiveIndexChange, recordingMode, effect, isPlaying, getTime, layout = "center" }: LyricsPanelProps) {
  const card = layout === "card";
  // Thẻ nhạc: câu quá dài thu nhỏ chữ để hiện trọn. Đo bằng canvas với đúng phông đang dùng, cùng thuật toán với bản ghi.
  const [fits, setFits] = useState<number[]>([]);
  useEffect(() => {
    const element = viewport.current;
    if (!card || !element || !document.fonts) return;
    let alive = true;
    void document.fonts.ready.then(() => {
      const context = document.createElement("canvas").getContext("2d");
      if (!alive || !context) return;
      const family = getComputedStyle(element).fontFamily;
      setFits(lines.map(line => fitLyricScale((text, k) => {
        context.font = `750 ${cardMetrics.lyricSize * k}px ${family}`;
        context.letterSpacing = `${cardMetrics.lyricTracking * k}px`;
        return context.measureText(text).width;
      }, line.text || "♪", cardMetrics.art)));
    });
    return () => { alive = false; };
  }, [card, lines]);
  const viewport = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const motion = useRef<{ spring: LyricSpring; lines: LyricLine[] } | null>(null);
  const lineElements = useRef<(HTMLParagraphElement | null)[]>([]);
  const initialized = useRef(false);
  const animation = useRef(0);
  const glide = useRef({ y: 0, velocity: 0, target: 0, omega: 0, time: 0, running: false });

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

  // Thẻ nhạc: cột lời trượt bằng transform theo lò xo, cùng công thức với bản ghi (utils/cardMotion.ts). Tiêu điểm là chỉ số câu
  // dạng số thực; từ đó suy ra vị trí cột, độ sáng và độ phóng của từng câu, nên mọi thứ chuyển động cùng một nhịp.
  useLayoutEffect(() => {
    const container = viewport.current;
    const list = column.current;
    if (!card || !container || !list) return;
    let tops: number[] = [];
    let end = 0;
    const measure = () => {
      // Thẻ được phóng bằng transform nên toạ độ getBoundingClientRect bị phóng theo; offsetTop thì không.
      const pad = parseFloat(getComputedStyle(list).paddingTop) || 0;
      tops = lines.map((_, index) => (lineElements.current[index]?.offsetTop ?? 0) - pad);
      const last = lineElements.current[lines.length - 1];
      end = last ? last.offsetTop - pad + last.offsetHeight + cardMetrics.lyricGap : 0;
    };
    const topOf = (index: number) => index < tops.length ? tops[index] : end;
    const travel = (from: number, to: number) => Math.abs(lyricTopAt(topOf, to) - lyricTopAt(topOf, from));
    // Chỉ ghi lại style của câu nào đổi giá trị. Mỗi lần effect chạy lại thì ghi lại từ đầu.
    const painted: string[] = [];
    const paint = (focus: number) => {
      list.style.transform = `translate3d(0, ${-lyricTopAt(topOf, focus)}px, 0)`;
      lines.forEach((_, index) => {
        const element = lineElements.current[index];
        if (!element) return;
        const distance = index - focus;
        const alpha = Math.round(cardLyricAlpha(distance) * 1000) / 1000;
        const emphasis = Math.round(cardLyricEmphasis(distance) * 10000) / 10000;
        const value = `${alpha}|${emphasis}`;
        if (painted[index] === value) return;
        painted[index] = value;
        element.style.opacity = String(alpha);
        element.style.transform = `scale(${emphasis})`;
      });
    };

    measure();
    // Bộ lời mới thì bắt đầu thẳng ở câu hiện tại. Lò xo được giữ giữa các lần đổi câu để vận tốc nối liền.
    const fresh = !motion.current || motion.current.lines !== lines;
    if (!motion.current || fresh) motion.current = { spring: createLyricSpring(activeIndex), lines };
    const { spring } = motion.current;
    const step = () => {
      paint(spring.update(activeIndex, performance.now(), travel));
      if (!spring.settled) animation.current = requestAnimationFrame(step);
    };
    if (fresh || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { spring.jump(activeIndex); paint(activeIndex); }
    else step();

    // Đổi cỡ thẻ hoặc phông làm các câu cao thấp khác đi: đo lại và đặt thẳng vào vị trí, không chạy chuyển động.
    const signature = () => `${container.clientWidth}-${list.offsetHeight}`;
    let previous = signature();
    const observer = new ResizeObserver(() => {
      const next = signature();
      if (next === previous) return;
      previous = next;
      cancelAnimationFrame(animation.current);
      measure();
      painted.length = 0;
      spring.jump(activeIndex);
      paint(activeIndex);
    });
    observer.observe(container);
    observer.observe(list);
    return () => { cancelAnimationFrame(animation.current); observer.disconnect(); };
  }, [activeIndex, lines, card]);

  useLayoutEffect(() => {
    const container = viewport.current;
    if (!container || card) return;

    // Cuộn bằng lò xo giảm chấn tới hạn (utils/lyricSpring.ts) theo từng khung hình thay vì đường cong cố định: bắt đầu êm, đổi câu
    // giữa chừng thì giữ nguyên vận tốc, câu trước càng cao thì trượt càng chậm. `reference` là quãng trượt bình thường của câu này.
    function glideTo(target: number, animate: boolean, reference: number) {
      if (!container) return;
      cancelAnimationFrame(animation.current);
      const motion = glide.current;
      // Đang chạy dở thì nối tiếp từ vị trí và vận tốc đang có; không thì bắt đầu từ vị trí cuộn thật (người dùng có thể đã tự cuộn).
      if (!motion.running) { motion.y = container.scrollTop; motion.velocity = 0; }
      if (!animate || Math.abs(target - motion.y) < 1) { container.scrollTop = target; motion.running = false; return; }
      motion.omega = lyricSpringOmega(Math.abs(target - motion.y) / reference * cardTravelReference);
      motion.target = target;
      motion.time = performance.now();
      motion.running = true;
      const step = () => {
        const now = performance.now();
        [motion.y, motion.velocity] = springStep(motion.y, motion.velocity, motion.target, (now - motion.time) / 1000, motion.omega);
        motion.time = now;
        if (Math.abs(motion.y - motion.target) < .3 && Math.abs(motion.velocity) < 4) { container.scrollTop = motion.target; motion.running = false; return; }
        container.scrollTop = motion.y;
        animation.current = requestAnimationFrame(step);
      };
      animation.current = requestAnimationFrame(step);
    }

    function centerActiveLine(smooth: boolean) {
      const line = lineElements.current[Math.max(0, activeIndex)];
      if (!container || !line) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const containerBounds = container.getBoundingClientRect();
      const lineBounds = line.getBoundingClientRect();
      // Bước của một câu một dòng (cao dòng cộng đệm hai phía), theo cỡ chữ đang dùng.
      const style = getComputedStyle(line);
      const pitch = (parseFloat(style.lineHeight) || line.offsetHeight) + (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
      glideTo(
        container.scrollTop + lineBounds.top - containerBounds.top - container.clientHeight / 2 + lineBounds.height / 2,
        smooth && !reduceMotion,
        1.7 * pitch,
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
  }, [activeIndex, lines, recordingMode, card]);

  return (
    <section className={`lyrics-panel${card ? " card-lyrics" : ""}`} aria-label="Lời bài hát">
      <div ref={viewport} className="lyrics-viewport" aria-label="Các câu lời quanh câu hiện tại">
        <div ref={column} className="lyrics-lines">
          {lines.map((line, index) => {
            const distance = Math.abs(index - activeIndex);
            // Thẻ nhạc chỉ cho thấy câu đang hát và câu kế tiếp; câu đã hát trôi ra mép trên và tan đi.
            const hidden = card && distance !== 0 && index !== activeIndex + 1;
            const text = <ActiveText text={line.text || "♪"} effect={distance === 0 ? effect : "scroll"} />;
            const content = card ? <span className="lyric-clamp">{text}</span> : text;
            return (
              <p
                key={line.id}
                ref={(element) => { lineElements.current[index] = element; }}
                className={`lyric-line${distance === 0 ? " active-lyric" : ""}`}
                data-distance={Math.min(distance, 4)}
                style={{ opacity: card ? undefined : distance === 0 ? 1 : distance === 1 ? 0.4 : distance === 2 ? 0.2 : 0.09, pointerEvents: hidden ? "none" : undefined, ...(card && (fits[index] ?? 1) < 1 ? { fontSize: `calc(var(--card-lyric-size) * ${fits[index]})`, letterSpacing: `calc(var(--card-lyric-tracking) * ${fits[index]})` } : null) }}
                aria-current={distance === 0 ? "true" : undefined}
              >
                {recordingMode ? content : (
                  <button type="button" tabIndex={hidden ? -1 : undefined} onClick={() => onActiveIndexChange(index)} aria-label={`Chuyển đến câu ${index + 1}: ${line.text || "Nhạc không lời"}`}>{content}</button>
                )}
              </p>
            );
          })}
        </div>
      </div>
    </section>
  );
}
