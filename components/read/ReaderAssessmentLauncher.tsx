"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type ReaderChapterEventDetail = {
  publicationId?: unknown;
  chapterId?: unknown;
};

export function ReaderAssessmentLauncher() {
  const router = useRouter();
  const [source, setSource] = useState<{ publicationId: string; chapterId: string } | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setAuthenticated(Boolean(data.user));
    });

    function handleChapter(event: Event) {
      const detail = (event as CustomEvent<ReaderChapterEventDetail>).detail;
      if (
        typeof detail?.publicationId === "string" &&
        typeof detail?.chapterId === "string"
      ) {
        setSource({
          publicationId: detail.publicationId,
          chapterId: detail.chapterId,
        });
      }
    }

    window.addEventListener("vibe:reader-chapter", handleChapter);
    return () => {
      cancelled = true;
      window.removeEventListener("vibe:reader-chapter", handleChapter);
    };
  }, []);

  if (!authenticated || !source) return null;

  return (
    <button
      type="button"
      aria-label="Test me on this unit"
      onClick={() =>
        router.push(
          `/student/vibelearn/practice?publication=${encodeURIComponent(source.publicationId)}&chapter=${encodeURIComponent(source.chapterId)}`
        )
      }
      style={{
        position: "fixed",
        right: 16,
        bottom: 82,
        zIndex: 80,
        border: "1px solid rgba(204,255,0,0.48)",
        borderRadius: 999,
        background: "#CCFF00",
        color: "#090D16",
        padding: "12px 17px",
        fontSize: 13,
        fontWeight: 900,
        boxShadow: "0 10px 30px rgba(0,0,0,0.32)",
        cursor: "pointer",
      }}
    >
      Test Me
    </button>
  );
}
