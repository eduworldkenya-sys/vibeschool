"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ParentNavTab } from "@/lib/types";
import { UserContext } from "@/lib/parent-context";
import OfflineBar from "@/components/teacher/OfflineBar";
import VibeLearnShellWrapper from "@/components/student/VibeLearnShellWrapper";
import TwinRoleSwitcher from "@/components/twin/TwinRoleSwitcher";
import { getTwinAuthorityContext, requireTwinRole } from "@/lib/twin/core";

const NAV_TABS: ParentNavTab[] = [
  { id: "home",      label: "Home",     icon: "🏠", href: "/parent"          },
  { id: "connect",   label: "Inbox",    icon: "🔔", href: "/parent/inbox"    },
  { id: "vibelearn", label: "VibeLearn",icon: "🎓", href: "/parent/vibe-learn" },
  { id: "learn",     label: "Learn",    icon: "📚", href: "/parent/learn"    },
  { id: "students",  label: "Children", icon: "🎒", href: "/parent/students" },
];

const PRIMARY_HREFS = NAV_TABS.map(t => t.href);

function tabIdFromPath(path: string): ParentNavTab["id"] {
  if (path === "/parent" || path === "/parent/") return "home";
  if (path.startsWith('/parent/messages') || path.startsWith('/parent/connect')) return 'connect';
  const match = NAV_TABS.find(t => t.href !== "/parent" && path.startsWith(t.href));
  return (match?.id ?? "home") as ParentNavTab["id"];
}

function BottomNav({ activeId, onVibeLearnOpen }: { activeId: ParentNavTab["id"]; onVibeLearnOpen: () => void; }) {
  const router = useRouter();
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 700,
      background: "#fff", borderTop: "1px solid #e5e7eb",
      display: "flex", height: 64, boxShadow: "0 -2px 12px rgba(0,0,0,0.06)", alignItems: "flex-end",
    }}>
      {NAV_TABS.map(t => {
        const isActive = t.id === activeId;
        const isCenter = t.id === "vibelearn";
        if (isCenter) {
          return (
            <button key={t.id} onClick={onVibeLearnOpen} aria-label="Open VibeLearn" style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
              border: "none", background: "none", cursor: "pointer", padding: "0 0 6px", position: "relative", height: "100%",
            }}>
              <div style={{
                position: "absolute", bottom: 20, width: 54, height: 54, borderRadius: "50%",
                background: isActive ? "linear-gradient(135deg, #059669 0%, #10b981 100%)" : "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: isActive ? "0 4px 18px rgba(16,185,129,0.55)" : "0 4px 18px rgba(30,27,75,0.35)",
                border: "3px solid #fff", fontSize: 22, transition: "all 0.2s ease",
              }}>{t.icon}</div>
              <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600, color: isActive ? "#10b981" : "#6b7280", lineHeight: 1, zIndex: 1 }}>{t.label}</span>
            </button>
          );
        }
        return (
          <button key={t.id} onClick={() => router.push(t.href)} aria-label={t.label} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
            border: "none", background: "none", cursor: "pointer", padding: "8px 0", color: isActive ? "#10b981" : "#6b7280", position: "relative",
          }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
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
  const normalizedPath = pathname.replace(/\/$/, "");
  const isPrimaryTab = PRIMARY_HREFS.includes(normalizedPath) || pathname === "/parent";
  return (
    <div style={{
      background: "#1e1b4b", color: "#fff", padding: "0 12px 0 20px", minHeight: 56,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      position: "sticky", top: 0, zIndex: 600, boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {!isPrimaryTab && <div onClick={() => router.back()} style={{ cursor: "pointer", fontSize: 24, color: "#fff", lineHeight: 1, marginRight: 4, fontWeight: 300 }}>&#8249;</div>}
        <div onClick={() => router.push("/parent")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", minWidth: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#fff", flexShrink: 0 }}>V</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>VibeSchool</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: -1 }}>Parent Portal</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
        <TwinRoleSwitcher currentRole="parent" />
        <div onClick={() => router.push("/parent/messages")} aria-label="Open parent conversations" style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer" }}>💬</div>
        <div onClick={() => router.push("/parent/profile")} aria-label="Open parent profile" style={{ width: 34, height: 34, borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", cursor: "pointer" }}>{initials || "…"}</div>
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
  const [vibeLearnOpen, setVibeLearnOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const authority = await getTwinAuthorityContext();
        requireTwinRole(authority, "parent");
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", authority.userId)
          .single();
        if (error || !data) { router.replace("/"); return; }
        const name = data.full_name ?? "";
        setFullName(name);
        const parts = name.trim().split(" ").filter(Boolean);
        setInitials(parts.slice(0, 2).map((w: string) => w[0].toUpperCase()).join(""));
        setAuthReady(true);
      } catch {
        router.replace("/");
      }
    }
    void fetchProfile();
  }, [router]);

  if (!authReady) {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f2f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "36px", height: "36px", border: "3px solid #e5e7eb", borderTop: "3px solid #10b981", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ fullName, initials }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f0f2f5; }
        @keyframes slideIn { from{ opacity:0; transform:translateY(10px) } to{ opacity:1; transform:translateY(0) } }
        @keyframes fadeIn  { from{ opacity:0 } to{ opacity:1 } }
        @keyframes shimmer { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }
      `}</style>
      <TopBar initials={initials} />
      <OfflineBar />
      <main style={{ maxWidth: 768, margin: "0 auto", padding: "16px 16px 160px", background: "#f0f2f5", color: "#111827" }}>{children}</main>
      <BottomNav activeId={activeId} onVibeLearnOpen={() => setVibeLearnOpen(true)} />
      <VibeLearnShellWrapper isOpen={vibeLearnOpen} onClose={() => setVibeLearnOpen(false)} />
    </UserContext.Provider>
  );
}
