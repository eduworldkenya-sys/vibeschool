"use client";

import { useEffect, useState } from "react";

type ThemeMode = "dark" | "light" | "paper";
type FontScale = "small" | "medium" | "large" | "xlarge";
type LineSpacing = "compact" | "comfortable" | "relaxed";
type ReadingWidth = "narrow" | "standard" | "wide";

interface ReaderPreferences {
  theme: ThemeMode;
  fontScale: FontScale;
  lineSpacing: LineSpacing;
  readingWidth: ReadingWidth;
  reducedMotion: boolean;
}

const STORAGE_KEY = "vibeschool_reader_preferences_v1";

const DEFAULTS: ReaderPreferences = {
  theme: "dark",
  fontScale: "medium",
  lineSpacing: "comfortable",
  readingWidth: "standard",
  reducedMotion: false,
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "dark" || value === "light" || value === "paper";
}

function isFontScale(value: unknown): value is FontScale {
  return value === "small" || value === "medium" || value === "large" || value === "xlarge";
}

function isLineSpacing(value: unknown): value is LineSpacing {
  return value === "compact" || value === "comfortable" || value === "relaxed";
}

function isReadingWidth(value: unknown): value is ReadingWidth {
  return value === "narrow" || value === "standard" || value === "wide";
}

function readPreferences(): ReaderPreferences {
  if (typeof window === "undefined") return DEFAULTS;

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<ReaderPreferences>;
    return {
      theme: isThemeMode(parsed.theme) ? parsed.theme : DEFAULTS.theme,
      fontScale: isFontScale(parsed.fontScale) ? parsed.fontScale : DEFAULTS.fontScale,
      lineSpacing: isLineSpacing(parsed.lineSpacing) ? parsed.lineSpacing : DEFAULTS.lineSpacing,
      readingWidth: isReadingWidth(parsed.readingWidth) ? parsed.readingWidth : DEFAULTS.readingWidth,
      reducedMotion:
        typeof parsed.reducedMotion === "boolean"
          ? parsed.reducedMotion
          : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  } catch {
    return DEFAULTS;
  }
}

