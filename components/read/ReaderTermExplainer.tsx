"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type ReaderMode = "read" | "study" | "revise";
type ReaderChapterEventDetail = { chapterId?: unknown };
type SelectionState = { text: string; x: number; y: number } | null;
type Explanation = {
  ok?: boolean;
  found?: boolean;
  reason?: string | null;
  term?: string;
  definition_en?: string;
  term_sw?: string;
  explanation_sw?: string;
  source_label?: string;
  source_url?: string;
  source_kind?: string;
};

function currentTermSelection(): SelectionState {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer as Element
    : range.startContainer.parentElement;
  const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE
    ? range.endContainer as Element
    : range.endContainer.parentElement;
  const startBlock = startElement?.closest<HTMLElement>("#reader-active-unit [data-reader-block-id]");
  const endBlock = endElement?.closest<HTMLElement>("#reader-active-unit [data-reader-block-id]");
  if (!startBlock || startBlock !== endBlock) return null;
  const text = selection.toString().replace(/\s+/g, " ").trim();
  if (text.length < 1 || text.length > 160 || text.split(/\s+/).length > 8) return null;
  const rect = range.getBoundingClientRect();
  return {
    text,
    x: Math.max(72, Math.min(window.innerWidth - 72, rect.left + rect.width / 2)),
    y: Math.min(window.innerHeight - 56, rect.bottom + 10),
  };
}

function bestVoice(languagePrefix: "en" | "sw"): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith(languagePrefix));
  return voices.find((voice) => /natural|neural|enhanced|premium|online|google|microsoft/i.test(`${voice.name} ${voice.voiceURI}`)) ?? voices[0] ?? null;
}

