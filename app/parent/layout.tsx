"use client";
import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface UserCtx { fullName: string; initials: string }
const UserContext = createContext<UserCtx>({ fullName: '', initials: '' });
export const useUser = () => useContext(UserContext);

const NAV_TABS = [
  { id: "home",    label: "Home",    icon: "🏠", href: "/parent"          },
  { id: "connect", label: "Connect", icon: "💬", href: "/parent/connect"  },
  { id: "more",    label: "More",    icon: "⋯",  href: "/parent/more"     },
  { id: "profile", label: "Profile", icon: "👤", href: "/parent/profile"  },
];

function tabIdFromPath(path: string): string {
  if (path === "/parent" || path === "/parent/") return "home";
  const match = NAV_TABS.find(t => t.href !== "/parent" && path.startsWith(t.href));
  return match?.id ?? "home";
}

function BottomNav({ activeId }: { activeId: string }) {
  const router = useRouter();
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 700, background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", height: 64, boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" }}>
      {NAV_TABS.map(t => {
        const isActive = t.id === activeId;
        return (
          <button key={t.id} onClick={() => router.push(t.href)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, border: "none", background: "none", cursor: "pointer", padding: "8px 0", color: isActive ? "#10b981" : "#6b7280", position: "relative" }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600 }}>{t.label}</span>
            {isActive && <div style={{ position: "absolute", top: 0, width: 28, height: 2.5, background: "#10b981", borderRadius: "0 0 3px 3px" }} />}
          </button>
        );
      })}
    </div>
  );
}

function TopBar({ initials, fullName }: { initials: string; fullName: string }) {
  const router   = useRouter();
  const pathname = usePathname();
  const isHome   = pathname === "/parent" || pathname === "/parent/";
  return (
    <div style={{ background: "#1e1b4b", color: "#fff", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 600, boxShadow: "0 2px 12px rgba(0,0,0,0.18)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {!isHome && (
          <div onClick={() => router.back()} style={{ cursor: "pointer", fontSize: 24, color: "#fff", lineHeight: 1, marginRight: 4, fontWeight: 300 }}>‹</div>
        )}
        <div onClick={() => router.push("/parent")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#fff" }}>V</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>VibeSchool</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: -1 }}>Parent Portal</div>
          </div>
        </div>
      </div>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", cursor: "pointer" }}
        onClick={() => router.push("/parent/profile")}>
        {initials || "…"}
      </div>
    </div>
  );
}

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const activeId = tabIdFromPath(pathname);

  const [fullName, setFullName] = useState("");
  const [initials, setInitials] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/academy/signin?role=parent"); return }

      const { data } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      if (data?.role !== "parent") { router.push("/academy/signin?role=parent"); return }

      const name  = data?.full_name ?? "";
      setFullName(name);
      const parts = name.trim().split(" ").filter(Boolean);
      setInitials(parts.slice(0, 2).map((w: string) => w[0].toUpperCase()).join(""));
    }
    fetchProfile();
  }, []);

  return (
    <UserContext.Provider value={{ fullName, initials }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f0f2f5; }
        @keyframes slideIn { from{ opacity:0; transform:translateY(10px) } to{ opacity:1; transform:translateY(0) } }
        @keyframes fadeIn  { from{ opacity:0 } to{ opacity:1 } }
        @keyframes shimmer { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }
      `}</style>
      <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
        <TopBar initials={initials} fullName={fullName} />
        <main style={{ maxWidth: 768, margin: "0 auto", padding: "16px 16px 0", paddingBottom: 160, minHeight: "calc(100vh - 120px)" }}>
          {children}
        </main>
        <BottomNav activeId={activeId} />
      </div>
    </UserContext.Provider>
  );
}
