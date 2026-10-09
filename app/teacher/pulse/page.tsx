"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/teacher/TeacherUiContext";
import { fetchPulseData } from "@/lib/pulse/fetcher";
import type { ActivityItem, PriorityTask, PulseSnapshot } from "@/lib/types";
import { runRules } from "@/lib/pulse/rules";
import { readSnapCache, writeSnapCache } from "@/lib/pulse/cache";
import AssessmentPulseCard from "@/components/teacher/AssessmentPulseCard";
import LessonFlowCard from "@/components/teacher/LessonFlowCard";
import NextTeachingAction from "@/components/teacher/NextTeachingAction";
import PulseHeader from "@/components/teacher/PulseHeader";
import QuickActions from "@/components/teacher/QuickActions";
import RecentActivity from "@/components/teacher/RecentActivity";
import TodayGlance from "@/components/teacher/TodayGlance";
import TodayHero from "@/components/teacher/TodayHero";
import TwinShortcut from "@/components/teacher/TwinShortcut";
import WeekOverview from "@/components/teacher/WeekOverview";
import { subscribePulse } from "@/lib/pulse/refresh";

const surface: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
};

function keyOf(classId: string, subjectId: string): string {
  return `${classId}::${subjectId}`;
}

function sameSubject(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function scopeSnapshot(
  snapshot: PulseSnapshot,
  classId: string,
  subjectId: string
): PulseSnapshot {
  const selectedClass = snapshot.myClasses.find(
    (item) => item.class_id === classId && item.subject_id === subjectId
  );
  const subjectName = selectedClass?.subject;

  return {
    ...snapshot,
    todaySlots: snapshot.todaySlots.filter(
      (slot) => slot.class_id === classId && slot.subject_id === subjectId
    ),
    tomorrowSlots: snapshot.tomorrowSlots.filter(
      (slot) => slot.class_id === classId && slot.subject_id === subjectId
    ),
    myClasses: selectedClass ? [selectedClass] : [],
    homeworkDue: snapshot.homeworkDue.filter(
      (item) => item.class_id === classId && sameSubject(item.subject, subjectName)
    ),
    homeworkDueTomorrow: snapshot.homeworkDueTomorrow.filter(
      (item) => item.class_id === classId && sameSubject(item.subject, subjectName)
    ),
    homeworkUngraded: snapshot.homeworkUngraded.filter(
      (item) => item.class_id === classId && sameSubject(item.subject, subjectName)
    ),
    attPending: snapshot.attPending.filter((item) => item.class_id === classId),
    totalStudentsToday: selectedClass?.studentCount ?? 0,
    currStats: snapshot.currStats.filter(
      (item) => item.classId === classId && item.subjectId === subjectId
    ),
    missedLessonPlans: snapshot.missedLessonPlans.filter(
      (item) => item.class_id === classId && item.subject_id === subjectId
    ),
    // These alerts do not carry class/subject identity in the pulse contract.
    // Suppress them in a scoped view rather than showing another class's alert.
    atRisk: [],
    consecutiveAbsences: [],
  };
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  return `${Math.floor(hrs / 24)}d ago`;
}

function Skeleton() {
  return (
    <div style={{ padding: "20px 16px 140px" }} aria-label="Loading Teacher Today">
      <div style={{ height: 40, borderRadius: 12, background: "#f3f4f6", marginBottom: 14 }} />
      <div style={{ height: 86, borderRadius: 18, background: "#f3f4f6", marginBottom: 14 }} />
      <div style={{ height: 170, borderRadius: 18, background: "#f3f4f6", marginBottom: 14 }} />
      <div style={{ height: 220, borderRadius: 18, background: "#f3f4f6" }} />
    </div>
  );
}

function EmptyToday({ onRetry }: { onRetry: () => void }) {
  return (
    <section style={{ ...surface, margin: 16, padding: 20, textAlign: "center" }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          background: "#ecfdf5",
          color: "#047857",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 10px",
        }}
        aria-hidden="true"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 5h16v14H4z" />
          <path d="M8 9h8M8 13h5" />
        </svg>
      </div>
      <div style={{ fontSize: 15, fontWeight: 750, color: "var(--teacher-ink, #1c2923)" }}>
        Today could not be loaded
      </div>
      <div style={{ fontSize: 12, color: "var(--teacher-muted, #627168)", lineHeight: 1.5, marginTop: 4 }}>
        Check your connection or teaching assignment, then try again.
      </div>
      <button
        type="button"
        onClick={onRetry}
        style={{
          minHeight: 44,
          marginTop: 14,
          border: 0,
          borderRadius: 12,
          padding: "10px 16px",
          background: "var(--teacher-green, #087451)",
          color: "#fff",
          fontWeight: 750,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </section>
  );
}

function AttentionCard({
  tasks,
  guideHeadline,
  guideMessage,
  guidePriority,
  onNavigate,
}: {
  tasks: PriorityTask[];
  guideHeadline: string | null;
  guideMessage: string;
  guidePriority: string;
  onNavigate: (href: string) => void;
}) {
  const primaryTask = tasks[0];
  const secondaryTasks = tasks.slice(1);
  const urgentGuide = guidePriority === "critical" || guidePriority === "urgent";
  const guideDuplicatesPrimary = Boolean(
    primaryTask && guideMessage.trim() === primaryTask.detail.trim()
  );
  const showGuide = urgentGuide && !guideDuplicatesPrimary;

  if (!showGuide && secondaryTasks.length === 0) return null;

  return (
    <section
      style={{ ...surface, padding: 16, marginBottom: 12 }}
      aria-labelledby="teacher-attention-title"
    >
      <div
        id="teacher-attention-title"
        style={{
          fontSize: 11,
          fontWeight: 750,
          color: "#92400e",
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        Needs attention
      </div>

      {showGuide && (
        <div
          role="status"
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 14,
            border: "1px solid #fde68a",
            background: "#fffbeb",
          }}
        >
          {guideHeadline && (
            <div style={{ fontSize: 13, fontWeight: 750, color: "#78350f" }}>
              {guideHeadline}
            </div>
          )}
          <div
            style={{
              marginTop: guideHeadline ? 4 : 0,
              fontSize: 12,
              lineHeight: 1.5,
              color: "#92400e",
            }}
          >
            {guideMessage}
          </div>
        </div>
      )}

      {secondaryTasks.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginTop: showGuide ? 10 : 12 }}>
          {secondaryTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onNavigate(task.href)}
              style={{
                minHeight: 52,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                background: "#fff",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 750, color: "var(--teacher-ink, #1c2923)" }}>
                  {task.label}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: "var(--teacher-muted, #627168)",
                    lineHeight: 1.4,
                    marginTop: 3,
                  }}
                >
                  {task.detail}
                </span>
              </span>
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function PulsePage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [snap, setSnap] = useState<PulseSnapshot | null>(null);
  const [usingCachedSnap, setUsingCachedSnap] = useState(false);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);

  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

  const boot = useCallback(
    async (isRefresh = false, signal?: AbortSignal) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      if (isRefresh) setRefreshing(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || signal?.aborted) return;

        const [schoolContextRes, profileRes] = await Promise.all([
          supabase.rpc("get_my_teacher_school_context"),
          supabase
            .from("profiles")
            .select("full_name,avatar_url")
            .eq("id", user.id)
            .single(),
        ]);
        if (signal?.aborted) return;
        if (schoolContextRes.error) throw schoolContextRes.error;

        const schoolContext = schoolContextRes.data as {
          active_school_id?: string | null;
          schools?: Array<{ id: string; name: string }>;
        } | null;
        const authorizedSchools = Array.isArray(schoolContext?.schools) ? schoolContext.schools : [];
        if (authorizedSchools.length > 0) {
          setSchools((current) => current.length > 0 ? current : authorizedSchools);
        }

        const schoolId = schoolContext?.active_school_id ?? null;
        setActiveSchoolId(schoolId);

        // Offline data is private teaching data. Only read it after both the
        // authenticated teacher and an authorized active school are known.
        if (!isRefresh && schoolId) {
          const cached = readSnapCache(user.id, schoolId);
          if (cached) {
            setSnap(cached);
            setUsingCachedSnap(true);
            setLoading(false);
          }
        }

        setName((profileRes.data?.full_name ?? "").split(" ")[0] ?? "");
        setAvatarUrl(
          (profileRes.data as { avatar_url?: string } | null)?.avatar_url ?? ""
        );

        if (!schoolId) return;

        const fresh = await fetchPulseData(user.id, schoolId, null);
        if (signal?.aborted) return;

        setSnap(fresh);
        setUsingCachedSnap(false);
        writeSnapCache(fresh);
      } catch {
        // The cached snapshot, when available, remains the safe offline fallback.
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
        fetchingRef.current = false;
      }
    },
    []
  );

  const handleSchoolChange = useCallback(
    async (id: string) => {
      const { error: switchError } = await supabase.rpc("set_my_active_teacher_school", {
        p_school_id: id,
      });
      if (switchError) {
        showToast("Could not switch school. Your current school is unchanged.");
        return;
      }
      setSelectedKey("");
      await boot(true);
    },
    [boot, showToast]
  );

  const handleContextChange = useCallback(
    (key: string) => {
      setSelectedKey(key);
      // Update the view immediately from the current snapshot, then reconcile
      // attendance/plans/homework with a fresh server read.
      void boot(true);
    },
    [boot]
  );

  useEffect(() => {
    const controller = new AbortController();
    // Initial bootstrap must always reach a terminal UI state. Network/RPC
    // stalls must not leave Teacher Today as an infinite skeleton.
    const terminalTimer = window.setTimeout(() => {
      if (!controller.signal.aborted) setLoading(false);
    }, 12000);
    void boot(false, controller.signal);
    return () => {
      window.clearTimeout(terminalTimer);
      controller.abort();
    };
  }, [boot]);

  useEffect(
    () =>
      subscribePulse(() => {
        const controller = new AbortController();
        void boot(true, controller.signal);
      }),
    [boot]
  );

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartY.current = event.touches[0].clientY;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const delta = event.changedTouches[0].clientY - touchStartY.current;
    if (delta > 65 && (scrollRef.current?.scrollTop ?? 0) === 0 && !refreshing) {
      const controller = new AbortController();
      void boot(true, controller.signal);
    }
  };

  if (loading && !snap) return <Skeleton />;
  if (!snap) return <EmptyToday onRetry={() => void boot(true)} />;

  const safeTodaySlots = snap.todaySlots ?? [];
  const safeMyClasses = snap.myClasses ?? [];
  const defaultKey = safeTodaySlots[0]
    ? keyOf(safeTodaySlots[0].class_id, safeTodaySlots[0].subject_id)
    : safeMyClasses[0]
    ? keyOf(safeMyClasses[0].class_id, safeMyClasses[0].subject_id)
    : "";

  const selectedKeyIsValid = safeMyClasses.some(
    (item) => keyOf(item.class_id, item.subject_id) === selectedKey
  );
  const effectiveKey = selectedKeyIsValid ? selectedKey : defaultKey;
  const [focusClassId = "", focusSubjectId = ""] = effectiveKey.split("::");

  // These are plain derivations, not hooks. That keeps React hook ordering stable
  // across the loading -> loaded transition while still updating synchronously.
  const contextSnap = scopeSnapshot(snap, focusClassId, focusSubjectId);
  const dayResult = runRules(snap);
  const focusSlot = contextSnap.todaySlots[0];

  const recentItems: ActivityItem[] = (snap.recentActivity ?? []).map((activity) => ({
    id: activity.id,
    type: activity.type === "homework" ? "gradebook" : activity.type,
    title: activity.title,
    subtitle: activity.subtitle,
    timestamp: relativeTime(activity.timestamp),
  }));

  return (
    <div
      ref={scrollRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="teacher-today"
    >
      {refreshing && (
        <div
          role="status"
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#047857",
            padding: "6px 0 10px",
            fontWeight: 800,
          }}
        >
          Updating this teaching context…
        </div>
      )}

      <PulseHeader
        snap={snap}
        name={name}
        avatarUrl={avatarUrl}
        selectedKey={effectiveKey}
        onSelectedKeyChange={handleContextChange}
        schools={schools}
        activeSchoolId={activeSchoolId ?? snap.schoolId}
        onSchoolChange={handleSchoolChange}
        offline={usingCachedSnap}
        contextRefreshing={refreshing}
        onOpenNotifications={() => router.push("/teacher/notifications")}
      />

      <p className="teacher-today__scope">My day across all classes · selected class shortcuts are shown in Quick tools.</p>
      <div className="teacher-today__grid"><section className="teacher-today__primary" aria-label="Your teaching day">
      <TodayHero
        snap={snap}
        onOpenTimetable={() => router.push("/teacher/timetable")}
        onOpenStudents={() => router.push("/teacher/students")}
        onOpenAttendance={() => router.push("/teacher/attendance")}
      />

      <NextTeachingAction
        task={dayResult.tasks[0] ?? null}
        hasLessons={snap.todaySlots.length > 0}
        headline={dayResult.upcomingWarning}
        snap={snap}
        onNavigate={(href) => router.push(href)}
      />

      <LessonFlowCard
        slots={snap.todaySlots}
        snap={snap}
        teacherId={snap.userId}
        onNavigate={(href) => router.push(href)}
        onSaved={() => void boot(true)}
      />

      </section><aside className="teacher-today__support" aria-label="Tasks and quick tools">
      <AttentionCard
        tasks={dayResult.tasks}
        guideHeadline={dayResult.upcomingWarning}
        guideMessage={dayResult.message}
        guidePriority={dayResult.priority}
        onNavigate={(href) => router.push(href)}
      />

      <AssessmentPulseCard
        key={`assessment-${effectiveKey}`}
        schoolId={activeSchoolId ?? snap.schoolId}
      />

      <QuickActions
        slot={focusSlot}
        context={{ classId: focusClassId, subjectId: focusSubjectId }}
        onNavigate={(href) => router.push(href)}
      />

      </aside></div>
      <details className="teacher-today__details"><summary>This week & recent activity</summary>
      <WeekOverview overview={snap.weekOverview} />

      <TodayGlance snap={snap} onNavigate={(href) => router.push(href)} />

      <RecentActivity items={recentItems} />

      </details>
      <TwinShortcut onOpen={(mode) => router.push(`/teacher/twin?mode=${encodeURIComponent(mode)}`)} />
    </div>
  );
}
