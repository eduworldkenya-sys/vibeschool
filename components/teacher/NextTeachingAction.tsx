"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { nairobiDateStr } from "@/lib/time";
import type { PriorityTask, PulseSnapshot, Slot } from "@/lib/types";

interface NextTeachingActionProps {
  task: PriorityTask | null;
  hasLessons: boolean;
  headline?: string | null;
  snap?: PulseSnapshot;
  onNavigate: (href: string) => void;
}

interface UpcomingLesson {
  slot: Slot;
  time: Date;
}

function parseTimeToday(time: string): Date | null {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  return new Date(`${nairobiDateStr()}T${match[1].padStart(2, "0")}:${match[2]}:00+03:00`);
}

function useCountdown(target: Date | null): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;

    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [target]);

  if (!target) return null;

  const diffMs = target.getTime() - now;
  if (diffMs <= 0 || diffMs > 12 * 60 * 60 * 1000) return null;

  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function nextUpcomingLesson(snap?: PulseSnapshot): UpcomingLesson | null {
  if (!snap) return null;

  return snap.todaySlots
    .filter((slot) => !slot.teaching_workspace || !["completed", "cancelled", "missed"].includes(slot.teaching_workspace.lifecycle))
    .map((slot) => ({ slot, time: parseTimeToday(slot.start_time) }))
    .filter((entry): entry is UpcomingLesson => Boolean(entry.time))
    .filter((entry) => entry.time.getTime() > Date.now())
    .sort((a, b) => a.time.getTime() - b.time.getTime())[0] ?? null;
}

export default function NextTeachingAction({
  task,
  hasLessons,
  headline,
  snap,
  onNavigate,
}: NextTeachingActionProps) {
  const title = task?.label
    ?? headline
    ?? (hasLessons ? "Continue today's lesson" : "Continue your teaching workflow");
  const detail = task?.detail
    ?? (hasLessons
      ? "Complete the next required step for this lesson."
      : "No lesson is scheduled now. Prepare, review, or mark work.");
  const href = task?.href ?? (hasLessons ? "/teacher/teach-today" : "/teacher/scheme");

  const upcoming = useMemo(() => nextUpcomingLesson(snap), [snap]);
  const countdown = useCountdown(upcoming?.time ?? null);

  return (
    <section
      aria-labelledby="teacher-next-action-title"
      className="studio-next"
    >
      <div className="studio-next__top">
        <span>
          Next step
        </span>
        {countdown && (
          <span>
            In {countdown}
          </span>
        )}
      </div>

      <h2 id="teacher-next-action-title">
        {title}
      </h2>
      <details><summary>Lesson details</summary>{detail}</details>

      <button
        type="button"
        onClick={() => onNavigate(href)}
        className="studio-next__button"
        aria-label={`Open: ${title}`}
      >
        Open next step <ArrowUpRight size={18} aria-hidden="true"/>
      </button>
    </section>
  );
}
