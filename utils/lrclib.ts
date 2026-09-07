// Kho lời cộng đồng LRCLIB (https://lrclib.net). API mở, cho phép gọi thẳng từ trình duyệt,
// nên lời bài hát đi từ LRCLIB về máy bạn mà không qua máy chủ nào của ứng dụng.
const endpoint = "https://lrclib.net/api/search";

export type LyricsMatch = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  syncedLyrics: string;
  plainLyrics: string;
};

export function buildSearchUrl(track: string, artist: string) {
  const name = track.trim();
  const by = artist.trim();
  const params = new URLSearchParams();
  // Tìm theo cặp tên bài + nghệ sĩ cho kết quả sát hơn; thiếu một vế thì tìm tự do.
  if (name && by) { params.set("track_name", name); params.set("artist_name", by); }
  else params.set("q", name || by);
  return `${endpoint}?${params}`;
}

function toMatch(raw: unknown): LyricsMatch | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== "number") return null;
  const text = (value: unknown) => typeof value === "string" ? value : "";
  const duration = typeof item.duration === "number" && Number.isFinite(item.duration) ? Math.max(0, item.duration) : 0;
  return {
    id: item.id,
    trackName: text(item.trackName), artistName: text(item.artistName), albumName: text(item.albumName),
    duration, instrumental: item.instrumental === true,
    syncedLyrics: text(item.syncedLyrics), plainLyrics: text(item.plainLyrics),
  };
}

/** Xếp bản có mốc thời gian lên trước, rồi tới bản có độ dài gần với bài đang phát nhất. */
export function rankMatches(matches: LyricsMatch[], duration: number) {
  return [...matches].sort((a, b) => {
    const synced = Number(Boolean(b.syncedLyrics)) - Number(Boolean(a.syncedLyrics));
    if (synced) return synced;
    if (duration > 0 && a.duration && b.duration) return Math.abs(a.duration - duration) - Math.abs(b.duration - duration);
    return 0;
  });
}

export async function searchLyrics(track: string, artist: string, signal?: AbortSignal): Promise<LyricsMatch[]> {
  if (!track.trim() && !artist.trim()) throw new Error("Hãy nhập tên bài hát hoặc tên nghệ sĩ để tìm.");
  let response: Response;
  try {
    response = await fetch(buildSearchUrl(track, artist), { signal, headers: { Accept: "application/json" } });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new Error("Không kết nối được kho lời LRCLIB. Hãy kiểm tra mạng rồi thử lại.");
  }
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(response.status === 429
      ? "LRCLIB đang giới hạn số lượt tìm. Hãy đợi một chút rồi thử lại."
      : "LRCLIB chưa trả lời được. Hãy thử lại sau ít phút.");
  }
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new Error("LRCLIB trả về dữ liệu không đọc được."); }
  if (!Array.isArray(data)) return [];
  return data.map(toMatch).filter((item): item is LyricsMatch => item !== null);
}
