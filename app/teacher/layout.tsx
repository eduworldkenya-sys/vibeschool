"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useRef, useCallback, createContext, useContext, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C, Avatar } from "@/components/teacher/ui";
import TwinDrawer from "@/components/teacher/TwinDrawer";
import OfflineBar from "@/components/teacher/OfflineBar";
import { getTwinAuthorityContext, selectTwinRoleBinding } from "@/lib/twin/core";

interface ToastCtx { showToast: (msg: string) => void }
const ToastContext = createContext<ToastCtx>({ showToast: () => {} });
export const useToast = () => useContext(ToastContext);

interface UserCtx { fullName: string; initials: string; school: string }
const UserContext = createContext<UserCtx>({ fullName: '', initials: '', school: '' });
export const useUser = () => useContext(UserContext);

interface CreditCtx { creditBalance: number | null; refreshCredits: () => void }
const CreditContext = createContext<CreditCtx>({ creditBalance: null, refreshCredits: () => {} });
export const useCredits = () => useContext(CreditContext);

const NAV_TABS = [
  { id: "today",   label: "Today",   href: "/teacher/pulse"       },
  { id: "teach",   label: "Teach",   href: "/teacher/teach-today" },
  { id: "classes", label: "Classes", href: "/teacher/classhub"    },
  { id: "assess",  label: "Assess",  href: "/teacher/assessment"  },
  { id: "me",      label: "Me",      href: "/teacher/profile"     },
] as const;

type TabId = typeof NAV_TABS[number]["id"];

function tabIdFromPath(path: string): TabId {
  if (path === "/teacher" || path === "/teacher/") return "today";
  if (path.startsWith("/teacher/pulse")) return "today";
  if (path.startsWith("/teacher/twin")) return "today";

  if (
    path.startsWith("/teacher/teach-today") ||
    path.startsWith("/teacher/timetable") ||
    path.startsWith("/teacher/week") ||
    path.startsWith("/teacher/subjecthub") ||
    path.startsWith("/teacher/scheme") ||
    path.startsWith("/teacher/lessonplan") ||
    path.startsWith("/teacher/progress") ||
    path.startsWith("/teacher/resources") ||
    path.startsWith("/teacher/vibelearn")
  ) return "teach";

  if (
    path.startsWith("/teacher/classhub") ||
    path.startsWith("/teacher/students") ||
    path.startsWith("/teacher/attendance") ||
    path.startsWith("/teacher/homework") ||
    path.startsWith("/teacher/vibeconnect")
  ) return "classes";

  if (
    path.startsWith("/teacher/results") ||
    path.startsWith("/teacher/assessment") ||
    path.startsWith("/teacher/academics")
  ) return "assess";

  if (
    path.startsWith("/teacher/profile") ||
    path.startsWith("/teacher/credits") ||
    path.startsWith("/teacher/tpad") ||
    path.startsWith("/teacher/schoolhub") ||
    path.startsWith("/teacher/settings") ||
    path.startsWith("/teacher/help") ||
    path.startsWith("/teacher/more")
  ) return "me";

  return "today";
}