export function ReaderStudyViewControls() {
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState<ReaderPreferences>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPreferences(readPreferences());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const root = document.documentElement;
    root.dataset.vsReaderTheme = preferences.theme;
    root.dataset.vsReaderFont = preferences.fontScale;
    root.dataset.vsReaderSpacing = preferences.lineSpacing;
    root.dataset.vsReaderWidth = preferences.readingWidth;
    root.dataset.vsReaderMotion = preferences.reducedMotion ? "reduced" : "full";

    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));

    return () => {
      delete root.dataset.vsReaderTheme;
      delete root.dataset.vsReaderFont;
      delete root.dataset.vsReaderSpacing;
      delete root.dataset.vsReaderWidth;
      delete root.dataset.vsReaderMotion;
    };
  }, [hydrated, preferences]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.altKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function update<K extends keyof ReaderPreferences>(
    key: K,
    value: ReaderPreferences[K]
  ) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setPreferences({
      ...DEFAULTS,
      reducedMotion: prefersReducedMotion,
    });
  }

  return (
    <>
      <a className="vs-reader-skip-link" href="#vibetextbook-reading-content">
        Skip to reading content
      </a>

      <button
        type="button"
        className="vs-reader-settings-button"
        aria-expanded={open}
        aria-controls="vs-reader-settings-panel"
        onClick={() => setOpen((current) => !current)}
        title="Reading settings (Alt+R)"
      >
        Aa
        <span className="vs-reader-settings-label"> Reading view</span>
      </button>

      {open && (
        <aside
          id="vs-reader-settings-panel"
          className="vs-reader-settings-panel"
          aria-label="Reading view settings"
        >
          <div className="vs-reader-settings-heading">
            <div>
              <h2>Reading view</h2>
              <p>Adjust the page without changing the textbook.</p>
            </div>
            <button
              type="button"
              className="vs-reader-close"
              onClick={() => setOpen(false)}
              aria-label="Close reading settings"
            >
              ×
            </button>
          </div>

          <fieldset>
            <legend>Page appearance</legend>
            <div className="vs-reader-option-grid">
              {(["dark", "light", "paper"] as ThemeMode[]).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  className={preferences.theme === theme ? "is-active" : ""}
                  aria-pressed={preferences.theme === theme}
                  onClick={() => update("theme", theme)}
                >
                  {theme === "dark" ? "Dark" : theme === "light" ? "Light" : "Paper"}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Text size</legend>
            <div className="vs-reader-option-grid">
              {(["small", "medium", "large", "xlarge"] as FontScale[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  className={preferences.fontScale === size ? "is-active" : ""}
                  aria-pressed={preferences.fontScale === size}
                  onClick={() => update("fontScale", size)}
                >
                  {size === "xlarge"
                    ? "Extra large"
                    : size.charAt(0).toUpperCase() + size.slice(1)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Line spacing</legend>
            <div className="vs-reader-option-grid">
              {(["compact", "comfortable", "relaxed"] as LineSpacing[]).map((spacing) => (
                <button
                  key={spacing}
                  type="button"
                  className={preferences.lineSpacing === spacing ? "is-active" : ""}
                  aria-pressed={preferences.lineSpacing === spacing}
                  onClick={() => update("lineSpacing", spacing)}
                >
                  {spacing.charAt(0).toUpperCase() + spacing.slice(1)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Reading width</legend>
            <div className="vs-reader-option-grid">
              {(["narrow", "standard", "wide"] as ReadingWidth[]).map((width) => (
                <button
                  key={width}
                  type="button"
                  className={preferences.readingWidth === width ? "is-active" : ""}
                  aria-pressed={preferences.readingWidth === width}
                  onClick={() => update("readingWidth", width)}
                >
                  {width.charAt(0).toUpperCase() + width.slice(1)}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="vs-reader-motion-control">
            <input
              type="checkbox"
              checked={preferences.reducedMotion}
              onChange={(event) => update("reducedMotion", event.target.checked)}
            />
            <span>
              <strong>Reduce motion</strong>
              <small>Limits reader animation and smooth scrolling.</small>
            </span>
          </label>

          <button type="button" className="vs-reader-reset" onClick={reset}>
            Reset reading view
          </button>

          <p className="vs-reader-shortcut">Keyboard shortcut: Alt + R</p>
        </aside>
      )}

      <style jsx global>{`
        :root {
          --vs-reader-font-size: 16px;
          --vs-reader-line-height: 1.7;
          --vs-reader-max-width: 720px;
          --vs-reader-bg: #090d16;
          --vs-reader-surface: #111827;
          --vs-reader-card: #1a2235;
          --vs-reader-text: #ffffff;
          --vs-reader-muted: rgba(255, 255, 255, 0.58);
          --vs-reader-border: rgba(255, 255, 255, 0.1);
          --vs-reader-accent: #ccff00;
        }

        html[data-vs-reader-theme="light"] {
          --vs-reader-bg: #f7f8fb;
          --vs-reader-surface: #ffffff;
          --vs-reader-card: #eef1f5;
          --vs-reader-text: #111827;
          --vs-reader-muted: #5f6878;
          --vs-reader-border: #d8dde6;
          --vs-reader-accent: #3f6212;
        }

        html[data-vs-reader-theme="paper"] {
          --vs-reader-bg: #f4ecd8;
          --vs-reader-surface: #fbf5e7;
          --vs-reader-card: #eee2c7;
          --vs-reader-text: #332a20;
          --vs-reader-muted: #6f6252;
          --vs-reader-border: #d9c9aa;
          --vs-reader-accent: #526b2b;
        }

        html[data-vs-reader-font="small"] {
          --vs-reader-font-size: 14px;
        }

        html[data-vs-reader-font="medium"] {
          --vs-reader-font-size: 16px;
        }

        html[data-vs-reader-font="large"] {
          --vs-reader-font-size: 18px;
        }

        html[data-vs-reader-font="xlarge"] {
          --vs-reader-font-size: 21px;
        }

        html[data-vs-reader-spacing="compact"] {
          --vs-reader-line-height: 1.45;
        }

        html[data-vs-reader-spacing="comfortable"] {
          --vs-reader-line-height: 1.7;
        }

        html[data-vs-reader-spacing="relaxed"] {
          --vs-reader-line-height: 2;
        }

        html[data-vs-reader-width="narrow"] {
          --vs-reader-max-width: 600px;
        }

        html[data-vs-reader-width="standard"] {
          --vs-reader-max-width: 720px;
        }

        html[data-vs-reader-width="wide"] {
          --vs-reader-max-width: 900px;
        }

        #vibetextbook-reader-shell,
        #vibetextbook-reader-shell > div {
          background: var(--vs-reader-bg) !important;
          color: var(--vs-reader-text) !important;
        }

        #vibetextbook-reader-shell main {
          max-width: var(--vs-reader-max-width) !important;
          transition: max-width 160ms ease;
        }

        #vibetextbook-reader-shell main p,
        #vibetextbook-reader-shell main li,
        #vibetextbook-reader-shell main blockquote,
        #vibetextbook-reader-shell main [contenteditable="false"] {
          font-size: var(--vs-reader-font-size) !important;
          line-height: var(--vs-reader-line-height) !important;
          color: var(--vs-reader-text) !important;
        }

        #vibetextbook-reader-shell main h1,
        #vibetextbook-reader-shell main h2,
        #vibetextbook-reader-shell main h3,
        #vibetextbook-reader-shell main h4,
        #vibetextbook-reader-shell main strong {
          color: var(--vs-reader-text) !important;
        }

        #vibetextbook-reader-shell main section > div,
        #vibetextbook-reader-shell main article,
        #vibetextbook-reader-shell main button {
          border-color: var(--vs-reader-border) !important;
        }

        html[data-vs-reader-theme="light"] #vibetextbook-reader-shell main section > div,
        html[data-vs-reader-theme="paper"] #vibetextbook-reader-shell main section > div {
          background-color: var(--vs-reader-surface) !important;
        }

        #vibetextbook-reader-shell button:focus-visible,
        #vibetextbook-reader-shell a:focus-visible,
        .vs-reader-settings-button:focus-visible,
        .vs-reader-settings-panel button:focus-visible,
        .vs-reader-settings-panel input:focus-visible {
          outline: 3px solid var(--vs-reader-accent) !important;
          outline-offset: 3px !important;
        }

        .vs-reader-skip-link {
          position: fixed;
          top: 8px;
          left: 8px;
          z-index: 120;
          transform: translateY(-160%);
          background: var(--vs-reader-accent);
          color: #090d16;
          padding: 10px 14px;
          border-radius: 10px;
          font-weight: 900;
          text-decoration: none;
        }

        .vs-reader-skip-link:focus {
          transform: translateY(0);
        }

        .vs-reader-settings-button {
          position: fixed;
          right: 16px;
          top: 16px;
          z-index: 90;
          border: 1px solid var(--vs-reader-border);
          border-radius: 12px;
          background: color-mix(in srgb, var(--vs-reader-surface) 92%, transparent);
          color: var(--vs-reader-text);
          padding: 9px 12px;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
          backdrop-filter: blur(12px);
        }

        .vs-reader-settings-panel {
          position: fixed;
          top: 64px;
          right: 16px;
          z-index: 100;
          width: min(360px, calc(100vw - 32px));
          max-height: calc(100dvh - 82px);
          overflow-y: auto;
          box-sizing: border-box;
          border: 1px solid var(--vs-reader-border);
          border-radius: 18px;
          background: var(--vs-reader-surface);
          color: var(--vs-reader-text);
          padding: 16px;
          box-shadow: 0 22px 55px rgba(0, 0, 0, 0.38);
        }

        .vs-reader-settings-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .vs-reader-settings-heading h2 {
          margin: 0;
          font-size: 18px;
        }

        .vs-reader-settings-heading p {
          margin: 4px 0 0;
          color: var(--vs-reader-muted);
          font-size: 12px;
          line-height: 1.45;
        }

        .vs-reader-close {
          border: 0;
          background: transparent;
          color: var(--vs-reader-text);
          font-size: 24px;
          cursor: pointer;
        }

        .vs-reader-settings-panel fieldset {
          border: 0;
          padding: 0;
          margin: 18px 0 0;
        }

        .vs-reader-settings-panel legend {
          margin-bottom: 8px;
          font-size: 12px;
          font-weight: 900;
        }

        .vs-reader-option-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 7px;
        }

        .vs-reader-option-grid button,
        .vs-reader-reset {
          border: 1px solid var(--vs-reader-border);
          border-radius: 10px;
          background: var(--vs-reader-card);
          color: var(--vs-reader-text);
          padding: 9px 10px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .vs-reader-option-grid button.is-active {
          border-color: var(--vs-reader-accent);
          box-shadow: inset 0 0 0 1px var(--vs-reader-accent);
        }

        .vs-reader-motion-control {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          margin-top: 18px;
          cursor: pointer;
        }

        .vs-reader-motion-control input {
          width: 18px;
          height: 18px;
          margin: 1px 0 0;
        }

        .vs-reader-motion-control span {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 12px;
        }

        .vs-reader-motion-control small {
          color: var(--vs-reader-muted);
          line-height: 1.4;
        }

        .vs-reader-reset {
          width: 100%;
          margin-top: 18px;
        }

        .vs-reader-shortcut {
          margin: 10px 0 0;
          text-align: center;
          color: var(--vs-reader-muted);
          font-size: 11px;
        }

        html[data-vs-reader-motion="reduced"] *,
        html[data-vs-reader-motion="reduced"] *::before,
        html[data-vs-reader-motion="reduced"] *::after {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          scroll-behavior: auto !important;
          transition-duration: 0.001ms !important;
        }

        @media (max-width: 640px) {
          .vs-reader-settings-button {
            top: auto;
            right: 16px;
            bottom: 72px;
          }

          .vs-reader-settings-label {
            display: none;
          }

          .vs-reader-settings-panel {
            top: auto;
            right: 0;
            bottom: 0;
            width: 100%;
            max-height: 86dvh;
            border-radius: 20px 20px 0 0;
          }
        }
      `}</style>
    </>
  );
}
