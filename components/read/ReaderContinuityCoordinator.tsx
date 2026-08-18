"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type ReaderChapterEventDetail = {
  publicationId?: unknown;
  chapterId?: unknown;
  progressPercent?: unknown;
};

type ActiveReader = {
  publicationId: string;
  chapterId: string;
  progressPercent: number;
  blockId: string | null;
};

const READING_WPM = 210;

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function findCurrentBlock(readingLine: number): string | null {
  const blocks = Array.from(
    document.querySelectorAll<HTMLElement>(
      "#reader-active-unit [data-reader-block-id]"
    )
  );
  let current: HTMLElement | null = null;
  for (const block of blocks) {
    if (block.getBoundingClientRect().top <= readingLine) current = block;
  }
  return current?.dataset.readerBlockId ?? null;
}

function findBlockById(blockId: string): HTMLElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLElement>(
        "#reader-active-unit [data-reader-block-id]"
      )
    ).find((block) => block.dataset.readerBlockId === blockId) ?? null
  );
}

function findNavigationSection(): HTMLElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLElement>("#vibetextbook-reading-content main section")
    ).find((section) =>
      Array.from(section.querySelectorAll<HTMLElement>("div")).some(
        (node) => node.textContent?.trim() === "SEARCH AND NAVIGATION"
      )
    ) ?? null
  );
}

function clickReaderNavigation(direction: "previous" | "next") {
  const label = direction === "previous" ? "previous" : "next";
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      "#vibetextbook-reading-content button"
    )
  );
  const target = buttons.find((button) => {
    const text = button.textContent?.trim().toLocaleLowerCase("en") ?? "";
    return text.startsWith(label);
  });
  target?.click();
}

function estimateMinutesLeft(progressPercent: number): number | null {
  const unit = document.getElementById("reader-active-unit");
  if (!unit) return null;
  const words = unit.innerText.trim().split(/\s+/).filter(Boolean).length;
  if (words < 20) return null;
  const totalMinutes = Math.max(1, Math.ceil(words / READING_WPM));
  return Math.max(0, Math.ceil(totalMinutes * (1 - progressPercent / 100)));
}

