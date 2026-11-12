"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import { tuitionLessonState } from "@/lib/vibetutor/lessonLifecycle";

export type TuitionTimetableLesson = {
  id: string;
  invitation_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Nairobi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Nairobi",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** An instant in Nairobi time, not the device's timezone. */
export function tuitionLocalDate(instant: string): string {
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function tuitionLocalTime(instant: string): string {
  return timeFormatter.format(new Date(instant));
}

export function tuitionLessonsBetween(
  lessons: readonly TuitionTimetableLesson[],
  firstDate: string,
  lastDate: string,
): TuitionTimetableLesson[] {
  return lessons
    .filter(lesson => {
      const day = tuitionLocalDate(lesson.starts_at);
      return day >= firstDate && day <= lastDate;
    })
    .slice()
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id));
}

/**
 * Existing accepted-invitation RPC remains the ONLY tuition read authority.
 * Do not query the private table or join tuition identities to school records.
 */
export function useTuitionTimetable() {
  const [lessons, setLessons] = useState<TuitionTimetableLesson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange(event => {
      // Clear previous account's private timetable immediately on a session
      // change; the accepted-invitation RPC rechecks the new identity.
      if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return;
      setLessons([]);
      setError(null);
      setLoading(true);
      setRevision(value => value + 1);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data, error: readError } = await getSupabaseClient().rpc("vibetutor_my_lessons");
        if (cancelled) return;
        if (readError) throw readError;
        setLessons((data ?? []) as TuitionTimetableLesson[]);
        setError(null);
      } catch {
        if (cancelled) return;
        // A failed read (including a rejected network request) is unknown,
        // never a confirmed empty private timetable.
        setLessons([]);
        setError("Private tuition lessons could not be loaded. Retry before relying on your timetable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [revision]);
  return { lessons, error, loading, refresh };
}

export function TuitionTimetableCard({
  lesson,
  role,
}: {
  lesson: TuitionTimetableLesson;
  role: "teacher" | "student";
}) {
  const state = tuitionLessonState(lesson);
  const label =
    state === "joinable" ? "Ready to join" :
    state === "upcoming" ? "Scheduled" :
    state === "ended" ? "Ended" :
    state === "cancelled" ? "Cancelled" :
    state === "completed" ? "Completed" : "Unavailable";

  const url = state === "joinable"
    ? `/tuition/lessons/${lesson.id}`
    : role === "teacher" ? "/teacher/tutoring/students?tool=lessons" : "/student/tutoring";

  return (
    <div style={{
      border: "1px solid var(--vs-border, #dfe5de)",
      background: "var(--vs-card, #fff)",
      borderRadius: 14,
      padding: "12px 14px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      opacity: state === "cancelled" ? 0.7 : 1,
    }}>
      <div style={{ minWidth: 58, fontSize: 12, fontWeight: 750 }}>
        <div>{tuitionLocalTime(lesson.starts_at)}</div>
        <div style={{ opacity: 0.65 }}>{tuitionLocalTime(lesson.ends_at)}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 750, overflowWrap: "anywhere" }}>{lesson.title}</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          <strong>Tuition</strong> · {label}
        </div>
      </div>
      <Link href={url} style={{ fontSize: 12, fontWeight: 750, color: "var(--vs-accent, #087451)" }}>
        {state === "joinable" ? "Join" : "Details"}
      </Link>
    </div>
  );
}
