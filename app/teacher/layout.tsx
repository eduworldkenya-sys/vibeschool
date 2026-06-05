"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C, Avatar } from "@/components/teacher/ui";
import TwinDrawer from "@/components/teacher/TwinDrawer";
import OfflineBar from "@/components/teacher/OfflineBar";

interface ToastCtx { showToast: (msg: string) => void }
const ToastContext = createContext<ToastCtx>({ showToast: () => {} });
export const useToast = () => useContext(ToastContext);

interface UserCtx { fullName: string; initials: string; school: string }
const UserContext = createContext<UserCtx>({ fullName: '', initials: '', school: '' });
export const useUser = () => useContext(UserContext);

// ── Nav config — single source of truth ──────────────────────────────────────
const NAV_TABS = [
  { id: "classhub",   label: "ClassHub",  href: "/teacher" },
  { id: "vibelearn",  label: "VibeLearn", href: "/teacher/vibelearn"  },
  { id: "lessonplan", label: "Plans",     href: "/teacher/lessonplan" },
  { id: "assessment", label: "Assess",    href: "/teacher/assessment" },
  { id: "more",       label: "More",      href: "/teacher/more"       },
] as const;

type TabId = typeof NAV_TABS[number]["id"];

function tabIdFromPath(path: string): TabId {
  // /teacher root → classhub is home
  if (path === "/teacher" || path === "/teacher/") return "classhub";
  const match = NAV_TABS.find(t => path.startsWith(t.href));
  return (match?.id ?? "classhub") as TabId;
}

// ── SVG icons — currentColor, no hardcoded fills ─────────────────────────────
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
      <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
  );
}
function IconMore({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5"  cy="12" r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"/>
    </svg>
  );
}

const NAV_ICONS: Record<string, (active: boolean) => React.ReactNode> = {
  classhub:   (a) => <IconClassHub  size={a ? 23 : 21} />,
  vibelearn:  (a) => <IconVibeLearn size={a ? 23 : 21} />,
  lessonplan: (a) => <IconPlans     size={a ? 23 : 21} />,
  assessment: (a) => <IconAssess    size={a ? 23 : 21} />,
  more:       (a) => <IconMore      size={a ? 23 : 21} />,
};