export function ReaderContinuityCoordinator() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const activeRef = useRef<ActiveReader | null>(null);
  const authenticatedRef = useRef(false);
  const lastPersistedRef = useRef<{
    chapterId: string;
    progressPercent: number;
    blockId: string | null;
  } | null>(null);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [active, setActive] = useState(false);
  const [chapterTitle, setChapterTitle] = useState("Current unit");
  const [progressPercent, setProgressPercent] = useState(0);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    let disposed = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (!disposed) authenticatedRef.current = Boolean(data.user);
    });
    return () => {
      disposed = true;
    };
  }, [supabase]);

  useEffect(() => {
    async function persist(snapshot: ActiveReader, force = false) {
      if (!authenticatedRef.current) return;

      const last = lastPersistedRef.current;
      if (
        !force &&
        last?.chapterId === snapshot.chapterId &&
        snapshot.progressPercent < last.progressPercent + 3 &&
        snapshot.blockId === last.blockId
      ) {
        return;
      }

      const { data, error } = await supabase.rpc("record_reading_progress", {
        publication_id_input: snapshot.publicationId,
        chapter_id_input: snapshot.chapterId,
        progress_percent_input: snapshot.progressPercent,
        position_input: {
          block_id: snapshot.blockId,
          scroll_percent: snapshot.progressPercent,
          source: "reader_continuity_v1",
        },
        reset_input: false,
      });

      const result = data as { ok?: boolean; reason?: string | null } | null;
      if (error || !result?.ok) {
        if (result?.reason !== "completion_evidence_required") {
          console.warn("Reading progress was not recorded:", error ?? result);
        }
        return;
      }

      lastPersistedRef.current = {
        chapterId: snapshot.chapterId,
        progressPercent: snapshot.progressPercent,
        blockId: snapshot.blockId,
      };
    }

    async function restore(snapshot: ActiveReader) {
      setResumed(false);
      if (!authenticatedRef.current) return;

      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;

      const { data, error } = await supabase
        .from("vibe_reading_progress")
        .select("reading_position,progress_percent")
        .eq("viewer_id", authData.user.id)
        .eq("publication_id", snapshot.publicationId)
        .eq("chapter_id", snapshot.chapterId)
        .maybeSingle();

      if (error || !data) return;
      const position = data.reading_position as Record<string, unknown> | null;
      const blockId =
        typeof position?.block_id === "string" && position.block_id.trim()
          ? position.block_id.trim()
          : null;
      if (!blockId) return;

      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const target = findBlockById(blockId);
      if (!target) return;

      target.scrollIntoView({ behavior: "auto", block: "center" });
      activeRef.current = {
        ...snapshot,
        blockId,
        progressPercent: Math.max(
          snapshot.progressPercent,
          clampProgress(Number(data.progress_percent) || 0)
        ),
      };
      setProgressPercent(activeRef.current.progressPercent);
      setResumed(true);
    }

    function measure(force = false) {
      const current = activeRef.current;
      const unit = document.getElementById("reader-active-unit");
      if (!current || !unit) return;

      const rect = unit.getBoundingClientRect();
      const unitTop = window.scrollY + rect.top;
      const readingLineViewport = window.innerHeight * 0.7;
      const readingLineDocument = window.scrollY + readingLineViewport;
      const height = Math.max(unit.scrollHeight, 1);
      let measured = clampProgress(
        ((readingLineDocument - unitTop) / height) * 100
      );

      const blocks = Array.from(
        unit.querySelectorAll<HTMLElement>("[data-reader-block-id]")
      );
      const lastBlock = blocks.at(-1) ?? null;
      const reachedFinalBlock = Boolean(
        lastBlock && lastBlock.getBoundingClientRect().bottom <= window.innerHeight * 0.9
      );
      measured = reachedFinalBlock ? 100 : Math.min(measured, 89);

      const blockId = reachedFinalBlock
        ? lastBlock?.dataset.readerBlockId ?? null
        : findCurrentBlock(readingLineViewport);
      const next: ActiveReader = {
        ...current,
        progressPercent: Math.max(current.progressPercent, measured),
        blockId,
      };

      activeRef.current = next;
      setProgressPercent(next.progressPercent);
      setMinutesLeft(estimateMinutesLeft(next.progressPercent));

      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
      writeTimerRef.current = setTimeout(
        () => void persist(next, force),
        force ? 0 : 1000
      );
    }

    function onChapter(rawEvent: Event) {
      const event = rawEvent as CustomEvent<ReaderChapterEventDetail>;
      const detail = event.detail;
      if (
        typeof detail?.publicationId !== "string" ||
        typeof detail?.chapterId !== "string"
      ) {
        return;
      }

      const supplied =
        typeof detail.progressPercent === "number"
          ? clampProgress(detail.progressPercent)
          : 0;
      const next: ActiveReader = {
        publicationId: detail.publicationId,
        chapterId: detail.chapterId,
        progressPercent: supplied,
        blockId: null,
      };

      activeRef.current = next;
      setActive(true);
      setProgressPercent(supplied);

      window.requestAnimationFrame(() => {
        const heading = document.querySelector(
          "#reader-active-unit h2"
        )?.textContent?.trim();
        setChapterTitle(heading || "Current unit");
        setMinutesLeft(estimateMinutesLeft(supplied));
        void restore(next).finally(() => {
          window.requestAnimationFrame(() => measure(true));
        });
      });
    }

    function onScroll() {
      measure(false);
    }

    function onVisibility() {
      if (document.visibilityState !== "hidden") return;
      const current = activeRef.current;
      if (current) void persist(current, true);
    }

    window.addEventListener("vibe:reader-chapter", onChapter);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
      const current = activeRef.current;
      if (current) void persist(current, true);
      window.removeEventListener("vibe:reader-chapter", onChapter);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [supabase]);

  if (!active) return null;

  function openContents() {
    const section = findNavigationSection();
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    const input = section?.querySelector<HTMLInputElement>(
      'input[aria-label="Search this textbook"]'
    );
    window.setTimeout(() => input?.focus(), 350);
  }

  return (
    <div className="reader-continuity-ui" aria-label="Reading position and navigation">
      <style jsx global>{`
        .reader-continuity-ui {
          position: sticky;
          top: 0;
          z-index: 89;
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 50px;
          padding: 7px max(12px, env(safe-area-inset-left));
          box-sizing: border-box;
          background: color-mix(in srgb, var(--reader-surface, #fffaf0) 94%, transparent);
          border-bottom: 1px solid var(--reader-border, rgba(0,0,0,.12));
          color: var(--reader-text, #27231f);
          backdrop-filter: blur(12px);
        }
        .reader-continuity-title {
          min-width: 0;
          flex: 1;
        }
        .reader-continuity-title strong,
        .reader-continuity-title span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .reader-continuity-title strong { font-size: 13px; }
        .reader-continuity-title span {
          margin-top: 2px;
          font-size: 11px;
          color: var(--reader-muted, #625d55);
        }
        .reader-continuity-ui button {
          border: 1px solid var(--reader-border, rgba(0,0,0,.12));
          background: var(--reader-surface, #fffaf0);
          color: var(--reader-text, #27231f);
          border-radius: 10px;
          min-width: 40px;
          min-height: 38px;
          padding: 7px 10px;
          font-weight: 800;
          cursor: pointer;
        }
        .reader-continuity-track {
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 2px;
          background: color-mix(in srgb, var(--reader-text, #27231f) 10%, transparent);
        }
        .reader-continuity-track > span {
          display: block;
          height: 100%;
          background: var(--reader-accent, #466400);
          transition: width 160ms ease;
        }
        @media (max-width: 520px) {
          .reader-continuity-ui { gap: 6px; }
          .reader-continuity-ui button { padding-inline: 8px; }
          .reader-continuity-contents-label { display: none; }
        }
      `}</style>

      <button type="button" onClick={() => history.back()} aria-label="Back">←</button>
      <div className="reader-continuity-title">
        <strong>{chapterTitle}</strong>
        <span>
          {progressPercent}% read
          {minutesLeft !== null && minutesLeft > 0 ? ` · about ${minutesLeft} min left` : ""}
          {resumed ? " · resumed" : ""}
        </span>
      </div>
      <button
        type="button"
        onClick={() => clickReaderNavigation("previous")}
        aria-label="Previous readable unit"
      >
        ‹
      </button>
      <button type="button" onClick={openContents} aria-label="Open contents and search">
        ☰ <span className="reader-continuity-contents-label">Contents</span>
      </button>
      <button
        type="button"
        onClick={() => clickReaderNavigation("next")}
        aria-label="Next readable unit"
      >
        ›
      </button>
      <div className="reader-continuity-track" aria-hidden="true">
        <span style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  );
}
