import { useState, useRef, useEffect } from "react";

const C = {
  bg: "#ffffff",
  surface: "#f8f9fa",
  accent: "#10b981",
  accentLight: "#d1fae5",
  textPrimary: "#111827",
  textMuted: "#6b7280",
  error: "#ef4444",
  warning: "#f59e0b",
  dark: "#1e1b4b",
  border: "#e5e7eb",
  shadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
};

const TEACHER = {
  name: "Ms. Wanjiku Kamau",
  school: "St. Mary's Academy",
  class: "Grade 6B",
  subject: "Mathematics",
  initials: "WK",
};

const TODAY_SLOTS = [
  { id: 1, subject: "Mathematics", class: "6B", room: "Room 12", start: "07:30", end: "08:30", period: 1, status: "taught", planStatus: "green" },
  { id: 2, subject: "Mathematics", class: "7A", room: "Room 12", start: "08:30", end: "09:30", period: 2, status: "scheduled", planStatus: "green" },
  { id: 3, subject: "Mathematics", class: "6B", room: "Lab 2", start: "10:00", end: "11:00", period: 3, status: "scheduled", planStatus: "amber" },
  { id: 4, subject: "Mathematics", class: "8C", room: "Room 12", start: "11:00", end: "12:00", period: 4, status: "scheduled", planStatus: "red" },
  { id: 5, subject: "Mathematics", class: "6B", room: "Room 12", start: "14:00", end: "15:00", period: 5, status: "scheduled", planStatus: "green" },
];

const STUDENTS = [
  { id: 1, name: "Amina Ochieng", absences: 0, trend: "improving", score: 82 },
  { id: 2, name: "Brian Kamau", absences: 3, trend: "declining", score: 58 },
  { id: 3, name: "Cynthia Mwangi", absences: 1, trend: "stable", score: 74 },
  { id: 4, name: "David Otieno", absences: 5, trend: "declining", score: 51 },
  { id: 5, name: "Esther Njoki", absences: 0, trend: "improving", score: 91 },
  { id: 6, name: "Felix Kipchoge", absences: 2, trend: "stable", score: 67 },
  { id: 7, name: "Grace Auma", absences: 0, trend: "improving", score: 88 },
  { id: 8, name: "Hassan Maina", absences: 1, trend: "stable", score: 73 },
];

const FLAGS_DATA = [
  { id: 1, type: "attendance", severity: "high", student: "David Otieno", message: "5 absences this term. Parent thread auto-created.", resolved: false },
  { id: 2, type: "resource_gap", severity: "low", student: null, message: "Period 3 — Lab equipment unconfirmed for Geometry lesson.", resolved: false },
  { id: 3, type: "attendance", severity: "medium", student: "Brian Kamau", message: "3 consecutive absences. Consider welfare check.", resolved: false },
];

const ASSESSMENT = {
  lastTitle: "Algebra — Linear Equations",
  classAvg: 68,
  distribution: [12, 23, 35, 20, 10],
  bands: ["0–40", "41–55", "56–70", "71–85", "86–100"],
  needsFollowup: ["Brian Kamau", "David Otieno", "Felix Kipchoge"],
};

const CURRICULUM = {
  strand: "Algebra",
  topicsCovered: 14,
  topicsTotal: 18,
  weeksRemaining: 4,
};

const ANNOUNCEMENTS = [
  { id: 1, title: "Term 2 Report Card Deadline", body: "All assessments must be submitted by Friday 5pm.", pinned: true, date: "Today" },
  { id: 2, title: "Staff Meeting — Thursday", body: "Mandatory meeting at 4pm in the main hall.", pinned: false, date: "Yesterday" },
];

const NEWS = [
  { id: 1, title: "Kenya National Exam Board Updates Mathematics Syllabus", source: "Education Weekly", time: "2h ago" },
  { id: 2, title: "New Approaches to Formative Assessment in African Schools", source: "EduAfrica", time: "5h ago" },
  { id: 3, title: "KICD Releases New STEM Resources for Secondary Schools", source: "Daily Nation", time: "1d ago" },
];

const VIBECONNECT_THREADS = [
  { id: 1, type: "parent", name: "Mrs. Otieno (David's Parent)", last: "Thank you for reaching out, I will talk to him tonight.", time: "10m ago", unread: 1, avatar: "MO" },
  { id: 2, type: "teacher", name: "Mr. Odhiambo — Head of Maths", last: "Can you share the assessment breakdown for 8C?", time: "1h ago", unread: 2, avatar: "JO" },
  { id: 3, type: "admin", name: "Mrs. Njeri — Deputy Principal", last: "Please ensure your register is submitted by end of day.", time: "2h ago", unread: 1, avatar: "DN" },
  { id: 4, type: "parent", name: "Mr. Kamau (Brian's Parent)", last: "He has been dealing with some issues at home.", time: "3h ago", unread: 0, avatar: "PK" },
  { id: 5, type: "admin", name: "School Admin Office", last: "Term 2 timetable adjustments attached. Please confirm.", time: "Yesterday", unread: 0, avatar: "AO" },
  { id: 6, type: "teacher", name: "Ms. Akinyi — Form Tutor 7A", last: "Thanks for covering last week!", time: "Yesterday", unread: 0, avatar: "SA" },
  { id: 7, type: "parent", name: "Mrs. Njoki (Esther's Parent)", last: "Esther said she really enjoys your lessons!", time: "Yesterday", unread: 0, avatar: "FN" },
];

