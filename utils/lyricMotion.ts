// Shared with the live lyric panel so scrolling and recorded motion finish together.
export const lyricTransitionMs = 420;
export const lyricScrollEase = (progress: number) => 1 - (1 - Math.min(1, Math.max(0, progress))) ** 3;
