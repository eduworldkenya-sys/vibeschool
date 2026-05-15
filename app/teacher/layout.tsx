"use client";
<<<<<<< Updated upstream
import { useState, useEffect, useRef, useCallback } from "react";
=======
import { useState, useEffect, createContext, useContext, useCallback } from "react";
>>>>>>> Stashed changes
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { VIBECONNECT_THREADS } from "@/lib/data";
import { C, Avatar } from "@/components/teacher/ui";
import TwinDrawer from "@/components/teacher/TwinDrawer";
import { createContext, useContext } from "react";

<<<<<<< Updated upstream
// ─── Toast context ─────────────────────────────────────────────────────────────
interface ToastCtx { showToast: (msg: string) => void }
const ToastContext = createContext<ToastCtx>({ showToast: () => {} });
export const useToast = () => useContext(ToastContext);

// ─── Nav config ────────────────────────────────────────────────────────────────
=======
interface ToastCtx { showToast: (msg: string) => void; }
const ToastContext = createContext<ToastCtx>({ showToast: () => {} });
export const useToast = () => useContext(ToastContext);

interface UserCtx { fullName: string; initials: string; school: string; }
const UserContext = createContext<UserCtx>({ fullName: '', initials: '', school: '' });
export const useUser = () => useContext(UserContext);

>>>>>>> Stashed changes
const NAV_TABS = [
  { id: "home",        label: "Home",        icon: "🏠", href: "/teacher"             },
  { id: "lessonplan",  label: "Plans",        icon: "📖", href: "/teacher/lessonplan"  },
  { id: "vibeconnect", label: "VibeConnect",  icon: "💬", href: "/teacher/vibeconnect" },
  { id: "more",        label: "More",         icon: "⋯",  href: "/teacher/more"        },
  { id: "profile",     label: "Profile",      icon: "👤", href: "/teacher/profile"     },
];

function tabIdFromPath(path: string): string {
  if (path === "/teacher" || path === "/teacher/") return "home";
  const match = NAV_TABS.find(t => t.href !== "/teacher" && path.startsWith(t.href));
  return match?.id ?? "home";
}

<<<<<<< Updated upstream
// ─── Draggable Twin Pill ───────────────────────────────────────────────────────
=======
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
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
          left:           pos.x,
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
          justifyContent: expanded ? 'flex-start' : 'center',
          overflow:       'hidden',
          paddingLeft:    expanded ? 8 : 0,
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
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1, whiteSpace: 'nowrap' }}>
              Your Twin
            </div>
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
=======
    <div onClick={onOpen} style={{ position: "fixed", bottom: 68, left: "50%", transform: "translateX(-50%)", zIndex: 750, background: C.dark, borderRadius: 40, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 24px rgba(30,27,75,0.32)", cursor: "pointer", userSelect: "none", border: "1.5px solid rgba(16,185,129,0.3)", transition: "box-shadow 0.2s, transform 0.2s", minWidth: 220, justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(16,185,129,0.18)", border: "1.5px solid rgba(16,185,129,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.accent }}>✦</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", lineHeight: 1 }}>Your Twin</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Tap to open</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {unread > 0 ? (
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: C.error, color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{unread}</span>
        ) : (
          [0, 0.2, 0.4].map(delay => (
            <span key={delay} style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: C.accent, margin: "0 2px", animation: `twinPulse 1.4s ease-in-out ${delay}s infinite` }} />
          ))
>>>>>>> Stashed changes
        )}
      </div>
    </>
  )
}

