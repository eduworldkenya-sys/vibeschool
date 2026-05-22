"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Fix P0: Unified Design Tokens for absolute maintainability
const TOKENS = {
  textPrimary: "#0f172a",
  textMuted: "#64748b",
  borderDefault: "#e2e8f0",
  bgDefault: "#f8fafc",
  bgCard: "#ffffff",
  
  // Asymmetric Status Accents
  danger: "#ef4444",
  dangerBg: "#fdf2f2",
  warning: "#d97706",
  warningBg: "#fffbeb",
  success: "#10b981",
  successBg: "#e6fbf2",
  purple: "#8b5cf6",
  purpleBg: "#f5f3ff",
  
  radiusCard: "20px",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
} as const;

const ROUTES = {
  parentHub: "/parent/learn",
  homeworkDetail: (id: string) => `/parent/learn/homework/${id}`
} as const;

interface Assignment {
  id: string;
  childOwner: string;
  title: string;
  subject: string;
  subjectIcon: string;
  dueDateISO: string;
  totalPoints: number;
  status: "pending" | "overdue" | "completed";
  scoreEarned?: number;
  teacherComment?: string;
}

// Fix 6: Renamed to clearly signal mock state layers before API hookup
const MOCK_ASSIGNMENTS: Assignment[] = [
  {
    id: "hw-01",
    childOwner: "Jaden",
    title: "Insha: Maisha ya Nyumbani na Shambani",
    subject: "Shughuli za Kiswahili",
    subjectIcon: "🌍",
    dueDateISO: "2026-05-23T08:00:00.000Z", 
    totalPoints: 20,
    status: "pending",
    teacherComment: "Ensure proper use of msamiati wa nyumbani learned on Tuesday."
  },
  {
    id: "hw-02",
    childOwner: "Jaden",
    title: "Long Division & Remainders Workbook (Ex. 4B)",
    subject: "Mathematics Activities",
    subjectIcon: "📐",
    dueDateISO: "2026-05-25T13:00:00.000Z",
    totalPoints: 50,
    status: "pending"
  },
  {
    id: "hw-03",
    childOwner: "Jaden",
    title: "Phonetics & Reading Fluency Audio Check",
    subject: "English Language Arts",
    subjectIcon: "📚",
    dueDateISO: "2026-05-21T16:00:00.000Z",
    totalPoints: 30,
    status: "overdue"
  },
  {
    id: "hw-04",
    childOwner: "Jaden",
    title: "Metamorphosis Diagram & Labeling Project",
    subject: "Science & Environmental",
    subjectIcon: "🌱",
    dueDateISO: "2026-05-18T14:14:00.000Z",
    totalPoints: 40,
    status: "completed",
    scoreEarned: 38
  },
  {
    id: "hw-05",
    childOwner: "Liam",
    title: "Primary Color Mixing & Shading Canvas",
    subject: "Creative Arts Activities",
    subjectIcon: "🎨",
    dueDateISO: "2026-05-22T12:00:00.000Z",
    totalPoints: 20,
    status: "overdue"
  },
  {
    id: "hw-06",
    childOwner: "Liam",
    title: "Number Patterns & Sequence Matching",
    subject: "Mathematics Activities",
    subjectIcon: "📐",
    dueDateISO: "2026-05-24T09:00:00.000Z",
    totalPoints: 15,
    status: "pending"
  }
];

