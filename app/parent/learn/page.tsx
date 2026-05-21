"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Homework, HomeworkSubmission } from "@/lib/types";

const dark   = "#1e1b4b";
const accent = "#10b981";

interface ChildPill {
  id:      string;
  name:    string;
  classId: string;
}

interface HomeworkWithSubmission {
  homework:   Homework;
  submission: HomeworkSubmission | null;
}

interface LessonItem {
  id:           string;
  title:        string;
  subject:      string;
  day:          number;
  student_copy: string;
}

interface AssessmentItem {
  id:              string;
  subjectName:     string;
  sub_strand:      string;
  assessment_type: string;
  performance:     string;
  term:            number;
  academic_year:   number;
}

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function subjectColor(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes("math"))                         return "#3b82f6";
  if (s.includes("english"))                      return "#8b5cf6";
  if (s.includes("science"))                      return "#10b981";
  if (s.includes("kiswahili"))                    return "#f59e0b";
  if (s.includes("social") || s.includes("sst")) return "#ef4444";
  return "#6b7280";
}

function dueDateColor(due: string): string {
  const today = new Date().toISOString().split("T")[0];
  if (due < today)   return "#ef4444";
  if (due === today) return "#f59e0b";
  return "#6b7280";
}

function dueDateLabel(due: string): string {
  const today = new Date().toISOString().split("T")[0];
  if (due < today)   return "Overdue";
  if (due === today) return "Due today";
  return "Due " + new Date(due).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

function pendingCount(list: HomeworkWithSubmission[]): number {
  return list.filter(h => !h.submission || h.submission.status === "pending").length;
}

function Skeleton({ w = "100%", h = 16, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: radius, background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", flexShrink: 0 }} />
  );
}

function LoadingCards() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <Skeleton w={60} h={22} radius={11} />
            <Skeleton w={40} h={22} radius={11} />
          </div>
          <Skeleton w="70%" h={15} />
          <div style={{ marginTop: 8 }}><Skeleton w="40%" h={11} /></div>
          <div style={{ marginTop: 12 }}><Skeleton w="100%" h={36} radius={10} /></div>
        </div>
      ))}
    </div>
  );
}

function SubjectPill({ subject }: { subject: string }) {
  const color = subjectColor(subject);
  return (
    <span style={{ background: color + "18", color, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px", flexShrink: 0 }}>
      {subject}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const isSmart = type === "smart";
  return (
    <span style={{ background: isSmart ? "#ede9fe" : "#fef3c7", color: isSmart ? "#7c3aed" : "#92400e", fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "3px 8px", flexShrink: 0 }}>
      {isSmart ? "Smart" : "Book"}
    </span>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 24px", background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb" }}>
      <div style={{ fontSize: 13, color: "#9ca3af" }}>{msg}</div>
    </div>
  );
}

function PendingCard({ item, onAction }: { item: HomeworkWithSubmission; onAction: (id: string) => void }) {
  const hw    = item.homework;
  const color = dueDateColor(hw.due_date);
  const label = dueDateLabel(hw.due_date);
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <SubjectPill subject={hw.subject} />
        <TypeBadge type={hw.type} />
        <span style={{ fontSize: 11, fontWeight: 700, color, marginLeft: "auto" }}>{label}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{hw.title}</div>
      {hw.instructions && (
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" as const }}>
          {hw.instructions}
        </div>
      )}
      <button onClick={() => onAction(hw.id)}
        style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", background: dark, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
        {hw.type === "smart" ? "Start Homework" : "Upload Work"}
      </button>
    </div>
  );
}

function SubmittedCard({ item }: { item: HomeworkWithSubmission }) {
  const hw  = item.homework;
  const sub = item.submission!;
  const submittedDate = sub.submitted_at
    ? new Date(sub.submitted_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })
    : "—";
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <SubjectPill subject={hw.subject} />
        <TypeBadge type={hw.type} />
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, background: "#fef3c7", color: "#92400e", borderRadius: 20, padding: "3px 10px" }}>
          Awaiting Review
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{hw.title}</div>
      <div style={{ fontSize: 11, color: "#9ca3af" }}>Submitted {submittedDate}</div>
    </div>
  );
}

