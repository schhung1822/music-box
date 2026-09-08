import type { ReactNode } from "react";

type IconName = "music" | "headphones" | "arrow" | "help" | "lock" | "video" | "image" | "upload" | "play" | "volume" | "rewind" | "forward" | "lyrics" | "edit" | "sync" | "download" | "close" | "check" | "link" | "sliders" | "expand" | "pause" | "muted" | "disc" | "record" | "stop" | "search" | "backdrop" | "flame" | "waves" | "droplet";

const paths: Record<IconName, ReactNode> = {
  pause: <><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /></>,
  muted: <path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6" />,
  disc: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M6 12a6 6 0 0 1 6-6m6 6a6 6 0 0 1-6 6" /></>,
  record: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" fill="currentColor" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />,
  expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
  music: <><path d="M9 18V5l11-2v13M9 9l11-2" /><ellipse cx="6" cy="18" rx="3" ry="3" /><ellipse cx="17" cy="16" rx="3" ry="3" /></>,
  headphones: <><path d="M4 14v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="12" width="4" height="8" rx="2" /><rect x="17" y="12" width="4" height="8" rx="2" /></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
  video: <><rect x="3" y="5" width="13" height="14" rx="3" /><path d="m16 10 5-3v10l-5-3" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  upload: <path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />,
  play: <path d="m8 4 12 8-12 8Z" fill="currentColor" stroke="none" />,
  volume: <path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />,
  rewind: <><path d="M3 9a9 9 0 1 1 0 7M3 4v5h5" /><text x="7" y="16" fontSize="9" fill="currentColor" stroke="none" fontFamily="sans-serif">10</text></>,
  forward: <><path d="M21 9a9 9 0 1 0 0 7m0-12v5h-5" /><text x="7" y="16" fontSize="9" fill="currentColor" stroke="none" fontFamily="sans-serif">10</text></>,
  lyrics: <path d="M9 6h12M9 12h12M9 18h8M3 6h.01M3 12h.01M3 18h.01" />,
  edit: <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15Z" />,
  sync: <path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5" />,
  download: <path d="M12 3v13m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  link: <><path d="m10 14 4-4m-6 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m4 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  backdrop: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="8.5" cy="11" r="3" /><circle cx="16" cy="14.5" r="4" /></>,
  flame: <path d="M12 3c3 4 5 5.6 5 9a5 5 0 0 1-10 0c0-1.7.8-3.1 2-4.3 0 1.7.8 2.3 1.6 2.3 1 0 1.6-.8 1.4-2.3A9 9 0 0 0 12 3Z" />,
  waves: <path d="M3 7c2-2.2 4-2.2 6 0s4 2.2 6 0 4-2.2 6 0M3 12c2-2.2 4-2.2 6 0s4 2.2 6 0 4-2.2 6 0M3 17c2-2.2 4-2.2 6 0s4 2.2 6 0 4-2.2 6 0" />,
  droplet: <path d="M12 3c3.6 4 6 7.2 6 10a6 6 0 0 1-12 0c0-2.8 2.4-6 6-10Z" />,
  sliders: <><path d="M4 7h5m4 0h7M4 17h9m4 0h3" /><circle cx="11" cy="7" r="2" /><circle cx="15" cy="17" r="2" /></>,
};

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{paths[name]}</svg>;
}