const QUICK_ACTIONS = [
  { id: "classhub",    label: "ClassHub",       icon: "🏫", color: "#dbeafe", iconColor: "#1d4ed8" },
  { id: "timetable",  label: "SmartTimetable",  icon: "🗓️", color: "#d1fae5", iconColor: "#065f46" },
  { id: "lessonplan", label: "Lesson Plans",    icon: "📖", color: "#ede9fe", iconColor: "#6d28d9" },
  { id: "attendance", label: "Attendance",      icon: "✅", color: "#dcfce7", iconColor: "#166534" },
  { id: "subjecthub", label: "SubjectHub",      icon: "🔬", color: "#e0f2fe", iconColor: "#075985" },
  { id: "vibelearn",  label: "VibeLearn",       icon: "🎓", color: "#fef9c3", iconColor: "#854d0e" },
  { id: "assessment", label: "Assessment",      icon: "📊", color: "#fef3c7", iconColor: "#92400e" },
  { id: "schoolhub",  label: "SchoolHub",       icon: "🏛️", color: "#f3e8ff", iconColor: "#7e22ce" },
];

const LESSON_PLANS = [
  { id: 1, title: "Algebra — Linear Equations", class: "6B", date: "Today · Period 2", status: "green", topic: "Balance method, real-world contexts" },
  { id: 2, title: "Geometry — Angles in Polygons", class: "6B", date: "Today · Period 3", status: "amber", topic: "Resource confirmation needed" },
  { id: 3, title: "Algebra — Quadratic Introduction", class: "8C", date: "Today · Period 4", status: "red", topic: "No plan generated yet" },
  { id: 4, title: "Data Handling — Mean & Median", class: "7A", date: "Tomorrow", status: "green", topic: "Grouped data, calculator method" },
];

const ROLE_STYLE = {
  parent:  { bg: "#dbeafe", color: "#1d4ed8" },
  teacher: { bg: "#ede9fe", color: "#6d28d9" },
  admin:   { bg: "#fef3c7", color: "#92400e" },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function timeToMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function currentTimeMin() { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
function isNext(slot) { return timeToMin(slot.start) > currentTimeMin(); }
function isCurrent(slot) { const c = currentTimeMin(); return timeToMin(slot.start) <= c && timeToMin(slot.end) > c; }
function minutesUntil(slot) { return timeToMin(slot.start) - currentTimeMin(); }
function formatCountdown(m) { if (m <= 0) return "Now"; if (m < 60) return `${m}m`; return `${Math.floor(m / 60)}h ${m % 60}m`; }
function greeting() { const h = new Date().getHours(); if (h < 12) return "Good morning"; if (h < 17) return "Good afternoon"; return "Good evening"; }

// ── Primitives ─────────────────────────────────────────────────────────────
function Card({ children, style = {}, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.bg, borderRadius: 16, boxShadow: C.shadow,
        border: `1px solid ${C.border}`, padding: "18px 18px",
        marginBottom: 14, cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.18s", ...style,
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)")}
      onMouseLeave={e => onClick && (e.currentTarget.style.boxShadow = C.shadow)}
    >{children}</div>
  );
}

function SectionLabel({ children, style = {} }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}

function Btn({ children, variant = "primary", onClick, small, style = {}, disabled }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: small ? "6px 12px" : "9px 18px", borderRadius: 10,
    border: "none", cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit", fontWeight: 700,
    fontSize: small ? 12 : 13, transition: "opacity 0.15s",
    opacity: disabled ? 0.5 : 1, ...style,
  };
  const variants = {
    primary: { background: C.accent, color: "#fff" },
    ghost:   { background: "transparent", color: C.accent, border: `1.5px solid ${C.accent}` },
    muted:   { background: C.surface, color: C.textPrimary },
    danger:  { background: "#fee2e2", color: "#991b1b" },
    dark:    { background: C.dark, color: "#fff" },
  };
  return (
    <button
      style={{ ...base, ...variants[variant] }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={e => !disabled && (e.currentTarget.style.opacity = "0.82")}
      onMouseLeave={e => (e.currentTarget.style.opacity = disabled ? "0.5" : "1")}
    >{children}</button>
  );
}

function ReadinessChip({ status }) {
  const map = {
    green: { bg: "#d1fae5", color: "#065f46", label: "Ready" },
    amber: { bg: "#fef3c7", color: "#92400e", label: "Resource" },
    red:   { bg: "#fee2e2", color: "#991b1b", label: "No Plan" },
    grey:  { bg: "#f3f4f6", color: "#6b7280", label: "Cancelled" },
  };
  const s = map[status] || map.grey;
  return <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>;
}

function SeverityBadge({ sev }) {
  const map = {
    critical: { bg: "#fee2e2", color: "#991b1b" },
    high:     { bg: "#fef3c7", color: "#92400e" },
    medium:   { bg: "#e0f2fe", color: "#075985" },
    low:      { bg: "#f3f4f6", color: "#6b7280" },
  };
  const s = map[sev] || map.low;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: s.bg, color: s.color, textTransform: "uppercase", letterSpacing: 0.5 }}>{sev}</span>;
}

function Avatar({ initials, size = 36, bg = C.accent, color = "#fff", style = {}, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: "50%", background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.36, fontWeight: 800, color,
        flexShrink: 0, cursor: onClick ? "pointer" : "default", ...style,
      }}
    >{initials}</div>
  );
}

