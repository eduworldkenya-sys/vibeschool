"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type ReaderMode = "read" | "study" | "revise";
type ReaderChapterEventDetail = { chapterId?: unknown };
type StudyItem = {
  item_id: string;
  item_type: "highlight" | "note" | string;
  chapter_id: string;
  payload: Record<string, unknown>;
  updated_at?: string;
};

type EditableItem = StudyItem & { draftText: string; draftColor: string };

function payloadString(payload: Record<string, unknown>, key: string): string {
  return typeof payload[key] === "string" ? String(payload[key]) : "";
}

function payloadInteger(payload: Record<string, unknown>, key: string): number | null {
  const value = Number(payload[key]);
  return Number.isInteger(value) ? value : null;
}

function rangeFromOffsets(root: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let cursor = 0;
  let startNode: Node | null = null;
  let endNode: Node | null = null;
  let startLocal = 0;
  let endLocal = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const length = node.textContent?.length ?? 0;
    if (!startNode && start >= cursor && start <= cursor + length) {
      startNode = node;
      startLocal = start - cursor;
    }
    if (end >= cursor && end <= cursor + length) {
      endNode = node;
      endLocal = end - cursor;
      break;
    }
    cursor += length;
  }

  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, startLocal);
  range.setEnd(endNode, endLocal);
  return range;
}

function anchoredRange(item: StudyItem): Range | null {
  const blockId = payloadString(item.payload, "block_id");
  const start = payloadInteger(item.payload, "start_offset");
  const end = payloadInteger(item.payload, "end_offset");
  if (!blockId || start === null || end === null || end <= start) return null;
  const block = document.querySelector<HTMLElement>(`#reader-active-unit [data-reader-block-id="${CSS.escape(blockId)}"]`);
  return block ? rangeFromOffsets(block, start, end) : null;
}

function clearFallbackOverlays() {
  document.querySelectorAll("[data-reader-annotation-overlay]").forEach((node) => node.remove());
}

