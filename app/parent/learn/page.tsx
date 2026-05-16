"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Homework, HomeworkSubmission, SubmissionStatus } from "@/lib/types";

// ─── Colors ──────────────────────────────────────────────────────────────────
const dark   = "#1e1b4b";
const accent = "#10b981";

// ─── Local types ─────────────────────────────────────────────────────────────
interface ChildPill {
  id:      string;
  name:    string;
  classId: string;
}

interface HomeworkWithSubmission {
  homework:   Homework;
  submission: HomeworkSubmission | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function subjectColor(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes("math"))                          return "#3b82f6";
  if (s.includes("english"))                       return "#8b5cf6";
  if (s.includes("science"))                       return "#10b981";
  if (s.includes("kiswahili"))                     return "#f59e0b";
  if (s.includes("social") || s.includes("sst"))  return "#ef4444";
  return "#6b7280";
}

function dueDateColor(due: string): string {
  const today = new Date().toISOString().split("T")[0];
  if (due < today)    return "#ef4444";
  if (due === today)  return "#f59e0b";
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

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = 16, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
      flexShrink: 0,
    }} />
  );
}

function LoadingState() {
  return (
    <div style={{ animation: "fadeIn 0.2s ease" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[80, 70, 90].map((w, i) => <Skeleton key={i} w={w} h={34} radius={20} />)}
      </div>
      {[1, 2].map(i => (
        <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, border: "1px solid #e5e7eb" }}>
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

// ─── Subject pill ─────────────────────────────────────────────────────────────
function SubjectPill({ subject }: { subject: string }) {
  const color = subjectColor(subject);
  return (
    <span style={{
      background: color + "18",
      color,
      fontSize: 11,
      fontWeight: 700,
      borderRadius: 20,
      padding: "3px 10px",
      flexShrink: 0,
    }}>
      {subject}
    </span>
  );
}

// ─── Type badge ───────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const isSmart = type === "smart";
  return (
    <span style={{
      background: isSmart ? "#ede9fe" : "#fef3c7",
      color:      isSmart ? "#7c3aed" : "#92400e",
      fontSize: 10,
      fontWeight: 700,
      borderRadius: 20,
      padding: "3px 8px",
      flexShrink: 0,
    }}>
      {isSmart ? "Smart" : "Book"}
    </span>
  );
}

// ─── Pending card ─────────────────────────────────────────────────────────────
function PendingCard({ item, onAction }: { item: HomeworkWithSubmission; onAction: (id: string) => void }) {
  const hw    = item.homework;
  const color = dueDateColor(hw.due_date);
  const label = dueDateLabel(hw.due_date);
  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      border: "1px solid #e5e7eb",
      padding: "14px 16px", marginBottom: 12,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <SubjectPill subject={hw.subject} />
        <TypeBadge type={hw.type} />
        <span style={{ fontSize: 11, fontWeight: 700, color, marginLeft: "auto" }}>{label}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{hw.title}</div>
      {hw.instructions && (
        <div style={{
          fontSize: 12, color: "#6b7280", marginBottom: 10,
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 1, WebkitBoxOrient: "vertical" as const,
        }}>
          {hw.instructions}
        </div>
      )}
      <button
        onClick={() => onAction(hw.id)}
        style={{
          width: "100%", padding: "10px",
          borderRadius: 10, border: "none",
          background: dark, color: "#fff",
          fontWeight: 700, fontSize: 13,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        {hw.type === "smart" ? "Start Homework" : "Upload Work"}
      </button>
    </div>
  );
}

// ─── Submitted card ───────────────────────────────────────────────────────────
function SubmittedCard({ item }: { item: HomeworkWithSubmission }) {
  const hw  = item.homework;
  const sub = item.submission!;
  const submittedDate = sub.submitted_at
    ? new Date(sub.submitted_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })
    : "—";
  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      border: "1px solid #e5e7eb",
      padding: "14px 16px", marginBottom: 12,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <SubjectPill subject={hw.subject} />
        <TypeBadge type={hw.type} />
        <span style={{
          marginLeft: "auto", fontSize: 11, fontWeight: 700,
          background: "#fef3c7", color: "#92400e",
          borderRadius: 20, padding: "3px 10px",
        }}>
          Awaiting Review
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{hw.title}</div>
      <div style={{ fontSize: 11, color: "#9ca3af" }}>Submitted {submittedDate}</div>
    </div>
  );
}

// ─── Marked card ─────────────────────────────────────────────────────────────
function MarkedCard({ item }: { item: HomeworkWithSubmission }) {
  const hw  = item.homework;
  const sub = item.submission!;
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      border: "1px solid #e5e7eb",
      padding: "14px 16px", marginBottom: 12,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <SubjectPill subject={hw.subject} />
        <TypeBadge type={hw.type} />
        <span style={{
          marginLeft: "auto", fontSize: 11, fontWeight: 700,
          background: "#d1fae5", color: "#065f46",
          borderRadius: 20, padding: "3px 10px",
        }}>
          Marked
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 6 }}>{hw.title}</div>
      {sub.mark !== null && (
        <div style={{ fontSize: 22, fontWeight: 900, color: accent, marginBottom: 6 }}>
          {sub.mark} pts
        </div>
      )}
      {sub.feedback && (
        <>
          <div style={{
            fontSize: 12, color: "#374151", lineHeight: 1.6,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: expanded ? undefined : 2,
            WebkitBoxOrient: "vertical" as const,
          }}>
            {sub.feedback}
          </div>
          {!expanded && (
            <div
              onClick={() => setExpanded(true)}
              style={{ fontSize: 12, fontWeight: 700, color: accent, marginTop: 4, cursor: "pointer" }}
            >
              Read more
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ tab }: { tab: string }) {
  const map: Record<string, { emoji: string; text: string }> = {
    pending:   { emoji: "🎉", text: "No pending homework" },
    submitted: { emoji: "📬", text: "No submitted homework yet" },
    marked:    { emoji: "📊", text: "No marked homework yet" },
  };
  const { emoji, text } = map[tab] ?? { emoji: "📭", text: "Nothing here yet" };
  return (
    <div style={{
      textAlign: "center", padding: "40px 24px",
      background: "#fff", borderRadius: 16,
      border: "1px solid #e5e7eb",
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{emoji}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#6b7280" }}>{text}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ParentLearnPage() {
  const router = useRouter();

  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingHomework, setLoadingHomework] = useState(false);
  const [children,        setChildren]        = useState<ChildPill[]>([]);
  const [activeChildId,   setActiveChildId]   = useState<string>("");
  const [homeworkList,    setHomeworkList]     = useState<HomeworkWithSubmission[]>([]);
  const [activeTab,       setActiveTab]        = useState<"pending" | "submitted" | "marked">("pending");

  // ── Fetch children ──────────────────────────────────────────────────────────
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

  // ── Fetch homework for active child ─────────────────────────────────────────
  const fetchHomework = useCallback(async (childId: string, classId: string) => {
    setLoadingHomework(true);

    const { data: hwRows } = await supabase
      .from("homework")
      .select("id, class_id, teacher_id, title, subject, instructions, type, due_date, created_at")
      .eq("class_id", classId)
      .order("due_date", { ascending: true });

    if (!hwRows || hwRows.length === 0) {
      setHomeworkList([]);
      setLoadingHomework(false);
      return;
    }

    const hwIds = hwRows.map((h: Homework) => h.id);

    const { data: subRows } = await supabase
      .from("homework_submissions")
      .select("id, homework_id, student_id, submitted_at, status, photo_url, mark, feedback, created_at")
      .eq("student_id", childId)
      .in("homework_id", hwIds);

    const merged: HomeworkWithSubmission[] = hwRows.map((hw: Homework) => {
      const sub = (subRows ?? []).find(
        (s: HomeworkSubmission) => s.homework_id === hw.id
      ) ?? null;
      return { homework: hw, submission: sub };
    });

    setHomeworkList(merged);
    setLoadingHomework(false);
  }, []);

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  useEffect(() => {
    if (!activeChildId) return;
    const child = children.find(c => c.id === activeChildId);
    if (!child) return;
    fetchHomework(activeChildId, child.classId);
  }, [activeChildId, children, fetchHomework]);

  // ── Derived lists ────────────────────────────────────────────────────────────
  const pendingList   = homeworkList.filter(h => !h.submission || h.submission.status === "pending");
  const submittedList = homeworkList.filter(h => h.submission?.status === "submitted");
  const markedList    = homeworkList.filter(h => h.submission?.status === "marked");

  const pending = pendingCount(homeworkList);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loadingChildren) return <LoadingState />;

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>

      {/* ── CHILD SWITCHER ── */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 20 }}>
        {children.length === 0 ? (
          <div style={{ fontSize: 13, color: "#6b7280" }}>No children linked yet.</div>
        ) : (
          children.map(c => {
            const isActive = c.id === activeChildId;
            return (
              <button
                key={c.id}
                onClick={() => setActiveChildId(c.id)}
                style={{
                  flexShrink: 0,
                  padding: "8px 18px",
                  borderRadius: 20,
                  border: `2px solid ${isActive ? dark : "#d1d5db"}`,
                  background: isActive ? dark : "#fff",
                  color: isActive ? "#fff" : "#6b7280",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                {c.name.split(" ")[0]}
              </button>
            );
          })
        )}
      </div>

      {/* ── HOMEWORK HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: dark }}>Homework</div>
        {pending > 0 && (
          <span style={{
            background: "#ef4444", color: "#fff",
            fontSize: 11, fontWeight: 800,
            borderRadius: 20, padding: "2px 8px",
          }}>
            {pending} pending
          </span>
        )}
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, background: "#e5e7eb", borderRadius: 12, padding: 3 }}>
        {(["pending", "submitted", "marked"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 10,
              border: "none",
              background: activeTab === tab ? "#fff" : "transparent",
              color: activeTab === tab ? dark : "#6b7280",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s",
              textTransform: "capitalize",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      {loadingHomework ? (
        <LoadingState />
      ) : (
        <>
          {activeTab === "pending" && (
            pendingList.length === 0
              ? <EmptyState tab="pending" />
              : pendingList.map(item => (
                  <PendingCard
                    key={item.homework.id}
                    item={item}
                    onAction={(id) => router.push("/parent/homework/" + id)}
                  />
                ))
          )}
          {activeTab === "submitted" && (
            submittedList.length === 0
              ? <EmptyState tab="submitted" />
              : submittedList.map(item => (
                  <SubmittedCard key={item.homework.id} item={item} />
                ))
          )}
          {activeTab === "marked" && (
            markedList.length === 0
              ? <EmptyState tab="marked" />
              : markedList.map(item => (
                  <MarkedCard key={item.homework.id} item={item} />
                ))
          )}
        </>
      )}
    </div>
  );
}