// ── Modal Shell ────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", width: "100%", maxWidth: 520, padding: "26px 26px 22px", maxHeight: "85vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Attendance Modal ───────────────────────────────────────────────────────
function AttendanceModal({ slot, onClose, onSave }) {
  const [statuses, setStatuses] = useState(Object.fromEntries(STUDENTS.map(s => [s.id, "present"])));
  const options = ["present", "absent", "late", "excused"];
  const optColor = { present: "#10b981", absent: "#ef4444", late: "#f59e0b", excused: "#6366f1" };
  return (
    <Modal open onClose={onClose} title={`Attendance — ${slot.subject} ${slot.class} · ${slot.start}`}>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>Tap to change status. Default: Present.</div>
      {STUDENTS.map(s => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{s.name}</span>
          <div style={{ display: "flex", gap: 4 }}>
            {options.map(o => (
              <button
                key={o}
                onClick={() => setStatuses(p => ({ ...p, [s.id]: o }))}
                style={{ padding: "4px 8px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", background: statuses[s.id] === o ? optColor[o] : C.surface, color: statuses[s.id] === o ? "#fff" : C.textMuted }}
              >{o.charAt(0).toUpperCase() + o.slice(1)}</button>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => { onSave(slot.id, statuses); onClose(); }}>Save Attendance</Btn>
      </div>
    </Modal>
  );
}

// ── Message Modal ──────────────────────────────────────────────────────────
function MessageModal({ student, onClose }) {
  const [msg, setMsg] = useState(student ? `Hi, I wanted to reach out regarding ${student.name}. I've noticed some concerns and would like to discuss with you.` : "");
  const [sent, setSent] = useState(false);
  if (sent) return (
    <Modal open onClose={onClose} title="Message Sent">
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 15, color: C.textPrimary, fontWeight: 600 }}>Message sent.</div>
        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 6 }}>Thread created in VibeConnect.</div>
        <Btn style={{ marginTop: 20 }} onClick={onClose}>Done</Btn>
      </div>
    </Modal>
  );
  return (
    <Modal open onClose={onClose} title={`Message${student ? ` — ${student.name}` : ""}`}>
      <div style={{ marginBottom: 12, fontSize: 13, color: C.textMuted }}>Opens a thread in VibeConnect. Students cannot see this.</div>
      <textarea
        value={msg}
        onChange={e => setMsg(e.target.value)}
        style={{ width: "100%", minHeight: 120, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, fontFamily: "inherit", color: C.textPrimary, resize: "vertical", outline: "none", boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => setSent(true)} disabled={!msg.trim()}>Send</Btn>
      </div>
    </Modal>
  );
}

// ── Lesson Plan Modal ──────────────────────────────────────────────────────
function LessonPlanModal({ slot, onClose }) {
  const plan = {
    objectives: ["Solve linear equations with one variable", "Apply equations to real-world contexts"],
    introduction: "Begin with a real-world problem: 'If a matatu carries 14 passengers and 3 get off at each stop, how many stops before it is empty?' Students model this as an equation.",
    development: "Introduce the balance method. Students work in pairs on differentiated worksheets. Higher: multi-step. On-track: single-step with negatives. Support: pictorial balance with guided steps.",
    consolidation: "Exit card: solve 3x + 7 = 22. Students write one real-world equation of their own.",
    assessmentHook: "Moment 3 exit check — auto-marked. Results feed progressive record.",
    homework: "Textbook p.84 Exercise 3B — Questions 1–10.",
    differentiation: {
      higher:   "Multi-step equations with brackets and fractions.",
      on_track: "Single-step equations with negative numbers.",
      support:  "Pictorial balance method with step-by-step scaffold.",
    },
  };
  const diffColor = { higher: "#7c3aed", on_track: C.accent, support: "#f59e0b" };
  return (
    <Modal open onClose={onClose} title={`Lesson Plan — ${slot.subject} ${slot.class} · ${slot.start}`}>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>Generated by Pedagogical Chain · 12hrs before lesson</div>
      {[
        { label: "Learning Objectives", content: plan.objectives.map((o, i) => `${i + 1}. ${o}`).join("\n") },
        { label: "Introduction (5–7 min)", content: plan.introduction },
        { label: "Development (20–25 min)", content: plan.development },
        { label: "Consolidation (10 min)", content: plan.consolidation },
        { label: "Assessment Hook", content: plan.assessmentHook },
        { label: "Homework", content: plan.homework },
      ].map(s => (
        <div key={s.label} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>{s.label}</div>
          <div style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.6, whiteSpace: "pre-line" }}>{s.content}</div>
        </div>
      ))}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Differentiation</div>
        {Object.entries(plan.differentiation).map(([level, desc]) => (
          <div key={level} style={{ marginBottom: 8, padding: "10px 14px", borderRadius: 10, background: C.surface }}>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: diffColor[level], marginRight: 8 }}>{level.replace("_", " ")}</span>
            <span style={{ fontSize: 13, color: C.textPrimary }}>{desc}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
        <Btn>Edit Plan</Btn>
      </div>
    </Modal>
  );
}

// ── Twin Pill (always visible above bottom nav) ────────────────────────────
function TwinDot({ delay = 0 }) {
  return (
    <span style={{
      display: "inline-block", width: 7, height: 7, borderRadius: "50%",
      background: C.accent, margin: "0 2px",
      animation: `twinPulse 1.4s ease-in-out ${delay}s infinite`,
    }} />
  );
}

