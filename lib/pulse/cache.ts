import type { PulseSnapshot } from "@/lib/types";

interface GuideCache {
  fp: string;
  message: string;
  savedAt: string;
}

const GUIDE_CACHE_KEY = "vibeschool.teacher.guide";
const SNAP_CACHE_KEY = "vibeschool.teacher.pulse.snapshot";

// Bump this whenever PulseSnapshot's shape changes. Any cached snapshot
// written under an older version is treated as a cache miss instead of
// being rendered, so a stale/incomplete object can never reach the page.
const SNAP_CACHE_VERSION = 2;

interface VersionedSnapCache {
  v: number;
  data: PulseSnapshot;
}

const REQUIRED_SNAP_ARRAY_FIELDS: (keyof PulseSnapshot)[] = [
  "todaySlots",
  "tomorrowSlots",
  "myClasses",
  "currStats",
  "homeworkUngraded",
  "atRisk",
  "consecutiveAbsences",
  "recentActivity",
  "attPending",
];

function isCompleteSnapshot(data: unknown): data is PulseSnapshot {
  if (!data || typeof data !== "object") return false;
  return REQUIRED_SNAP_ARRAY_FIELDS.every((field) =>
    Array.isArray((data as Record<string, unknown>)[field])
  );
}

function safeRead<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function safeWrite<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Offline cache should never break the teaching flow.
  }
}

export function fingerprint(snapshot: PulseSnapshot): string {
  const slotPart = snapshot.todaySlots
    .map((slot) => [
      slot.id,
      slot.lesson_plan_id ?? "no-plan",
      slot.attendance_status,
      slot.task_status,
      slot.submission_count,
      slot.marking_status,
    ].join(":"))
    .join("|");

  return [
    snapshot.userId,
    snapshot.schoolId,
    snapshot.termNumber ?? "no-term",
    snapshot.weekNumber ?? "no-week",
    slotPart,
    snapshot.attPending.length,
    snapshot.homeworkUngraded.length,
  ].join("::");
}

export function readGuideCache(): GuideCache | null {
  return safeRead<GuideCache>(GUIDE_CACHE_KEY);
}

export function writeGuideCache(fp: string, message: string): void {
  safeWrite<GuideCache>(GUIDE_CACHE_KEY, {
    fp,
    message,
    savedAt: new Date().toISOString(),
  });
}

export function readSnapCache(): PulseSnapshot | null {
  const wrapped = safeRead<VersionedSnapCache>(SNAP_CACHE_KEY);
  if (!wrapped) return null;

  if (wrapped.v !== SNAP_CACHE_VERSION || !isCompleteSnapshot(wrapped.data)) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SNAP_CACHE_KEY);
    }
    return null;
  }

  return wrapped.data;
}

export function writeSnapCache(snapshot: PulseSnapshot): void {
  safeWrite<VersionedSnapCache>(SNAP_CACHE_KEY, {
    v: SNAP_CACHE_VERSION,
    data: snapshot,
  });
}