function IconClassHub({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function IconVibeLearn({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      <line x1="12" y1="6" x2="16" y2="6"/><line x1="12" y1="10" x2="16" y2="10"/>
      <line x1="8" y1="14" x2="16" y2="14"/>
    </svg>
  );
}
function IconPlans({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}
function IconAssess({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}
function IconMore({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"/>
    </svg>
  );
}

const NAV_ICONS: Record<string, (active: boolean) => React.ReactNode> = {
  today: (a) => <IconPulse size={a ? 23 : 21} />,
  teach: (a) => <IconTeach size={a ? 23 : 21} />,
  classes: (a) => <IconStudents size={a ? 23 : 21} />,
  assess: (a) => <IconAssess size={a ? 23 : 21} />,
  me: (a) => <IconMe size={a ? 23 : 21} />,
};

function TwinPill({ onOpen, unread }: { onOpen: () => void; unread: number }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const dragging = useRef(false)
  const startPointer = useRef({ x: 0, y: 0 })
  const startPos = useRef({ x: 0, y: 0 })
  const pillRef = useRef<HTMLDivElement>(null)
  const moved = useRef(false)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    setPos({ x: w / 2 - 28, y: h - 136 })
  }, [])

  useEffect(() => {
    if (expanded) collapseTimer.current = setTimeout(() => setExpanded(false), 3000)
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current)
    }
  }, [expanded])

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true
    moved.current = false
    startPointer.current = { x: e.clientX, y: e.clientY }
    startPos.current = pos ?? { x: window.innerWidth / 2 - 28, y: window.innerHeight - 136 }
    pillRef.current?.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return
    const dx = e.clientX - startPointer.current.x
    const dy = e.clientY - startPointer.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true
    const w = window.innerWidth
    const h = window.innerHeight
    const pw = pillRef.current?.offsetWidth ?? 56
    const ph = pillRef.current?.offsetHeight ?? 56
    setPos({
      x: Math.min(Math.max(startPos.current.x + dx, 8), w - pw - 8),
      y: Math.min(Math.max(startPos.current.y + dy, 8), h - ph - 8),
    })
  }

  const [greeted, setGreeted] = useState(false)

  function vibeSpeak(text: string) {
    if (typeof window === 'undefined') return
    window.speechSynthesis?.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.88
    u.pitch = 1.05
    window.speechSynthesis?.speak(u)
  }

  function onPointerUp() {
    dragging.current = false
    if (moved.current) return
    if (!greeted) {
      setGreeted(true)
      vibeSpeak('Vibe.')
      setTimeout(() => {
        setExpanded(true)
        setTimeout(() => onOpen(), 600)
      }, 500)
      return
    }
    if (expanded) {
      if (collapseTimer.current) clearTimeout(collapseTimer.current)
      setExpanded(false)
      onOpen()
    } else {
      setExpanded(true)
      setTimeout(() => onOpen(), 400)
    }
  }

  if (!pos) return null
  const SIZE = 56

  return (
    <>
      <style>{`
        @keyframes twinGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.0), 0 0 16px 4px rgba(16,185,129,0.35), 0 4px 24px rgba(30,27,75,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(16,185,129,0.0), 0 0 28px 8px rgba(16,185,129,0.55), 0 4px 24px rgba(30,27,75,0.4); }
        }
        @keyframes twinRingPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.18); opacity: 0; }
        }
        @keyframes twinExpand {
          from { opacity: 0; transform: scaleX(0.7) translateX(-10px); }
          to { opacity: 1; transform: scaleX(1) translateX(0); }
        }
        @keyframes twinDotPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      {!expanded && (
        <div style={{
          position: 'fixed', left: pos.x - 8, top: pos.y - 8,
          width: SIZE + 16, height: SIZE + 16, borderRadius: '50%',
          border: '2px solid rgba(16,185,129,0.45)',
          animation: 'twinRingPulse 2s ease-in-out infinite',
          zIndex: 748, pointerEvents: 'none',
        }} />
      )}
      <div
        ref={pillRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position: 'fixed',
          left: expanded && pos.x + 56 > window.innerWidth / 2 ? pos.x - (180 - 56) : pos.x,
          top: pos.y, zIndex: 750, width: expanded ? 180 : SIZE, height: SIZE,
          borderRadius: expanded ? 32 : '50%',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #064e3b 100%)',
          border: '1.5px solid rgba(16,185,129,0.5)',
          animation: 'twinGlow 2.4s ease-in-out infinite',
          cursor: 'grab', userSelect: 'none', touchAction: 'none',
          transition: 'width 0.28s cubic-bezier(0.34,1.56,0.64,1), border-radius 0.28s ease',
          display: 'flex', alignItems: 'center',
          justifyContent: expanded ? (pos.x + 56 > window.innerWidth / 2 ? 'flex-end' : 'flex-start') : 'center',
          overflow: 'hidden',
          paddingLeft: expanded && pos.x + 56 <= window.innerWidth / 2 ? 8 : 0,
          paddingRight: expanded && pos.x + 56 > window.innerWidth / 2 ? 8 : 0,
          gap: expanded ? 8 : 0,
        }}
      >
        <div style={{
          flexShrink: 0, width: 40, height: 40, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, rgba(16,185,129,0.35), rgba(16,185,129,0.08))',
          border: '1.5px solid rgba(16,185,129,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: '#10b981', pointerEvents: 'none',
        }}>✦</div>
        {expanded && (
          <div style={{ animation: 'twinExpand 0.22s ease', pointerEvents: 'none', minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1, whiteSpace: 'nowrap' }}>Your Twin</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
              {[0, 0.2, 0.4].map(delay => (
                <span key={delay} style={{
                  display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
                  background: '#10b981', animation: `twinDotPulse 1.4s ease-in-out ${delay}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        {unread > 0 && (
          <div style={{
            position: 'absolute', top: 2, right: 2, width: 18, height: 18,
            borderRadius: '50%', background: '#ef4444', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800,
          }}>{unread}</div>
        )}
      </div>
    </>
  )
}

