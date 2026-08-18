"use client";

import { useEffect, useMemo, useState } from "react";

type ReaderMode = "read" | "study" | "revise";

function normalizedMode(value: unknown): ReaderMode {
  return value === "study" || value === "revise" ? value : "read";
}

export function ReaderCalmSurface() {
  const [mode, setMode] = useState<ReaderMode>("read");
  const [contentsOpen, setContentsOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [activeReader, setActiveReader] = useState(false);

  useEffect(() => {
    const shell = document.getElementById("vibetextbook-reader-shell");
    if (!shell) return;

    const syncActiveReader = () => {
      const active = Boolean(document.getElementById("reader-active-unit"));
      shell.classList.toggle("reader-calm-active", active);
      setActiveReader(active);
    };

    const syncMode = () => setMode(normalizedMode(shell.dataset.readerMode));

    syncActiveReader();
    syncMode();

    const observer = new MutationObserver(() => {
      syncActiveReader();
      syncMode();
    });
    observer.observe(shell, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-reader-mode"] });

    function onMode(raw: Event) {
      const event = raw as CustomEvent<{ mode?: ReaderMode }>;
      if (event.detail?.mode) setMode(normalizedMode(event.detail.mode));
      setModeMenuOpen(false);
      setContentsOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setContentsOpen(false);
      setModeMenuOpen(false);
    }

    window.addEventListener("vibe:reader-mode", onMode);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      observer.disconnect();
      window.removeEventListener("vibe:reader-mode", onMode);
      window.removeEventListener("keydown", onKeyDown);
      shell.classList.remove("reader-calm-active");
      delete shell.dataset.readerContents;
    };
  }, []);

  useEffect(() => {
    const shell = document.getElementById("vibetextbook-reader-shell");
    if (!shell) return;
    shell.dataset.readerContents = contentsOpen ? "true" : "false";
  }, [contentsOpen]);

  const modeLabel = useMemo(
    () => (mode === "read" ? "Read" : mode === "study" ? "Study" : "Revise"),
    [mode]
  );

  function chooseMode(nextMode: ReaderMode) {
    const source = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".reader-mode-switcher button")
    ).find((button) => button.textContent?.trim().toLocaleLowerCase("en") === nextMode);

    source?.click();
    setModeMenuOpen(false);
  }

  if (!activeReader) return null;

  return (
    <>
      <style jsx global>{`
        #vibetextbook-reader-shell.reader-calm-active[data-reader-mode="read"]
          #vibetextbook-reading-content > div > div:first-child {
          display: none !important;
        }

        #vibetextbook-reader-shell.reader-calm-active[data-reader-mode="read"]
          #vibetextbook-reading-content main {
          padding-top: 72px !important;
        }

        #vibetextbook-reader-shell.reader-calm-active[data-reader-mode="read"]
          #vibetextbook-reading-content main > :not(#reader-active-unit) {
          display: none !important;
        }

        #vibetextbook-reader-shell.reader-calm-active[data-reader-mode="read"][data-reader-contents="true"]
          #vibetextbook-reading-content main > section:not(#reader-active-unit) {
          display: block !important;
          position: fixed !important;
          z-index: 2147483050 !important;
          inset: max(70px, env(safe-area-inset-top)) 12px max(86px, env(safe-area-inset-bottom)) !important;
          width: auto !important;
          max-width: 680px !important;
          margin: 0 auto !important;
          overflow-y: auto !important;
          box-sizing: border-box !important;
          padding: 18px !important;
          border: 1px solid var(--reader-border, rgba(39,35,31,.14)) !important;
          border-radius: 18px !important;
          background: var(--reader-surface, #fffaf0) !important;
          color: var(--reader-text, #27231f) !important;
          box-shadow: 0 24px 70px rgba(0,0,0,.34) !important;
        }

        #vibetextbook-reader-shell.reader-calm-active[data-reader-mode="read"]
          #reader-active-unit [aria-label="Assign this unit to a class"],
        #vibetextbook-reader-shell.reader-calm-active[data-reader-mode="read"]
          #reader-active-unit [aria-label="Bookmark chapter"],
        #vibetextbook-reader-shell.reader-calm-active[data-reader-mode="read"]
          #reader-active-unit [aria-label="Remove chapter bookmark"] {
          display: none !important;
        }

        #vibetextbook-reader-shell.reader-calm-active .reader-mode-switcher {
          display: none !important;
        }

        #vibetextbook-reader-shell.reader-calm-active .reader-excellence-bar {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }

        #vibetextbook-reader-shell.reader-calm-active .reader-excellence-bar > button:last-child {
          display: none !important;
        }

        .reader-calm-toolbar {
          position: fixed;
          z-index: 2147483060;
          top: max(10px, env(safe-area-inset-top));
          left: 50%;
          transform: translateX(-50%);
          width: min(calc(100vw - 24px), 720px);
          display: grid;
          grid-template-columns: minmax(44px, auto) 1fr auto auto;
          align-items: center;
          gap: 6px;
          padding: 6px;
          box-sizing: border-box;
          border: 1px solid var(--reader-border, rgba(39,35,31,.14));
          border-radius: 16px;
          background: color-mix(in srgb, var(--reader-surface, #fffaf0) 94%, transparent);
          color: var(--reader-text, #27231f);
          box-shadow: 0 10px 34px rgba(0,0,0,.18);
          backdrop-filter: blur(16px);
        }

        .reader-calm-toolbar button {
          min-height: 44px;
          border: 0;
          border-radius: 11px;
          background: transparent;
          color: inherit;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 850;
          cursor: pointer;
        }

        .reader-calm-toolbar button:hover,
        .reader-calm-toolbar button:focus-visible,
        .reader-calm-toolbar button[aria-expanded="true"] {
          background: color-mix(in srgb, var(--reader-accent, #466400) 12%, transparent);
        }

        .reader-calm-title {
          min-width: 0;
          padding-inline: 4px;
          color: var(--reader-muted, #625d55);
          font-size: 11px;
          font-weight: 760;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .reader-calm-popover {
          position: fixed;
          z-index: 2147483070;
          top: max(66px, calc(env(safe-area-inset-top) + 56px));
          right: max(12px, calc((100vw - 720px) / 2));
          width: min(230px, calc(100vw - 24px));
          padding: 7px;
          border: 1px solid var(--reader-border, rgba(39,35,31,.14));
          border-radius: 14px;
          background: var(--reader-surface, #fffaf0);
          color: var(--reader-text, #27231f);
          box-shadow: 0 18px 48px rgba(0,0,0,.26);
        }

        .reader-calm-popover button {
          width: 100%;
          min-height: 44px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: inherit;
          padding: 9px 11px;
          text-align: left;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .reader-calm-popover button[aria-current="true"] {
          background: color-mix(in srgb, var(--reader-accent, #466400) 13%, transparent);
          color: var(--reader-accent, #466400);
        }

        .reader-calm-backdrop {
          position: fixed;
          z-index: 2147483040;
          inset: 0;
          background: rgba(0,0,0,.42);
        }

        @media (max-width: 520px) {
          .reader-calm-toolbar {
            grid-template-columns: 44px 1fr auto auto;
          }
          .reader-calm-toolbar button {
            padding-inline: 8px;
          }
          .reader-calm-title {
            font-size: 10px;
          }
        }
      `}</style>

      {contentsOpen ? (
        <button
          type="button"
          className="reader-calm-backdrop"
          aria-label="Close contents"
          onClick={() => setContentsOpen(false)}
        />
      ) : null}

      <div className="reader-calm-toolbar reader-excellence-ui" aria-label="Reader navigation">
        <button type="button" aria-label="Back" onClick={() => window.history.back()}>
          ←
        </button>
        <div className="reader-calm-title">Content first · tools when needed</div>
        <button
          type="button"
          aria-expanded={contentsOpen}
          aria-controls="reader-calm-contents"
          onClick={() => {
            setContentsOpen((current) => !current);
            setModeMenuOpen(false);
          }}
        >
          Contents
        </button>
        <button
          type="button"
          aria-expanded={modeMenuOpen}
          onClick={() => {
            setModeMenuOpen((current) => !current);
            setContentsOpen(false);
          }}
        >
          {modeLabel} ▾
        </button>
      </div>

      {modeMenuOpen ? (
        <div className="reader-calm-popover" role="menu" aria-label="Choose reading mode">
          {(["read", "study", "revise"] as ReaderMode[]).map((value) => (
            <button
              key={value}
              type="button"
              role="menuitem"
              aria-current={mode === value ? "true" : undefined}
              onClick={() => chooseMode(value)}
            >
              {value === "read"
                ? "Read · calm reading"
                : value === "study"
                  ? "Study · notes and highlights"
                  : "Revise · practice and self-test"}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
