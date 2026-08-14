"use client";
import { useState, useEffect, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ParentNavTab } from "@/lib/types";
import OfflineBar from "@/components/teacher/OfflineBar";

interface UserCtx { fullName: string; initials: string }
const UserContext = createContext<UserCtx>({ fullName: "", initials: "" });
const useUser = () => useContext(UserContext);

const NAV_TABS: ParentNavTab[] = [
  { id: "home",     label: "Home",     icon: "🏠", href: "/parent" },
  { id: "students", label: "Children", icon: "👨‍👩‍👧", href: "/parent/students" },
  { id: "messages", label: "Messages", icon: "💬", href: "/parent/messages" },
  { id: "learn",    label: "Learn",    icon: "📚", href: "/parent/learn" },
  { id: "profile",  label: "Profile",  icon: "👤", href: "/parent/profile" },
];

function tabIdFromPath(path: string): ParentNavTab["id"] {
  if (path === "/parent" || path === "/parent/") return "home";
  const match = NAV_TABS.find(t => t.href !== "/parent" && path.startsWith(t.href));
  return (match?.id ?? "home") as ParentNavTab["id"];
}

function BottomNav({ activeId }: { activeId: ParentNavTab["id"] }) {
  const router = useRouter();
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 700, background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", height: 64, boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" }}>
      {NAV_TABS.map(t => {
        const isActive = t.id === activeId;
        return (
          <button key={t.id} onClick={() => router.push(t.href)} aria-label={t.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, border: "none", background: "none", cursor: "pointer", padding: "8px 0", color: isActive ? "#10b981" : "#6b7280", position: "relative" }}>
            <span style={{ fontSize: 19, lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600 }}>{t.label}</span>
            {isActive && <div style={{ position: "absolute", top: 0, width: 28, height: 2.5, background: "#10b981", borderRadius: "0 0 3px 3px" }} />}
          </button>
        );
      })}
    </div>
  );
}

function TopBar({ initials }: { initials: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/parent" || pathname === "/parent/";
  return (
    <div style={{ background: "#1e1b4b", color: "#fff", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 600, boxShadow: "0 2px 12px rgba(0,0,0,0.18)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {!isHome && <button onClick={() => router.back()} aria-label="Go back" style={{ border: "none", background: "none", color: "#fff", cursor: "pointer", fontSize: 25, lineHeight: 1, padding: 0 }}>&#8249;</button>}
        <button onClick={() => router.push("/parent")} aria-label="Open parent home" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", border: "none", background: "none", color: "#fff", padding: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900 }}>V</div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>VibeSchool</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: -1 }}>Parent Portal</div>
          </div>
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => router.push("/parent/messages")} aria-label="Open messages" style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, cursor: "pointer" }}>💬</button>
        <button onClick={() => router.push("/parent/profile")} aria-label="Open profile" style={{ width: 34, height: 34, borderRadius: "50%", background: "#10b981", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", cursor: "pointer" }}>{initials || "…"}</button>
      </div>
    </div>
  );
}

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeId = tabIdFromPath(pathname);
  const [fullName, setFullName] = useState("");
  const [initials, setInitials] = useState("");
  const [authReady, setAuthReady] = useState(false);

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
      } catch {
        router.push("/");
      }
    }
    fetchProfile();
  }, [router]);

  if (!authReady) {
    return <div style={{ minHeight: "100vh", background: "#f0f2f5", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTop: "3px solid #10b981", borderRadius: "50%", animation: "spin 1s linear infinite" }} /><style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style></div>;
  }

  return (
    <UserContext.Provider value={{ fullName, initials }}>
      <style>{`*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f0f2f5; } @keyframes slideIn { from{ opacity:0; transform:translateY(10px) } to{ opacity:1; transform:translateY(0) } } @keyframes fadeIn { from{ opacity:0 } to{ opacity:1 } } @keyframes parentShimmer { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }`}</style>
      <TopBar initials={initials} />
      <OfflineBar />
      <main style={{ maxWidth: 768, margin: "0 auto", padding: "16px 16px 160px", background: "#f0f2f5", color: "#111827" }}>{children}</main>
      <BottomNav activeId={activeId} />
    </UserContext.Provider>
  );
}
