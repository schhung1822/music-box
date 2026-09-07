"use client";

import { useEffect, useRef, useState } from "react";
import type { LocalAssets, MediaKind } from "../types/studio";
import { validateMediaFile } from "../utils/media";

export function useLocalFiles() {
  const [assets, setAssets] = useState<LocalAssets>({});
  const current = useRef<LocalAssets>({});

  useEffect(() => () => {
    Object.values(current.current).forEach(asset => URL.revokeObjectURL(asset.url));
    current.current = {};
  }, []);

  function replace(kind: MediaKind, file: File | null) {
    if (file) {
      const error = validateMediaFile(file, kind);
      if (error) return error;
    }
    const previous = current.current[kind];
    const next = { ...current.current };
    if (file) next[kind] = { file, url: URL.createObjectURL(file) };
    else delete next[kind];
    current.current = next;
    setAssets(next);
    if (previous) URL.revokeObjectURL(previous.url);
    return null;
  }

  return { assets, replace };
}
