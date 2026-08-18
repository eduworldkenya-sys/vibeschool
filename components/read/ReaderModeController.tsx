"use client";

import { useEffect, useState } from "react";

type ReaderMode = "read" | "study" | "revise";

const STORAGE_KEY = "vibeschool.reader.mode.v1";

function initialMode(): ReaderMode {
  if (typeof window === "undefined") return "read";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "study" || stored === "revise" ? stored : "read";
}

export function ReaderModeController() {
  const [mode, setMode] = useState<ReaderMode>("read");

  useEffect(() => setMode(initialMode()), []);

  useEffect(() => {
    const shell = document.getElementById("vibetextbook-reader-shell");
    if (!shell) return;
    shell.dataset.readerMode = mode;
    try { window.localStorage.setItem(STORAGE_KEY, mode); } catch {}
    window.dispatchEvent(new CustomEvent("vibe:reader-mode", { detail: { mode } }));
  }, [mode]);

  return (
    <>
      <style jsx global>{`
        .reader-mode-switcher {
          position: fixed;
          left: 50%;
          bottom: max(14px, env(safe-area-inset-bottom));
          z-index: 94;
          transform: translateX(-50%);
          display: flex;
          gap: 3px;
          padding: 4px;
          border: 1px solid var(--reader-border, rgba(0,0,0,.14));
          border-radius: 999px;
          background: color-mix(in srgb, var(--reader-surface, #fffaf0) 95%, transparent);
          box-shadow: 0 10px 30px rgba(0,0,0,.18);
          backdrop-filter: blur(12px);
        }
        .reader-mode-switcher button {
          min-height: 36px;
          border: 0;
          border-radius: 999px;
          padding: 7px 13px;
          background: transparent;
          color: var(--reader-muted, #625d55);
          font-size: 12px;
          font-weight: 850;
          cursor: pointer;
        }
        .reader-mode-switcher button[aria-pressed="true"] {
          background: var(--reader-accent, #466400);
          color: var(--reader-bg, #fff);
        }
        #vibetextbook-reader-shell[data-reader-mode="read"] .reader-secondary-tools-button,
        #vibetextbook-reader-shell[data-reader-mode="read"] .reader-selection-toolbar,
        #vibetextbook-reader-shell[data-reader-mode="read"] .reader-study-marker {
          display: none !important;
        }
        #vibetextbook-reader-shell[data-reader-mode="study"] .reader-secondary-tools-button {
          display: block;
        }
        #vibetextbook-reader-shell[data-reader-mode="revise"] .reader-selection-toolbar {
          display: none !important;
        }
        @media (max-width: 420px) {
          .reader-mode-switcher button { padding-inline: 10px; }
        }
      `}</style>
      <nav className="reader-mode-switcher reader-excellence-ui" aria-label="Reading mode">
        {(["read", "study", "revise"] as ReaderMode[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            title={
              value === "read" ? "Clean reading" :
              value === "study" ? "Highlights, notes and study tools" :
              "Revision and self-testing"
            }
          >
            {value === "read" ? "Read" : value === "study" ? "Study" : "Revise"}
          </button>
        ))}
      </nav>
    </>
  );
}