function renderFallbackOverlays(items: StudyItem[]) {
  clearFallbackOverlays();
  for (const item of items) {
    if (item.item_type !== "highlight") continue;
    const range = anchoredRange(item);
    if (!range) continue;
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width <= 0 || rect.height <= 0) continue;
      const overlay = document.createElement("span");
      overlay.dataset.readerAnnotationOverlay = "true";
      overlay.setAttribute("aria-hidden", "true");
      overlay.style.position = "absolute";
      overlay.style.pointerEvents = "none";
      overlay.style.zIndex = "1";
      overlay.style.left = `${rect.left + window.scrollX}px`;
      overlay.style.top = `${rect.top + window.scrollY}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.borderRadius = "3px";
      overlay.style.background = "rgba(255,220,80,.42)";
      document.body.appendChild(overlay);
    }
  }
}

export function ReaderAnnotationManager() {
  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    [],
  );
  const chapterIdRef = useRef<string | null>(null);
  const [mode, setMode] = useState<ReaderMode>("read");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<StudyItem[]>([]);
  const [editing, setEditing] = useState<EditableItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function load(chapterId = chapterIdRef.current) {
    if (!chapterId) {
      setItems([]);
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setItems([]);
      return;
    }
    const { data, error } = await supabase.rpc("get_my_study_workspace_items", { p_item_type: null });
    if (error) {
      setMessage("Could not load annotations.");
      return;
    }
    const next = ((data ?? []) as StudyItem[]).filter(
      (item) => item.chapter_id === chapterId && (item.item_type === "highlight" || item.item_type === "note"),
    );
    setItems(next);
  }

  useEffect(() => {
    function onChapter(raw: Event) {
      const event = raw as CustomEvent<ReaderChapterEventDetail>;
      const chapterId = typeof event.detail?.chapterId === "string" ? event.detail.chapterId : null;
      chapterIdRef.current = chapterId;
      setOpen(false);
      setEditing(null);
      setMessage("");
      if (chapterId) window.setTimeout(() => void load(chapterId), 100);
      else setItems([]);
    }
    function onMode(raw: Event) {
      const event = raw as CustomEvent<{ mode?: ReaderMode }>;
      if (event.detail?.mode) setMode(event.detail.mode);
      if (event.detail?.mode !== "study") {
        setOpen(false);
        setEditing(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setEditing(null);
      }
    }
    window.addEventListener("vibe:reader-chapter", onChapter);
    window.addEventListener("vibe:reader-mode", onMode);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("vibe:reader-chapter", onChapter);
      window.removeEventListener("vibe:reader-mode", onMode);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    const noteCounts = new Map<string, number>();
    for (const item of items) {
      if (item.item_type !== "note") continue;
      const blockId = payloadString(item.payload, "block_id");
      if (blockId) noteCounts.set(blockId, (noteCounts.get(blockId) ?? 0) + 1);
    }
    document.querySelectorAll<HTMLElement>("#reader-active-unit [data-reader-block-id]").forEach((element) => {
      delete element.dataset.readerNoteCount;
    });
    noteCounts.forEach((count, blockId) => {
      const element = document.querySelector<HTMLElement>(`#reader-active-unit [data-reader-block-id="${CSS.escape(blockId)}"]`);
      if (element) element.dataset.readerNoteCount = String(count);
    });

    const cssApi = CSS as typeof CSS & { highlights?: Map<string, unknown> };
    if (cssApi.highlights && typeof Highlight !== "undefined") {
      clearFallbackOverlays();
      const ranges = items.filter((item) => item.item_type === "highlight").map(anchoredRange).filter((range): range is Range => Boolean(range));
      cssApi.highlights.set("vibe-reader-highlights", new Highlight(...ranges));
      return () => cssApi.highlights?.delete("vibe-reader-highlights");
    }

    const refreshFallback = () => renderFallbackOverlays(items);
    const timer = window.setTimeout(refreshFallback, 40);
    window.addEventListener("resize", refreshFallback);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", refreshFallback);
      clearFallbackOverlays();
    };
  }, [items]);

  function jumpToSource(item: StudyItem) {
    const blockId = payloadString(item.payload, "block_id");
    if (!blockId) return;
    const block = document.querySelector<HTMLElement>(`#reader-active-unit [data-reader-block-id="${CSS.escape(blockId)}"]`);
    if (!block) {
      setMessage("The saved source passage is not visible in this unit.");
      return;
    }
    setOpen(false);
    block.scrollIntoView({ behavior: "smooth", block: "center" });
    block.dataset.readerAnnotationFocus = "true";
    window.setTimeout(() => delete block.dataset.readerAnnotationFocus, 1600);
  }

  async function remove(item: StudyItem) {
    if (busyId) return;
    setBusyId(item.item_id);
    setMessage("");
    const { data, error } = await supabase.rpc("delete_study_workspace_item", { p_item_id: item.item_id });
    const result = data as { ok?: boolean; reason?: string | null } | null;
    if (error || !result?.ok) setMessage("Could not delete this annotation.");
    else {
      setItems((current) => current.filter((candidate) => candidate.item_id !== item.item_id));
      setEditing(null);
      setMessage("Annotation deleted.");
    }
    setBusyId(null);
  }

  function beginEdit(item: StudyItem) {
    setMessage("");
    setEditing({
      ...item,
      draftText: payloadString(item.payload, "text"),
      draftColor: payloadString(item.payload, "color") || "yellow",
    });
  }

  async function saveEdit() {
    if (!editing || busyId) return;
    const text = editing.draftText.trim();
    if (!text) return;
    setBusyId(editing.item_id);
    setMessage("");
    const anchor = {
      block_id: payloadString(editing.payload, "block_id"),
      start_offset: payloadInteger(editing.payload, "start_offset"),
      end_offset: payloadInteger(editing.payload, "end_offset"),
    };
    const payload = editing.item_type === "highlight"
      ? {
          text,
          color: editing.draftColor,
          context: payloadString(editing.payload, "context") || "reader_anchor_v1",
          ...anchor,
        }
      : {
          text,
          quote: payloadString(editing.payload, "quote"),
          ...anchor,
        };
    const { data, error } = await supabase.rpc("upsert_study_workspace_item", {
      p_item_type: editing.item_type,
      p_chapter_id: editing.chapter_id,
      p_payload: payload,
      p_item_id: editing.item_id,
    });
    const result = data as { ok?: boolean; reason?: string | null } | null;
    if (error || !result?.ok) setMessage("Could not save this annotation.");
    else {
      await load(editing.chapter_id);
      setEditing(null);
      setMessage("Annotation updated.");
    }
    setBusyId(null);
  }

  if (mode !== "study") return null;

  const highlightCount = items.filter((item) => item.item_type === "highlight").length;
  const noteCount = items.filter((item) => item.item_type === "note").length;

  return <>
    <style jsx global>{`
      ::highlight(vibe-reader-highlights){background:rgba(255,220,80,.58);color:inherit}
      #reader-active-unit [data-reader-annotation-focus="true"]{outline:3px solid color-mix(in srgb,var(--reader-accent,#466400) 65%,transparent);outline-offset:5px;border-radius:7px}
      .reader-annotations-button{position:fixed;right:12px;bottom:max(18px,env(safe-area-inset-bottom));z-index:92;min-height:42px;border:1px solid var(--reader-border,rgba(0,0,0,.14));border-radius:12px;background:color-mix(in srgb,var(--reader-surface,#fffaf0) 96%,transparent);color:var(--reader-text,#27231f);padding:8px 12px;font-size:12px;font-weight:850;box-shadow:0 8px 28px rgba(0,0,0,.16);cursor:pointer}
      .reader-annotations-backdrop{position:fixed;inset:0;z-index:121;display:flex;align-items:flex-end;justify-content:center;padding:12px;background:rgba(0,0,0,.5)}
      .reader-annotations-drawer{width:min(620px,100%);max-height:min(78dvh,720px);overflow-y:auto;box-sizing:border-box;padding:16px;border-radius:18px;border:1px solid var(--reader-border,rgba(0,0,0,.14));background:var(--reader-surface,#fffaf0);color:var(--reader-text,#27231f);box-shadow:0 20px 60px rgba(0,0,0,.35)}
      .reader-annotation-card{margin-top:10px;padding:12px;border:1px solid var(--reader-border,rgba(0,0,0,.14));border-radius:12px;background:var(--reader-bg,#f7f1e5)}
      .reader-annotation-card p{margin:7px 0 0;line-height:1.5}.reader-annotation-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.reader-annotation-actions button,.reader-annotation-editor button{min-height:34px;border:1px solid var(--reader-border,rgba(0,0,0,.14));border-radius:9px;background:var(--reader-surface,#fffaf0);color:inherit;padding:6px 10px;font-weight:750;cursor:pointer}.reader-annotation-editor textarea{width:100%;min-height:100px;margin-top:8px;box-sizing:border-box;border:1px solid var(--reader-border,rgba(0,0,0,.14));border-radius:10px;background:var(--reader-bg,#f7f1e5);color:inherit;padding:10px;font:inherit}.reader-color-choice{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.reader-color-choice button[aria-pressed="true"]{outline:2px solid var(--reader-accent,#466400)}
    `}</style>
    <button type="button" className="reader-annotations-button" onClick={() => { setOpen(true); void load(); }} aria-expanded={open} aria-label="Open saved annotations">
      Annotations {items.length ? `(${items.length})` : ""}
    </button>
    {open ? <div className="reader-annotations-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <div className="reader-annotations-drawer" role="dialog" aria-modal="true" aria-label="Saved annotations">
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
          <div><strong style={{fontSize:18}}>Saved annotations</strong><div style={{marginTop:3,fontSize:12,opacity:.72}}>{highlightCount} highlights · {noteCount} notes in this unit</div></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close annotations">×</button>
        </div>
        {message ? <div role="status" style={{marginTop:10,fontSize:12}}>{message}</div> : null}
        {items.length === 0 ? <p style={{fontSize:13,opacity:.76}}>Select a passage in Study mode to create a highlight or note. Saved items will appear here.</p> : null}
        {items.map((item) => {
          const quote = item.item_type === "note" ? payloadString(item.payload, "quote") : payloadString(item.payload, "text");
          const body = payloadString(item.payload, "text");
          const anchored = Boolean(payloadString(item.payload, "block_id"));
          return <div className="reader-annotation-card" key={item.item_id}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8}}><strong>{item.item_type === "highlight" ? "Highlight" : "Note"}</strong><span style={{fontSize:11,opacity:.65}}>{anchored ? "Anchored" : "Legacy"}</span></div>
            {item.item_type === "note" && quote ? <div style={{marginTop:7,fontSize:12,opacity:.68}}>“{quote.slice(0,180)}{quote.length > 180 ? "…" : ""}”</div> : null}
            <p>{body.slice(0,420)}{body.length > 420 ? "…" : ""}</p>
            <div className="reader-annotation-actions">
              {anchored ? <button type="button" onClick={() => jumpToSource(item)}>Go to passage</button> : null}
              <button type="button" onClick={() => beginEdit(item)}>Edit</button>
              <button type="button" disabled={busyId === item.item_id} onClick={() => void remove(item)}>{busyId === item.item_id ? "Working…" : "Delete"}</button>
            </div>
          </div>;
        })}
      </div>
    </div> : null}
    {editing ? <div className="reader-annotations-backdrop" role="presentation">
      <div className="reader-annotations-drawer reader-annotation-editor" role="dialog" aria-modal="true" aria-label={`Edit ${editing.item_type}`}>
        <strong style={{fontSize:18}}>Edit {editing.item_type}</strong>
        {editing.item_type === "highlight" ? <div className="reader-color-choice" aria-label="Highlight color">
          {["yellow","green","blue","pink"].map((color) => <button key={color} type="button" aria-pressed={editing.draftColor === color} onClick={() => setEditing((current) => current ? {...current,draftColor:color} : current)}>{color}</button>)}
        </div> : null}
        <textarea autoFocus maxLength={editing.item_type === "highlight" ? 2000 : 5000} value={editing.draftText} onChange={(event) => setEditing((current) => current ? {...current,draftText:event.target.value} : current)} />
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:10}}><button type="button" onClick={() => setEditing(null)}>Cancel</button><button type="button" disabled={!editing.draftText.trim() || busyId === editing.item_id} onClick={() => void saveEdit()}>{busyId === editing.item_id ? "Saving…" : "Save"}</button></div>
      </div>
    </div> : null}
  </>;
}