<<<<<<< Updated upstream
// ─── Bottom nav ────────────────────────────────────────────────────────────────
=======
>>>>>>> Stashed changes
function BottomNav({ activeId, unreadConnect }: { activeId: string; unreadConnect: number }) {
  const router = useRouter();
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 700, background: "#fff", borderTop: `1px solid ${C.border}`, display: "flex", height: 64, boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" }}>
      {NAV_TABS.map(t => {
        const isActive = t.id === activeId;
        const badge = t.id === "vibeconnect" ? unreadConnect : 0;
        return (
          <button key={t.id} onClick={() => router.push(t.href)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, border: "none", background: "none", cursor: "pointer", padding: "8px 0", color: isActive ? C.accent : C.textMuted, transition: "color 0.15s", position: "relative" }}>
            {badge > 0 && <span style={{ position: "absolute", top: 6, right: "calc(50% - 14px)", width: 16, height: 16, borderRadius: "50%", background: C.error, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>}
            <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600, letterSpacing: 0.2 }}>{t.label}</span>
            {isActive && <div style={{ position: "absolute", top: 0, width: 28, height: 2.5, background: C.accent, borderRadius: "0 0 3px 3px" }} />}
          </button>
        );
      })}
    </div>
  );
}

<<<<<<< Updated upstream
// ─── Top bar ───────────────────────────────────────────────────────────────────
function TopBar({ school, initials, unreadConnect }: { school: string; initials: string; unreadConnect: number }) {
  const router   = useRouter();
=======
function TopBar({ unreadConnect, initials, school }: { unreadConnect: number; initials: string; school: string }) {
  const router = useRouter();
>>>>>>> Stashed changes
  const pathname = usePathname();
  const isHome   = pathname === "/teacher" || pathname === "/teacher/";
  return (
    <div style={{ background: C.dark, color: "#fff", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 600, boxShadow: "0 2px 12px rgba(0,0,0,0.18)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
<<<<<<< Updated upstream
        {!isHome && (
          <div onClick={() => router.back()} style={{ cursor: "pointer", fontSize: 24, color: "#fff", lineHeight: 1, marginRight: 4, fontWeight: 300 }}>‹</div>
        )}
        <div style={{ width: 30, height: 30, borderRadius: 9, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#fff" }}>V</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>VibeSchool</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: -1 }}>
            {school || "Loading…"}
          </div>
=======
        {!isHome && <div onClick={() => router.back()} style={{ cursor: "pointer", fontSize: 24, color: "#fff", lineHeight: 1, marginRight: 4, fontWeight: 300 }}>‹</div>}
        <div style={{ width: 30, height: 30, borderRadius: 9, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#fff" }}>V</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>VibeSchool</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: -1 }}>{school || 'Loading...'}</div>
>>>>>>> Stashed changes
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {unreadConnect > 0 && (
          <div style={{ position: "relative", cursor: "pointer" }} onClick={() => router.push("/teacher/vibeconnect")}>
            <span style={{ fontSize: 20 }}>💬</span>
            <span style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: C.error, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{unreadConnect}</span>
          </div>
        )}
<<<<<<< Updated upstream
        <Avatar
          initials={initials || "…"}
          size={34}
          onClick={() => router.push("/teacher/profile")}
          style={{ cursor: "pointer" }}
        />
=======
        <Avatar initials={initials || '?'} size={34} onClick={() => router.push("/teacher/profile")} style={{ cursor: "pointer" }} />
>>>>>>> Stashed changes
      </div>
    </div>
  );
}

<<<<<<< Updated upstream
// ─── Toast ─────────────────────────────────────────────────────────────────────
=======
>>>>>>> Stashed changes
function Toast({ msg }: { msg: string }) {
  return <div style={{ position: "fixed", bottom: 140, left: "50%", transform: "translateX(-50%)", background: C.dark, color: "#fff", padding: "11px 22px", borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 9999, animation: "fadeIn 0.2s ease", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", whiteSpace: "nowrap" }}>{msg}</div>;
}

<<<<<<< Updated upstream
// ─── Layout ────────────────────────────────────────────────────────────────────
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname      = usePathname();
  const activeId      = tabIdFromPath(pathname);
  const unreadConnect = VIBECONNECT_THREADS.reduce((a, t) => a + t.unread, 0);

  const [twinOpen, setTwinOpen] = useState(false);
  const [toast,    setToast]    = useState<string | null>(null);
  const [school,   setSchool]   = useState("");
  const [initials, setInitials] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, school_id")
          .eq("id", user.id)
          .single(),
      ]);

      const fullName = profileRes.data?.full_name ?? "";
      const parts    = fullName.trim().split(" ").filter(Boolean);
      const derived  = parts.slice(0, 2).map((w: string) => w[0].toUpperCase()).join("");
      setInitials(derived);

      const schoolId = profileRes.data?.school_id;
      if (schoolId) {
        const schoolRes = await supabase
          .from("schools")
          .select("name")
          .eq("id", schoolId)
          .single();
        setSchool(schoolRes.data?.name ?? "");
      }
    }
    fetchProfile();
  }, []);
=======
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeId = tabIdFromPath(pathname);
  const unreadConnect = VIBECONNECT_THREADS.reduce((a, t) => a + t.unread, 0);

  const [twinOpen, setTwinOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [user, setUser] = useState<UserCtx>({ fullName: '', initials: '', school: '' });
>>>>>>> Stashed changes

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    async function loadUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, school_id')
        .eq('id', authUser.id)
        .single();

      const fullName = profile?.full_name ?? '';
      const parts = fullName.trim().split(' ').filter(Boolean);
      const initials = parts.slice(0, 2).map((w: string) => w[0].toUpperCase()).join('') || '?';

      let school = '';
      if (profile?.school_id) {
        const { data: schoolData } = await supabase
          .from('schools')
          .select('name')
          .eq('id', profile.school_id)
          .single();
        school = schoolData?.name ?? '';
      }

      setUser({ fullName, initials, school });
    }
    loadUser();
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
<<<<<<< Updated upstream
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f0f2f5; }
        @keyframes twinPulse { 0%,80%,100%{ transform:scale(0.7); opacity:0.5 } 40%{ transform:scale(1); opacity:1 } }
        @keyframes slideIn   { from{ opacity:0; transform:translateY(10px) } to{ opacity:1; transform:translateY(0) } }
        @keyframes fadeIn    { from{ opacity:0 } to{ opacity:1 } }
        @keyframes shimmer   { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
      `}</style>

      <div style={{ minHeight: "100vh", overflowY: "auto", WebkitOverflowScrolling: "touch" as const, background: "#f0f2f5" }}>
        <TopBar school={school} initials={initials} unreadConnect={unreadConnect} />

        <main style={{
          maxWidth: 768,
          margin: "0 auto",
          padding: "clamp(12px, 3vw, 20px) clamp(12px, 4vw, 20px) 0",
          paddingBottom: 160,
          minHeight: "calc(100vh - 120px)",
        }}>
          {children}
        </main>

        <TwinPill onOpen={() => setTwinOpen(true)} unread={twinOpen ? 0 : 1} />
        <TwinDrawer open={twinOpen} onClose={() => setTwinOpen(false)} />
        <BottomNav activeId={activeId} unreadConnect={unreadConnect} />

        {toast && <Toast msg={toast} />}
      </div>
=======
      <UserContext.Provider value={user}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f0f2f5; }
          @keyframes twinPulse { 0%,80%,100%{ transform:scale(0.7); opacity:0.5 } 40%{ transform:scale(1); opacity:1 } }
          @keyframes slideIn   { from{ opacity:0; transform:translateY(10px) } to{ opacity:1; transform:translateY(0) } }
          @keyframes fadeIn    { from{ opacity:0 } to{ opacity:1 } }
          ::-webkit-scrollbar { width: 5px; }
          ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
        `}</style>
        <div style={{ minHeight: "100vh", overflowY: "auto", WebkitOverflowScrolling: "touch", background: "#f0f2f5", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <TopBar unreadConnect={unreadConnect} initials={user.initials} school={user.school} />
          <main style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 0", paddingBottom: 160, minHeight: "calc(100vh - 120px)" }}>
            {children}
          </main>
          <TwinPill onOpen={() => setTwinOpen(true)} unread={twinOpen ? 0 : 1} />
          <TwinDrawer open={twinOpen} onClose={() => setTwinOpen(false)} />
          <BottomNav activeId={activeId} unreadConnect={unreadConnect} />
          {toast && <Toast msg={toast} />}
        </div>
      </UserContext.Provider>
>>>>>>> Stashed changes
    </ToastContext.Provider>
  );
}