export default function HomeworkTimeline() {
  const router = useRouter();
  
  // Fix 5: Derive children array dynamically from data layer to support any household scale
  const childrenList = Array.from(new Set(MOCK_ASSIGNMENTS.map(a => a.childOwner)));
  const [activeChildIndex, setActiveChildIndex] = useState<number>(0);
  const activeChild = childrenList[activeChildIndex] || "Student";
  
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Filter dataset dynamically matching active child profile context
  const childAssignments = MOCK_ASSIGNMENTS.filter(a => a.childOwner === activeChild);

  // Fix 2: Changed from static string anchor to authentic live production clock execution
  const getDaysDiff = (isoString: string): number => {
    const targetDate = new Date(isoString);
    const currentDate = new Date();
    
    targetDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);
    
    return Math.ceil((targetDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const overdueTasks = childAssignments.filter(a => a.status === "overdue");
  const activeTasks = childAssignments.filter(a => a.status === "pending");
  const completedTasks = childAssignments.filter(a => a.status === "completed");

  const dueTodayOrTomorrow = activeTasks.filter(a => getDaysDiff(a.dueDateISO) <= 1);
  const dueLaterThisWeek = activeTasks.filter(a => getDaysDiff(a.dueDateISO) > 1);

  // Fix 5: Gracefully cycle across multi-child arrays safely for infinite scalability
  const cycleChildProfile = () => {
    setActiveChildIndex(prevIndex => (prevIndex + 1) % childrenList.length);
  };

  const triggerCardAction = (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
    e.stopPropagation(); 
    router.push(ROUTES.homeworkDetail(id));
  };

  return (
    <div style={{ 
      maxWidth: "480px", 
      margin: "0 auto", 
      padding: "24px 16px", 
      backgroundColor: TOKENS.bgDefault, 
      minHeight: "100vh", 
      fontFamily: TOKENS.fontFamily, 
      color: TOKENS.textPrimary,
      // Fix 4: Dropped 'as any' and implemented proper hardware font smoothing keys
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale"
    }}>
      
      {/* Dynamic Header Component */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <button 
          onClick={() => router.push(ROUTES.parentHub)} 
          aria-label="Back to learning hub"
          style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.borderDefault}`, borderRadius: "14px", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.02)", WebkitTapHighlightColor: "transparent" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        
        {/* Wired Functional Multi-Child Profiler Tab Switcher */}
        <button
          onClick={cycleChildProfile}
          aria-label={`Current student is ${activeChild}. Tap to switch profile view.`}
          style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: TOKENS.bgCard, border: `1px solid ${TOKENS.borderDefault}`, padding: "6px 14px", borderRadius: "999px", boxShadow: "0 2px 6px rgba(15,23,42,0.04)", cursor: "pointer", transition: "transform 0.1s", WebkitTapHighlightColor: "transparent" }}
          onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.97)"}
          onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
        >
          <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "800", color: "#fff" }}>
            {activeChild.charAt(0)}M
          </div>
          <div style={{ textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: "12px", fontWeight: "800", color: TOKENS.textPrimary, lineHeight: 1 }}>{activeChild} Mwangi</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", fontWeight: "600", color: TOKENS.textMuted, lineHeight: 1 }}>{activeChild === "Jaden" ? "Grade 3" : "Grade 1"}</p>
          </div>
          <svg style={{ color: TOKENS.textMuted, marginLeft: "4px" }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
      </div>

      {/* Emotive High-Context Status Summary Statement */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "900", letterSpacing: "-0.5px", color: "#090d16", margin: 0 }}>
          {overdueTasks.length > 0 
            ? `${overdueTasks.length} ${overdueTasks.length === 1 ? "task requires" : "tasks require"} attention today` 
            : `${activeChild} is all caught up! 🎉`
          }
        </h1>
        <p style={{ fontSize: "14px", color: TOKENS.textMuted, marginTop: "4px", margin: 0 }}>
          {overdueTasks.length > 0 
            ? "Review items past deadlines to secure standard progression points." 
            : "No outstanding assignments require immediate parental follow-up."
          }
        </p>
      </div>

      {/* --- SPATIAL TIMELINE RENDERING SYSTEM --- */}
      
      {/* SECTION 1: HIGH URGENCY OVERDUE TRACKS */}
      {overdueTasks.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: TOKENS.danger }} />
            <h2 style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px", color: TOKENS.danger, margin: 0 }}>Overdue Assignments</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {overdueTasks.map((assignment) => {
              const isHovered = hoveredId === assignment.id;
              return (
                <div
                  key={assignment.id}
                  onClick={() => router.push(ROUTES.homeworkDetail(assignment.id))}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && router.push(ROUTES.homeworkDetail(assignment.id))}
                  aria-label={`Overdue Task: ${assignment.title}. Subject: ${assignment.subject}`}
                  onMouseEnter={() => setHoveredId(assignment.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    backgroundColor: TOKENS.bgCard,
                    borderRadius: TOKENS.radiusCard,
                    border: `1px solid ${TOKENS.borderDefault}`,
                    borderLeft: `5px solid ${TOKENS.danger}`, 
                    padding: "16px 18px",
                    cursor: "pointer",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    transform: isHovered ? "translateY(-2px)" : "none",
                    boxShadow: isHovered ? "0 10px 20px rgba(239,68,68,0.08)" : "0 4px 12px rgba(239,68,68,0.02)",
                    WebkitTapHighlightColor: "transparent",
                    outline: "none"
                  }}
                >
                  {/* Fix 1: Removed invalid justifySubject properties completely across layout */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "16px" }}>{assignment.subjectIcon}</span>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: TOKENS.textMuted }}>{assignment.subject}</span>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: TOKENS.danger, backgroundColor: TOKENS.dangerBg, padding: "2px 8px", borderRadius: "6px" }}>Action Needed</span>
                  </div>
                  
                  <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "800", color: TOKENS.textPrimary, lineHeight: "1.4" }}>{assignment.title}</h3>
                  
                  <div style={{ borderTop: "1px dashed #f1f5f9", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: TOKENS.danger }}>Missed Deadline</span>
                    <button
                      onClick={(e) => triggerCardAction(e, assignment.id)}
                      style={{ background: TOKENS.danger, color: "#fff", border: "none", borderRadius: "10px", padding: "6px 14px", fontSize: "11px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <span>Submit Late Work</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: DUE TODAY / TOMORROW */}
      {dueTodayOrTomorrow.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: TOKENS.warning }} />
            <h2 style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px", color: TOKENS.warning, margin: 0 }}>Due Today & Tomorrow</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {dueTodayOrTomorrow.map((assignment) => {
              const isHovered = hoveredId === assignment.id;
              const daysLeft = getDaysDiff(assignment.dueDateISO);
              return (
                <div
                  key={assignment.id}
                  onClick={() => router.push(ROUTES.homeworkDetail(assignment.id))}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && router.push(ROUTES.homeworkDetail(assignment.id))}
                  aria-label={`Due Soon Task: ${assignment.title}. Due in ${daysLeft} days.`}
                  onMouseEnter={() => setHoveredId(assignment.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    backgroundColor: TOKENS.bgCard,
                    borderRadius: TOKENS.radiusCard,
                    border: `1px solid ${TOKENS.borderDefault}`,
                    padding: "16px 18px",
                    cursor: "pointer",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    transform: isHovered ? "translateY(-2px)" : "none",
                    boxShadow: isHovered ? "0 8px 16px rgba(15,23,42,0.05)" : "0 2px 4px rgba(0,0,0,0.01)",
                    WebkitTapHighlightColor: "transparent",
                    outline: "none"
                  }}
                >
                  {/* Fix 1: Cleaned up typo */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "16px" }}>{assignment.subjectIcon}</span>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: TOKENS.textMuted }}>{assignment.subject}</span>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: TOKENS.warning }}>{daysLeft === 0 ? "Due Today" : "Due Tomorrow"}</span>
                  </div>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "15px", fontWeight: "800", color: TOKENS.textPrimary, lineHeight: "1.4" }}>{assignment.title}</h3>
                  <p style={{ margin: 0, fontSize: "12px", color: TOKENS.textMuted }}>Worth up to {assignment.totalPoints} Marks towards term evaluation.</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: LATER THIS WEEK */}
      {dueLaterThisWeek.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px", color: TOKENS.textMuted, margin: "0 0 12px 0" }}>Later This Week</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {dueLaterThisWeek.map((assignment) => {
              const isHovered = hoveredId === assignment.id;
              return (
                <div
                  key={assignment.id}
                  onClick={() => router.push(ROUTES.homeworkDetail(assignment.id))}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && router.push(ROUTES.homeworkDetail(assignment.id))}
                  aria-label={`Upcoming Task: ${assignment.title}`}
                  onMouseEnter={() => setHoveredId(assignment.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    backgroundColor: TOKENS.bgCard,
                    borderRadius: TOKENS.radiusCard,
                    border: `1px solid ${TOKENS.borderDefault}`,
                    padding: "14px 16px",
                    cursor: "pointer",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    transform: isHovered ? "translateY(-2px)" : "none",
                    boxShadow: isHovered ? "0 8px 16px rgba(15,23,42,0.04)" : "0 2px 4px rgba(0,0,0,0.01)",
                    WebkitTapHighlightColor: "transparent",
                    outline: "none"
                  }}
                >
                  {/* Fix 1: Cleaned up typo */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "16px" }}>{assignment.subjectIcon}</span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: TOKENS.textPrimary }}>{assignment.title}</h4>
                        <span style={{ fontSize: "11px", fontWeight: "500", color: TOKENS.textMuted }}>{assignment.subject} • {assignment.totalPoints} Marks</span>
                      </div>
                    </div>
                    <svg style={{ color: TOKENS.textMuted }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 4: VISUALLY RECEDED COMPLETED SECTION */}
      {completedTasks.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <h2 style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px", color: TOKENS.textMuted, margin: "0 0 12px 0" }}>Completed</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {completedTasks.map((assignment) => {
              const pct = assignment.scoreEarned ? Math.round((assignment.scoreEarned / assignment.totalPoints) * 100) : 0;
              return (
                <div
                  key={assignment.id}
                  onClick={() => router.push(ROUTES.homeworkDetail(assignment.id))}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && router.push(ROUTES.homeworkDetail(assignment.id))}
                  aria-label={`Completed Task: ${assignment.title}. Scored ${assignment.scoreEarned} out of ${assignment.totalPoints}`}
                  style={{
                    backgroundColor: "#f1f5f9", 
                    opacity: 0.85,
                    borderRadius: TOKENS.radiusCard,
                    border: "1px solid #e2e8f0",
                    padding: "14px 16px",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                    outline: "none"
                  }}
                >
                  {/* Fix 1: Cleaned up typo */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "14px", opacity: 0.6 }}>{assignment.subjectIcon}</span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#334155", textDecoration: "line-through" }}>{assignment.title}</h4>
                        <span style={{ fontSize: "11px", color: TOKENS.textMuted }}>{assignment.subject}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "13px", fontWeight: "800", color: TOKENS.success }}>{pct}%</span>
                      <p style={{ margin: 0, fontSize: "10px", color: TOKENS.textMuted }}>{assignment.scoreEarned}/{assignment.totalPoints}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Absolute Fallback View Condition */}
      {childAssignments.length === 0 && (
        <div style={{ padding: "48px 24px", textAlign: "center", background: TOKENS.bgCard, borderRadius: TOKENS.radiusCard, border: `1px solid ${TOKENS.borderDefault}` }}>
          <span style={{ fontSize: "40px" }}>🎉</span>
          <h3 style={{ fontSize: "16px", fontWeight: "800", color: TOKENS.textPrimary, marginTop: "12px", marginBottom: "4px" }}>All caught up!</h3>
          {/* Fix 3: Burned technical jargon completely for approachable parent language */}
          <p style={{ fontSize: "13px", color: TOKENS.textMuted, margin: 0 }}>No assignments found for {activeChild} right now.</p>
        </div>
      )}
    </div>
  );
}
