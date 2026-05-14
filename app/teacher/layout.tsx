"use client";
import { useState, createContext, useContext, useCallback } from "react";
import { useRouter, usePathname }  from "next/navigation";
import { VIBECONNECT_THREADS, TEACHER } from "@/lib/data";
import { C, Avatar } from "@/components/teacher/ui";
import TwinDrawer from "@/components/teacher/TwinDrawer";

// ─── Toast context ────────────────────────────────────────────────────────────
interface ToastCtx {
  showToast: (msg: string) => void;
}
const ToastContext = createContext<ToastCtx>({ showToast: () => {} });
export const useToast = () => useContext(ToastContext);

// ─── Bottom nav config ────────────────────────────────────────────────────────
const NAV_TABS = [
  { id: "home",        label: "Home",        icon: "🏠", href: "/teacher"            },
  { id: "lessonplan",  label: "Plans",       icon: "📖", href: "/teacher/lessonplan" },
  { id: "vibeconnect", label: "VibeConnect", icon: "💬", href: "/teacher/vibeconnect"},
  { id: "more",        label: "More",        icon: "⋯",  href: "/teacher/more"       },
  { id: "profile",     label: "Profile",     icon: "👤", href: "/teacher/profile"    },
];

function tabIdFromPath(path: string): string {
  if (path === "/teacher" || path === "/teacher/") return "home";
  const match = NAV_TABS.find(t => t.href !== "/teacher" && path.startsWith(t.href));
  return match?.id ?? "home";
}

// ─── Twin pill ────────────────────────────────────────────────────────────────
function TwinPill({ onOpen, unread }: { onOpen: () => void; unread: number }) {
  return (
    <div
      onClick={onOpen}
      style={{
        position: "fixed", bottom: 68, left: "50%", transform: "translateX(-50%)",
        zIndex: 750,
        background: C.dark, borderRadius: 40, padding: "10px 20px",
        display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 4px 24px rgba(30,27,75,0.32)",
        cursor: "pointer", userSelect: "none",
        border: "1.5px solid rgba(16,185,129,0.3)",
        transition: "box-shadow 0.2s, transform 0.2s",
        minWidth: 220, justifyContent: "space-between",
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(30,27,75,0.45)"; e.currentTarget.style.transform = "translateX(-50%) translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(30,27,75,0.32)"; e.currentTarget.style.transform = "translateX(-50%) translateY(0)"; }}
    >
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
          <>
            {[0, 0.2, 0.4].map(delay => (
              <span key={delay} style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: C.accent, margin: "0 2px", animation: `twinPulse 1.4s ease-in-out ${delay}s infinite` }} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Bottom nav ───────────────────────────────────────────────────────────────
function BottomNav({ activeId, unreadConnect }: { activeId: string; unreadConnect: number }) {
  const router = useRouter();
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 700, background: "#fff", borderTop: `1px solid ${C.border}`, display: "flex", height: 64, boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" }}>
      {NAV_TABS.map(t => {
        const isActive = t.id === activeId;
        const badge    = t.id === "vibeconnect" ? unreadConnect : 0;
        return (
          <button
            key={t.id}
            onClick={() => router.push(t.href)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, border: "none", background: "none", cursor: "pointer", padding: "8px 0", color: isActive ? C.accent : C.textMuted, transition: "color 0.15s", position: "relative" }}
          >
            {badge > 0 && (
              <span style={{ position: "absolute", top: 6, right: "calc(50% - 14px)", width: 16, height: 16, borderRadius: "50%", background: C.error, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>
            )}
            <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600, letterSpacing: 0.2, fontFamily: "inherit" }}>{t.label}</span>
            {isActive && <div style={{ position: "absolute", top: 0, width: 28, height: 2.5, background: C.accent, borderRadius: "0 0 3px 3px" }} />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────
function TopBar({ unreadConnect }: { unreadConnect: number }) {
  const router = useRouter();
  return (
    <div style={{ background: C.dark, color: "#fff", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 600, boxShadow: "0 2px 12px rgba(0,0,0,0.18)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#fff" }}>V</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>VibeSchool</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: -1 }}>{TEACHER.school}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {unreadConnect > 0 && (
          <div style={{ position: "relative", cursor: "pointer" }} onClick={() => router.push("/teacher/vibeconnect")}>
            <span style={{ fontSize: 20 }}>💬</span>
            <span style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: C.error, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{unreadConnect}</span>
          </div>
        )}
        <Avatar initials={TEACHER.initials} size={34} onClick={() => router.push("/teacher/profile")} style={{ cursor: "pointer" }} />
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  return (
    <div style={{ position: "fixed", bottom: 140, left: "50%", transform: "translateX(-50%)", background: C.dark, color: "#fff", padding: "11px 22px", borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 9999, animation: "fadeIn 0.2s ease", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", whiteSpace: "nowrap" }}>
      {msg}
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname        = usePathname();
  const activeId        = tabIdFromPath(pathname);
  const unreadConnect   = VIBECONNECT_THREADS.reduce((a, t) => a + t.unread, 0);

  const [twinOpen, setTwinOpen] = useState(false);
  const [toast,    setToast]    = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
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

      <div style={{ minHeight: "100vh", background: "#f0f2f5", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        <TopBar unreadConnect={unreadConnect} />

        <main style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 0", paddingBottom: 160 }}>
          {children}
        </main>

        <TwinPill onOpen={() => setTwinOpen(true)} unread={twinOpen ? 0 : 1} />
        <TwinDrawer open={twinOpen} onClose={() => setTwinOpen(false)} />
        <BottomNav activeId={activeId} unreadConnect={unreadConnect} />

        {toast && <Toast msg={toast} />}
      </div>
    </ToastContext.Provider>
  );
}