function MarkedCard({ item }: { item: HomeworkWithSubmission }) {
  const hw  = item.homework;
  const sub = item.submission!;
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <SubjectPill subject={hw.subject} />
        <TypeBadge type={hw.type} />
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, background: "#d1fae5", color: "#065f46", borderRadius: 20, padding: "3px 10px" }}>
          Marked
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 6 }}>{hw.title}</div>
      {sub.mark !== null && (
        <div style={{ fontSize: 22, fontWeight: 900, color: accent, marginBottom: 6 }}>{sub.mark} pts</div>
      )}
      {sub.feedback && (
        <>
          <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: expanded ? undefined : 2, WebkitBoxOrient: "vertical" as const }}>
            {sub.feedback}
          </div>
          {!expanded && (
            <div onClick={() => setExpanded(true)} style={{ fontSize: 12, fontWeight: 700, color: accent, marginTop: 4, cursor: "pointer" }}>
              Read more
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ParentLearnPage() {
  const router = useRouter();

  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingContent,  setLoadingContent]  = useState(false);
  const [children,        setChildren]        = useState<ChildPill[]>([]);
  const [activeChildId,   setActiveChildId]   = useState<string>("");
  const [homeworkList,    setHomeworkList]     = useState<HomeworkWithSubmission[]>([]);
  const [lessons,         setLessons]         = useState<LessonItem[]>([]);
  const [assessments,     setAssessments]     = useState<AssessmentItem[]>([]);
  const [mainTab,         setMainTab]         = useState<"work"|"lessons"|"results"|"papers">("work");
  const [hwTab,           setHwTab]           = useState<"pending"|"submitted"|"marked">("pending");

  const fetchChildren = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/academy/signin?role=parent"); return; }

    const { data: links } = await supabase
      .from("parent_student_links")
      .select("student_id")
      .eq("parent_id", user.id);

    if (!links || links.length === 0) { setLoadingChildren(false); return; }

    const studentIds = links.map((l: { student_id: string }) => l.student_id);

    const { data: students } = await supabase
      .from("students")
      .select("id, name, class_id")
      .in("id", studentIds);

    if (!students || students.length === 0) { setLoadingChildren(false); return; }

    const pills: ChildPill[] = students.map((s: { id: string; name: string; class_id: string }) => ({
      id:      s.id,
      name:    s.name,
      classId: s.class_id,
    }));

    setChildren(pills);
    setActiveChildId(pills[0].id);
    setLoadingChildren(false);
  }, [router]);

  const fetchContent = useCallback(async (childId: string, classId: string) => {
    setLoadingContent(true);

    const [hwRes, subRes, planRes, assessRes] = await Promise.all([
      supabase.from("homework").select("id,class_id,teacher_id,title,subject,instructions,type,due_date,created_at").eq("class_id", classId).order("due_date", { ascending: true }),
      supabase.from("homework_submissions").select("id,homework_id,student_id,submitted_at,status,photo_url,mark,feedback,created_at").eq("student_id", childId),
      supabase.from("lesson_plans").select("id,title,subject_id,day_of_week").eq("class_id", classId).order("day_of_week", { ascending: false }).limit(20),
      supabase.from("cbc_assessments").select("id,subject_id,sub_strand,assessment_type,performance,term,academic_year").eq("student_id", childId).order("created_at", { ascending: false }),
    ]);

    const merged: HomeworkWithSubmission[] = (hwRes.data ?? []).map((hw: Homework) => {
      const sub = (subRes.data ?? []).find((s: HomeworkSubmission) => s.homework_id === hw.id) ?? null;
      return { homework: hw, submission: sub };
    });
    setHomeworkList(merged);

    const planIds = (planRes.data ?? []).map((p: { id: string }) => p.id);
    let contentData: { lesson_plan_id: string; student_copy: string }[] = [];
    if (planIds.length > 0) {
      const { data } = await supabase.from("lesson_content").select("lesson_plan_id,student_copy").in("lesson_plan_id", planIds);
      contentData = data ?? [];
    }

    const contentMap = new Map<string, string>();
    for (const c of contentData) { contentMap.set(c.lesson_plan_id, c.student_copy); }

    const subjectIds = Array.from(new Set((planRes.data ?? []).map((p: { subject_id: string }) => p.subject_id).filter(Boolean))) as string[];
    let subjectMap: Record<string, string> = {};
    if (subjectIds.length > 0) {
      const { data: subs } = await supabase.from("subjects").select("id,name").in("id", subjectIds);
      subjectMap = Object.fromEntries((subs ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
    }

    const lessonItems: LessonItem[] = (planRes.data ?? [])
      .filter((p: { id: string }) => contentMap.has(p.id))
      .map((p: { id: string; title: string; subject_id: string; day_of_week: number }) => ({
        id: p.id, title: p.title, subject: subjectMap[p.subject_id] ?? "Lesson", day: p.day_of_week, student_copy: contentMap.get(p.id) ?? "",
      }));
    setLessons(lessonItems);

    const aSubjectIds = Array.from(new Set((assessRes.data ?? []).map((a: { subject_id: string }) => a.subject_id).filter(Boolean))) as string[];
    let aSubjectMap: Record<string, string> = {};
    if (aSubjectIds.length > 0) {
      const { data: aSubs } = await supabase.from("subjects").select("id,name").in("id", aSubjectIds);
      aSubjectMap = Object.fromEntries((aSubs ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
    }

    const assessItems: AssessmentItem[] = (assessRes.data ?? []).map((a: { id: string; subject_id: string; sub_strand: string; assessment_type: string; performance: string; term: number; academic_year: number }) => ({
      id: a.id, subjectName: aSubjectMap[a.subject_id] ?? "Subject", sub_strand: a.sub_strand, assessment_type: a.assessment_type, performance: a.performance, term: a.term, academic_year: a.academic_year,
    }));
    setAssessments(assessItems);
    setLoadingContent(false);
  }, []);

  useEffect(() => { fetchChildren(); }, [fetchChildren]);

  useEffect(() => {
    if (!activeChildId) return;
    const child = children.find(c => c.id === activeChildId);
    if (!child) return;
    fetchContent(activeChildId, child.classId);
  }, [activeChildId, children, fetchContent]);

  const pendingList   = homeworkList.filter(h => !h.submission || h.submission.status === "pending");
  const submittedList = homeworkList.filter(h => h.submission?.status === "submitted");
  const markedList    = homeworkList.filter(h => h.submission?.status === "marked");
  const pending       = pendingCount(homeworkList);

  const mainTabs: { id: typeof mainTab; label: string; emoji: string }[] = [
    { id: "work",    label: "Work",    emoji: "📝" },
    { id: "lessons", label: "Lessons", emoji: "📖" },
    { id: "results", label: "Results", emoji: "📊" },
    { id: "papers",  label: "Papers",  emoji: "🗂" },
  ];

  if (loadingChildren) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "fadeIn 0.2s ease" }}>
      <div style={{ display: "flex", gap: 8 }}>
        {[80,70].map((w,i) => <Skeleton key={i} w={w} h={34} radius={20} />)}
      </div>
      <LoadingCards />
    </div>
  );

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
        {children.length === 0 ? (
          <div style={{ fontSize: 13, color: "#6b7280" }}>No children linked yet.</div>
        ) : (
          children.map(c => {
            const isActive = c.id === activeChildId;
            return (
              <button key={c.id} onClick={() => setActiveChildId(c.id)}
                style={{ flexShrink: 0, padding: "8px 18px", borderRadius: 20, border: `2px solid ${isActive ? dark : "#d1d5db"}`, background: isActive ? dark : "#fff", color: isActive ? "#fff" : "#6b7280", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                {c.name.split(" ")[0]}
              </button>
            );
          })
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
        {mainTabs.map(t => (
          <button key={t.id} onClick={() => setMainTab(t.id)}
            style={{ flexShrink: 0, border: "none", cursor: "pointer", fontFamily: "inherit", padding: "8px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: mainTab === t.id ? dark : "#fff", color: mainTab === t.id ? "#fff" : "#6b7280", boxShadow: mainTab === t.id ? "0 2px 8px rgba(30,27,75,0.25)" : "0 1px 3px rgba(0,0,0,0.06)" }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {loadingContent ? <LoadingCards /> : (
        <>
          {mainTab === "work" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: dark }}>Homework</div>
                {pending > 0 && (
                  <span style={{ background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 800, borderRadius: 20, padding: "2px 8px" }}>{pending} pending</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 0, marginBottom: 16, background: "#e5e7eb", borderRadius: 12, padding: 3 }}>
                {(["pending","submitted","marked"] as const).map(tab => (
                  <button key={tab} onClick={() => setHwTab(tab)}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", background: hwTab === tab ? "#fff" : "transparent", color: hwTab === tab ? dark : "#6b7280", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", boxShadow: hwTab === tab ? "0 1px 4px rgba(0,0,0,0.08)" : "none", textTransform: "capitalize" }}>
                    {tab}
                  </button>
                ))}
              </div>
              {hwTab === "pending"   && (pendingList.length   === 0 ? <EmptyState msg="No pending homework" />       : pendingList.map(item   => <PendingCard   key={item.homework.id} item={item} onAction={id => router.push("/parent/homework/" + id)} />))}
              {hwTab === "submitted" && (submittedList.length === 0 ? <EmptyState msg="No submitted homework yet" /> : submittedList.map(item => <SubmittedCard key={item.homework.id} item={item} />))}
              {hwTab === "marked"    && (markedList.length    === 0 ? <EmptyState msg="No marked homework yet" />    : markedList.map(item    => <MarkedCard    key={item.homework.id} item={item} />))}
            </>
          )}

          {mainTab === "lessons" && (
            <>
              <div style={{ fontSize: 16, fontWeight: 800, color: dark, marginBottom: 14 }}>Lesson Replay</div>
              {lessons.length === 0 ? <EmptyState msg="No lesson content posted yet. Check back after class." /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {lessons.map(l => (
                    <div key={l.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: dark }}>{l.title}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: accent, background: "#d1fae5", borderRadius: 8, padding: "3px 8px" }}>{DAYS[l.day] ?? ""}</div>
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>{l.subject}</div>
                      <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, maxHeight: 72, overflow: "hidden", position: "relative" }}>
                        {l.student_copy}
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 24, background: "linear-gradient(transparent,#fff)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {mainTab === "results" && (
            <>
              <div style={{ fontSize: 16, fontWeight: 800, color: dark, marginBottom: 14 }}>Assessment Results</div>
              {assessments.length === 0 ? <EmptyState msg="No assessment results yet. Results appear here after the teacher marks work." /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {assessments.map(a => {
                    const perfColor = a.performance === "exceeds_expectation" ? { bg: "#d1fae5", text: "#065f46" }
                      : a.performance === "meets_expectation"                 ? { bg: "#dbeafe", text: "#1e40af" }
                      : a.performance === "approaching_expectation"           ? { bg: "#fef3c7", text: "#92400e" }
                      : { bg: "#fee2e2", text: "#991b1b" };
                    return (
                      <div key={a.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: dark }}>{a.subjectName}</div>
                            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{a.sub_strand}</div>
                            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Term {a.term} · {a.academic_year}</div>
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: perfColor.text, background: perfColor.bg, borderRadius: 8, padding: "4px 10px" }}>
                            {(a.performance ?? "").replace(/_/g, " ")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {mainTab === "papers" && (
            <>
              <div style={{ fontSize: 16, fontWeight: 800, color: dark, marginBottom: 14 }}>Past Papers</div>
              <div style={{ background: "#fff", borderRadius: 14, border: "1px dashed #d1d5db", padding: "40px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🗂</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: dark, marginBottom: 6 }}>Coming Soon</div>
                <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7 }}>
                  KCPE, KCSE, school-based and personal practice papers will live here. Timed. Marked. Tracked.
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
