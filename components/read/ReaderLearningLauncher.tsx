"use client";

import { useEffect, useState } from "react";
import { LearningTransformPanel } from "@/components/read/LearningTransformPanel";

type ReaderChapterEventDetail = {
  publicationId?: unknown;
  chapterId?: unknown;
};

export function ReaderLearningLauncher() {
  const [source, setSource] = useState<{ chapterId: string; chapterTitle: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleChapter(event: Event) {
      const detail = (event as CustomEvent<ReaderChapterEventDetail>).detail;
      if (typeof detail?.chapterId !== "string") return;

      const heading = document.querySelector("#reader-active-unit h2")?.textContent?.trim();
      setSource({
        chapterId: detail.chapterId,
        chapterTitle: heading || "This unit",
      });
    }

    window.addEventListener("vibe:reader-chapter", handleChapter);
    return () => window.removeEventListener("vibe:reader-chapter", handleChapter);
  }, []);

  if (!source) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Learn with this unit"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          right: 16,
          bottom: 132,
          zIndex: 79,
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 999,
          background: "#111827",
          color: "#fff",
          padding: "11px 15px",
          fontSize: 12,
          fontWeight: 900,
          boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
          cursor: "pointer",
        }}
      >
        Learn
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Learn with this unit"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.68)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: 0,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              maxHeight: "86dvh",
              overflowY: "auto",
              background: "#090D16",
              borderRadius: "22px 22px 0 0",
              padding: 16,
              boxSizing: "border-box",
              color: "white",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900 }}>Learn with this unit</div>
                <div style={{ marginTop: 3, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{source.chapterTitle}</div>
              </div>
              <button
                type="button"
                aria-label="Close learning tools"
                onClick={() => setOpen(false)}
                style={{ border: 0, background: "transparent", color: "white", fontSize: 22, cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            <LearningTransformPanel
              chapterId={source.chapterId}
              chapterTitle={source.chapterTitle}
            />
          </div>
        </div>
      )}
    </>
  );
}
