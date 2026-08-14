"use client";
import { useState, useEffect, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import OfflineBar from "@/components/teacher/OfflineBar";

type ParentTabId = "home" | "students" | "messages" | "learn" | "profile";
interface UserCtx { fullName: string; initials: string }
const UserContext = createContext<UserCtx>({ fullName: "", initials: "" });
const useUser = () => useContext(UserContext);

const NAV_TABS: ReadonlyArray<{ id: ParentTabId; label: string; icon: string; href: string }> = [
  { id: "home", label: "Home", icon: "🏠", href: "/parent" },
  { id: "students", label: "Children", icon: "👨‍👩‍👧", href: "/parent/students" },
  { id: "messages", label: "Messages", icon: "💬", href: "/parent/messages" },
  { id: "learn", label: "Learn", icon: "📚", href: "/parent/learn" },
  { id: "profile", label: "Profile", icon: "👤", href: "/parent/profile" },
];

function tabIdFromPath(path: string): ParentTabId {
  if (path === "/parent" || path === "/parent/") return "home";
  const match = NAV_TABS.find(t => t.href !== "/parent" && path.startsWith(t.href));
  return match?.id ?? "home";
}

function BottomNav({ activeId }: { activeId: ParentTabId }) {
  const router = useRouter();
  return <nav aria-label="Parent navigation" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 700, background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", height: 64, boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" }}>
    {NAV_TABS.map(t => {
      const isActive = t.id === activeId;
      return <button key={t.id} onClick={() => router.push(t.href)} aria-current={isActive ? "page" : undefined} aria-label={t.label} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, border: "none", background: "none", cursor: "pointer", padding: "8px 0", color: isActive ? "#10b981" : "#6b7280", position: "relative" }}>
        <span aria-hidden="true" style={{ fontSize: 19, lineHeight: 1 }}>{t.icon}</span><span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600 }}>{t.label}</span>
        {isActive && <div aria-hidden="true" style={{ position: "absolute", top: 0, width: 28, height: 2.5, background: "#10b981", borderRadius: "0 0 3px 3px" }} />}
      </button>;
    })}
  </nav>;
}

