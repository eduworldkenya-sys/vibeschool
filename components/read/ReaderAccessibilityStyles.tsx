"use client";

/**
 * Cross-cutting accessibility floor for the canonical reader. Individual tools
 * may style themselves, but they may not reduce keyboard focus visibility or
 * phone touch targets below this product-wide baseline.
 */
export function ReaderAccessibilityStyles() {
  return (
    <style jsx global>{`
      #vibetextbook-reader-shell button,
      #vibetextbook-reader-shell select,
      #vibetextbook-reader-shell input[type="search"],
      #vibetextbook-reader-shell input[type="text"] {
        min-height: 44px;
      }

      #vibetextbook-reader-shell button:focus-visible,
      #vibetextbook-reader-shell select:focus-visible,
      #vibetextbook-reader-shell input:focus-visible,
      #vibetextbook-reader-shell textarea:focus-visible,
      #vibetextbook-reader-shell a:focus-visible,
      #vibetextbook-reader-shell [tabindex]:focus-visible {
        outline: 3px solid var(--reader-accent, #466400) !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 0 2px var(--reader-surface, #fffaf0) !important;
      }

      #vibetextbook-reader-shell button:disabled,
      #vibetextbook-reader-shell [aria-disabled="true"] {
        cursor: not-allowed;
      }

      @media (max-width: 380px) {
        .reader-continuity-ui {
          gap: 4px !important;
          padding-inline: 8px !important;
        }
        .reader-continuity-ui button {
          min-width: 44px !important;
          padding-inline: 6px !important;
        }
        .reader-excellence-ui {
          width: min(calc(100vw - 12px), 560px) !important;
        }
        .reader-selection-toolbar {
          max-width: calc(100vw - 8px) !important;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        #vibetextbook-reader-shell *,
        #vibetextbook-reader-shell *::before,
        #vibetextbook-reader-shell *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      }
    `}</style>
  );
}
