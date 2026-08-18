"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ReaderTheme = "light" | "paper" | "dark" | "contrast";
type ReaderWidth = "narrow" | "standard" | "wide";

type ReaderPreferences = {
  theme: ReaderTheme;
  fontSize: number;
  lineHeight: number;
  width: ReaderWidth;
  focus: boolean;
  rate: number;
  voiceURI: string;
};

const STORAGE_KEY = "vibeschool.reader.preferences.v1";

const DEFAULT_PREFERENCES: ReaderPreferences = {
  theme: "paper",
  fontSize: 19,
  lineHeight: 1.72,
  width: "standard",
  focus: false,
  rate: 0.95,
  voiceURI: "",
};

const WIDTHS: Record<ReaderWidth, string> = {
  narrow: "620px",
  standard: "720px",
  wide: "840px",
};

const READER_TEXT_SELECTOR = [
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "li",
  "blockquote",
  "figcaption",
  "[data-reader-block-id]",
].join(",");

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function readStoredPreferences(): ReaderPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<ReaderPreferences>;
    return {
      theme:
        parsed.theme === "light" ||
        parsed.theme === "paper" ||
        parsed.theme === "dark" ||
        parsed.theme === "contrast"
          ? parsed.theme
          : DEFAULT_PREFERENCES.theme,
      fontSize: clamp(Number(parsed.fontSize) || DEFAULT_PREFERENCES.fontSize, 16, 28),
      lineHeight: clamp(
        Number(parsed.lineHeight) || DEFAULT_PREFERENCES.lineHeight,
        1.4,
        2.1
      ),
      width:
        parsed.width === "narrow" ||
        parsed.width === "standard" ||
        parsed.width === "wide"
          ? parsed.width
          : DEFAULT_PREFERENCES.width,
      focus: Boolean(parsed.focus),
      rate: clamp(Number(parsed.rate) || DEFAULT_PREFERENCES.rate, 0.75, 1.5),
      voiceURI: typeof parsed.voiceURI === "string" ? parsed.voiceURI : "",
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function isActuallyVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function collectReadableElements(): HTMLElement[] {
  const root = document.getElementById("vibetextbook-reading-content");
  if (!root) return [];

  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(READER_TEXT_SELECTOR)
  ).filter((element) => {
    if (!isActuallyVisible(element)) return false;
    if (element.closest("button, nav, form, [role='dialog']")) return false;
    const text = element.innerText.replace(/\s+/g, " ").trim();
    if (text.length < 2) return false;

    // Structured blocks often contain paragraphs/headings. Prefer the leaf text
    // elements so the same passage is not spoken twice.
    if (
      element.matches("[data-reader-block-id]") &&
      element.querySelector("h1,h2,h3,h4,p,li,blockquote,figcaption")
    ) {
      return false;
    }

    return true;
  });

  return candidates;
}

function voiceQualityScore(voice: SpeechSynthesisVoice): number {
  const name = `${voice.name} ${voice.voiceURI}`.toLocaleLowerCase("en");
  let score = 0;

  if (voice.lang.toLocaleLowerCase("en").startsWith("en")) score += 40;
  if (!voice.localService) score += 25;
  if (/natural|neural|enhanced|premium|online/.test(name)) score += 40;
  if (/google|microsoft|samsung/.test(name)) score += 12;
  if (/compact|espeak|festival/.test(name)) score -= 25;
  if (voice.default) score += 5;

  return score;
}

function sortedEnglishVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices
    .filter((voice) => voice.lang.toLocaleLowerCase("en").startsWith("en"))
    .sort((a, b) => voiceQualityScore(b) - voiceQualityScore(a));
}

function ThemeButton({
  value,
  active,
  children,
  onClick,
}: {
  value: ReaderTheme;
  active: boolean;
  children: React.ReactNode;
  onClick: (value: ReaderTheme) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onClick(value)}
      className="reader-excellence-choice"
    >
      {children}
    </button>
  );
}

