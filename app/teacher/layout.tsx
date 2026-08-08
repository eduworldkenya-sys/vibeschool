"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useRef, useCallback, createContext, useContext, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
    path.startsWith("/teacher/vibelearn") ||
    path.startsWith("/teacher/studio")
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
        @keyframes twinLabelIn {
          from { opacity: 0; transform: translateX(-8px) scale(0.9); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes twinBreath {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
      `}</style>
      <div
        ref={pillRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragging.current = false }}
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          zIndex: 9999,
          display: 'flex', alignItems: 'center',
          cursor: dragging.current ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
        }}
        title="VibeTwin — drag me or tap to chat"
      >
        <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
          <div style={{
            position: 'absolute', inset: -4, borderRadius: '50%',
            border: '2px solid rgba(16,185,129,0.4)',
            animation: 'twinRingPulse 2.4s ease-in-out infinite',
          }} />
          <div style={{
            width: SIZE, height: SIZE, borderRadius: '50%',
            background: 'linear-gradient(145deg, #10b981 0%, #059669 55%, #064e3b 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '3px solid rgba(255,255,255,0.9)',
            animation: 'twinGlow 2.8s ease-in-out infinite, twinBreath 3s ease-in-out infinite',
            boxSizing: 'border-box',
          }}>
            <span style={{ fontSize: 21, fontWeight: 900, color: '#fff', lineHeight: 1, fontFamily: 'system-ui' }}>V</span>
          </div>
          {unread > 0 && (
            <div style={{
              position: 'absolute', top: -3, right: -3,
              minWidth: 18, height: 18, borderRadius: 9,
              background: '#ef4444', color: '#fff', fontSize: 10,
              fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #fff', padding: '0 4px', boxSizing: 'border-box',
            }}>{unread > 9 ? '9+' : unread}</div>
          )}
        </div>

        {expanded && (
          <div style={{
            marginLeft: 8,
            background: 'linear-gradient(135deg,#064e3b,#10b981)',
            color: '#fff', borderRadius: '16px 16px 16px 4px',
            padding: '9px 14px', fontSize: 12, fontWeight: 700,
            whiteSpace: 'nowrap',
            boxShadow: '0 6px 24px rgba(6,78,59,0.35)',
            border: '1px solid rgba(255,255,255,0.25)',
            animation: 'twinLabelIn 0.25s ease-out',
            pointerEvents: 'none',
          }}>
            VibeTwin · Tap to ask
          </div>
        )}
      </div>
    </>
  )
}

function IconPulse({ size = 22 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>; }
function IconTeach({ size = 22 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 19.5A2.5 2.5 0 0 1 5.5 17H20"/><path d="M5.5 2H20v20H5.5A2.5 2.5 0 0 1 3 19.5v-15A2.5 2.5 0 0 1 5.5 2z"/></svg>; }
function IconStudents({ size = 22 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>; }
function IconMe({ size = 22 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg>; }

// ... rest of the original file remains unchanged below this line
