"use client";

export function initMonitor() {
  if (typeof window === 'undefined') return;

  window.onerror = (message, source, lineno, colno, error) => {
    console.error('[VibeSchool Monitor]', {
      message,
      source,
      lineno,
      colno,
      error: error?.stack,
    });
  };

  window.onunhandledrejection = (event) => {
    console.error('[VibeSchool Monitor] Unhandled Promise:', event.reason);
  };
}