export function ReaderExcellenceShell() {
  const [preferences, setPreferences] = useState<ReaderPreferences>(DEFAULT_PREFERENCES);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [listenOpen, setListenOpen] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const speechQueueRef = useRef<HTMLElement[]>([]);
  const speechIndexRef = useRef(0);
  const activeElementRef = useRef<HTMLElement | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    setPreferences(readStoredPreferences());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Reading comfort must keep working when storage is unavailable.
    }

    const shell = document.getElementById("vibetextbook-reader-shell");
    if (!shell) return;

    shell.dataset.readerTheme = preferences.theme;
    shell.dataset.readerFocus = preferences.focus ? "true" : "false";
    shell.style.setProperty("--reader-font-size", `${preferences.fontSize}px`);
    shell.style.setProperty("--reader-line-height", String(preferences.lineHeight));
    shell.style.setProperty("--reader-column-width", WIDTHS[preferences.width]);
  }, [preferences]);

  useEffect(() => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setSpeechSupported(false);
      return;
    }

    const synth = window.speechSynthesis;
    const loadVoices = () => setVoices(sortedEnglishVoices(synth.getVoices()));
    loadVoices();
    synth.addEventListener?.("voiceschanged", loadVoices);

    return () => {
      synth.removeEventListener?.("voiceschanged", loadVoices);
      synth.cancel();
    };
  }, []);

  const selectedVoice = useMemo(() => {
    if (preferences.voiceURI) {
      const exact = voices.find((voice) => voice.voiceURI === preferences.voiceURI);
      if (exact) return exact;
    }
    return voices[0] ?? null;
  }, [preferences.voiceURI, voices]);

  const clearActiveSpeechElement = useCallback(() => {
    if (activeElementRef.current) {
      activeElementRef.current.removeAttribute("data-reader-speaking");
      activeElementRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    cancelledRef.current = true;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    speechQueueRef.current = [];
    speechIndexRef.current = 0;
    clearActiveSpeechElement();
    setSpeaking(false);
    setPaused(false);
  }, [clearActiveSpeechElement]);

  const speakCurrent = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    const element = speechQueueRef.current[speechIndexRef.current];

    if (!element) {
      clearActiveSpeechElement();
      setSpeaking(false);
      setPaused(false);
      return;
    }

    clearActiveSpeechElement();
    activeElementRef.current = element;
    element.setAttribute("data-reader-speaking", "true");
    element.scrollIntoView({ behavior: "smooth", block: "center" });

    const text = element.innerText.replace(/\s+/g, " ").trim();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedVoice?.lang || "en-KE";
    utterance.rate = preferences.rate;
    utterance.pitch = 1;
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onend = () => {
      if (cancelledRef.current) return;
      speechIndexRef.current += 1;
      speakCurrent();
    };

    utterance.onerror = () => {
      if (cancelledRef.current) return;
      speechIndexRef.current += 1;
      speakCurrent();
    };

    window.speechSynthesis.speak(utterance);
  }, [clearActiveSpeechElement, preferences.rate, selectedVoice]);

  const startListening = useCallback(() => {
    if (!speechSupported || !("speechSynthesis" in window)) return;
    const readable = collectReadableElements();
    if (readable.length === 0) return;

    stopListening();
    cancelledRef.current = false;
    speechQueueRef.current = readable;

    const viewportTarget = window.innerHeight * 0.38;
    const firstVisible = readable.findIndex((element) => {
      const rect = element.getBoundingClientRect();
      return rect.bottom >= viewportTarget;
    });
    speechIndexRef.current = firstVisible >= 0 ? firstVisible : 0;
    setSpeaking(true);
    setPaused(false);
    window.setTimeout(speakCurrent, 0);
  }, [speechSupported, speakCurrent, stopListening]);

  const togglePause = useCallback(() => {
    if (!("speechSynthesis" in window) || !speaking) return;

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  }, [speaking]);

  useEffect(() => {
    if (!speaking) return;
    // Voice/rate changes should take effect immediately without losing the
    // reader's current block.
    window.speechSynthesis.cancel();
    cancelledRef.current = false;
    window.setTimeout(speakCurrent, 0);
  }, [preferences.rate, preferences.voiceURI, speakCurrent, speaking]);

  return (
    <>
      <style jsx global>{`
        #vibetextbook-reader-shell {
          --reader-font-size: 19px;
          --reader-line-height: 1.72;
          --reader-column-width: 720px;
          --reader-bg: #f7f1e5;
          --reader-surface: #fffaf0;
          --reader-text: #27231f;
          --reader-muted: #625d55;
          --reader-border: rgba(39, 35, 31, 0.14);
          --reader-accent: #466400;
        }

        #vibetextbook-reader-shell[data-reader-theme="light"] {
          --reader-bg: #ffffff;
          --reader-surface: #ffffff;
          --reader-text: #171717;
          --reader-muted: #595959;
          --reader-border: rgba(23, 23, 23, 0.13);
          --reader-accent: #3d5b00;
        }

        #vibetextbook-reader-shell[data-reader-theme="paper"] {
          --reader-bg: #f7f1e5;
          --reader-surface: #fffaf0;
          --reader-text: #27231f;
          --reader-muted: #625d55;
          --reader-border: rgba(39, 35, 31, 0.14);
          --reader-accent: #466400;
        }

        #vibetextbook-reader-shell[data-reader-theme="dark"] {
          --reader-bg: #111318;
          --reader-surface: #171a20;
          --reader-text: #f2f2ef;
          --reader-muted: #b1b4b8;
          --reader-border: rgba(255, 255, 255, 0.12);
          --reader-accent: #ccff00;
        }

        #vibetextbook-reader-shell[data-reader-theme="contrast"] {
          --reader-bg: #000000;
          --reader-surface: #000000;
          --reader-text: #ffffff;
          --reader-muted: #ffffff;
          --reader-border: #ffffff;
          --reader-accent: #ffff00;
        }

        #vibetextbook-reading-content {
          background: var(--reader-bg) !important;
          color: var(--reader-text) !important;
          min-height: 100vh;
          padding-bottom: 112px !important;
          transition: background 160ms ease, color 160ms ease;
        }

        #vibetextbook-reading-content main,
        #vibetextbook-reading-content #reader-active-unit {
          color: var(--reader-text) !important;
        }

        #vibetextbook-reading-content #reader-active-unit {
          width: min(calc(100% - 32px), var(--reader-column-width)) !important;
          max-width: var(--reader-column-width) !important;
          margin-inline: auto !important;
        }

        #vibetextbook-reading-content p,
        #vibetextbook-reading-content li,
        #vibetextbook-reading-content blockquote,
        #vibetextbook-reading-content figcaption {
          color: var(--reader-text) !important;
          font-size: var(--reader-font-size) !important;
          line-height: var(--reader-line-height) !important;
          letter-spacing: 0.005em !important;
          text-align: left !important;
          text-wrap: pretty;
        }

        #vibetextbook-reading-content p {
          margin-block: 0 1.08em !important;
        }

        #vibetextbook-reading-content h1,
        #vibetextbook-reading-content h2,
        #vibetextbook-reading-content h3,
        #vibetextbook-reading-content h4 {
          color: var(--reader-text) !important;
          line-height: 1.25 !important;
          text-wrap: balance;
        }

        #vibetextbook-reading-content a {
          color: var(--reader-accent) !important;
          text-decoration-thickness: 0.09em;
          text-underline-offset: 0.17em;
        }

        #vibetextbook-reading-content [data-reader-speaking="true"] {
          background: color-mix(in srgb, var(--reader-accent) 18%, transparent) !important;
          outline: 2px solid color-mix(in srgb, var(--reader-accent) 55%, transparent) !important;
          outline-offset: 5px;
          border-radius: 6px;
          transition: background 120ms ease;
        }

        #vibetextbook-reader-shell[data-reader-focus="true"]
          > :not(#vibetextbook-reading-content):not(.reader-excellence-ui):not(script) {
          display: none !important;
        }

        #vibetextbook-reader-shell[data-reader-focus="true"] #vibetextbook-reading-content {
          padding-top: max(22px, env(safe-area-inset-top)) !important;
        }

        #vibetextbook-reader-shell [aria-label="Unlock this learning product"] {
          bottom: 82px !important;
        }

        .reader-excellence-ui {
          position: fixed;
          z-index: 2147483000;
          left: 50%;
          bottom: max(12px, env(safe-area-inset-bottom));
          transform: translateX(-50%);
          width: min(calc(100vw - 24px), 560px);
          color: #f6f7f8;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        .reader-excellence-bar {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          align-items: center;
          gap: 4px;
          padding: 6px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 18px;
          background: rgba(17, 19, 24, 0.94);
          box-shadow: 0 14px 42px rgba(0, 0, 0, 0.34);
          backdrop-filter: blur(18px);
        }

        .reader-excellence-action,
        .reader-excellence-choice {
          border: 0;
          border-radius: 13px;
          background: transparent;
          color: inherit;
          min-height: 44px;
          padding: 8px 10px;
          font: inherit;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
        }

        .reader-excellence-action:hover,
        .reader-excellence-action:focus-visible,
        .reader-excellence-choice:hover,
        .reader-excellence-choice:focus-visible,
        .reader-excellence-choice[aria-pressed="true"] {
          background: rgba(204, 255, 0, 0.13);
          color: #e7ff85;
          outline: none;
        }

        .reader-excellence-panel {
          margin-bottom: 8px;
          max-height: min(68vh, 540px);
          overflow-y: auto;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 18px;
          background: rgba(17, 19, 24, 0.98);
          box-shadow: 0 18px 54px rgba(0, 0, 0, 0.42);
          padding: 16px;
        }

        .reader-excellence-panel h2 {
          margin: 0 0 4px;
          font-size: 16px;
        }

        .reader-excellence-panel p {
          margin: 0 0 14px;
          color: rgba(255, 255, 255, 0.67);
          font-size: 12px;
          line-height: 1.5;
        }

        .reader-excellence-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px;
          margin-bottom: 14px;
        }

        .reader-excellence-field {
          display: grid;
          gap: 6px;
          margin-bottom: 14px;
        }

        .reader-excellence-field label {
          color: rgba(255, 255, 255, 0.72);
          font-size: 12px;
          font-weight: 700;
        }

        .reader-excellence-field select,
        .reader-excellence-field input[type="range"] {
          width: 100%;
        }

        .reader-excellence-field select {
          min-height: 44px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 12px;
          background: #20242b;
          color: #ffffff;
          padding: 9px 10px;
        }

        .reader-excellence-listen-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 7px;
        }

        .reader-excellence-primary {
          background: #ccff00;
          color: #0d1005;
        }

        @media (max-width: 520px) {
          #vibetextbook-reading-content #reader-active-unit {
            width: min(calc(100% - 24px), var(--reader-column-width)) !important;
          }

          .reader-excellence-action {
            font-size: 12px;
            padding-inline: 5px;
          }

          .reader-excellence-panel {
            padding: 14px;
          }

          .reader-excellence-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          #vibetextbook-reading-content,
          #vibetextbook-reading-content [data-reader-speaking="true"] {
            transition: none !important;
          }

          * {
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      <div className="reader-excellence-ui" aria-label="Reading controls">
        {settingsOpen ? (
          <section className="reader-excellence-panel" aria-label="Reading appearance">
            <h2>Make this comfortable</h2>
            <p>Your reading preferences stay on this device.</p>

            <div className="reader-excellence-row" aria-label="Reading theme">
              <ThemeButton
                value="paper"
                active={preferences.theme === "paper"}
                onClick={(theme) => setPreferences((current) => ({ ...current, theme }))}
              >
                Paper
              </ThemeButton>
              <ThemeButton
                value="light"
                active={preferences.theme === "light"}
                onClick={(theme) => setPreferences((current) => ({ ...current, theme }))}
              >
                Light
              </ThemeButton>
              <ThemeButton
                value="dark"
                active={preferences.theme === "dark"}
                onClick={(theme) => setPreferences((current) => ({ ...current, theme }))}
              >
                Dark
              </ThemeButton>
              <ThemeButton
                value="contrast"
                active={preferences.theme === "contrast"}
                onClick={(theme) => setPreferences((current) => ({ ...current, theme }))}
              >
                Contrast
              </ThemeButton>
            </div>

            <div className="reader-excellence-field">
              <label htmlFor="reader-font-size">
                Text size · {preferences.fontSize}px
              </label>
              <input
                id="reader-font-size"
                type="range"
                min={16}
                max={28}
                step={1}
                value={preferences.fontSize}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    fontSize: Number(event.target.value),
                  }))
                }
              />
            </div>

            <div className="reader-excellence-field">
              <label htmlFor="reader-line-height">
                Line spacing · {preferences.lineHeight.toFixed(2)}
              </label>
              <input
                id="reader-line-height"
                type="range"
                min={1.4}
                max={2.1}
                step={0.05}
                value={preferences.lineHeight}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    lineHeight: Number(event.target.value),
                  }))
                }
              />
            </div>

            <div className="reader-excellence-row" aria-label="Text width">
              {(["narrow", "standard", "wide"] as ReaderWidth[]).map((width) => (
                <button
                  key={width}
                  type="button"
                  className="reader-excellence-choice"
                  aria-pressed={preferences.width === width}
                  onClick={() => setPreferences((current) => ({ ...current, width }))}
                >
                  {width === "narrow" ? "Narrow" : width === "standard" ? "Comfort" : "Wide"}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {listenOpen ? (
          <section className="reader-excellence-panel" aria-label="Listen to this reading">
            <h2>Listen</h2>
            <p>
              VibeSchool prefers the highest-quality English voice available on your device.
              Voice quality depends on the phone and browser.
            </p>

            {speechSupported ? (
              <>
                <div className="reader-excellence-field">
                  <label htmlFor="reader-voice">Voice</label>
                  <select
                    id="reader-voice"
                    value={selectedVoice?.voiceURI ?? ""}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        voiceURI: event.target.value,
                      }))
                    }
                  >
                    {voices.length === 0 ? <option value="">Default voice</option> : null}
                    {voices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} · {voice.lang}
                        {!voice.localService ? " · online" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="reader-excellence-field">
                  <label htmlFor="reader-rate">Speed · {preferences.rate.toFixed(2)}×</label>
                  <input
                    id="reader-rate"
                    type="range"
                    min={0.75}
                    max={1.5}
                    step={0.05}
                    value={preferences.rate}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        rate: Number(event.target.value),
                      }))
                    }
                  />
                </div>

                <div className="reader-excellence-listen-actions">
                  <button
                    type="button"
                    className="reader-excellence-action reader-excellence-primary"
                    onClick={speaking ? togglePause : startListening}
                  >
                    {speaking ? (paused ? "Resume" : "Pause") : "Start"}
                  </button>
                  <button
                    type="button"
                    className="reader-excellence-action"
                    onClick={startListening}
                  >
                    From here
                  </button>
                  <button
                    type="button"
                    className="reader-excellence-action"
                    onClick={stopListening}
                    disabled={!speaking}
                  >
                    Stop
                  </button>
                </div>
              </>
            ) : (
              <p>This browser does not provide text-to-speech. Reading remains fully available.</p>
            )}
          </section>
        ) : null}

        <div className="reader-excellence-bar">
          <button
            type="button"
            className="reader-excellence-action"
            aria-expanded={listenOpen}
            onClick={() => {
              setListenOpen((current) => !current);
              setSettingsOpen(false);
            }}
          >
            {speaking ? (paused ? "Resume" : "Listening") : "Listen"}
          </button>
          <button
            type="button"
            className="reader-excellence-action"
            aria-expanded={settingsOpen}
            onClick={() => {
              setSettingsOpen((current) => !current);
              setListenOpen(false);
            }}
          >
            Aa
          </button>
          <button
            type="button"
            className="reader-excellence-action"
            aria-pressed={preferences.focus}
            onClick={() =>
              setPreferences((current) => ({ ...current, focus: !current.focus }))
            }
          >
            {preferences.focus ? "Exit focus" : "Focus"}
          </button>
          <button
            type="button"
            className="reader-excellence-action"
            onClick={() => {
              stopListening();
              setSettingsOpen(false);
              setListenOpen(false);
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </>
  );
}
