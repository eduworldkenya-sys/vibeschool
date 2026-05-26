"use client";
import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C, Avatar } from "@/components/teacher/ui";
import TwinDrawer from "@/components/teacher/TwinDrawer";

interface ToastCtx { showToast: (msg: string) => void }
const ToastContext = createContext<ToastCtx>({ showToast: () => {} });
export const useToast = () => useContext(ToastContext);

interface UserCtx { fullName: string; initials: string; school: string }
const UserContext = createContext<UserCtx>({ fullName: '', initials: '', school: '' });
export const useUser = () => useContext(UserContext);

const NAV_TABS = [
  { id: "classhub",   label: "ClassHub", icon: "nav_classhub",   href: "/teacher/classhub"   },
  { id: "vibelearn",  label: "Learn",    icon: "nav_learn",      href: "/teacher/vibelearn"  },
  { id: "lessonplan", label: "Studio",   icon: "nav_studio",     href: "/teacher/lessonplan" },
  { id: "assessment", label: "Assess",   icon: "nav_assess",     href: "/teacher/assessment" },
];

const SVG: Record<string, React.ReactNode> = {
  attendance: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  homework:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  classes:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  invite:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  lesson:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  scheme:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  notes:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  resources:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  assess:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  results:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  strands:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/></svg>,
  exam:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><path d="M9 12h6M9 16h4"/></svg>,

  nav_classhub: (
    <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
      <rect x="6" y="20" width="36" height="24" rx="3" fill="#f97316"/>
      <rect x="14" y="28" width="8" height="10" rx="1.5" fill="#fff7ed"/>
      <rect x="26" y="28" width="8" height="10" rx="1.5" fill="#fff7ed"/>
      <polygon points="4,22 24,6 44,22" fill="#1e1b4b"/>
      <rect x="20" y="6" width="8" height="8" rx="1" fill="#f97316"/>
      <circle cx="36" cy="14" r="3" fill="#fbbf24"/>
      <line x1="36" y1="11" x2="36" y2="6" stroke="#fbbf24" strokeWidth="1.5"/>
    </svg>
  ),
  nav_learn: (
    <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
      <ellipse cx="24" cy="38" rx="14" ry="4" fill="#1e1b4b"/>
      <path d="M10 26 L24 20 L38 26 L24 32 Z" fill="#1e1b4b"/>
      <path d="M38 26 L38 34" stroke="#1e1b4b" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="38" cy="36" r="3" fill="#1e1b4b"/>
      <path d="M14 28.5 L14 36 Q24 40 34 36 L34 28.5" fill="#4ade80" opacity="0.85"/>
    </svg>
  ),
  nav_studio: (
    <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="26" r="14" fill="#f97316"/>
      <circle cx="19" cy="21" r="4" fill="#fff"/>
      <circle cx="29" cy="21" r="4" fill="#ef4444"/>
      <circle cx="19" cy="31" r="4" fill="#fbbf24"/>
      <circle cx="29" cy="31" r="4" fill="#22c55e"/>
      <circle cx="24" cy="26" r="3" fill="#1e1b4b"/>
      <path d="M24 12 Q28 8 32 10 Q30 14 26 13 Z" fill="#1e1b4b"/>
    </svg>
  ),
  nav_assess: (
    <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="28" width="8" height="14" rx="2" fill="#1e1b4b"/>
      <rect x="20" y="18" width="8" height="24" rx="2" fill="#f97316"/>
      <rect x="32" y="10" width="8" height="32" rx="2" fill="#22c55e"/>
    </svg>
  ),
};

const NAV_SHEETS: Record<string, { icon: string; label: string; href: string; desc: string }[]> = {
  classhub: [
    { icon: "attendance", label: "Mark Attendance",  href: "/teacher/attendance",  desc: "Today's register" },
    { icon: "homework",   label: "Set Homework",     href: "/teacher/classhub",    desc: "Assign to a class" },
    { icon: "classes",    label: "My Classes",       href: "/teacher/classhub",    desc: "All classes overview" },
    { icon: "invite",     label: "Invite Students",  href: "/teacher/classhub",    desc: "Share join codes" },
  ],
  lessonplan: [
    { icon: "lesson",     label: "New Lesson Plan",  href: "/teacher/lessonplan",  desc: "AI-powered generator" },
    { icon: "scheme",     label: "Scheme of Work",   href: "/teacher/lessonplan",  desc: "Term planner" },
    { icon: "notes",      label: "My Notes",         href: "/teacher/lessonplan",  desc: "Teaching notes" },
    { icon: "resources",  label: "Resources",        href: "/teacher/resources",   desc: "Files & materials" },
  ],
  assessment: [
    { icon: "assess",     label: "Record Assessment",href: "/teacher/assessment",  desc: "CBC performance entry" },
    { icon: "results",    label: "Class Performance",href: "/teacher/assessment",  desc: "Trends & averages" },
    { icon: "strands",    label: "CBC Strands",      href: "/teacher/assessment",  desc: "Strand progress" },
    { icon: "exam",       label: "Exam Results",     href: "/teacher/assessment",  desc: "Test scores" },
  ],
};

