"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from '@/lib/supabase'

// Initialize the browser client safely using environment variables

// ==========================================
// MODULE-LEVEL CONSTANTS & HELPERS
// ==========================================

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EXPLANATION_MAP = {
  exceeds_expectation:     "🌟 Outstanding work! Your child is performing above the expected level for this strand.",
  meets_expectation:       "✅ Good work. Your child has fully met the expected level for this strand.",
  approaching_expectation: "📈 Making progress. Your child is getting closer to the expected level. A little more practice will help.",
  below_expectation:       "📚 Needs support. Your child is working below the expected level. Let's look over this topic together.",
};

interface ChildOption {
  id:          string;
  name:        string;
  classId:     string | null;
  className:   string;
}

interface HomeworkItem {
  id:           string;
  subject:      string;
  title:        string;
  instructions: string | null;
  type:         "smart" | "book";
  due_date:     string;
  submission:   SubmissionItem | null;
  teacherName:  string;
}

interface SubmissionItem {
  id:           string;
  status:       "pending" | "submitted" | "marked" | "draft";
  mark:         number | null;
  feedback:     string | null;
  submitted_at: string | null;
  photo_url:    string | null;
}

interface LessonItem {
  id:           string;
  title:        string;
  subject:      string;
  day_of_week:  number;
  student_copy: string;
}

interface AssessmentItem {
  id:              string;
  subject:         string;
  sub_strand:      string;
  assessment_type: string;
  performance:     "exceeds_expectation" | "meets_expectation" |
                   "approaching_expectation" | "below_expectation";
  term:            number;
  academic_year:   number;
}

interface ExamResultItem {
  id:        string;
  examName:  string;
  examType:  string;
  term:      number;
  year:      number;
  subject:   string;
  marks:     number;
  maxMarks:  number;
  isAbsent:  boolean;
}

interface CachedData {
  homework:    HomeworkItem[];
  lessons:     LessonItem[];
  assessments: AssessmentItem[];
  examResults: ExamResultItem[];
  timestamp:   number;
}

function getDueDateMeta(due: string): { label: string; color: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(due);
  dueDate.setHours(0, 0, 0, 0);
  const diff = dueDate.getTime() - today.getTime();
  const days = Math.round(diff / 86400000);
  if (days < 0)  return { label: "Overdue",       color: "#ef4444" };
  if (days === 0) return { label: "Due today",    color: "#f59e0b"   };
  if (days === 1) return { label: "Due tomorrow", color: "#f59e0b"   };
  return {
    label: `Due ${dueDate.toLocaleDateString("en-KE", { day: "numeric", month: "short" })}`,
    color: "#6b7280"
  };
}

