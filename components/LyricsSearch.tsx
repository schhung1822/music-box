"use client";

import { useEffect, useRef, useState } from "react";
import type { LyricLine } from "../types/studio";
import { rankMatches, searchLyrics, type LyricsMatch } from "../utils/lrclib";
import { parseLyrics } from "../utils/lyrics";
import { formatTime } from "../utils/media";
import { Icon } from "./Icon";

type LyricsSearchProps = {
  defaultTrack: string; defaultArtist: string; duration: number;
  onApply: (lines: LyricLine[], match: LyricsMatch) => void;
};

export function LyricsSearch({ defaultTrack, defaultArtist, duration, onApply }: LyricsSearchProps) {
  const [track, setTrack] = useState(defaultTrack);
  const [artist, setArtist] = useState(defaultArtist);
  const [results, setResults] = useState<LyricsMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [appliedId, setAppliedId] = useState<number | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function search() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError(""); setAppliedId(null);
    try {
      const matches = await searchLyrics(track, artist, controller.signal);
      if (controller.signal.aborted) return;
      setResults(rankMatches(matches, duration));
    } catch (cause) {
      if (controller.signal.aborted || (cause instanceof DOMException && cause.name === "AbortError")) return;
      setResults(null);
      setError(cause instanceof Error ? cause.message : "Không tìm được lời bài hát.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function apply(match: LyricsMatch) {
    const source = match.syncedLyrics || match.plainLyrics;
    if (!source.trim()) { setError("Bản này chưa có nội dung lời. Hãy thử một bản khác."); return; }
    const lines = parseLyrics(source);
    if (!lines.length) { setError("Không đọc được lời của bản này. Hãy thử một bản khác."); return; }
    onApply(lines, match);
    setAppliedId(match.id);
    setError("");
  }

  return (
    <div className="lyrics-search">
      <h4 className="field-label">Tìm lời có sẵn trên LRCLIB</h4>
      <p className="field-hint">Kho lời cộng đồng. Bản có mốc thời gian được xếp lên đầu, kèm độ dài để bạn chọn đúng phiên bản.</p>
      <form className="search-row mt-3" onSubmit={event => { event.preventDefault(); void search(); }}>
        <input className="text-field" aria-label="Tên bài hát cần tìm" placeholder="Tên bài hát" value={track} maxLength={160} onChange={event => setTrack(event.target.value)} />
        <input className="text-field" aria-label="Tên nghệ sĩ cần tìm" placeholder="Nghệ sĩ (tùy chọn)" value={artist} maxLength={160} onChange={event => setArtist(event.target.value)} />
        <button type="submit" className="primary-button" disabled={loading || (!track.trim() && !artist.trim())}>
          <Icon name="search" size={15} />{loading ? "Đang tìm…" : "Tìm lời"}
        </button>
      </form>
      {error && <p role="alert" className="field-error mt-3">{error}</p>}
      {results !== null && !results.length && !error && <p role="status" className="field-hint mt-3">Không tìm thấy bản nào. Hãy thử bớt chữ trong tên bài hoặc bỏ trống ô nghệ sĩ.</p>}
      {results !== null && results.length > 0 && (
        <>
          <p role="status" className="field-hint mt-3">Tìm thấy {results.length} bản. Chọn một bản để áp dụng ngay.</p>
          <ul className="search-results">
            {results.map(match => (
              <li key={match.id}>
                <button type="button" className={`search-result${appliedId === match.id ? " result-applied" : ""}`} onClick={() => apply(match)}>
                  <span className="result-title">{match.trackName || "Không rõ tên bài"}</span>
                  <span className="result-meta">
                    {match.artistName || "Không rõ nghệ sĩ"}
                    {match.albumName ? ` · ${match.albumName}` : ""}
                    {match.duration ? ` · ${formatTime(match.duration)}` : ""}
                  </span>
                  <span className="result-tags">
                    <span className={match.syncedLyrics ? "result-badge badge-synced" : "result-badge"}>
                      {match.instrumental ? "Không lời" : match.syncedLyrics ? "Có mốc thời gian" : "Chỉ có lời"}
                    </span>
                    {duration > 0 && match.duration > 0 && Math.abs(match.duration - duration) <= 3 && <span className="result-badge badge-match">Khớp độ dài</span>}
                    {appliedId === match.id && <span className="result-badge badge-applied"><Icon name="check" size={12} /> Đã áp dụng</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