function tabIdFromPath(path: string): string {
  if (path === "/teacher" || path === "/teacher/") return "home";
  const match = NAV_TABS.find(t => t.href !== "/teacher" && path.startsWith(t.href));
  return match?.id ?? "home";
}

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

  function onPointerUp() {
    dragging.current = false
    if (moved.current) return
    if (expanded) {
      if (collapseTimer.current) clearTimeout(collapseTimer.current)
      setExpanded(false)
      onOpen()
    } else {
      setExpanded(true)
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

function BottomNav({ activeId, unreadConnect }: { activeId: string; unreadConnect: number }) {
  const router   = useRouter();
  const [sheet, setSheet] = useState<string | null>(null);

  function handleTab(t: typeof NAV_TABS[0]) {
    if (t.id === "vibelearn") { router.push(t.href); setSheet(null); return; }
    if (NAV_SHEETS[t.id]) {
      if (sheet === t.id) { router.push(t.href); setSheet(null); }
      else { setSheet(t.id); }
    } else {
      router.push(t.href); setSheet(null);
    }
  }

  return (
    <>
      {/* ── PEEK SHEET ── */}
      {sheet && (
        <>
          {/* backdrop */}
          <div
            onClick={() => setSheet(null)}
            style={{ position:"fixed", inset:0, zIndex:698, background:"rgba(0,0,0,0.18)", backdropFilter:"blur(2px)", animation:"fadeIn 0.18s ease" }}
          />
          {/* sheet */}
          <div style={{
            position:"fixed", bottom:64, left:0, right:0, zIndex:699,
            background:"#fff", borderRadius:"20px 20px 0 0",
            boxShadow:"0 -8px 40px rgba(0,0,0,0.12)",
            padding:"8px 0 12px",
            animation:"sheetUp 0.22s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            <style>{`
              @keyframes sheetUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
              @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
            `}</style>
            {/* handle */}
            <div style={{ width:36, height:4, borderRadius:2, background:"#e5e7eb", margin:"4px auto 16px" }} />
            {/* title */}
            <div style={{ fontSize:11, fontWeight:800, color:"#9ca3af", letterSpacing:1.6, textTransform:"uppercase", paddingLeft:20, marginBottom:12 }}>
              {NAV_TABS.find(t => t.id === sheet)?.label}
            </div>
            {/* actions grid */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, padding:"0 14px 8px" }}>
              {(NAV_SHEETS[sheet] ?? []).map(a => (
                <button
                  key={a.label}
                  onClick={() => { router.push(a.href); setSheet(null); }}
                  style={{
                    display:"flex", alignItems:"center", gap:12,
                    padding:"14px 14px", borderRadius:16,
                    border:"1px solid #f0ece6", background:"#fafaf9",
                    cursor:"pointer", textAlign:"left", fontFamily:"inherit",
                    transition:"transform 0.12s ease, background 0.12s ease",
                  }}
                  onPointerDown={e => (e.currentTarget.style.transform="scale(0.96)")}
                  onPointerUp={e => (e.currentTarget.style.transform="scale(1)")}
                  onPointerLeave={e => (e.currentTarget.style.transform="scale(1)")}
                >
                  <span style={{ color:"#1e1b4b", flexShrink:0, display:"flex", alignItems:"center" }}>{SVG[a.icon]}</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:"#111827", lineHeight:1.2 }}>{a.label}</div>
                    <div style={{ fontSize:10, color:"#9ca3af", marginTop:2 }}>{a.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            {/* go to full page */}
            <button
              onClick={() => { const t = NAV_TABS.find(x => x.id === sheet); if(t) router.push(t.href); setSheet(null); }}
              style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, width:"calc(100% - 28px)", margin:"4px 14px 0", padding:"12px", borderRadius:14, border:"none", background:"#1e1b4b", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}
            >
              Open {NAV_TABS.find(t => t.id === sheet)?.label} <span style={{ fontSize:16 }}>→</span>
            </button>
          </div>
        </>
      )}

      {/* ── TAB BAR ── */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:700, background:"#fff", borderTop:`1px solid ${C.border}`, display:"flex", height:64, boxShadow:"0 -2px 12px rgba(0,0,0,0.06)" }}>
        {NAV_TABS.map(t => {
          const isActive  = t.id === activeId;
          const isOpen    = sheet === t.id;
          const badge     = t.id === "vibeconnect" ? unreadConnect : 0;
          return (
            <button
              key={t.id}
              onClick={() => handleTab(t)}
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, border:"none", background:"none", cursor:"pointer", padding:"8px 0", color: isActive || isOpen ? C.accent : C.textMuted, transition:"color 0.15s", position:"relative" }}
            >
              {badge > 0 && <span style={{ position:"absolute", top:6, right:"calc(50% - 14px)", width:16, height:16, borderRadius:"50%", background:C.error, color:"#fff", fontSize:9, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>{badge}</span>}
              <span style={{ lineHeight:1, transition:"transform 0.15s ease", transform: isOpen ? "translateY(-2px)" : "translateY(0)", display:"flex", alignItems:"center", justifyContent:"center" }}>{SVG[t.icon]}</span>
              <span style={{ fontSize:10, fontWeight: isActive || isOpen ? 800 : 600, letterSpacing:0.2 }}>{t.label}</span>
              {(isActive || isOpen) && <div style={{ position:"absolute", top:0, width:28, height:2.5, background:C.accent, borderRadius:"0 0 3px 3px" }} />}
            </button>
          );
        })}
      </div>
    </>
  );
}

function TopBar({ school, initials, unreadConnect }: { school: string; initials: string; unreadConnect: number }) {
  const router   = useRouter();
  const pathname = usePathname();
  const isHome   = pathname === "/teacher" || pathname === "/teacher/";
  return (
    <div style={{ background: C.dark, color: "#fff", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 600, boxShadow: "0 2px 12px rgba(0,0,0,0.18)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {!isHome && (
          <div onClick={() => router.back()} style={{ cursor: "pointer", fontSize: 24, color: "#fff", lineHeight: 1, marginRight: 4, fontWeight: 300 }}>‹</div>
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
        {unreadConnect > 0 && (
          <div style={{ position: "relative", cursor: "pointer" }} onClick={() => router.push("/teacher/vibeconnect")}>
            <span style={{ fontSize: 20 }}>💬</span>
            <span style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: C.error, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{unreadConnect}</span>
          </div>
        )}
        <Avatar initials={initials || "…"} size={34} onClick={() => router.push("/teacher/profile")} style={{ cursor: "pointer" }} />
      </div>
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  return <div style={{ position: "fixed", bottom: 140, left: "50%", transform: "translateX(-50%)", background: C.dark, color: "#fff", padding: "11px 22px", borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 9999, animation: "fadeIn 0.2s ease", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", whiteSpace: "nowrap" }}>{msg}</div>;
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
      if (userErr || !user) return;
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("full_name, school_id")
        .eq("id", user.id)
        .single();
      if (profileErr || !profileData) return;
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
      const { data: participation } = await supabase
        .from('vc_participants')
        .select('thread_id, last_read_at')
        .eq('profile_id', user.id)

      const threadIds = (participation ?? []).map((p: { thread_id: string }) => p.thread_id)
      let unread = 0
      if (threadIds.length > 0) {
        const readMap: Record<string, string> = {}
        ;(participation ?? []).forEach((p: { thread_id: string; last_read_at: string | null }) => {
          readMap[p.thread_id] = p.last_read_at ?? '1970-01-01T00:00:00Z'
        })
        const counts = await Promise.all(
          threadIds.map(async (tid: string) => {
            const { count } = await supabase
              .from('vc_messages')
              .select('id', { count: 'exact', head: true })
              .eq('thread_id', tid)
              .neq('sender_id', user.id)
              .gt('created_at', readMap[tid])
            return (count ?? 0) > 0 ? 1 : 0
          })
        )
        unread = counts.reduce((a: number, b: number) => a + b, 0)
      }
      setUnreadConnect(unread)
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
          <BottomNav activeId={activeId} unreadConnect={unreadConnect} />
          {toast && <Toast msg={toast} />}
        </div>
      </UserContext.Provider>
    </ToastContext.Provider>
  );
}
