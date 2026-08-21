"use client";

import { useEffect, useRef, useState } from "react";

type ReaderChapterEventDetail = { chapterId?: unknown };
type SavedListenPosition = { publicationId: string; chapterId: string; blockId: string; savedAt: string };
const STORAGE_PREFIX = "vibeschool.reader.listen.v1";

function storageKey(publicationId: string, chapterId: string): string { return `${STORAGE_PREFIX}:${publicationId}:${chapterId}`; }
function readPosition(publicationId: string, chapterId: string): SavedListenPosition | null {
  try {
    const raw = window.localStorage.getItem(storageKey(publicationId, chapterId)); if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedListenPosition>;
    if (parsed.publicationId !== publicationId || parsed.chapterId !== chapterId || typeof parsed.blockId !== "string") return null;
    return parsed as SavedListenPosition;
  } catch { return null; }
}

export function ReaderListenContinuity({ publicationId }: { publicationId: string }) {
  const chapterIdRef = useRef<string | null>(null);
  const [saved, setSaved] = useState<SavedListenPosition | null>(null);

  useEffect(() => {
    function onChapter(raw: Event) {
      const event = raw as CustomEvent<ReaderChapterEventDetail>;
      const chapterId = typeof event.detail?.chapterId === "string" ? event.detail.chapterId : null;
      chapterIdRef.current = chapterId; setSaved(chapterId ? readPosition(publicationId, chapterId) : null);
    }
    window.addEventListener("vibe:reader-chapter", onChapter);
    const root = document.getElementById("vibetextbook-reading-content");
    const observer = root ? new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== "attributes" || mutation.attributeName !== "data-reader-speaking") continue;
        const target = mutation.target as HTMLElement;
        if (target.getAttribute("data-reader-speaking") !== "true") continue;
        const block = target.closest<HTMLElement>("[data-reader-block-id]");
        const chapterId = chapterIdRef.current; const blockId = block?.dataset.readerBlockId;
        if (!chapterId || !blockId) continue;
        const position: SavedListenPosition = { publicationId, chapterId, blockId, savedAt: new Date().toISOString() };
        try { window.localStorage.setItem(storageKey(publicationId, chapterId), JSON.stringify(position)); } catch {}
        setSaved(position);
      }
    }) : null;
    observer?.observe(root!, { subtree: true, attributes: true, attributeFilter: ["data-reader-speaking"] });
    return () => { window.removeEventListener("vibe:reader-chapter", onChapter); observer?.disconnect(); };
  }, [publicationId]);

  function resume() {
    if (!saved) return;
    const block = document.querySelector<HTMLElement>(`#reader-active-unit [data-reader-block-id="${CSS.escape(saved.blockId)}"]`);
    if (!block) { setSaved(null); return; }
    block.scrollIntoView({ behavior: "smooth", block: "center" });
    block.dataset.readerListenResume = "true";
    window.setTimeout(() => delete block.dataset.readerListenResume, 1200);
    window.dispatchEvent(new CustomEvent("vibe:reader-resume-listening", { detail: { blockElementId: block.id, blockId: saved.blockId } }));
  }

  if (!saved) return null;
  return <>
    <style jsx global>{`
      .reader-listen-resume{position:fixed;left:12px;bottom:calc(72px + env(safe-area-inset-bottom));z-index:69;max-width:min(320px,calc(100vw - 24px));border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(21,24,33,.96);color:#f6f7f8;padding:8px 11px;font-size:12px;font-weight:850;box-shadow:0 8px 28px rgba(0,0,0,.28);cursor:pointer;backdrop-filter:blur(14px)}
      #reader-active-unit [data-reader-listen-resume="true"]{outline:2px solid rgba(207,255,0,.55);outline-offset:5px;border-radius:7px}
    `}</style>
    <button type="button" className="reader-listen-resume" onClick={resume}>Resume listening from saved passage</button>
  </>;
}
