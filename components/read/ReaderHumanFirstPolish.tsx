"use client";

import { useEffect } from "react";

const REPLACEMENTS: Record<string, string> = {
  "Search readable units...": "Search this book",
  "Search readable units…": "Search this book",
  "No matches in readable units": "No matches in this book",
  "SEARCH AND NAVIGATION": "FIND IN THIS BOOK",
  "Curriculum alignment claimed by publisher": "Matches your syllabus",
  "Verified curriculum alignment": "Matches your syllabus",
  "Alignment under review": "Syllabus match being checked",
  "No verified alignment": "Syllabus details unavailable",
  "Alignment not verified": "Syllabus match not confirmed",
  "What you will learn": "You'll learn",
  "Key inquiry questions": "Questions to think about",
  "Suggested learning experiences": "Ways to learn this",
  "CHECK YOUR UNDERSTANDING": "CHECK YOURSELF",
  "Check your understanding": "Check yourself",
  "Revision tools": "Practice",
  "Revise tools": "Practice",
  "Learn with this unit": "Help me learn this",
  "Test me on this unit": "Check myself",
  "Mastery:": "Check yourself:",
  "This question is for reflection. No automatic marking is configured.": "Try this yourself — it won't be marked.",
  "✓ Completed": "✓ Finished",
  "Previous Unit": "Previous topic",
  "Next Unit": "Next topic",
  "Purchasing coming soon": "Not available yet",
};

function humanize(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);

  for (const textNode of nodes) {
    const value = textNode.nodeValue;
    if (!value) continue;
    let next = value;
    for (const [from, to] of Object.entries(REPLACEMENTS)) {
      next = next.split(from).join(to);
    }
    if (next !== value) textNode.nodeValue = next;
  }

  root
    .querySelectorAll<HTMLElement>("input[placeholder='Search readable units...'],input[placeholder='Search readable units…']")
    .forEach((el) => {
      el.setAttribute("placeholder", "Search this book");
      el.setAttribute("aria-label", "Search this book");
    });
}

export function ReaderHumanFirstPolish() {
  useEffect(() => {
    const root = document.getElementById("vibetextbook-reader-shell");
    if (!root) return;

    humanize(root);
    const observer = new MutationObserver(() => humanize(root));
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder"],
    });

    return () => observer.disconnect();
  }, []);

  return <style jsx global>{`
    /* Reader contract: the book owns the viewport; tools stay secondary. */
    #vibetextbook-reading-content { padding-bottom: 96px !important; }
    .reader-excellence-bar { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
    .reader-excellence-bar > button:last-child { display: none !important; }
    .reader-excellence-bar > button:nth-child(2) { font-size: 0 !important; }
    .reader-excellence-bar > button:nth-child(2)::after { content: "Text"; font-size: 12px; }
    .reader-excellence-panel { max-height: min(56dvh, 500px) !important; overflow-y: auto !important; overscroll-behavior: contain; }
    #vibetextbook-reader-shell [role="dialog"] { overscroll-behavior: contain; }

    /* Focus means focus: only the exit/focus control remains persistent. */
    #vibetextbook-reader-shell[data-reader-focus="true"] .reader-excellence-bar > button:not(:nth-child(3)) { display: none !important; }
    #vibetextbook-reader-shell[data-reader-focus="true"] .reader-excellence-bar { grid-template-columns: 1fr !important; width: min(180px, 100%) !important; margin-inline: auto; }
    #vibetextbook-reader-shell[data-reader-focus="true"] .reader-practice-button { display: none !important; }

    /* Readability: never let secondary metadata become lower contrast than usable body copy. */
    #vibetextbook-reader-shell { --reader-readable-muted: rgba(255,255,255,.68); }
    #vibetextbook-reader-shell input::placeholder { opacity: 1; }

    @media (max-width: 520px) {
      .reader-excellence-ui { width: min(calc(100vw - 20px), 520px) !important; bottom: max(8px, env(safe-area-inset-bottom)) !important; }
      .reader-excellence-bar { border-radius: 16px !important; padding: 4px !important; }
      .reader-excellence-action { min-height: 44px !important; }
      .reader-practice-button { top: 58px !important; right: 10px !important; }
      #vibetextbook-reading-content #reader-active-unit { width: min(calc(100% - 28px), var(--reader-column-width)) !important; }
      #vibetextbook-reader-shell button, #vibetextbook-reader-shell [role="button"] { min-height: 44px; }
    }

    @media (max-width: 360px) {
      .reader-excellence-ui { width: calc(100vw - 12px) !important; }
      #vibetextbook-reading-content #reader-active-unit { width: calc(100% - 20px) !important; }
    }

    @media (prefers-reduced-motion: reduce) {
      #vibetextbook-reader-shell *, #vibetextbook-reader-shell *::before, #vibetextbook-reader-shell *::after {
        scroll-behavior: auto !important;
        animation-duration: .01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: .01ms !important;
      }
    }
  `}</style>;
}