function TwinPill({ onOpen, hasUnread }) {
  return (
    <div
      onClick={onOpen}
      style={{
        position: "fixed", bottom: 72, left: "50%", transform: "translateX(-50%)",
        zIndex: 750, background: C.dark, borderRadius: 40,
        padding: "10px 20px", display: "flex", alignItems: "center", gap: 14,
        boxShadow: "0 4px 24px rgba(30,27,75,0.32)", cursor: "pointer",
        border: "1.5px solid rgba(16,185,129,0.3)",
        transition: "box-shadow 0.2s, transform 0.2s",
        minWidth: 230, justifyContent: "space-between", userSelect: "none",
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(30,27,75,0.45)"; e.currentTarget.style.transform = "translateX(-50%) translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(30,27,75,0.32)"; e.currentTarget.style.transform = "translateX(-50%) translateY(0)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(16,185,129,0.18)", border: "1.5px solid rgba(16,185,129,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.accent }}>✦</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1 }}>Your Twin</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Tap to open</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {hasUnread
          ? <span style={{ width: 20, height: 20, borderRadius: "50%", background: C.error, color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>1</span>
          : <><TwinDot delay={0} /><TwinDot delay={0.2} /><TwinDot delay={0.4} /></>
        }
      </div>
    </div>
  );
}

// ── Twin Drawer ────────────────────────────────────────────────────────────
function TwinDrawer({ open, onClose }) {
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState([
    { role: "twin", text: "Good morning, Ms. Kamau. You have 4 lessons today. David Otieno has missed 5 days this term — flagged. Period 3 needs a resource confirmed. You are on track with the scheme of work." }
  ]);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open && bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking, open]);

  async function send() {
    if (!input.trim()) return;
    const userMsg = input;
    setInput("");
    setMessages(m => [...m, { role: "user", text: userMsg }]);
    setThinking(true);
    await new Promise(r => setTimeout(r, 1600));
    setThinking(false);
    const responses = [
      "Brian Kamau and David Otieno are both showing declining trends. I recommend reaching out to both parents this week.",
      "Period 3 resource flag: lab equipment for the Geometry lesson is unconfirmed. Mark it available or request a substitute.",
      "You are 14 topics into an 18-topic scheme with 4 weeks remaining. On track — no action needed.",
      "I can draft a parent message for David Otieno. Just say 'draft message for David's parent'.",
      "The class average for Linear Equations was 68%. Three students need follow-up: Brian, David, and Felix.",
    ];
    setMessages(m => [...m, { role: "twin", text: responses[Math.floor(Math.random() * responses.length)] }]);
  }

  return (
    <>
      {open && <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 780, background: "rgba(0,0,0,0.25)" }} />}
      <div style={{
        position: "fixed", left: "50%", transform: "translateX(-50%)",
        bottom: open ? 138 : -500, zIndex: 790,
        width: "calc(100% - 32px)", maxWidth: 600,
        background: "#fff", borderRadius: 20,
        boxShadow: "0 -4px 40px rgba(0,0,0,0.18)",
        display: "flex", flexDirection: "column", height: 440,
        transition: "bottom 0.34s cubic-bezier(0.34,1.56,0.64,1)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ background: C.dark, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(16,185,129,0.2)", border: "1.5px solid rgba(16,185,129,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.accent }}>✦</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", fontFamily: "'Bricolage Grotesque', sans-serif" }}>Your Twin</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Never resets · Always here</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8 }}>
              {m.role === "twin" && (
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, color: C.accent }}>✦</div>
              )}
              <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px", background: m.role === "user" ? C.accent : C.surface, color: m.role === "user" ? "#fff" : C.textPrimary, fontSize: 13, lineHeight: 1.6 }}>
                {m.text}
              </div>
            </div>
          ))}
          {thinking && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.accent }}>✦</div>
              <TwinDot delay={0} /><TwinDot delay={0.2} /><TwinDot delay={0.4} />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {/* Input */}
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8, flexShrink: 0 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Ask your Twin anything about your class..."
            style={{ flex: 1, padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${C.border}`, outline: "none", fontSize: 13, fontFamily: "inherit", color: C.textPrimary }}
          />
          <Btn onClick={send}>Send</Btn>
        </div>
      </div>
    </>
  );
}

// ── Bottom Nav ─────────────────────────────────────────────────────────────
function BottomNav({ active, onChange, unreadConnect }) {
  const tabs = [
    { id: "home",        icon: "🏠", label: "Home" },
    { id: "lessonplan",  icon: "📖", label: "Plans" },
    { id: "vibeconnect", icon: "💬", label: "VibeConnect", badge: unreadConnect },
    { id: "more",        icon: "⋯",  label: "More" },
    { id: "profile",     icon: "👤", label: "Profile" },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 700, background: "#fff", borderTop: `1px solid ${C.border}`, display: "flex", height: 64, boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, border: "none", background: "none", cursor: "pointer", padding: "8px 0", color: active === t.id ? C.accent : C.textMuted, transition: "color 0.15s", position: "relative" }}
        >
          {t.badge > 0 && (
            <span style={{ position: "absolute", top: 6, right: "calc(50% - 14px)", width: 16, height: 16, borderRadius: "50%", background: C.error, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{t.badge}</span>
          )}
          <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
          <span style={{ fontSize: 10, fontWeight: active === t.id ? 800 : 600, letterSpacing: 0.2, fontFamily: "inherit" }}>{t.label}</span>
          {active === t.id && <div style={{ position: "absolute", top: 0, width: 28, height: 2.5, background: C.accent, borderRadius: "0 0 3px 3px" }} />}
        </button>
      ))}
    </div>
  );
}

// ══ HOME TAB ═══════════════════════════════════════════════════════════════
function HomeTab({ setAttendanceModal, setMessageModal, setLessonModal, flags, setFlags, markedSlots, showToast, setActiveTab }) {
  const unresolvedFlags = flags.filter(f => !f.resolved);
  const nextSlot = TODAY_SLOTS.find(s => isNext(s) && s.status === "scheduled");
  const currentSlot = TODAY_SLOTS.find(s => isCurrent(s));
  const attendancePct = Math.round((STUDENTS.filter(s => s.absences === 0).length / STUDENTS.length) * 100);

  function resolveFlag(id) {
    setFlags(f => f.map(x => x.id === id ? { ...x, resolved: true } : x));
    showToast("Flag resolved.");
  }

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>

      {/* Hero Greeting */}
      <div style={{ background: `linear-gradient(135deg, ${C.dark} 0%, #312e81 100%)`, borderRadius: 20, padding: "22px 22px 20px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 600, marginBottom: 4 }}>
          {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 4 }}>
          {greeting()}, Ms. Kamau 👋
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
          {TEACHER.class} · {TEACHER.subject} · {TEACHER.school}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {[
            { label: "Lessons Today", value: TODAY_SLOTS.length },
            { label: "Flags", value: unresolvedFlags.length },
            { label: "Attendance", value: `${attendancePct}%` },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Next Up Banner */}
      {(currentSlot || nextSlot) && (() => {
        const slot = currentSlot || nextSlot;
        const isnow = !!currentSlot;
        return (
          <div style={{ background: isnow ? "#d1fae5" : "#fef3c7", borderRadius: 14, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${isnow ? "#a7f3d0" : "#fde68a"}` }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: isnow ? "#065f46" : "#92400e", letterSpacing: 1, textTransform: "uppercase" }}>{isnow ? "● Now" : "Next Up"}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, marginTop: 2 }}>{slot.subject} · {slot.class} · {slot.room}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{slot.start}–{slot.end}{!isnow ? ` · in ${formatCountdown(minutesUntil(slot))}` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn small variant="ghost" onClick={() => setLessonModal(slot)}>Plan</Btn>
              <Btn small onClick={() => setAttendanceModal(slot)}>Attend</Btn>
            </div>
          </div>
        );
      })()}

      {/* Quick Actions — 4×2 grid */}
      <Card style={{ padding: "18px 18px" }}>
        <SectionLabel>Quick Actions</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {QUICK_ACTIONS.map(qa => (
            <button
              key={qa.id}
              onClick={() => {
                if (qa.id === "lessonplan") setActiveTab("lessonplan");
                else if (qa.id === "attendance") setAttendanceModal(TODAY_SLOTS[1]);
                else if (qa.id === "vibeconnect") setActiveTab("vibeconnect");
                else showToast(`Opening ${qa.label}…`);
              }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 4px", borderRadius: 14, border: "none", cursor: "pointer", background: qa.color, transition: "transform 0.15s, box-shadow 0.15s", fontFamily: "inherit" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <span style={{ fontSize: 22 }}>{qa.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 800, color: qa.iconColor, textAlign: "center", lineHeight: 1.3 }}>{qa.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Early Warning Flags */}
      {unresolvedFlags.length > 0 && (
        <Card>
          <SectionLabel>Early Warning Flags ({unresolvedFlags.length})</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {unresolvedFlags.map(f => (
              <div key={f.id} style={{ padding: "12px 14px", borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <SeverityBadge sev={f.severity} />
                    {f.student && <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{f.student}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>{f.message}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, flexDirection: "column" }}>
                  {f.type === "attendance" && (
                    <Btn small variant="ghost" onClick={() => setMessageModal(STUDENTS.find(s => s.name === f.student) || null)}>
                      Message Parent
                    </Btn>
                  )}
                  <Btn small variant="muted" onClick={() => resolveFlag(f.id)}>Resolve</Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Today's Timetable */}
      <Card>
        <SectionLabel>Today's Timetable</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {TODAY_SLOTS.map(slot => {
            const isNow = isCurrent(slot);
            const isDone = slot.status === "taught" || markedSlots[slot.id];
            return (
              <div key={slot.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 12, background: isNow ? "#f0fdf4" : C.surface, border: isNow ? `1.5px solid ${C.accent}` : `1px solid ${C.border}` }}>
                <div style={{ width: 42, textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary }}>{slot.start}</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>{slot.end}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{slot.subject} · <span style={{ color: C.textMuted }}>{slot.class}</span></div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{slot.room} · P{slot.period}</div>
                </div>
                <ReadinessChip status={isDone ? "green" : slot.planStatus} />
                <div style={{ display: "flex", gap: 5 }}>
                  <Btn small variant="ghost" onClick={() => setLessonModal(slot)}>Plan</Btn>
                  <Btn small variant={markedSlots[slot.id] ? "muted" : "primary"} onClick={() => setAttendanceModal(slot)}>
                    {markedSlots[slot.id] ? "✓" : "Attend"}
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Class Pulse */}
      <Card>
        <SectionLabel>Class Pulse · {TEACHER.class}</SectionLabel>
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, padding: 14, borderRadius: 12, background: C.surface, textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.accent }}>{attendancePct}%</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Attendance</div>
          </div>
          <div style={{ flex: 1, padding: 14, borderRadius: 12, background: C.surface, textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.warning }}>{STUDENTS.filter(s => s.absences >= 3).length}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>At-risk (3+ absent)</div>
          </div>
        </div>
        {STUDENTS.map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: s.absences >= 3 ? C.error : s.absences >= 1 ? C.warning : C.accent }} />
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{s.name}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{s.absences} absent</div>
            <div style={{ fontSize: 11, color: s.trend === "improving" ? C.accent : s.trend === "declining" ? C.error : C.textMuted }}>
              {s.trend === "improving" ? "▲" : s.trend === "declining" ? "▼" : "→"} {s.trend}
            </div>
            {s.absences >= 3 && <Btn small variant="ghost" onClick={() => setMessageModal(s)}>Msg</Btn>}
          </div>
        ))}
      </Card>

      {/* Assessment Snapshot */}
      <Card>
        <SectionLabel>Assessment Snapshot</SectionLabel>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>{ASSESSMENT.lastTitle}</div>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>Class average: <strong style={{ color: C.textPrimary }}>{ASSESSMENT.classAvg}%</strong></div>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 60, marginBottom: 8 }}>
          {ASSESSMENT.distribution.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: "100%", borderRadius: "4px 4px 0 0", background: [C.error, C.warning, C.accent, "#6366f1", "#7c3aed"][i], height: `${(v / 35) * 100}%`, minHeight: 4 }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          {ASSESSMENT.bands.map((b, i) => (
            <div key={i} style={{ flex: 1, fontSize: 10, color: C.textMuted, textAlign: "center" }}>{b}</div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: C.textMuted }}>
          Needs follow-up:{" "}
          {ASSESSMENT.needsFollowup.map((n, i) => (
            <span key={i} onClick={() => setMessageModal(STUDENTS.find(s => s.name === n) || null)} style={{ color: C.accent, fontWeight: 700, cursor: "pointer", marginLeft: i > 0 ? 6 : 4 }}>
              {n}{i < ASSESSMENT.needsFollowup.length - 1 ? "," : ""}
            </span>
          ))}
        </div>
      </Card>

      {/* Curriculum Progress */}
      <Card>
        <SectionLabel>Curriculum Progress</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{ padding: "5px 14px", borderRadius: 20, background: "#d1fae5", color: "#065f46", fontSize: 12, fontWeight: 700 }}>✓ On Track</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>Strand: <strong style={{ color: C.textPrimary }}>{CURRICULUM.strand}</strong> · {CURRICULUM.weeksRemaining}w left</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 10, background: C.accent, width: `${(CURRICULUM.topicsCovered / CURRICULUM.topicsTotal) * 100}%`, transition: "width 0.6s ease" }} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, flexShrink: 0 }}>{CURRICULUM.topicsCovered}/{CURRICULUM.topicsTotal}</div>
        </div>
      </Card>

      {/* News + Notices */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <Card style={{ flex: 1, marginBottom: 0 }}>
          <SectionLabel>News</SectionLabel>
          {NEWS.map(n => (
            <div key={n.id} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, lineHeight: 1.4 }}>{n.title}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{n.source} · {n.time}</div>
            </div>
          ))}
        </Card>
        <Card style={{ flex: 1, marginBottom: 0 }}>
          <SectionLabel>Notices</SectionLabel>
          {ANNOUNCEMENTS.map(a => (
            <div key={a.id} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              {a.pinned && <div style={{ fontSize: 9, fontWeight: 800, color: C.accent, textTransform: "uppercase", marginBottom: 2 }}>📌 Pinned</div>}
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary }}>{a.title}</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{a.body}</div>
            </div>
          ))}
        </Card>
      </div>

    </div>
  );
}

// ══ LESSON PLANS TAB ═══════════════════════════════════════════════════════
function LessonPlanTab({ setLessonModal }) {
  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>
      <div style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", borderRadius: 20, padding: "20px 20px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Lesson Plan Generator</div>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Bricolage Grotesque', sans-serif", marginTop: 4 }}>Built by the Pedagogical Chain</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>Auto-generated 12 hours before each lesson. Always differentiated.</div>
      </div>

      <Card>
        <SectionLabel>Today & Upcoming</SectionLabel>
        {LESSON_PLANS.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{p.title}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{p.class} · {p.date}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{p.topic}</div>
            </div>
            <ReadinessChip status={p.status} />
            <Btn small variant="ghost" onClick={() => setLessonModal(TODAY_SLOTS.find(s => s.class === p.class) || TODAY_SLOTS[0])}>View</Btn>
          </div>
        ))}
      </Card>

      <Card>
        <SectionLabel>Generate New Plan</SectionLabel>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 14 }}>The Pedagogical Chain auto-generates plans 12 hours before each lesson. Trigger manually if needed.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn>Generate for Next Lesson</Btn>
          <Btn variant="ghost">Browse All Plans</Btn>
        </div>
      </Card>

      <Card>
        <SectionLabel>Differentiation Summary</SectionLabel>
        {[
          { level: "Higher",   color: "#7c3aed", bg: "#ede9fe", count: 2, desc: "Multi-step and extension tasks" },
          { level: "On Track", color: C.accent,  bg: "#d1fae5", count: 4, desc: "Core curriculum delivery" },
          { level: "Support",  color: "#f59e0b", bg: "#fef3c7", count: 2, desc: "Scaffolded and visual methods" },
        ].map(d => (
          <div key={d.level} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: d.bg, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: d.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 800 }}>{d.count}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: d.color }}>{d.level}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{d.desc}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ══ VIBECONNECT TAB ════════════════════════════════════════════════════════
function VibeConnectTab({ setMessageModal }) {
  const [activeThread, setActiveThread] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState({});
  const [filter, setFilter] = useState("all");

  function sendMsg() {
    if (!chatInput.trim() || !activeThread) return;
    setChatHistory(h => ({ ...h, [activeThread.id]: [...(h[activeThread.id] || []), { role: "me", text: chatInput, time: "Just now" }] }));
    setChatInput("");
  }

  const filters = ["all", "teacher", "parent", "admin"];
  const filtered = filter === "all" ? VIBECONNECT_THREADS : VIBECONNECT_THREADS.filter(t => t.type === filter);

  if (activeThread) {
    const msgs = [
      { role: "them", text: activeThread.last, time: activeThread.time },
      ...(chatHistory[activeThread.id] || []),
    ];
    return (
      <div style={{ animation: "slideIn 0.22s ease", display: "flex", flexDirection: "column", height: "calc(100vh - 220px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", marginBottom: 8, borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => setActiveThread(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted, lineHeight: 1 }}>←</button>
          <Avatar initials={activeThread.avatar} size={40} bg={ROLE_STYLE[activeThread.type].bg} color={ROLE_STYLE[activeThread.type].color} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{activeThread.name}</div>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "capitalize", padding: "2px 8px", borderRadius: 10, background: ROLE_STYLE[activeThread.type].bg, color: ROLE_STYLE[activeThread.type].color }}>{activeThread.type}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 10 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "me" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "76%", padding: "10px 14px", borderRadius: m.role === "me" ? "16px 16px 4px 16px" : "4px 16px 16px 16px", background: m.role === "me" ? C.accent : C.surface, color: m.role === "me" ? "#fff" : C.textPrimary, fontSize: 13, lineHeight: 1.6 }}>
                {m.text}
                <div style={{ fontSize: 10, color: m.role === "me" ? "rgba(255,255,255,0.6)" : C.textMuted, marginTop: 4, textAlign: "right" }}>{m.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMsg()}
            placeholder="Type a message..."
            style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, outline: "none", fontSize: 13, fontFamily: "inherit", color: C.textPrimary }}
          />
          <Btn onClick={sendMsg}>Send</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>
      <div style={{ background: "linear-gradient(135deg, #0f766e 0%, #10b981 100%)", borderRadius: 20, padding: "20px 20px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>VibeConnect</div>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Bricolage Grotesque', sans-serif", marginTop: 4 }}>Messages & Threads</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>Teachers · Parents · Admin. Scoped to your school.</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: filter === f ? C.accent : C.surface, color: filter === f ? "#fff" : C.textMuted, transition: "all 0.15s" }}>
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button onClick={() => setMessageModal(null)} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${C.accent}`, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: "transparent", color: C.accent }}>
          + New
        </button>
      </div>

      <Card style={{ padding: 0 }}>
        {filtered.map((t, i) => (
          <div
            key={t.id}
            onClick={() => setActiveThread(t)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <Avatar initials={t.avatar} size={42} bg={ROLE_STYLE[t.type].bg} color={ROLE_STYLE[t.type].color} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{t.name}</span>
                <span style={{ fontSize: 11, color: C.textMuted }}>{t.time}</span>
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.last}</div>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", padding: "2px 7px", borderRadius: 10, background: ROLE_STYLE[t.type].bg, color: ROLE_STYLE[t.type].color, display: "inline-block", marginTop: 4 }}>{t.type}</span>
            </div>
            {t.unread > 0 && (
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{t.unread}</div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ══ MORE TAB ═══════════════════════════════════════════════════════════════
function MoreTab({ showToast }) {
  const items = [
    { icon: "🏫", label: "ClassHub",       desc: "Your class overview and learner profiles" },
    { icon: "🔬", label: "SubjectHub",      desc: "Subject teams and shared resources" },
    { icon: "🎓", label: "VibeLearn",       desc: "Student-facing learning platform" },
    { icon: "📦", label: "Resources",       desc: "Upload and manage teaching materials" },
    { icon: "📊", label: "Assessment",      desc: "Scores, trends, and progressive records" },
    { icon: "🗓️", label: "SmartTimetable",  desc: "Full weekly timetable view" },
    { icon: "🏛️", label: "SchoolHub",       desc: "School-wide admin and governance" },
    { icon: "📋", label: "Scheme of Work",  desc: "Curriculum map and topic tracker" },
    { icon: "⚙️", label: "Settings",        desc: "Account, notifications, preferences" },
    { icon: "❓", label: "Help & Support",  desc: "Guides, FAQs, and contact" },
  ];
  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary, fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 16 }}>More</div>
      <Card style={{ padding: 0 }}>
        {items.map((item, i) => (
          <div
            key={item.label}
            onClick={() => showToast(`Opening ${item.label}…`)}
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: 22 }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{item.label}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{item.desc}</div>
            </div>
            <span style={{ fontSize: 16, color: C.textMuted }}>›</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ══ PROFILE TAB ════════════════════════════════════════════════════════════
function ProfileTab() {
  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>
      <Card style={{ textAlign: "center", padding: "30px 20px" }}>
        <Avatar initials={TEACHER.initials} size={72} style={{ margin: "0 auto 14px" }} />
        <div style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{TEACHER.name}</div>
        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Class Teacher · {TEACHER.class}</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>{TEACHER.school}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
          <Btn variant="ghost">Edit Profile</Btn>
          <Btn variant="muted">Settings</Btn>
        </div>
      </Card>

      <Card>
        <SectionLabel>Employment</SectionLabel>
        {[
          { label: "Role",              value: "Class Teacher + Subject Teacher" },
          { label: "Class",             value: "Grade 6B (Form Tutor)" },
          { label: "Subject",           value: "Mathematics — Grades 6, 7, 8" },
          { label: "School",            value: TEACHER.school },
          { label: "Joined VibeSchool", value: "January 2024" },
        ].map(r => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13, color: C.textMuted }}>{r.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{r.value}</span>
          </div>
        ))}
      </Card>

      <Card>
        <SectionLabel>This Term</SectionLabel>
        {[
          { label: "Lessons Delivered", value: "84" },
          { label: "Plans Generated",   value: "91" },
          { label: "Parent Threads",    value: "12" },
          { label: "Assessments",       value: "6"  },
          { label: "Attendance Rate",   value: "87%" },
        ].map(r => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13, color: C.textMuted }}>{r.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{r.value}</span>
          </div>
        ))}
      </Card>

      <Btn variant="danger" style={{ width: "100%", justifyContent: "center" }}>Sign Out</Btn>
    </div>
  );
}

// ══ ROOT ════════════════════════════════════════════════════════════════════
export default function VibeSchoolTeacher() {
  const [activeTab, setActiveTab]       = useState("home");
  const [twinOpen, setTwinOpen]         = useState(false);
  const [flags, setFlags]               = useState(FLAGS_DATA);
  const [attendanceModal, setAttendanceModal] = useState(null);
  const [messageModal, setMessageModal] = useState(undefined); // undefined=closed, null=open no student
  const [lessonModal, setLessonModal]   = useState(null);
  const [markedSlots, setMarkedSlots]   = useState({});
  const [toast, setToast]               = useState(null);

  function showToast(msg) { setToast({ msg }); setTimeout(() => setToast(null), 2800); }
  function saveAttendance(slotId, statuses) { setMarkedSlots(p => ({ ...p, [slotId]: statuses })); showToast("Attendance saved and synced."); }

  const unreadConnect = VIBECONNECT_THREADS.reduce((a, t) => a + t.unread, 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f0f2f5; }
        @keyframes twinPulse { 0%,80%,100%{transform:scale(0.7);opacity:0.5} 40%{transform:scale(1);opacity:1} }
        @keyframes slideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#f0f2f5", fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 145 }}>

        {/* ── Header ── */}
        <div style={{ background: C.dark, color: "#fff", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 600, boxShadow: "0 2px 12px rgba(0,0,0,0.18)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#fff" }}>V</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3, fontFamily: "'Bricolage Grotesque', sans-serif" }}>VibeSchool</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: -1 }}>{TEACHER.school}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {unreadConnect > 0 && (
              <div style={{ position: "relative", cursor: "pointer" }} onClick={() => setActiveTab("vibeconnect")}>
                <span style={{ fontSize: 20 }}>💬</span>
                <span style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: C.error, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{unreadConnect}</span>
              </div>
            )}
            <Avatar initials={TEACHER.initials} size={34} onClick={() => setActiveTab("profile")} style={{ cursor: "pointer" }} />
          </div>
        </div>

        {/* ── Page Content ── */}
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 0" }}>
          {activeTab === "home"        && <HomeTab setAttendanceModal={setAttendanceModal} setMessageModal={setMessageModal} setLessonModal={setLessonModal} flags={flags} setFlags={setFlags} markedSlots={markedSlots} showToast={showToast} setActiveTab={setActiveTab} />}
          {activeTab === "lessonplan"  && <LessonPlanTab setLessonModal={setLessonModal} />}
          {activeTab === "vibeconnect" && <VibeConnectTab setMessageModal={setMessageModal} />}
          {activeTab === "more"        && <MoreTab showToast={showToast} />}
          {activeTab === "profile"     && <ProfileTab />}
        </div>

        {/* ── Modals ── */}
        {attendanceModal && <AttendanceModal slot={attendanceModal} onClose={() => setAttendanceModal(null)} onSave={saveAttendance} />}
        {messageModal !== undefined && <MessageModal student={messageModal} onClose={() => setMessageModal(undefined)} />}
        {lessonModal && <LessonPlanModal slot={lessonModal} onClose={() => setLessonModal(null)} />}

        {/* ── Twin Pill — always above nav ── */}
        <TwinPill onOpen={() => setTwinOpen(true)} hasUnread={!twinOpen} />

        {/* ── Twin Drawer — slides up ── */}
        <TwinDrawer open={twinOpen} onClose={() => setTwinOpen(false)} />

        {/* ── Bottom Nav ── */}
        <BottomNav active={activeTab} onChange={t => { setActiveTab(t); setTwinOpen(false); }} unreadConnect={unreadConnect} />

        {/* ── Toast ── */}
        {toast && (
          <div style={{ position: "fixed", bottom: 145, left: "50%", transform: "translateX(-50%)", background: C.dark, color: "#fff", padding: "11px 22px", borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 9999, animation: "fadeIn 0.2s ease", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", whiteSpace: "nowrap" }}>
            {toast.msg}
          </div>
        )}
      </div>
    </>
  );
}