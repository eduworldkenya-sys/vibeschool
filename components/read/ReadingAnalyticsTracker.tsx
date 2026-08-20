"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";

type ReaderChapterEvent = CustomEvent<{
  publicationId: string;
  chapterId: string;
  progressPercent?: number;
}>;

type EndReason = "chapter_change" | "page_hide" | "reader_close";

export function ReadingAnalyticsTracker() {
  const chapterRef = useRef<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const progressRef = useRef(0);
  const visibleRef = useRef(true);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const record = async (
      event: "start" | "heartbeat" | "completed" | EndReason,
      seconds = 0
    ) => {
      const chapterId = chapterRef.current;
      const sessionId = sessionRef.current;
      if (!chapterId || !sessionId) return;

      const { error } = await supabase.rpc("record_reading_activity", {
        p_chapter_id: chapterId,
        p_client_session_id: sessionId,
        p_event: event,
        p_active_seconds: Math.max(0, Math.min(seconds, 300)),
        p_progress_percent: Math.max(0, Math.min(progressRef.current, 100)),
      });

      if (error && error.code !== "PGRST202") {
        console.warn("Reading analytics was not recorded:", error);
      }
    };

    const closeCurrent = async (reason: EndReason) => {
      if (!chapterRef.current || !sessionRef.current) return;
      const now = Date.now();
      const seconds = visibleRef.current
        ? Math.floor((now - lastTickRef.current) / 1000)
        : 0;
      await record(reason, seconds);
      chapterRef.current = null;
      sessionRef.current = null;
    };

    const onChapter = (rawEvent: Event) => {
      const event = rawEvent as ReaderChapterEvent;
      const chapterId = event.detail?.chapterId;
      if (!chapterId) return;

      progressRef.current = event.detail.progressPercent ?? 10;

      if (chapterRef.current === chapterId) return;

      void closeCurrent("chapter_change").finally(() => {
        chapterRef.current = chapterId;
        sessionRef.current = crypto.randomUUID();
        lastTickRef.current = Date.now();
        void record("start");
      });
    };

    const heartbeat = window.setInterval(() => {
      if (!visibleRef.current || !chapterRef.current) return;
      const now = Date.now();
      const seconds = Math.floor((now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      if (seconds > 0) void record("heartbeat", seconds);
    }, 30000);

    const onVisibility = () => {
      const isVisible = document.visibilityState === "visible";
      if (visibleRef.current && !isVisible) {
        const now = Date.now();
        const seconds = Math.floor((now - lastTickRef.current) / 1000);
        lastTickRef.current = now;
        void record("page_hide", seconds);
      } else if (!visibleRef.current && isVisible && chapterRef.current) {
        sessionRef.current = crypto.randomUUID();
        lastTickRef.current = Date.now();
        void record("start");
      }
      visibleRef.current = isVisible;
    };

    const onPageHide = () => {
      void closeCurrent("reader_close");
    };

    window.addEventListener("vibe:reader-chapter", onChapter);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("vibe:reader-chapter", onChapter);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      void closeCurrent("reader_close");
    };
  }, []);

  return null;
}
