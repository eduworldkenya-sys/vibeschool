"use client";

import { useEffect } from "react";

type ChapterEvent = CustomEvent<{
  publicationId?: string;
  chapterId?: string;
}>;

export function ReaderCanonicalChapterUrl() {
  useEffect(() => {
    const syncUrl = (event: Event) => {
      const detail = (event as ChapterEvent).detail;
      if (!detail?.publicationId || !detail.chapterId) return;

      const path = `/read/textbook/${encodeURIComponent(detail.publicationId)}/${encodeURIComponent(detail.chapterId)}`;
      if (window.location.pathname === path && !window.location.search) return;

      window.history.replaceState(window.history.state, "", path);
    };

    window.addEventListener("vibe:reader-chapter", syncUrl);
    return () => window.removeEventListener("vibe:reader-chapter", syncUrl);
  }, []);

  return null;
}