// ── TwinPill ─────────────────────────────────────────────────────────────────
function TwinPill({ onOpen, unread }: { onOpen: () => void; unread: number }) {
  const [pos,      setPos]      = useState<{ x: number; y: number } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const dragging      = useRef(false)
  const startPointer  = useRef({ x: 0, y: 0 })
  const startPos      = useRef({ x: 0, y: 0 })
  const pillRef       = useRef<HTMLDivElement>(null)
  const moved         = useRef(false)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    setPos({ x: w / 2 - 28, y: h - 136 })
  }, [])

  useEffect(() => {
    if (expanded) {
      collapseTimer.current = setTimeout(() => setExpanded(false), 3000)
    }
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current)
    }
  }, [expanded])

  function onPointerDown(e: React.PointerEvent) {
    dragging.current     = true
    moved.current        = false
    startPointer.current = { x: e.clientX, y: e.clientY }
    startPos.current     = pos ?? { x: window.innerWidth / 2 - 28, y: window.innerHeight - 136 }
    pillRef.current?.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return
    const dx = e.clientX - startPointer.current.x
    const dy = e.clientY - startPointer.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true
    const w  = window.innerWidth
    const h  = window.innerHeight
    const pw = pillRef.current?.offsetWidth  ?? 56
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
    u.rate  = 0.88
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
          50%       { box-shadow: 0 0 0 8px rgba(16,185,129,0.0), 0 0 28px 8px rgba(16,185,129,0.55), 0 4px 24px rgba(30,27,75,0.4); }
        }
        @keyframes twinRingPulse {
          0%, 100% { transform: scale(1);    opacity: 0.6; }
          50%       { transform: scale(1.18); opacity: 0;   }
        }
        @keyframes twinExpand {
          from { opacity: 0; transform: scaleX(0.7) translateX(-10px); }
          to   { opacity: 1; transform: scaleX(1)   translateX(0);     }
        }
        @keyframes twinDotPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
      {!expanded && (
        <div style={{
          position:      'fixed',
          left:          pos.x - 8,
          top:           pos.y - 8,
          width:         SIZE + 16,
          height:        SIZE + 16,
          borderRadius:  '50%',
          border:        '2px solid rgba(16,185,129,0.45)',
          animation:     'twinRingPulse 2s ease-in-out infinite',
          zIndex:        748,
          pointerEvents: 'none',
        }} />
      )}
      <div
        ref={pillRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position:       'fixed',
          left:           expanded && pos.x + 56 > window.innerWidth / 2 ? pos.x - (180 - 56) : pos.x,
          top:            pos.y,
          zIndex:         750,
          width:          expanded ? 180 : SIZE,
          height:         SIZE,
          borderRadius:   expanded ? 32 : '50%',
          background:     'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #064e3b 100%)',
          border:         '1.5px solid rgba(16,185,129,0.5)',
          animation:      'twinGlow 2.4s ease-in-out infinite',
          cursor:         'grab',
          userSelect:     'none',
          touchAction:    'none',
          transition:     'width 0.28s cubic-bezier(0.34,1.56,0.64,1), border-radius 0.28s ease',
          display:        'flex',
          alignItems:     'center',
          justifyContent: expanded ? (pos.x + 56 > window.innerWidth / 2 ? 'flex-end' : 'flex-start') : 'center',
          overflow:       'hidden',
          paddingLeft:    expanded && pos.x + 56 <= window.innerWidth / 2 ? 8 : 0,
          paddingRight:   expanded && pos.x + 56 > window.innerWidth / 2 ? 8 : 0,
          gap:            expanded ? 8 : 0,
        }}
      >
        <div style={{
          flexShrink:     0,
          width:          40,
          height:         40,
          borderRadius:   '50%',
          background:     'radial-gradient(circle at 35% 35%, rgba(16,185,129,0.35), rgba(16,185,129,0.08))',
          border:         '1.5px solid rgba(16,185,129,0.6)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       18,
          color:          '#10b981',
          pointerEvents:  'none',
        }}>
          ✦
        </div>
        {expanded && (
          <div style={{ animation: 'twinExpand 0.22s ease', pointerEvents: 'none', minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1, whiteSpace: 'nowrap' }}>Your Twin</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
              {[0, 0.2, 0.4].map(delay => (
                <span key={delay} style={{
                  display:      'inline-block',
                  width:        5,
                  height:       5,
                  borderRadius: '50%',
                  background:   '#10b981',
                  animation:    `twinDotPulse 1.4s ease-in-out ${delay}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        {unread > 0 && (
          <div style={{
            position:       'absolute',
            top:            2,
            right:          2,
            width:          18,
            height:         18,
            borderRadius:   '50%',
            background:     '#ef4444',
            border:         '2px solid #0f172a',
            color:          '#fff',
            fontSize:       9,
            fontWeight:     800,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            pointerEvents:  'none',
          }}>
            {unread}
          </div>
        )}
      </div>
    </>
  )
}

// ── BottomNav ─────────────────────────────────────────────────────────────────
// ── Tray-item SVG icons ───────────────────────────────────────────────────
function IconAttendance({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <polyline points="16 11 18 13 22 9"/>
    </svg>
  )
}
function IconTimetable({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8"  y1="2" x2="8"  y2="6"/>
      <line x1="3"  y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function IconSchoolHub({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}
function IconIndexer({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8"  x2="11"   y2="14"/>
      <line x1="8"  y1="11" x2="14"   y2="11"/>
    </svg>
  )
}
function IconResources({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  )
}
function IconVibeConnect({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}
function IconScheme({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8"  y1="6"  x2="21" y2="6"/>
      <line x1="8"  y1="12" x2="21" y2="12"/>
      <line x1="8"  y1="18" x2="21" y2="18"/>
      <line x1="3"  y1="6"  x2="3.01" y2="6"/>
      <line x1="3"  y1="12" x2="3.01" y2="12"/>
      <line x1="3"  y1="18" x2="3.01" y2="18"/>
    </svg>
  )
}
function IconSubjectHub({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  )
}
function IconResults({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}
function IconReportCard({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="15" y2="17"/>
    </svg>
  )
}
function IconProfile({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}
function IconSettings({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}
function IconHelp({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}


function IconTPAD({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  )
}

// ── Tray config ────────────────────────────────────────────────────────────
interface TrayItem { label: string; icon: React.ReactNode; href: string }

const TRAY_ITEMS: Record<string, TrayItem[]> = {
  classhub: [
    { label: "Classes",    icon: <IconClassHub   size={24} />, href: "/teacher"               },
    { label: "Attendance", icon: <IconAttendance size={24} />, href: "/teacher/attendance"    },
    { label: "Timetable",  icon: <IconTimetable  size={24} />, href: "/teacher/timetable"     },
    { label: "SchoolHub",  icon: <IconSchoolHub  size={24} />, href: "/teacher/schoolhub"     },
  ],
  vibelearn: [
    { label: "VibeLearn",   icon: <IconVibeLearn   size={24} />, href: "/teacher/vibelearn"         },
    { label: "Indexer",     icon: <IconIndexer     size={24} />, href: "/teacher/vibelearn/indexer" },
    { label: "Resources",   icon: <IconResources   size={24} />, href: "/teacher/resources"         },
    { label: "VibeConnect", icon: <IconVibeConnect size={24} />, href: "/teacher/vibeconnect"       },
  ],
  lessonplan: [
    { label: "Lesson Plan", icon: <IconPlans      size={24} />, href: "/teacher/lessonplan"  },
    { label: "Scheme",      icon: <IconScheme     size={24} />, href: "/teacher/scheme"      },
    { label: "SubjectHub",  icon: <IconSubjectHub size={24} />, href: "/teacher/subjecthub"  },
    { label: "Notes",       icon: <IconVibeLearn  size={24} />, href: "/teacher/lessonnotes" },
  ],
  assessment: [
    { label: "Assessment",   icon: <IconAssess     size={24} />, href: "/teacher/assessment"              },
    { label: "Results",      icon: <IconResults    size={24} />, href: "/teacher/results"                 },
    { label: "Report Cards", icon: <IconReportCard size={24} />, href: "/teacher/results/report-card/all" },
    { label: "Students",     icon: <IconAttendance size={24} />, href: "/teacher/students"                },
  ],
  more: [
    { label: "Profile",  icon: <IconProfile  size={24} />, href: "/teacher/profile"  },
    { label: "Settings", icon: <IconSettings size={24} />, href: "/teacher/settings" },
    { label: "TPAD",     icon: <IconTPAD     size={24} />, href: "/teacher/tpad"     },
    { label: "Help",     icon: <IconHelp     size={24} />, href: "/teacher/help"     },
  ],
}

// ── BottomNav ─────────────────────────────────────────────────────────────
function BottomNav({ activeId, unreadLearn = 0 }: { activeId: string; unreadLearn?: number }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [openTray, setOpenTray] = useState<string | null>(null)

  useEffect(() => { setOpenTray(null) }, [pathname])

  function handleTab(t: typeof NAV_TABS[number]) {
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
        <div
          onClick={() => setOpenTray(null)}
          style={{ position: "fixed", inset: 0, zIndex: 690, background: "rgba(0,0,0,0.2)" }}
        />
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
          {NAV_TABS.find(t => t.id === openTray)?.label}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${trayItems?.length ?? 4}, 1fr)`, gap: 8 }}>
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
              <span style={{ fontSize: 10, fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>
                {item.label}
              </span>
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
          const isActive  = t.id === activeId || openTray === t.id
          const showBadge = t.id === "vibelearn" && unreadLearn > 0
          return (
            <button
              key={t.id}
              onClick={() => handleTab(t)}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 3,
                border: "none", background: "none", cursor: "pointer",
                padding: "8px 0", color: isActive ? C.accent : C.textMuted,
                transition: "color 0.15s", position: "relative",
              }}
            >
              {isActive && (
                <div style={{ position: "absolute", top: 0, width: 28, height: 3, background: C.accent, borderRadius: "0 0 4px 4px" }} />
              )}
              {t.id === "vibelearn" && isActive && (
                <div style={{ position: "absolute", width: 44, height: 44, borderRadius: "50%", background: "rgba(16,185,129,0.08)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
              )}
              {showBadge && (
                <span style={{ position: "absolute", top: 6, right: "calc(50% - 18px)", width: 16, height: 16, borderRadius: "50%", background: C.error, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
                  {unreadLearn}
                </span>
              )}
              <span style={{ lineHeight: 1 }}>{NAV_ICONS[t.id]?.(isActive)}</span>
              <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 500, letterSpacing: 0.1, marginTop: 1 }}>
                {t.label}
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}

// ── TopBar — VibeConnect icon + Avatar only ───────────────────────────────────
function TopBar({ school, initials, unreadConnect }: { school: string; initials: string; unreadConnect: number }) {
  const router   = useRouter();
  const pathname = usePathname();
  const isRoot   = pathname === "/teacher" || pathname === "/teacher/" || pathname === "/teacher";

  return (
    <div style={{
      background:      C.dark,
      color:           "#fff",
      padding:         "0 20px",
      height:          56,
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "space-between",
      position:        "sticky",
      top:             0,
      zIndex:          600,
      boxShadow:       "0 2px 12px rgba(0,0,0,0.18)",
    }}>
      {/* Left — back chevron or logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {!isRoot && (
          <div
            onClick={() => router.back()}
            style={{ cursor: "pointer", fontSize: 24, color: "#fff", lineHeight: 1, marginRight: 4, fontWeight: 300 }}
          >
            ‹
          </div>
        )}
        <div
          onClick={() => router.push("/teacher")}
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: C.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 900, color: "#fff",
          }}>
            V
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>VibeSchool</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: -1 }}>
              {school || "Independent"}
            </div>
          </div>
        </div>
      </div>

      {/* Right — VibeConnect + Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* VibeConnect — always visible, badge only when unread */}
        <div
          style={{ position: "relative", cursor: "pointer", display: "flex", alignItems: "center" }}
          onClick={() => router.push("/teacher/vibelearn")}
        >
          <svg
            width="22" height="22" viewBox="0 0 24 24"
            fill="none" stroke="rgba(255,255,255,0.75)"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {unreadConnect > 0 && (
            <span style={{
              position:     "absolute",
              top:          -4,
              right:        -4,
              width:        16,
              height:       16,
              borderRadius: "50%",
              background:   C.error,
              color:        "#fff",
              fontSize:     9,
              fontWeight:   800,
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              border:       `2px solid ${C.dark}`,
            }}>
              {unreadConnect}
            </span>
          )}
        </div>

        {/* Avatar → Profile */}
        <Avatar
          initials={initials || "…"}
          size={34}
          onClick={() => router.push("/teacher/profile")}
          style={{ cursor: "pointer" }}
        />
      </div>
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  return (
    <div style={{
      position:   "fixed",
      bottom:     140,
      left:       "50%",
      transform:  "translateX(-50%)",
      background: C.dark,
      color:      "#fff",
      padding:    "11px 22px",
      borderRadius: 12,
      fontSize:   13,
      fontWeight: 600,
      zIndex:     9999,
      animation:  "fadeIn 0.2s ease",
      boxShadow:  "0 8px 24px rgba(0,0,0,0.18)",
      whiteSpace: "nowrap",
    }}>
      {msg}
    </div>
  );
}

// ── Root layout ───────────────────────────────────────────────────────────────
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeId = tabIdFromPath(pathname);

  const [twinOpen,      setTwinOpen]      = useState(false);
  const [toast,         setToast]         = useState<string | null>(null);
  const [school,        setSchool]        = useState("");
  const [initials,      setInitials]      = useState("");
  const [fullName,      setFullName]      = useState("");
  const [unreadConnect, setUnreadConnect] = useState(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) { window.location.href = "/academy/signin"; return; }
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("full_name, school_id, role")
        .eq("id", user.id)
        .single();
      if (profileErr || !profileData || profileData.role !== "teacher") { window.location.href = "/academy/signin"; return; }
      const name  = profileData.full_name ?? "";
      setFullName(name);
      const parts   = name.trim().split(" ").filter(Boolean);
      const derived = parts.slice(0, 2).map((w: string) => w[0].toUpperCase()).join("");
      setInitials(derived);
      const schoolId = profileData.school_id;
      if (schoolId) {
        const { data: schoolData } = await supabase
          .from("schools")
          .select("name")
          .eq("id", schoolId)
          .single();
        setSchool(schoolData?.name ?? "");
      }
      // Unread VibeConnect count
      const { data: participation } = await supabase
        .from('vc_participants')
        .select('thread_id, last_read_at')
        .eq('profile_id', user.id);

      const threadIds = (participation ?? []).map((p: { thread_id: string }) => p.thread_id);
      let unread = 0;
      if (threadIds.length > 0) {
        const readMap: Record<string, string> = {};
        (participation ?? []).forEach((p: { thread_id: string; last_read_at: string | null }) => {
          readMap[p.thread_id] = p.last_read_at ?? '1970-01-01T00:00:00Z';
        });
        const counts = await Promise.all(
          threadIds.map(async (tid: string) => {
            const { count } = await supabase
              .from('vc_messages')
              .select('id', { count: 'exact', head: true })
              .eq('thread_id', tid)
              .neq('sender_id', user.id)
              .gt('created_at', readMap[tid]);
            return (count ?? 0) > 0 ? 1 : 0;
          })
        );
        unread = counts.reduce((a: number, b: number) => a + b, 0);
      }
      setUnreadConnect(unread);
    }
    fetchProfile();
  }, [pathname]);

  const userCtx: UserCtx = { fullName, initials, school };

  return (
    <ToastContext.Provider value={{ showToast }}>
      <UserContext.Provider value={userCtx}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f0f2f5; overflow-y: auto; -webkit-overflow-scrolling: touch; }
          @keyframes twinPulse { 0%,80%,100%{ transform:scale(0.7); opacity:0.5 } 40%{ transform:scale(1); opacity:1 } }
          @keyframes slideIn   { from{ opacity:0; transform:translateY(10px) } to{ opacity:1; transform:translateY(0) } }
          @keyframes fadeIn    { from{ opacity:0 } to{ opacity:1 } }
          @keyframes shimmer   { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }
          ::-webkit-scrollbar { width: 5px; }
          ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
        `}</style>
        <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
          <TopBar school={school} initials={initials} unreadConnect={unreadConnect} />
              <OfflineBar />
          <main style={{
            maxWidth:      768,
            margin:        "0 auto",
            padding:       "clamp(12px, 3vw, 20px) clamp(12px, 4vw, 20px) 0",
            paddingBottom: 160,
            minHeight:     "calc(100vh - 120px)",
          }}>
            {children}
          </main>
          <TwinPill onOpen={() => setTwinOpen(true)} unread={twinOpen ? 0 : 1} />
          <TwinDrawer open={twinOpen} onClose={() => setTwinOpen(false)} />
          <BottomNav activeId={activeId} />
          {toast && <Toast msg={toast} />}
        </div>
      </UserContext.Provider>
    </ToastContext.Provider>
  );
}
