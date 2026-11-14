"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Detail = { publicationId?: unknown; chapterId?: unknown; nextChapterId?: unknown };
type Source = { publicationId: string; chapterId: string; nextChapterId: string | null };
function validSource(value: Detail | undefined): Source | null {
  if (typeof value?.publicationId !== "string" || !value.publicationId ||
      typeof value?.chapterId !== "string" || !value.chapterId) return null;
  return {
    publicationId: value.publicationId,
    chapterId: value.chapterId,
    nextChapterId: typeof value.nextChapterId === "string" && value.nextChapterId !== value.chapterId
      ? value.nextChapterId : null,
  };
}

export function ReaderAssessmentLauncher() {
  const router = useRouter();
  const activeSource = useRef<Source | null>(null);
  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    function chapter(event: Event) {
      activeSource.current = validSource((event as CustomEvent<Detail>).detail);
    }
    async function practice(event: Event) {
      // The click carries its own source; ref is only for older reader dispatchers.
      const source = validSource((event as CustomEvent<Detail>).detail) ?? activeSource.current;
      if (!source) return;
      const { data, error } = await sb.auth.getUser();
      if (error || !data.user) { router.push("/login"); return; }
      const query = new URLSearchParams({ publication: source.publicationId, chapter: source.chapterId });
      if (source.nextChapterId) query.set("next", source.nextChapterId);
      router.push(`/student/vibelearn/practice?${query.toString()}`);
    }
    function onPractice(event: Event) { void practice(event); }
    window.addEventListener("vibe:reader-chapter", chapter);
    window.addEventListener("vibe:reader-open-practice", onPractice);
    return () => {
      window.removeEventListener("vibe:reader-chapter", chapter);
      window.removeEventListener("vibe:reader-open-practice", onPractice);
    };
  }, [router]);
  return null;
}
