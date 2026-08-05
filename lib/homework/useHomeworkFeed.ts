"use client";

// Single source of truth for "what homework does this student see right now".
// Used by /student/learn and /student/homework so they can never drift again —
// group-targeting, lifecycle state, and the generic-title fallback all live here once.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { readCache, writeCache } from "@/lib/student-cache";
import { Homework, HomeworkSubmission } from "@/lib/types";

export type LifecycleStatus =
  | "marked"
  | "submitted"
  | "overdue"
  | "stale"
  | "due_today"
  | "due_tomorrow"
  | "upcoming";

export interface HomeworkFeedItem extends Homework {
  status:    "pending" | "submitted" | "marked";
  mark:      number | null;
  feedback:  string | null;
  lifecycle: LifecycleStatus;
}

// Overdue homework older than this many days drops into the "stale" bucket —
// still reachable, but no longer competing for top-of-list urgency.
const STALE_AFTER_DAYS = 14;

const GENERIC_TITLES = new Set(["read", "study", "test", "exercise", "homework", "revision", "write"]);

export function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(dateStr); due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export function isOverdue(dateStr: string): boolean {
  return daysUntil(dateStr) < 0;
}

export function lifecycleOf(dueDate: string, status: "pending" | "submitted" | "marked"): LifecycleStatus {
  if (status === "marked")    return "marked";
  if (status === "submitted") return "submitted";
  const n = daysUntil(dueDate);
  if (n <= -STALE_AFTER_DAYS) return "stale";
  if (n < 0)   return "overdue";
  if (n === 0) return "due_today";
  if (n === 1) return "due_tomorrow";
  return "upcoming";
}

// Falls back to "Subject · Type" when a teacher enters a low-signal title
// (e.g. "read", "Study") so the card headline is never a bare, ambiguous word.
export function displayTitle(title: string, subject: string, type: string): string {
  const t = (title ?? "").trim();
  const isGeneric = t.length <= 6 || GENERIC_TITLES.has(t.toLowerCase());
  if (!isGeneric) return t;
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  return `${subject} · ${typeLabel}`;
}

interface UseHomeworkFeedResult {
  items:     HomeworkFeedItem[]; // everything, sorted by urgency (stale last)
  active:    HomeworkFeedItem[]; // everything except stale — what most views should render
  stale:     HomeworkFeedItem[]; // overdue 14d+ — the "archived" bucket
  overdue:   HomeworkFeedItem[];
  pending:   HomeworkFeedItem[];
  submitted: HomeworkFeedItem[];
  loading:   boolean;
}

export function useHomeworkFeed(
  classId:   string | null,
  studentId: string | null,
  schoolId:  string | null = null
): UseHomeworkFeedResult {
  const [items,   setItems]   = useState<HomeworkFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId || !studentId) { setLoading(false); return; }

    const cached = readCache<HomeworkFeedItem[]>("homework", studentId);
    if (cached) { setItems(cached); setLoading(false); }

    async function load(validClassId: string, validStudentId: string, validSchoolId: string | null) {
      let hwQuery = supabase
        .from("homework")
        .select("*")
        .eq("class_id", validClassId)
        .order("due_date", { ascending: true });
      if (validSchoolId) hwQuery = hwQuery.eq("school_id", validSchoolId);

      const [hwRes, subRes, grpRes] = await Promise.all([
        hwQuery,
        supabase.from("homework_submissions").select("*").eq("student_id", validStudentId),
        supabase.from("class_group_members").select("group_id").eq("student_id", validStudentId),
      ]);

      const subMap = new Map<string, HomeworkSubmission>();
      for (const s of (subRes.data as HomeworkSubmission[] | null) ?? []) {
        subMap.set(s.homework_id, s);
      }
      const myGroupIds = new Set((grpRes.data ?? []).map((g: { group_id: string }) => g.group_id));

      const result: HomeworkFeedItem[] = ((hwRes.data as Homework[] | null) ?? [])
        .filter(h => h.target_group_id === null || myGroupIds.has(h.target_group_id))
        .map(h => {
          const sub    = subMap.get(h.id);
          const status = (sub?.status ?? "pending") as "pending" | "submitted" | "marked";
          return {
            ...h,
            status,
            mark:      sub?.mark ?? null,
            feedback:  sub?.feedback ?? null,
            lifecycle: lifecycleOf(h.due_date, status),
          };
        });

      const rank: Record<LifecycleStatus, number> = {
        overdue: 0, due_today: 1, due_tomorrow: 2, upcoming: 3,
        submitted: 4, marked: 4, stale: 5,
      };
      result.sort((a, b) => {
        const r = rank[a.lifecycle] - rank[b.lifecycle];
        if (r !== 0) return r;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });

      writeCache("homework", validStudentId, result);
      setItems(result);
      setLoading(false);
    }
    void load(classId, studentId, schoolId);
  }, [classId, studentId, schoolId]);

  const stale     = items.filter(h => h.lifecycle === "stale");
  const active    = items.filter(h => h.lifecycle !== "stale");
  const overdue   = items.filter(h => h.lifecycle === "overdue");
  const pending   = items.filter(h => h.status === "pending" && (h.lifecycle === "upcoming" || h.lifecycle === "due_today" || h.lifecycle === "due_tomorrow"));
  const submitted = items.filter(h => h.status === "submitted" || h.status === "marked");

  return { items, active, stale, overdue, pending, submitted, loading };
}