function getSubjectColor(subject: string): string {
  const palette = [
    "#3b82f6", "#10b981", "#8b5cf6",
    "#f59e0b", "#ec4899", "#06b6d4", "#f43f5e"
  ];
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

function getPerformanceMeta(p: AssessmentItem["performance"]): {
  label: string; bg: string; color: string
} {
  const map = {
    exceeds_expectation:     { label: "Exceeds",     bg: "#d1fae5", color: "#065f46" },
    meets_expectation:       { label: "Meets",       bg: "#dbeafe", color: "#1e40af" },
    approaching_expectation: { label: "Approaching", bg: "#fef3c7", color: "#92400e" },
    below_expectation:       { label: "Below",       bg: "#fee2e2", color: "#991b1b" },
  };
  return map[p];
}

function BottomSheet({
  open,
  onClose,
  children,
}: {
  open:     boolean;
  onClose:  () => void;
  children: React.ReactNode;
}) {
  const touchStartY = useRef<number>(0);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diffY = touchEndY - touchStartY.current;
    if (diffY > 80) {
      onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
        zIndex: 100,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "all" : "none",
        transition: "opacity 0.2s ease"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          right: "auto",
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "#ffffff",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.12)",
          zIndex: 101,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          transform: open ? "translate(0, 0) translateX(-50%)" : "translate(0, 100%) translateX(-50%)",
          transition: "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        <div
          style={{
            width: "36px",
            height: "5px",
            backgroundColor: "#e5e7eb",
            borderRadius: "2.5px",
            margin: "12px auto 4px",
            flexShrink: 0,
            cursor: "grab"
          }}
        />
        <div
          style={{
            overflowY: "auto",
            flex: 1,
            padding: "16px 20px calc(24px + env(safe-area-inset-bottom, 24px))",
            WebkitOverflowScrolling: "touch"
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function ParentLearnPage() {
  const router = useRouter();

  const [children,        setChildren]        = useState<ChildOption[]>([]);
  const [activeChildId,   setActiveChildId]   = useState<string>("");
  const [mainTab,         setMainTab]         = useState<"work"|"lessons"|"results">("work");
  const [hwTab,           setHwTab]           = useState<"pending"|"submitted"|"marked">("pending");
  const [homework,        setHomework]        = useState<HomeworkItem[]>([]);
  const [lessons,         setLessons]         = useState<LessonItem[]>([]);
  const [assessments,     setAssessments]     = useState<AssessmentItem[]>([]);
  const [examResults,     setExamResults]     = useState<ExamResultItem[]>([]);
  const [loadingChildren, setLoadingChildren] = useState<boolean>(true);
  const [loadingContent,  setLoadingContent]  = useState<boolean>(false);
  const [initError,       setInitError]       = useState<string | null>(null);
  const [contentError,    setContentError]    = useState<string | null>(null);
  const [isRefreshing,    setIsRefreshing]    = useState<boolean>(false);
  const cache = useRef<Map<string, CachedData>>(new Map());

  const [sheet, setSheet] = useState<
    | { type: "lesson";     data: LessonItem }
    | { type: "assessment"; data: AssessmentItem }
    | null
  >(null);

  const sheetOpen = sheet !== null;
  const closeSheet = () => setSheet(null);

  const activeChildName = useMemo(() => {
    const matched = children.find(c => c.id === activeChildId);
    return matched ? matched.name.split(" ")[0] : "Child";
  }, [activeChildId, children]);

  useEffect(() => {
    async function loadInitialChildren() {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) { 
        router.push("/login"); 
        return; 
      }

      const { data: links, error: linksError } = await supabase
        .from("parent_student_links")
        .select("student_id")
        .eq("parent_id", authData.user.id);
        
      if (linksError) { 
        setInitError("Unable to load profile links. Please verify your connection and try again."); 
        setLoadingChildren(false);
        return; 
      }
      if (!links || links.length === 0) {
        setInitError("No verified student records are linked to your parent account.");
        setLoadingChildren(false);
        return;
      }

      const studentIds = links.map(l => l.student_id);

      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("id, name, class_id, classes(name, stream)")
        .in("id", studentIds);
        
      if (studentsError) { 
        setInitError("Failed to retrieve child profile data. Please refresh."); 
        setLoadingChildren(false);
        return; 
      }

      const mappedChildren: ChildOption[] = (students ?? []).map(s => {
        const classData = s.classes as unknown as { name: string; stream: string } | null;
        return {
          id:        s.id,
          name:      s.name,
          classId:   s.class_id ?? null,
          className: classData
                     ? `${classData.name} ${classData.stream}`.trim()
                     : "Unassigned Class",
        };
      });

      if (mappedChildren.length > 0) {
        setChildren(mappedChildren);
        setActiveChildId(mappedChildren[0].id);
      } else {
        setInitError("No registered child profiles matching your credentials were found.");
      }
      setLoadingChildren(false);
    }

    loadInitialChildren();
  }, [router]);

  useEffect(() => {
    if (!activeChildId) return;

    let isCurrentFetch = true;
    const CACHE_TTL = 5 * 60 * 1000;
    const cached = cache.current.get(activeChildId);

    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      setHomework(cached.homework);
      setLessons(cached.lessons);
      setAssessments(cached.assessments);
      setExamResults(cached.examResults ?? []);
      setContentError(null);
      return;
    }

    const currentChild = children.find(c => c.id === activeChildId);
    if (!currentChild || !currentChild.classId) {
      setHomework([]);
      setLessons([]);
      setAssessments([]);
      setContentError("This student has not yet been assigned to an active class.");
      setLoadingContent(false);
      return;
    }

    async function loadChildContent(classId: string, childId: string) {
      setLoadingContent(true);
      setContentError(null);

      try {
        const [hwRes, subRes, plansRes, assessRes, examRes] = await Promise.all([
          supabase
            .from("homework")
            .select("id, subject, title, instructions, type, due_date, teacher_id")
            .eq("class_id", classId)
            .order("due_date", { ascending: true }),

          supabase
            .from("homework_submissions")
            .select("id, homework_id, status, mark, feedback, submitted_at, photo_url")
            .eq("student_id", childId),

          supabase
            .from("lesson_plans")
            .select("id, title, subject_id, day_of_week")
            .eq("class_id", classId)
            .order("day_of_week", { ascending: true }),

          supabase
            .from("cbc_assessments")
            .select("id, subject_id, sub_strand, assessment_type, performance, term, academic_year")
            .eq("student_id", childId)
            .order("academic_year", { ascending: false }),

      supabase
          .from("exam_results")
          .select("id, marks, is_absent, subject_id, exam_id, exams(name, term, academic_year, exam_type)")
          .eq("student_id", childId)
          .order("created_at", { ascending: false }),
        ]);

        if (!isCurrentFetch) return;

        if (hwRes.error)     throw new Error(hwRes.error.message);
        if (subRes.error)    throw new Error(subRes.error.message);
        if (plansRes.error)  throw new Error(plansRes.error.message);
        if (assessRes.error) throw new Error(assessRes.error.message);

        const subMap = new Map(
          (subRes.data ?? []).map(s => [s.homework_id, s])
        );
        
        const teacherIds = Array.from(new Set(
          (hwRes.data ?? [])
            .map((hw: { teacher_id: string }) => hw.teacher_id)
            .filter(Boolean)
        ));

        const teacherMap = new Map<string, string>();
        if (teacherIds.length > 0) {
          const { data: teachers, error: teachersError } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", teacherIds);
          if (teachersError) throw new Error(teachersError.message);
          (teachers ?? []).forEach((t: { id: string; full_name: string }) =>
            teacherMap.set(t.id, t.full_name)
          );
        }

        const finalHomework: HomeworkItem[] = (hwRes.data ?? []).map(
          (hw: {
            id: string;
            subject: string;
            title: string;
            instructions: string | null;
            type: "smart" | "book";
            due_date: string;
            teacher_id: string;
          }) => {
            const matchingSub = subMap.get(hw.id);
            return {
              id: hw.id,
              subject: hw.subject,
              title: hw.title,
              instructions: hw.instructions,
              type: hw.type as "smart" | "book",
              due_date: hw.due_date,
              teacherName: teacherMap.get(hw.teacher_id) ?? "Teacher",
              submission: matchingSub ? {
                id: matchingSub.id,
                status: matchingSub.status as "pending" | "submitted" | "marked" | "draft",
                mark: matchingSub.mark,
                feedback: matchingSub.feedback,
                submitted_at: matchingSub.submitted_at,
                photo_url: matchingSub.photo_url
              } : null,
            };
          }
        );

        const planIds = (plansRes.data ?? []).map(p => p.id);
        const contentMap = new Map<string, string>();
        
        if (planIds.length > 0) {
          const { data: content, error: contentError } = await supabase
            .from("lesson_content")
            .select("lesson_plan_id, student_copy")
            .in("lesson_plan_id", planIds);
            
          if (contentError) throw new Error(contentError.message);
          (content ?? []).forEach(c =>
            contentMap.set(c.lesson_plan_id, c.student_copy)
          );
        }

        const subjectIds = Array.from(new Set([
          ...(plansRes.data ?? []).map(p => p.subject_id),
          ...(assessRes.data ?? []).map(a => a.subject_id),
        ].filter(Boolean)));

        const subjectMap = new Map<string, string>();
        if (subjectIds.length > 0) {
          const { data: subs, error: subsError } = await supabase
            .from("subjects")
            .select("id, name")
            .in("id", subjectIds);
            
          if (subsError) throw new Error(subsError.message);
          (subs ?? []).forEach(s => subjectMap.set(s.id, s.name));
        }

        const finalLessons: LessonItem[] = [
          ...(plansRes.data ?? [])
            .filter(p => contentMap.has(p.id))
            .map(p => ({
              id:           p.id,
              title:        p.title,
              subject:      subjectMap.get(p.subject_id) ?? "Lesson",
              day_of_week:  p.day_of_week,
              student_copy: contentMap.get(p.id)!,
            })),
        ];

        const finalAssessments: AssessmentItem[] = (assessRes.data ?? []).map(a => ({
          id:              a.id,
          subject:         subjectMap.get(a.subject_id) ?? "Subject",
          sub_strand:      a.sub_strand,
          assessment_type: a.assessment_type,
          performance:     a.performance as AssessmentItem["performance"],
          term:            a.term,
          academic_year:   a.academic_year,
        }));


        const finalExamResults: ExamResultItem[] = (examRes.data ?? []).map((r: any) => ({
          id:        r.id,
          examName:  r.exams?.name ?? "Exam",
          examType:  r.exams?.exam_type ?? "written",
          term:      r.exams?.term ?? 0,
          year:      r.exams?.academic_year ?? 0,
          subject:   subjectMap.get(r.subject_id) ?? "Subject",
          marks:     r.marks ?? 0,
          maxMarks:  100,
          isAbsent:  r.is_absent ?? false,
        }));
        cache.current.set(childId, { 
          homework: finalHomework, 
          lessons: finalLessons, 
          assessments: finalAssessments,
          examResults: finalExamResults,
          timestamp: Date.now()
        });

        setHomework(finalHomework);
        setLessons(finalLessons);
        setAssessments(finalAssessments);
        setExamResults(finalExamResults);
      } catch (err: unknown) {
        if (isCurrentFetch) {
          setContentError("An error occurred synchronizing data updates. Check your connection.");
        }
      } finally {
        if (isCurrentFetch) {
          setLoadingContent(false);
          setIsRefreshing(false);
        }
      }
    }

    setHomework([]);
    setLessons([]);
    setAssessments([]);

    loadChildContent(currentChild.classId, activeChildId);

    return () => {
      isCurrentFetch = false;
    };
  }, [activeChildId, children]);

  const forceSyncRefresh = async () => {
    if (!activeChildId || loadingContent) return;
    setIsRefreshing(true);
    cache.current.delete(activeChildId);
    
    const currentChild = children.find(c => c.id === activeChildId);
    if (currentChild && currentChild.classId) {
      setActiveChildId("");
      setTimeout(() => setActiveChildId(currentChild.id), 10);
    }
  };

  const handleChildSwitch = (id: string) => {
    setActiveChildId(id);
    setHwTab("pending");
  };

  const homeworkLists = useMemo(() => {
    const isPending = (hw: HomeworkItem) => {
      if (!hw.submission) return true;
      return hw.submission.status === "pending" || hw.submission.status === "draft";
    };
    return {
      pending:   homework.filter(hw => isPending(hw)),
      submitted: homework.filter(hw => hw.submission?.status === "submitted"),
      marked:    homework.filter(hw => hw.submission?.status === "marked"),
    };
  }, [homework]);

  const pendingCount = useMemo(
    () => homeworkLists.pending.length,
    [homeworkLists]
  );

  const formatSubStatus = (status: string | undefined) => {
    if (!status || status === "pending") return "Not started";
    if (status === "draft") return "Started";
    return status;
  };

  if (initError) {
    return (
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "24px 16px", backgroundColor: "#f0f2f5", minHeight: "100vh", fontFamily: "system-ui, sans-serif", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ padding: "20px", backgroundColor: "#ffffff", borderRadius: "20px", border: `1px solid #e5e7eb`, textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚠️</div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "#111827", fontWeight: "700" }}>Account Alert</h3>
          <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6b7280", lineHeight: "1.5" }}>{initError}</p>
          <button onClick={() => window.location.reload()} style={{ width: "100%", padding: "12px", border: "none", borderRadius: "12px", backgroundColor: "#111827", color: "#ffffff", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
            Retry Login Process
          </button>
        </div>
      </div>
    );
  }

  const skeletonShimmerCSS = `
    @keyframes shimmer {
      0% { background-position: -200px 0; }
      100% { background-position: 200px 0; }
    }
  `;

  const skeletonItemStyle = {
    height: "90px",
    borderRadius: "16px",
    border: "1px solid #e5e7eb",
    background: "#f3f4f6 linear-gradient(90deg, #f3f4f6 0px, #e5e7eb 40px, #f3f4f6 80px)",
    backgroundSize: "200px 100%",
    animation: "shimmer 1.2s infinite linear"
  };

  if (loadingChildren) {
    return (
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "16px", backgroundColor: "#f0f2f5", minHeight: "100vh", fontFamily: "system-ui, sans-serif", boxSizing: "border-box" }}>
        <style dangerouslySetInnerHTML={{ __html: skeletonShimmerCSS }} />
  <style dangerouslySetInnerHTML={{ __html: `
    :root {
      --color-bg:      #f0f2f5;
      --color-surface: #ffffff;
      --color-border:  #e5e7eb;
      --color-dark:    #111827;
      --color-muted:   #6b7280;
      --color-accent:  #10b981;
      --color-warn:    #f59e0b;
      --color-danger:  #ef4444;
    }
  `}} />
        <div style={{ ...skeletonItemStyle, height: "54px", borderRadius: "16px", marginBottom: "16px" }} />
        <div style={{ ...skeletonItemStyle, height: "44px", borderRadius: "12px", marginBottom: "24px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={skeletonItemStyle} />
          <div style={skeletonItemStyle} />
          <div style={skeletonItemStyle} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "16px", backgroundColor: "#f0f2f5", minHeight: "100vh", fontFamily: "system-ui, sans-serif", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      
      <style dangerouslySetInnerHTML={{ __html: skeletonShimmerCSS }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span style={{ fontSize: "12px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Viewing: <span style={{ color: "#10b981" }}>{activeChildName}&apos;s Desk</span>
        </span>
        <button 
          onClick={forceSyncRefresh}
          disabled={loadingContent}
          style={{ background: "none", border: "none", color: "#10b981", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", opacity: isRefreshing ? 0.5 : 1 }}
        >
          {isRefreshing ? "Syncing..." : "🔄 Refresh Data"}
        </button>
      </div>

      <div style={{ display: "flex", gap: "10px", overflowX: "auto", marginBottom: "16px", paddingBottom: "6px", WebkitOverflowScrolling: "touch" }}>
        {children.map((child) => {
          const isActive = child.id === activeChildId;
          const firstWordName = child.name.split(" ")[0];
          return (
            <button
              key={child.id}
              onClick={() => handleChildSwitch(child.id)}
              style={{
                flex: "0 0 auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "10px 16px",
                borderRadius: "16px",
                cursor: "pointer",
                border: isActive ? `2px solid #10b981` : `1px solid #e5e7eb`,
                backgroundColor: isActive ? "#111827" : "#ffffff",
                color: isActive ? "#ffffff" : "#111827",
                textAlign: "left",
                minWidth: "125px",
                boxSizing: "border-box",
                outline: "none"
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "700" }}>{firstWordName}</span>
              <span style={{ fontSize: "11px", color: isActive ? "rgba(255, 255, 255, 0.75)" : "#6b7280", marginTop: "2px", fontWeight: "500" }}>
                {child.className}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", borderBottom: "2px solid #e5e7eb", marginBottom: "16px", gap: "4px" }}>
        {(["work", "lessons", "results"] as const).map((tab) => {
          const isActive = mainTab === tab;
          let label = "Lessons";
          if (tab === "work") label = "Homework";
          if (tab === "results") label = "Results";

          return (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              style={{
                flex: 1,
                padding: "12px 0",
                border: "none",
                background: "none",
                fontSize: "14px",
                fontWeight: "700",
                color: isActive ? "#111827" : "#6b7280",
                borderBottom: isActive ? `3px solid #10b981` : "3px solid transparent",
                marginBottom: "-2px",
                cursor: "pointer",
                position: "relative",
                outline: "none"
              }}
            >
              {label}
              {tab === "work" && pendingCount > 0 && (
                <span style={{ marginLeft: "6px", backgroundColor: "#ef4444", color: "#ffffff", fontSize: "10px", fontWeight: "700", padding: "2px 6px", borderRadius: "10px", inlineSize: "fit-content" }}>
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {contentError && (
        <div style={{ padding: "12px 14px", backgroundColor: "#fef2f2", border: `1px solid #ef4444`, borderRadius: "12px", color: "#ef4444", fontSize: "13px", fontWeight: "500", marginBottom: "16px" }}>
          {contentError}
        </div>
      )}

      {loadingContent ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={skeletonItemStyle} />
          ))}
        </div>
      ) : (
        <div style={{ flex: 1 }}>
          {mainTab === "work" && !contentError && (
            <div>
              <div style={{ display: "flex", gap: "4px", backgroundColor: "#e5e7eb", padding: "4px", borderRadius: "12px", marginBottom: "16px" }}>
                {(["pending", "submitted", "marked"] as const).map((subTab) => {
                  const isActive = hwTab === subTab;
                  return (
                    <button
                      key={subTab}
                      onClick={() => setHwTab(subTab)}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "600",
                        backgroundColor: isActive ? "#ffffff" : "transparent",
                        color: isActive ? "#111827" : "#6b7280",
                        cursor: "pointer",
                        textTransform: "capitalize",
                        outline: "none"
                      }}
                    >
                      {subTab}
                    </button>
                  );
                })}
              </div>

              {homeworkLists[hwTab].length === 0 ? (
                <div style={{ padding: "48px 24px", textAlign: "center", backgroundColor: "#ffffff", borderRadius: "20px", border: "1px solid #e5e7eb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>
                    {hwTab === "pending" ? "🎉" : hwTab === "submitted" ? "⏳" : "✨"}
                  </div>
                  <span style={{ fontSize: "14px", color: "#6b7280", fontWeight: "600" }}>
                    {hwTab === "pending" && "All caught up! No pending homework assignments."}
                    {hwTab === "submitted" && "No logs waiting for standard review right now."}
                    {hwTab === "marked" && "No marked evaluation returns found."}
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {homeworkLists[hwTab].map((item) => {
                    const subColor = getSubjectColor(item.subject);
                    const dueMeta = getDueDateMeta(item.due_date);
                    return (
                      <div
                        key={item.id}
                        onClick={() => router.push(`/parent/homework/${item.id}`)}
                        style={{
                          backgroundColor: "#ffffff",
                          borderRadius: "16px",
                          border: "1px solid #e5e7eb",
                          padding: "16px",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                          cursor: "pointer",
                          position: "relative",
                          display: "flex",
                          flexDirection: "column",
                          boxSizing: "border-box"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <div style={{ display: "inline-block", backgroundColor: subColor, color: "#ffffff", fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "6px", textTransform: "uppercase" }}>
                            {item.subject}
                          </div>
                          <span style={{ fontSize: "18px", color: "#6b7280", fontWeight: "300" }}>›</span>
                        </div>

                        <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px", fontWeight: "500" }}>
                          {item.teacherName}
                        </div>

                        <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", color: "#111827", fontWeight: "700", paddingRight: "12px" }}>{item.title}</h4>
                        
                        {item.instructions && (
                          <p style={{
                            margin: "0 0 12px 0",
                            fontSize: "13px",
                            color: "#6b7280",
                            lineHeight: "1.4",
                            display: "-webkit-box",
                            WebkitLineClamp: "2",
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            paddingRight: "12px"
                          }}>
                            {item.instructions}
                          </p>
                        )}

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e5e7eb", paddingTop: "12px", fontSize: "12px", marginTop: item.instructions ? "0" : "8px" }}>
                          <span style={{ color: dueMeta.color, fontWeight: "600" }}>{dueMeta.label}</span>
                          
                          {hwTab === "pending" && (
                            <span style={{ color: "#f59e0b", fontWeight: "600" }}>
                              {formatSubStatus(item.submission?.status)}
                            </span>
                          )}

                          {hwTab === "submitted" && (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {item.submission?.photo_url && (
                                <img
                                  src={item.submission.photo_url}
                                  alt="Attachment Portfolio"
                                  style={{ width: "22px", height: "22px", borderRadius: "4px", objectFit: "cover", border: "1px solid #e5e7eb" }}
                                />
                              )}
                              <span style={{ color: "#10b981", fontWeight: "600" }}>Sent for review</span>
                            </div>
                          )}

                          {hwTab === "marked" && (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", width: "100%" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                                <span style={{ fontWeight: "700", color: "#111827", backgroundColor: "#f0f2f5", padding: "4px 8px", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
                                  {item.submission?.mark !== null
                                    ? `${item.submission?.mark} pts earned`
                                    : "Score pending"}
                                </span>
                              </div>
                              <div style={{ width: "100%", display: "flex", justifyContent: "flex-start", marginTop: "4px" }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/parent/connect`);
                                  }}
                                  style={{
                                    display: "inline-block",
                                    background: "#f0fdf4",
                                    border: "1px solid #bbf7d0",
                                    borderRadius: "8px",
                                    color: "#166534",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    padding: "6px 12px",
                                    textAlign: "left",
                                    outline: "none"
                                  }}
                                >
                                  💬 Message {item.teacherName} regarding mark
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {mainTab === "lessons" && !contentError && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {lessons.length === 0 ? (
                <div style={{ padding: "48px 24px", textAlign: "center", backgroundColor: "#ffffff", borderRadius: "20px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>📖</div>
                  <span style={{ fontSize: "14px", color: "#6b7280", fontWeight: "600" }}>No daily lesson logs posted for this cycle.</span>
                </div>
              ) : (
                lessons.map((lesson) => {
                  const sColor = getSubjectColor(lesson.subject);
                  const dayName = DAYS[lesson.day_of_week] || "Lesson";
                  return (
                    <div
                      key={lesson.id}
                      onClick={() => setSheet({ type: "lesson", data: lesson })}
                      style={{
                        backgroundColor: "#ffffff",
                        borderRadius: "16px",
                        border: "1px solid #e5e7eb",
                        padding: "16px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div style={{ backgroundColor: sColor, color: "#ffffff", fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "6px", textTransform: "uppercase" }}>
                          {lesson.subject}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: "600" }}>{dayName}</span>
                          <span style={{ fontSize: "16px", color: "#6b7280", fontWeight: "300" }}>›</span>
                        </div>
                      </div>

                      <h4 style={{ margin: "0 0 6px 0", fontSize: "15px", color: "#111827", fontWeight: "700" }}>{lesson.title}</h4>
                      
                      <p style={{
                        margin: "0",
                        fontSize: "13px",
                        color: "#6b7280",
                        lineHeight: "1.45",
                        display: "-webkit-box",
                        WebkitLineClamp: "3",
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden"
                      }}>
                        {lesson.student_copy}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {mainTab === "results" && !contentError && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {assessments.length === 0 ? (
                <div style={{ padding: "48px 24px", textAlign: "center", backgroundColor: "#ffffff", borderRadius: "20px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>📊</div>
                  <span style={{ fontSize: "14px", color: "#6b7280", fontWeight: "600" }}>No assessment records tracked yet.</span>
                </div>
              ) : (
                assessments.map((assessment) => {
                  const sColor = getSubjectColor(assessment.subject);
                  const badgeMeta = getPerformanceMeta(assessment.performance);
                  return (
                    <div
                      key={assessment.id}
                      onClick={() => setSheet({ type: "assessment", data: assessment })}
                      style={{
                        backgroundColor: "#ffffff",
                        borderRadius: "16px",
                        border: "1px solid #e5e7eb",
                        padding: "16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                        boxSizing: "border-box",
                        gap: "12px",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "0" }}>
                        <div style={{ display: "inline-block", backgroundColor: sColor, color: "#ffffff", fontSize: "10px", fontWeight: "700", padding: "2px 6px", borderRadius: "5px", marginBottom: "6px", textTransform: "uppercase" }}>
                          {assessment.subject}
                        </div>
                        <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", color: "#111827", fontWeight: "700", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {assessment.sub_strand}
                        </h4>
                        <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: "500" }}>{assessment.assessment_type}</span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <div style={{ backgroundColor: badgeMeta.bg, color: badgeMeta.color, fontSize: "11px", fontWeight: "700", padding: "4px 8px", borderRadius: "6px", textTransform: "capitalize", textAlign: "center" }}>
                            {badgeMeta.label}
                          </div>
                          <span style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px", fontWeight: "500" }}>
                            T{assessment.term} · {assessment.academic_year}
                          </span>
                        </div>
                        <span style={{ fontSize: "18px", color: "#6b7280", fontWeight: "300" }}>›</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}


        {/* Exam Results */}
        {examResults.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", color: "#6b7280", marginBottom: "10px" }}>Exam Results</div>
            {Array.from(new Set(examResults.map((r: any) => r.examName))).map((examName: any) => {
              const group = examResults.filter((r: any) => r.examName === examName);
              const first = group[0];
              const avg = Math.round(group.reduce((sum: number, r: any) => sum + (r.marks / r.maxMarks) * 100, 0) / group.length);
              return (
                <div key={examName} style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: "10px" }}>
                  <div style={{ background: "linear-gradient(135deg, #1e1b4b, #312e81)", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "#fff" }}>{examName}</div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: "2px" }}>Term {first.term} · {first.year}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "monospace", fontSize: "20px", fontWeight: "700", color: avg >= 70 ? "#34d399" : avg >= 50 ? "#fbbf24" : "#f87171" }}>{avg}%</div>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>Average</div>
                    </div>
                  </div>
                  <div style={{ padding: "8px 16px" }}>
                    {group.map((r: any) => {
                      const pct = Math.round((r.marks / r.maxMarks) * 100);
                      const color = pct >= 70 ? "#059669" : pct >= 50 ? "#d97706" : "#dc2626";
                      return (
                        <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                          <span style={{ fontSize: "12px", fontWeight: "600", color: "#111827" }}>{r.isAbsent ? "ABS " : ""}{r.subject}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "11px", color: "#6b7280" }}>{r.marks}/{r.maxMarks}</span>
                            <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: "700", color }}>{r.isAbsent ? "ABS" : pct + "%"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      <BottomSheet open={sheetOpen} onClose={closeSheet}>
        {sheet?.type === "lesson" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ backgroundColor: getSubjectColor(sheet.data.subject), color: "#ffffff", fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "6px", textTransform: "uppercase" }}>
                {sheet.data.subject}
              </div>
              <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: "600" }}>{DAYS[sheet.data.day_of_week]}</span>
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#111827", marginTop: "12px", marginBottom: "16px" }}>
              {sheet.data.title}
            </h3>
            <div style={{ borderBottom: "1px solid #e5e7eb", marginBottom: "16px" }} />
            <p style={{ fontSize: "14px", lineHeight: "1.7", color: "#111827", whiteSpace: "pre-wrap", margin: "0" }}>
              {sheet.data.student_copy}
            </p>
          </div>
        )}
        {sheet?.type === "assessment" && (
          <div>
            <div style={{ textAlign: "center" }}>
              <div style={{ backgroundColor: getPerformanceMeta(sheet.data.performance).bg, color: getPerformanceMeta(sheet.data.performance).color, fontSize: "13px", fontWeight: "700", padding: "6px 16px", borderRadius: "20px", display: "inline-block", marginBottom: "12px", textTransform: "capitalize" }}>
                {getPerformanceMeta(sheet.data.performance).label}
              </div>
              <p style={{ fontSize: "14px", lineHeight: "1.6", color: "#111827", textAlign: "center", marginBottom: "24px", margin: "0 0 24px 0" }}>
                {EXPLANATION_MAP[sheet.data.performance]}
              </p>
            </div>

            {[
              { label: "Subject", value: sheet.data.subject },
              { label: "Strand", value: sheet.data.sub_strand },
              { label: "Type", value: sheet.data.assessment_type },
              { label: "Term Context", value: `Term ${sheet.data.term}` },
              { label: "Academic Year", value: sheet.data.academic_year.toString() }
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: "12px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #e5e7eb"
                }}
              >
                <span style={{ fontSize: "13px", color: "#6b7280", fontWeight: "500" }}>{row.label}</span>
                <span style={{ fontSize: "13px", color: "#111827", fontWeight: "700" }}>{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