function TopBar({ initials, onHelp }: { initials: string; onHelp: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/parent" || pathname === "/parent/";
  return <header style={{ background: "#1e1b4b", color: "#fff", padding: "0 16px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 600, boxShadow: "0 2px 12px rgba(0,0,0,0.18)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {!isHome && <button onClick={() => router.back()} aria-label="Go back" style={{ border: "none", background: "none", color: "#fff", cursor: "pointer", fontSize: 25, lineHeight: 1, padding: 0, minWidth: 36, minHeight: 36 }}>&#8249;</button>}
      <button onClick={() => router.push("/parent")} aria-label="Open parent home" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", border: "none", background: "none", color: "#fff", padding: 0 }}>
        <div aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 9, background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900 }}>V</div>
        <div style={{ textAlign: "left" }}><div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>VibeSchool</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: -1 }}>Parent Portal</div></div>
      </button>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <button onClick={onHelp} aria-label="Get help using VibeSchool" title="Help" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, cursor: "pointer" }}>?</button>
      <button onClick={() => router.push("/parent/messages")} aria-label="Open messages" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, cursor: "pointer" }}>💬</button>
      <button onClick={() => router.push("/parent/profile")} aria-label="Open profile" style={{ width: 36, height: 36, borderRadius: "50%", background: "#10b981", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", cursor: "pointer" }}>{initials || "…"}</button>
    </div>
  </header>;
}

function ParentGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { icon: "🏠", title: "Start at Home", body: "Home is your family command centre. It shows what matters today and whether anything needs your attention." },
    { icon: "👨‍👩‍👧", title: "Choose a child", body: "Open a child's profile for attendance, learning progress, reports and school information. We only show information your account is authorized to see." },
    { icon: "💬", title: "Stay connected", body: "Messages keeps school communication in one place. You can contact the appropriate school team from there." },
    { icon: "💡", title: "We explain the numbers", body: "If there is not enough evidence, VibeSchool will say so instead of pretending everything is fine. Look for the information icon when you want an explanation." },
  ];
  useEffect(() => { if (open) setStep(0); }, [open]);
  if (!open) return null;
  const current = steps[step];
  const last = step === steps.length - 1;
  return <div role="dialog" aria-modal="true" aria-labelledby="parent-guide-title" style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(17,24,39,.62)", display: "grid", placeItems: "center", padding: 20 }}>
    <section style={{ width: "min(100%, 440px)", background: "#fff", borderRadius: 22, padding: 22, boxShadow: "0 24px 70px rgba(0,0,0,.25)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 11, fontWeight: 800, color: "#6b7280" }}>VibeSchool guide · {step + 1}/{steps.length}</span><button onClick={onClose} aria-label="Close guide" style={{ border: "none", background: "#f3f4f6", borderRadius: 999, width: 32, height: 32, cursor: "pointer", fontSize: 18 }}>×</button></div>
      <div style={{ width: 58, height: 58, borderRadius: 18, background: "#eef2ff", display: "grid", placeItems: "center", fontSize: 28, marginTop: 20 }}>{current.icon}</div>
      <h2 id="parent-guide-title" style={{ fontSize: 20, margin: "14px 0 7px", color: "#111827" }}>{current.title}</h2><p style={{ fontSize: 13, lineHeight: 1.6, color: "#4b5563", margin: 0 }}>{current.body}</p>
      <div style={{ display: "flex", gap: 6, margin: "20px 0 17px" }}>{steps.map((_, i) => <span key={i} aria-hidden="true" style={{ flex: 1, height: 4, borderRadius: 99, background: i <= step ? "#10b981" : "#e5e7eb" }} />)}</div>
      <div style={{ display: "flex", gap: 9 }}><button onClick={onClose} style={{ flex: 1, border: "1px solid #d1d5db", borderRadius: 11, padding: 11, background: "#fff", fontWeight: 800, cursor: "pointer" }}>{last ? "Done" : "Skip"}</button>{!last && <button onClick={() => setStep(s => s + 1)} style={{ flex: 1, border: "none", borderRadius: 11, padding: 11, background: "#1e1b4b", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Next</button>}</div>
    </section>
  </div>;
}

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeId = tabIdFromPath(pathname);
  const [fullName, setFullName] = useState("");
  const [initials, setInitials] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/"); return; }
        const { data } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
        if (data?.role !== "parent") { router.push("/"); return; }
        const name = data?.full_name ?? "";
        setFullName(name);
        const parts = name.trim().split(" ").filter(Boolean);
        setInitials(parts.slice(0, 2).map((w: string) => w[0].toUpperCase()).join(""));
        setAuthReady(true);
        if (typeof window !== "undefined" && !localStorage.getItem("vibeschool.parent.guide.v1")) setGuideOpen(true);
      } catch { router.push("/"); }
    }
    fetchProfile();
  }, [router]);

  function closeGuide() {
    setGuideOpen(false);
    if (typeof window !== "undefined") localStorage.setItem("vibeschool.parent.guide.v1", "seen");
  }

  if (!authReady) return <div style={{ minHeight: "100vh", background: "#f0f2f5", display: "flex", alignItems: "center", justifyContent: "center" }}><div aria-label="Loading VibeSchool" role="status" style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTop: "3px solid #10b981", borderRadius: "50%", animation: "spin 1s linear infinite" }} /><style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style></div>;

  return <UserContext.Provider value={{ fullName, initials }}>
    <style>{`*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f0f2f5; } button { -webkit-tap-highlight-color: transparent; } @keyframes slideIn { from{ opacity:0; transform:translateY(10px) } to{ opacity:1; transform:translateY(0) } } @keyframes fadeIn { from{ opacity:0 } to{ opacity:1 } } @keyframes parentShimmer { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }`}</style>
    <TopBar initials={initials} onHelp={() => setGuideOpen(true)} />
    <OfflineBar />
    <main style={{ maxWidth: 768, margin: "0 auto", padding: "16px 16px 160px", background: "#f0f2f5", color: "#111827" }}>{children}</main>
    <BottomNav activeId={activeId} />
    <ParentGuide open={guideOpen} onClose={closeGuide} />
  </UserContext.Provider>;
}
