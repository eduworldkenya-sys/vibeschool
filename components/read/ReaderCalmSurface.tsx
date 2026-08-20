"use client";

import { useEffect, useState } from "react";

// Canonical learner surface: one reading view, one Contents action, one More menu.
export function ReaderCalmSurface() {
  const [contentsOpen, setContentsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [activeReader, setActiveReader] = useState(false);
  const [currentTitle, setCurrentTitle] = useState("VibeLearn");

  useEffect(() => {
    const shell = document.getElementById("vibetextbook-reader-shell");
    if (!shell) return;
    const sync = () => {
      const unit = document.getElementById("reader-active-unit");
      const active = Boolean(unit);
      shell.classList.toggle("reader-calm-active", active);
      setActiveReader(active);
      const heading = unit?.querySelector("h2")?.textContent?.trim();
      if (heading) setCurrentTitle(heading);
      if (active) {
        const read = Array.from(document.querySelectorAll<HTMLButtonElement>(".reader-mode-switcher button")).find(b => b.textContent?.trim() === "Read");
        read?.click();
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(shell, { childList:true, subtree:true });
    const close = () => { setContentsOpen(false); setMoreOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("vibe:reader-chapter", close);
    window.addEventListener("vibe:reader-secondary-open", close);
    window.addEventListener("keydown", key);
    return () => {
      observer.disconnect();
      window.removeEventListener("vibe:reader-chapter", close);
      window.removeEventListener("vibe:reader-secondary-open", close);
      window.removeEventListener("keydown", key);
      shell.classList.remove("reader-calm-active");
      delete shell.dataset.readerContents;
    };
  }, []);

  useEffect(() => {
    const shell = document.getElementById("vibetextbook-reader-shell");
    if (shell) shell.dataset.readerContents = contentsOpen ? "true" : "false";
  }, [contentsOpen]);

  function openPractice() { setMoreOpen(false); document.querySelector<HTMLButtonElement>(".reader-practice-button")?.click(); }
  function openStudy() { setMoreOpen(false); Array.from(document.querySelectorAll<HTMLButtonElement>(".reader-mode-switcher button")).find(b => b.textContent?.trim() === "Study")?.click(); }
  function toggleFocus() { setMoreOpen(false); document.querySelector<HTMLButtonElement>(".reader-excellence-bar > button:nth-child(3)")?.click(); }

  if (!activeReader) return null;
  return <>
    <style jsx global>{`
      #vibetextbook-reader-shell.reader-calm-active #vibetextbook-reading-content > div:last-child > div:first-child{display:none!important}
      #vibetextbook-reader-shell.reader-calm-active #vibetextbook-reading-content main{padding-top:60px!important}
      #vibetextbook-reader-shell.reader-calm-active #vibetextbook-reading-content main>:not(#reader-active-unit){display:none!important}
      #vibetextbook-reader-shell.reader-calm-active[data-reader-contents="true"] #vibetextbook-reading-content main>section:not(#reader-active-unit){display:block!important;position:fixed!important;z-index:2147483050!important;left:10px!important;right:10px!important;bottom:max(10px,env(safe-area-inset-bottom))!important;top:auto!important;max-height:min(68dvh,620px)!important;width:auto!important;max-width:680px!important;margin:0 auto!important;overflow-y:auto!important;box-sizing:border-box!important;padding:14px!important;border:1px solid var(--reader-border)!important;border-radius:20px!important;background:var(--reader-surface)!important;color:var(--reader-text)!important;box-shadow:0 24px 70px rgba(0,0,0,.34)!important}
      #vibetextbook-reader-shell.reader-calm-active .reader-mode-switcher,#vibetextbook-reader-shell.reader-calm-active .reader-practice-button{display:none!important}
      .reader-calm-toolbar{position:fixed;z-index:2147483060;top:max(6px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(calc(100vw - 16px),720px);display:grid;grid-template-columns:44px minmax(0,1fr) auto 44px;align-items:center;gap:2px;padding:3px 5px;box-sizing:border-box;border:1px solid var(--reader-border);border-radius:14px;background:color-mix(in srgb,var(--reader-surface) 94%,transparent);color:var(--reader-text);box-shadow:0 7px 24px rgba(0,0,0,.16);backdrop-filter:blur(14px)}
      .reader-calm-toolbar button{min-height:40px!important;border:0;border-radius:10px;background:transparent;color:inherit;padding:6px 8px;font-size:12px;font-weight:800;cursor:pointer}.reader-calm-toolbar button:focus-visible,.reader-calm-toolbar button[aria-expanded="true"]{background:color-mix(in srgb,var(--reader-accent) 12%,transparent)}
      .reader-calm-title{min-width:0;padding-inline:3px;color:var(--reader-text);font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reader-calm-more{font-size:20px!important;letter-spacing:2px}
      .reader-calm-popover{position:fixed;z-index:2147483070;top:max(56px,calc(env(safe-area-inset-top) + 50px));right:max(8px,calc((100vw - 720px)/2));width:min(250px,calc(100vw - 16px));padding:7px;border:1px solid var(--reader-border);border-radius:14px;background:var(--reader-surface);color:var(--reader-text);box-shadow:0 18px 48px rgba(0,0,0,.26)}.reader-calm-popover button{width:100%;min-height:44px;border:0;border-radius:10px;background:transparent;color:inherit;padding:10px 11px;text-align:left;font-size:13px;font-weight:800;cursor:pointer}.reader-calm-popover button:focus-visible{background:color-mix(in srgb,var(--reader-accent) 12%,transparent)}
      .reader-calm-backdrop{position:fixed;z-index:2147483040;inset:0;background:rgba(0,0,0,.42)}
      @media(max-width:380px){.reader-calm-toolbar{width:calc(100vw - 10px)}.reader-calm-title{font-size:11px}.reader-calm-toolbar button{padding-inline:6px}}
    `}</style>
    {contentsOpen?<button type="button" className="reader-calm-backdrop" aria-label="Close contents" onClick={()=>setContentsOpen(false)}/>:null}
    <nav className="reader-calm-toolbar" aria-label="Reader navigation">
      <button type="button" aria-label="Back" onClick={()=>window.history.back()}>←</button><div className="reader-calm-title">{currentTitle}</div>
      <button type="button" aria-expanded={contentsOpen} onClick={()=>{setContentsOpen(v=>!v);setMoreOpen(false)}}>Contents</button>
      <button type="button" className="reader-calm-more" aria-label="More reader options" aria-expanded={moreOpen} onClick={()=>{setMoreOpen(v=>!v);setContentsOpen(false)}}>⋯</button>
    </nav>
    {moreOpen?<div className="reader-calm-popover" role="menu" aria-label="More reader options"><button type="button" role="menuitem" onClick={openPractice}>Practice this topic</button><button type="button" role="menuitem" onClick={()=>{setMoreOpen(false);window.dispatchEvent(new CustomEvent("vibe:reader-help"))}}>Get help</button><button type="button" role="menuitem" onClick={openStudy}>Notes & highlights</button><button type="button" role="menuitem" onClick={toggleFocus}>Focus mode</button></div>:null}
  </>;
}