function speak(text: string, language: "en" | "sw") {
  if (!("speechSynthesis" in window) || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = bestVoice(language);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = language === "sw" ? "sw-KE" : "en-KE";
  }
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

export function ReaderTermExplainer() {
  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    [],
  );
  const chapterIdRef = useRef<string | null>(null);
  const [mode, setMode] = useState<ReaderMode>("read");
  const [selection, setSelection] = useState<SelectionState>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Explanation | null>(null);

  useEffect(() => {
    function onChapter(raw: Event) {
      const event = raw as CustomEvent<ReaderChapterEventDetail>;
      chapterIdRef.current = typeof event.detail?.chapterId === "string" ? event.detail.chapterId : null;
      setSelection(null);
      setOpen(false);
      setResult(null);
    }
    function onMode(raw: Event) {
      const event = raw as CustomEvent<{ mode?: ReaderMode }>;
      if (event.detail?.mode) setMode(event.detail.mode);
      setSelection(null);
      setOpen(false);
      setResult(null);
    }
    function onSelectionChange() {
      if (mode !== "study" || open) return;
      window.setTimeout(() => setSelection(currentTermSelection()), 0);
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".reader-term-explain-pill,.reader-term-explain-panel")) return;
      if (!target?.closest("#reader-active-unit")) setSelection(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setResult(null);
      }
    }
    window.addEventListener("vibe:reader-chapter", onChapter);
    window.addEventListener("vibe:reader-mode", onMode);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("vibe:reader-chapter", onChapter);
      window.removeEventListener("vibe:reader-mode", onMode);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mode, open]);

  async function explain() {
    const chapterId = chapterIdRef.current;
    if (!selection?.text || !chapterId || loading) return;
    setLoading(true);
    setResult(null);
    setOpen(true);
    const { data, error } = await supabase.rpc("get_reader_term_explanation", {
      p_chapter_id: chapterId,
      p_term: selection.text,
    });
    if (error) {
      setResult({ ok: false, reason: "lookup_failed", term: selection.text });
    } else {
      setResult((data ?? { ok: false, reason: "lookup_failed", term: selection.text }) as Explanation);
    }
    setLoading(false);
  }

  if (mode !== "study") return null;

  return <>
    <style jsx global>{`
      .reader-term-explain-pill{position:fixed;z-index:111;transform:translateX(-50%);min-height:34px;border:1px solid var(--reader-border,rgba(0,0,0,.14));border-radius:999px;background:var(--reader-surface,#fffaf0);color:var(--reader-text,#27231f);padding:6px 11px;font-size:12px;font-weight:850;box-shadow:0 10px 30px rgba(0,0,0,.18);cursor:pointer;white-space:nowrap}
      .reader-term-explain-panel{position:fixed;inset:auto 12px max(64px,env(safe-area-inset-bottom)) 12px;z-index:124;margin:auto;width:min(620px,calc(100% - 24px));max-height:min(72dvh,680px);overflow-y:auto;box-sizing:border-box;padding:16px;border:1px solid var(--reader-border,rgba(0,0,0,.14));border-radius:18px;background:var(--reader-surface,#fffaf0);color:var(--reader-text,#27231f);box-shadow:0 20px 64px rgba(0,0,0,.34)}
      .reader-term-language-card{margin-top:12px;padding:12px;border:1px solid var(--reader-border,rgba(0,0,0,.14));border-radius:12px;background:var(--reader-bg,#f7f1e5)}
      .reader-term-language-card p{margin:6px 0 0;line-height:1.55}.reader-term-source{margin-top:12px;padding-top:10px;border-top:1px solid var(--reader-border,rgba(0,0,0,.14));font-size:11px;color:var(--reader-muted,#625d55)}
      .reader-term-speak{margin-left:8px;border:1px solid var(--reader-border,rgba(0,0,0,.14));border-radius:8px;background:transparent;color:inherit;padding:4px 8px;font-size:11px;font-weight:750;cursor:pointer}
    `}</style>
    {selection && !open ? <button type="button" className="reader-term-explain-pill" style={{left:selection.x,top:selection.y}} onClick={() => void explain()} disabled={loading} aria-label={`Explain ${selection.text} in English and Kiswahili`}>
      {loading ? "Checking…" : "Explain EN / SW"}
    </button> : null}
    {open ? <div className="reader-term-explain-panel" role="dialog" aria-modal="true" aria-label="Verified term explanation">
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
        <div><strong style={{fontSize:18}}>{selection?.text || result?.term || "Term explanation"}</strong><div style={{marginTop:3,fontSize:11,opacity:.65}}>Verified glossary only · no automatic translation</div></div>
        <button type="button" onClick={() => { setOpen(false); setResult(null); }} aria-label="Close explanation">×</button>
      </div>
      {loading ? <p role="status">Checking the verified glossary…</p> : null}
      {!loading && result?.ok && result.found ? <>
        <div className="reader-term-language-card"><strong>English</strong><button type="button" className="reader-term-speak" onClick={() => speak(result.term || selection?.text || "", "en")}>Pronounce</button><p>{result.definition_en}</p></div>
        {result.term_sw || result.explanation_sw ? <div className="reader-term-language-card"><strong>Kiswahili{result.term_sw ? ` · ${result.term_sw}` : ""}</strong>{result.term_sw ? <button type="button" className="reader-term-speak" onClick={() => speak(result.term_sw || "", "sw")}>Tamka</button> : null}<p>{result.explanation_sw || "Maelezo ya Kiswahili hayajaidhinishwa bado."}</p></div> : <div className="reader-term-language-card"><strong>Kiswahili</strong><p>Hakuna tafsiri ya Kiswahili iliyothibitishwa bado.</p></div>}
        <div className="reader-term-source">Source: {result.source_label || "VibeSchool editorial glossary"}{result.source_kind ? ` · ${result.source_kind}` : ""}</div>
      </> : null}
      {!loading && result?.ok && !result.found ? <div className="reader-term-language-card"><strong>No verified definition yet</strong><p>VibeSchool does not have a source-approved English/Kiswahili explanation for this term yet. The reader will not invent one.</p></div> : null}
      {!loading && result && !result.ok ? <div className="reader-term-language-card"><strong>Explanation unavailable</strong><p>{result.reason === "not_entitled" ? "This definition is only available with access to this unit." : "The verified glossary could not be checked right now."}</p></div> : null}
    </div> : null}
  </>;
}
