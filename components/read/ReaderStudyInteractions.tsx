"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type ReaderChapterEventDetail = {
  chapterId?: unknown;
};

type SelectionState = {
  text: string;
  x: number;
  y: number;
} | null;

function selectedTextInsideReader(): SelectionState {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const text = selection.toString().replace(/\s+/g, " ").trim();
  if (text.length < 2) return null;

  const range = selection.getRangeAt(0);
  const common = range.commonAncestorContainer;
  const element =
    common.nodeType === Node.ELEMENT_NODE
      ? (common as Element)
      : common.parentElement;
  if (!element?.closest("#reader-active-unit")) return null;

  const rect = range.getBoundingClientRect();
  return {
    text: text.slice(0, 2000),
    x: Math.max(12, Math.min(window.innerWidth - 12, rect.left + rect.width / 2)),
    y: Math.max(68, rect.top - 10),
  };
}

export function ReaderStudyInteractions() {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );
  const chapterIdRef = useRef<string | null>(null);
  const [selection, setSelection] = useState<SelectionState>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [zoomedImage, setZoomedImage] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    function onChapter(rawEvent: Event) {
      const event = rawEvent as CustomEvent<ReaderChapterEventDetail>;
      chapterIdRef.current =
        typeof event.detail?.chapterId === "string" ? event.detail.chapterId : null;
      setSelection(null);
      setNoteOpen(false);
      setMessage("");
    }

    function onSelectionChange() {
      window.setTimeout(() => setSelection(selectedTextInsideReader()), 0);
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".reader-selection-toolbar,.reader-selection-note")) return;
      if (!target?.closest("#reader-active-unit")) setSelection(null);
    }

    function onImageClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const image = target?.closest<HTMLImageElement>("#reader-active-unit img");
      if (!image?.src) return;
      event.preventDefault();
      setZoomedImage({ src: image.src, alt: image.alt || "Learning diagram" });
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setZoomedImage(null);
        setNoteOpen(false);
      }
    }

    window.addEventListener("vibe:reader-chapter", onChapter);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onImageClick, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("vibe:reader-chapter", onChapter);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onImageClick, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function requireUser() {
    const { data } = await supabase.auth.getUser();
    if (data.user) return data.user;
    const redirect = `${window.location.pathname}${window.location.search}`;
    router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
    return null;
  }

  async function saveItem(
    itemType: "highlight" | "note",
    payload: Record<string, unknown>
  ) {
    if (!selection?.text || !chapterIdRef.current || saving) return;
    const user = await requireUser();
    if (!user) return;

    setSaving(true);
    setMessage("");
    const { data, error } = await supabase.rpc("upsert_study_workspace_item", {
      p_item_type: itemType,
      p_chapter_id: chapterIdRef.current,
      p_payload: payload,
      p_item_id: null,
    });
    const result = data as { ok?: boolean; reason?: string | null } | null;
    if (error || !result?.ok) {
      setMessage(
        result?.reason === "not_entitled"
          ? "This passage is not available to save."
          : "Could not save this study item."
      );
      setSaving(false);
      return;
    }

    setMessage(itemType === "highlight" ? "Highlighted" : "Note saved");
    setSaving(false);
    if (itemType === "note") {
      setNote("");
      setNoteOpen(false);
    }
    window.setTimeout(() => {
      window.getSelection()?.removeAllRanges();
      setSelection(null);
      setMessage("");
    }, 650);
  }

  function listenToSelection() {
    if (!selection?.text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(selection.text);
    const voices = window.speechSynthesis
      .getVoices()
      .filter((voice) => voice.lang.toLowerCase().startsWith("en"));
    const preferred = voices.find((voice) =>
      /natural|neural|enhanced|premium|online|google|microsoft/i.test(
        `${voice.name} ${voice.voiceURI}`
      )
    );
    if (preferred) {
      utterance.voice = preferred;
      utterance.lang = preferred.lang;
    } else {
      utterance.lang = "en-KE";
    }
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <>
      <style jsx global>{`
        #reader-active-unit img {
          cursor: zoom-in;
        }
        .reader-selection-toolbar {
          position: fixed;
          z-index: 110;
          display: flex;
          gap: 4px;
          padding: 5px;
          border-radius: 12px;
          border: 1px solid var(--reader-border, rgba(0,0,0,.14));
          background: var(--reader-surface, #fffaf0);
          color: var(--reader-text, #27231f);
          box-shadow: 0 12px 36px rgba(0,0,0,.22);
          transform: translate(-50%, -100%);
        }
        .reader-selection-toolbar button {
          border: 0;
          border-radius: 8px;
          padding: 8px 10px;
          background: transparent;
          color: inherit;
          font-size: 12px;
          font-weight: 850;
          cursor: pointer;
        }
        .reader-selection-toolbar button:hover,
        .reader-selection-toolbar button:focus-visible {
          background: color-mix(in srgb, var(--reader-accent, #466400) 14%, transparent);
        }
        .reader-selection-note {
          position: fixed;
          z-index: 112;
          left: 50%;
          bottom: max(14px, env(safe-area-inset-bottom));
          width: min(560px, calc(100% - 24px));
          transform: translateX(-50%);
          padding: 14px;
          box-sizing: border-box;
          border-radius: 16px;
          border: 1px solid var(--reader-border, rgba(0,0,0,.14));
          background: var(--reader-surface, #fffaf0);
          color: var(--reader-text, #27231f);
          box-shadow: 0 18px 54px rgba(0,0,0,.3);
        }
        .reader-selection-note textarea {
          width: 100%;
          min-height: 90px;
          margin-top: 8px;
          padding: 10px;
          box-sizing: border-box;
          resize: vertical;
          border: 1px solid var(--reader-border, rgba(0,0,0,.14));
          border-radius: 10px;
          background: var(--reader-bg, #f7f1e5);
          color: var(--reader-text, #27231f);
          font: inherit;
        }
        .reader-image-zoom {
          position: fixed;
          inset: 0;
          z-index: 130;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(0,0,0,.88);
        }
        .reader-image-zoom img {
          max-width: 96vw;
          max-height: 88dvh;
          object-fit: contain;
          cursor: zoom-out;
        }
        .reader-image-zoom button {
          position: fixed;
          top: max(12px, env(safe-area-inset-top));
          right: 14px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,.3);
          background: rgba(0,0,0,.55);
          color: #fff;
          font-size: 24px;
          cursor: pointer;
        }
      `}</style>

      {selection && (
        <div
          className="reader-selection-toolbar"
          role="toolbar"
          aria-label="Actions for selected text"
          style={{ left: selection.x, top: selection.y }}
        >
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void saveItem("highlight", {
                text: selection.text,
                color: "yellow",
                context: "reader_selection_v1",
              })
            }
          >
            Highlight
          </button>
          <button type="button" onClick={() => setNoteOpen(true)}>Note</button>
          <button type="button" onClick={listenToSelection}>Listen</button>
        </div>
      )}

      {noteOpen && selection && (
        <div className="reader-selection-note" role="dialog" aria-label="Add note to passage">
          <strong>Add a note</strong>
          <div style={{ fontSize: 12, opacity: 0.72, marginTop: 4 }}>
            “{selection.text.slice(0, 140)}{selection.text.length > 140 ? "…" : ""}”
          </div>
          <textarea
            autoFocus
            value={note}
            maxLength={5000}
            placeholder="What do you want to remember?"
            onChange={(event) => setNote(event.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => setNoteOpen(false)}>Cancel</button>
            <button
              type="button"
              disabled={!note.trim() || saving}
              onClick={() =>
                void saveItem("note", {
                  text: note.trim(),
                  quote: selection.text,
                  source: "reader_selection_v1",
                })
              }
            >
              {saving ? "Saving…" : "Save note"}
            </button>
          </div>
          {message ? <div role="status" style={{ marginTop: 8, fontSize: 12 }}>{message}</div> : null}
        </div>
      )}

      {zoomedImage && (
        <div
          className="reader-image-zoom"
          role="dialog"
          aria-modal="true"
          aria-label={zoomedImage.alt}
          onClick={() => setZoomedImage(null)}
        >
          <button type="button" onClick={() => setZoomedImage(null)} aria-label="Close image">×</button>
          <img
            src={zoomedImage.src}
            alt={zoomedImage.alt}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