function IconPulse({ size = 22 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg> }
function IconTeach({ size = 22 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/></svg> }
function IconStudents({ size = 22 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function IconMe({ size = 22 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg> }
function IconWeek({ size = 22 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/></svg> }
function IconSubjectHub({ size = 22 }: { size?: number }) { return <IconClassHub size={size} /> }
function IconScheme({ size = 22 }: { size?: number }) { return <IconPlans size={size} /> }
function IconResources({ size = 22 }: { size?: number }) { return <IconVibeLearn size={size} /> }
function IconIndexer({ size = 22 }: { size?: number }) { return <IconVibeLearn size={size} /> }
function IconAttendance({ size = 22 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg> }
function IconHomework({ size = 22 }: { size?: number }) { return <IconPlans size={size} /> }
function IconVibeConnect({ size = 22 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function IconTimetable({ size = 22 }: { size?: number }) { return <IconWeek size={size} /> }
function IconResults({ size = 22 }: { size?: number }) { return <IconAssess size={size} /> }
function IconReportCard({ size = 22 }: { size?: number }) { return <IconPlans size={size} /> }
function IconProfile({ size = 22 }: { size?: number }) { return <IconMe size={size} /> }
function IconSettings({ size = 22 }: { size?: number }) { return <IconMore size={size} /> }
function IconHelp({ size = 22 }: { size?: number }) { return <IconMore size={size} /> }
function IconTPAD({ size = 22 }: { size?: number }) { return <IconAttendance size={size} /> }
function IconCredits({ size = 22 }: { size?: number }) { return <IconMore size={size} /> }
function IconSchoolHub({ size = 22 }: { size?: number }) { return <IconClassHub size={size} /> }

interface TrayItem { label: string; icon: React.ReactNode; href: string }

const TRAY_ITEMS: Record<string, TrayItem[]> = {
  teach: [
    { label: "Teach Today", icon: <IconPulse size={24} />, href: "/teacher/teach-today" },
    { label: "Timetable", icon: <IconTimetable size={24} />, href: "/teacher/timetable" },
    { label: "Subjects", icon: <IconSubjectHub size={24} />, href: "/teacher/subjecthub" },
    { label: "Scheme of Work", icon: <IconScheme size={24} />, href: "/teacher/scheme" },
    { label: "Lesson Plans", icon: <IconPlans size={24} />, href: "/teacher/lessonplan" },
    { label: "Week", icon: <IconWeek size={24} />, href: "/teacher/week" },
    { label: "Progress", icon: <IconVibeLearn size={24} />, href: "/teacher/progress" },
    { label: "Resources", icon: <IconResources size={24} />, href: "/teacher/resources" },
    { label: "VibeLearn", icon: <IconIndexer size={24} />, href: "/teacher/vibelearn" },
  ],
  classes: [
    { label: "My Classes", icon: <IconClassHub size={24} />, href: "/teacher/classhub" },
    { label: "Students", icon: <IconStudents size={24} />, href: "/teacher/students" },
    { label: "Attendance", icon: <IconAttendance size={24} />, href: "/teacher/attendance" },
    { label: "Homework", icon: <IconHomework size={24} />, href: "/teacher/homework" },
    { label: "VibeConnect", icon: <IconVibeConnect size={24} />, href: "/teacher/vibeconnect" },
  ],
  assess: [
    { label: "Assessments", icon: <IconAssess size={24} />, href: "/teacher/assessment" },
    { label: "Marking", icon: <IconAttendance size={24} />, href: "/teacher/assessment/marking" },
    { label: "Gradebook", icon: <IconResults size={24} />, href: "/teacher/assessment/gradebook" },
    { label: "Analytics", icon: <IconAssess size={24} />, href: "/teacher/assessment/analytics" },
    { label: "Curriculum", icon: <IconVibeLearn size={24} />, href: "/teacher/assessment/curriculum" },
    { label: "Interventions", icon: <IconStudents size={24} />, href: "/teacher/assessment/interventions" },
    { label: "Results", icon: <IconResults size={24} />, href: "/teacher/results" },
    { label: "Report Cards", icon: <IconReportCard size={24} />, href: "/teacher/results/report-card" },
  ],
  me: [
    { label: "Profile", icon: <IconProfile size={24} />, href: "/teacher/profile" },
    { label: "School", icon: <IconSchoolHub size={24} />, href: "/teacher/schoolhub" },
    { label: "TPAD", icon: <IconTPAD size={24} />, href: "/teacher/tpad" },
    { label: "Credits", icon: <IconCredits size={24} />, href: "/teacher/credits" },
    { label: "Settings", icon: <IconSettings size={24} />, href: "/teacher/settings" },
    { label: "Help", icon: <IconHelp size={24} />, href: "/teacher/help" },
  ],
}

function BottomNav({ activeId }: { activeId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [openTray, setOpenTray] = useState<string | null>(null)

  useEffect(() => { setOpenTray(null) }, [pathname])

  function handleTab(t: typeof NAV_TABS[number]) {
    if (t.id === "today") {
      setOpenTray(null)
      router.push("/teacher/pulse")
      return
    }
    setOpenTray(prev => prev === t.id ? null : t.id)
  }

  function handleTrayItem(href: string) {
    setOpenTray(null)
    router.push(href)
  }

  const trayItems = openTray ? TRAY_ITEMS[openTray] : null

  return (
    <>
      {openTray && (
        <div onClick={() => setOpenTray(null)} style={{ position: "fixed", inset: 0, zIndex: 690, background: "transparent" }} />
      )}
      <div style={{
        position: "fixed", bottom: 64, left: 0, right: 0, zIndex: 695,
        background: "#fff", borderRadius: "20px 20px 0 0",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.10)", padding: "10px 20px 16px",
        transform: openTray ? "translateY(0)" : "translateY(110%)",
        transition: "transform 0.28s cubic-bezier(0.32,0.72,0,1)",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e5e7eb", margin: "0 auto 14px" }} />
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 12px 2px" }}>
          {{ teach: "Teaching Tools", classes: "My Classes", assess: "Assessment & Results", me: "My Account" }[openTray ?? ""] ?? openTray}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 8 }}>
          {trayItems?.map(item => (
            <button
              key={item.href}
              onClick={() => handleTrayItem(item.href)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 8, padding: "14px 6px", border: "none", borderRadius: 14,
                background: pathname.startsWith(item.href) ? "rgba(16,185,129,0.08)" : "#f9fafb",
                cursor: "pointer", fontFamily: "inherit",
                color: pathname.startsWith(item.href) ? C.accent : "#374151",
                transition: "background 0.15s",
              }}
            >
              {item.icon}
              <span style={{ fontSize: 10, fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 700,
        background: "#fff", borderTop: `1px solid ${C.border}`,
        display: "flex", height: 64, boxShadow: "0 -4px 20px rgba(0,0,0,0.07)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {NAV_TABS.map(t => {
          const isActive = t.id === activeId || openTray === t.id
          return (
            <button
              key={t.id}
              onClick={() => handleTab(t)}
              aria-label={t.id === "today" ? "Open Today" : `Open ${t.label} tools`}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 3,
                border: "none", background: "none", cursor: "pointer",
                padding: "8px 0", color: isActive ? C.accent : C.textMuted,
                transition: "color 0.15s", position: "relative",
              }}
            >
              {isActive && <div style={{ position: "absolute", top: 0, width: 28, height: 3, background: C.accent, borderRadius: "0 0 4px 4px" }} />}
              <span style={{ lineHeight: 1, position: "relative", zIndex: 1 }}>{NAV_ICONS[t.id]?.(isActive)}</span>
              <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 500, letterSpacing: 0.1, marginTop: 1, position: "relative", zIndex: 1 }}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

function TopBar({ school, initials, unreadConnect, creditBalance }: { school: string; initials: string; unreadConnect: number; creditBalance: number | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const isRoot = pathname === "/teacher" || pathname === "/teacher/" || pathname.startsWith("/teacher/pulse");

  return (
    <div style={{
      background: C.dark, color: "#fff", padding: "0 20px", height: 56,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      position: "sticky", top: 0, zIndex: 600, boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {!isRoot && (
          <div onClick={() => router.back()} style={{ cursor: "pointer", fontSize: 22, color: "#fff", lineHeight: 1, marginRight: 4, fontWeight: 400, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</div>
        )}
        <div onClick={() => router.push("/teacher")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#fff" }}>V</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>VibeSchool</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: -1 }}>{school || "Independent"}</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ position: "relative", cursor: "pointer", display: "flex", alignItems: "center" }} onClick={() => router.push("/teacher/vibeconnect")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          {unreadConnect > 0 && <span style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: C.error, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.dark}` }}>{unreadConnect}</span>}
        </div>
        <div onClick={() => router.push("/teacher/credits")} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(16,185,129,0.15)", borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>
          <span style={{ fontSize: 13 }}>🪙</span><span style={{ fontSize: 13, fontWeight: 800, color: "#10b981" }}>{creditBalance ?? "…"}</span>
        </div>
        <Avatar initials={initials || "…"} size={34} onClick={() => router.push("/teacher/profile")} style={{ cursor: "pointer" }} />
      </div>
    </div>
  );
}

function Toast({ msg }: { msg: string }) { return <div style={{ position: "fixed", bottom: 140, left: "50%", transform: "translateX(-50%)", background: C.dark, color: "#fff", padding: "11px 22px", borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 9999, animation: "fadeIn 0.2s ease", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", whiteSpace: "nowrap" }}>{msg}</div> }

function SearchParamWatcher({ onTwin }: { onTwin: () => void }) {
  const searchParams = useSearchParams();
  useEffect(() => { if (searchParams?.get("twin") === "1") onTwin(); }, [searchParams, onTwin]);
  return null;
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeId = tabIdFromPath(pathname);
  const isLimitedOnboardingPath = pathname.startsWith("/teacher/onboarding") || pathname === "/teacher/provisional";

  const [twinOpen, setTwinOpen] = useState(false);
  const [twinUnread, setTwinUnread] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [school, setSchool] = useState("");
  const [initials, setInitials] = useState("");
  const [fullName, setFullName] = useState("");
  const [unreadConnect, setUnreadConnect] = useState(0);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const teacherIdRef = useRef<string | null>(null);

  const refreshCredits = useCallback(() => {
    const uid = teacherIdRef.current;
    if (!uid) return;
    supabase.rpc("get_credit_balance", { p_teacher_id: uid }).then(({ data: creditData }) => {
      const result = creditData as { success?: boolean; balance?: number } | null;
      if (result?.success) setCreditBalance(result.balance ?? null);
    }, () => {});
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      try {
        if (isLimitedOnboardingPath) {
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (userError || !user) { router.replace(`/login/teacher?redirect=${encodeURIComponent(pathname)}`); return; }
          const [{ data: profileData, error: profileError }, { data: teacherData, error: teacherError }] = await Promise.all([
            supabase.from("profiles").select("full_name,account_status,is_anonymized").eq("id", user.id).single(),
            supabase.from("teacher_profiles").select("profile_id").eq("profile_id", user.id).maybeSingle(),
          ]);
          if (profileError || teacherError || !profileData || !teacherData?.profile_id || profileData.account_status !== "active" || profileData.is_anonymized) {
            router.replace("/auth/error?reason=teacher_authority_required");
            return;
          }
          const name = profileData.full_name ?? "";
          setFullName(name);
          const parts = name.trim().split(" ").filter(Boolean);
          setInitials(parts.slice(0, 2).map((word: string) => word[0].toUpperCase()).join(""));
          teacherIdRef.current = user.id;
          setAuthReady(true);
          return;
        }
        const authority = await getTwinAuthorityContext();
        const userId = authority.userId;

        const { data: profileData, error: profileErr } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .single();
        if (profileErr || !profileData) { router.replace("/?role=teacher"); return; }

        const name = profileData.full_name ?? "";
        setFullName(name);
        const parts = name.trim().split(" ").filter(Boolean);
        setInitials(parts.slice(0, 2).map((w: string) => w[0].toUpperCase()).join(""));

        const { data: teacherData, error: teacherErr } = await supabase
          .from("teacher_profiles")
          .select("school_id, profile_id")
          .eq("profile_id", userId)
          .maybeSingle();
        if (teacherErr) throw new Error(teacherErr.message || "Teacher profile could not be resolved.");

        const binding = selectTwinRoleBinding(authority, "teacher", teacherData?.school_id ?? undefined);
        const isOnboardingPath = window.location.pathname.startsWith("/teacher/onboarding");
        const schoolId = binding.schoolId;
        if (!teacherData?.profile_id && !isOnboardingPath && schoolId) {
          router.replace("/teacher/onboarding/school");
          return;
        }

        if (schoolId) {
          const { data: schoolData, error: schoolErr } = await supabase
            .from("schools")
            .select("name")
            .eq("id", schoolId)
            .maybeSingle();
          if (schoolErr) throw new Error(schoolErr.message || "Teacher school could not be resolved.");
          setSchool(schoolData?.name ?? "");
        }

        teacherIdRef.current = userId;
        refreshCredits();
        setAuthReady(true);
      } catch (error) {
        console.error("Teacher portal authority resolution failed:", error);
        router.replace("/?role=teacher");
      }
    }
    void fetchProfile();
  }, [isLimitedOnboardingPath, pathname, refreshCredits, router]);

  if (!authReady) return <div style={{ minHeight: "100vh", background: "#f8fafc" }} />;
  if (isLimitedOnboardingPath) return <>{children}</>;

  return (
    <ToastContext.Provider value={{ showToast }}>
      <UserContext.Provider value={{ fullName, initials, school }}>
        <CreditContext.Provider value={{ creditBalance, refreshCredits }}>
          <OfflineBar />
          <Suspense fallback={null}><SearchParamWatcher onTwin={() => setTwinOpen(true)} /></Suspense>
          <TopBar school={school} initials={initials} unreadConnect={unreadConnect} creditBalance={creditBalance} />
          <main style={{ minHeight: "calc(100vh - 120px)", paddingBottom: 84, background: "#f8fafc" }}>{children}</main>
          <TwinPill onOpen={() => setTwinOpen(true)} unread={twinUnread} />
          <BottomNav activeId={activeId} />
          <TwinDrawer open={twinOpen} onClose={() => setTwinOpen(false)} />
          {toast && <Toast msg={toast} />}
        </CreditContext.Provider>
      </UserContext.Provider>
    </ToastContext.Provider>
  );
}
