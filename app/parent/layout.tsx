"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ParentNavTab } from "@/lib/types";
import { UserContext } from "@/lib/parent-context";
import OfflineBar from "@/components/teacher/OfflineBar";
import TwinRoleSwitcher from "@/components/twin/TwinRoleSwitcher";
import { getTwinAuthorityContext, requireTwinRole } from "@/lib/twin/core";

const NAV_TABS: ParentNavTab[] = [
  { id: "home", label: "Home", icon: "⌂", href: "/parent" },
  { id: "students", label: "Children", icon: "●", href: "/parent/students" },
  { id: "learn", label: "Schoolwork", icon: "▤", href: "/parent/learn" },
  { id: "vibelearn", label: "Progress", icon: "↗", href: "/parent/assessments" },
  { id: "connect", label: "Messages", icon: "✉", href: "/parent/inbox" },
];

const PRIMARY_HREFS = NAV_TABS.map(tab => tab.href);

function tabIdFromPath(path: string): ParentNavTab["id"] {
  if (path === "/parent" || path === "/parent/") return "home";
  if (path.startsWith("/parent/inbox") || path.startsWith("/parent/messages") || path.startsWith("/parent/connect")) return "connect";
  if (path.startsWith("/parent/assessments") || path.includes("/results") || path.includes("/progress") || path.includes("/report")) return "vibelearn";
  if (path.startsWith("/parent/homework") || path.includes("/homework") || path.startsWith("/parent/learn") || path.startsWith("/parent/exercises")) return "learn";
  if (path.startsWith("/parent/students") || path.startsWith("/parent/child")) return "students";
  return "home";
}

function BottomNav({ activeId }: { activeId: ParentNavTab["id"] }) {
  const router = useRouter();
  return (
    <nav aria-label="Parent primary navigation" style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 700,
      background: "#fff", borderTop: "1px solid #e5e7eb",
      display: "flex", minHeight: 66, paddingBottom: "env(safe-area-inset-bottom)",
      boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
    }}>
      {NAV_TABS.map(tab => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => router.push(tab.href)}
            aria-label={tab.label}
            aria-current={isActive ? "page" : undefined}
            style={{
              flex: 1, minWidth: 0, minHeight: 58, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 4, border: "none",
              background: "transparent", cursor: "pointer", padding: "8px 2px",
              color: isActive ? "#047857" : "#64748b", position: "relative", fontFamily: "inherit",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
            <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 650, whiteSpace: "nowrap" }}>{tab.label}</span>
            {isActive && <span aria-hidden="true" style={{ position: "absolute", top: 0, width: 30, height: 3, background: "#059669", borderRadius: "0 0 4px 4px" }} />}
          </button>
        );
      })}
    </nav>
  );
}

function TopBar({ initials }: { initials: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const normalizedPath = pathname.replace(/\/$/, "");
  const isPrimaryTab = PRIMARY_HREFS.includes(normalizedPath) || pathname === "/parent";

  return (
    <header style={{
      background: "#1e1b4b", color: "#fff", padding: "0 12px", minHeight: 58,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      position: "sticky", top: 0, zIndex: 600, boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {!isPrimaryTab && (
          <button type="button" onClick={() => router.back()} aria-label="Go back" style={{
            width: 44, height: 44, border: "none", background: "transparent", color: "#fff",
            cursor: "pointer", fontSize: 28, lineHeight: 1, fontFamily: "inherit",
          }}>‹</button>
        )}
        <button type="button" onClick={() => router.push("/parent")} aria-label="Go to Parent Home" style={{
          border: "none", background: "transparent", color: "inherit", display: "flex",
          alignItems: "center", gap: 10, cursor: "pointer", minWidth: 0, textAlign: "left", fontFamily: "inherit",
        }}>
          <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 9, background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, flexShrink: 0 }}>V</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>VibeSchool</span>
            <span style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.68)", marginTop: -1 }}>Family view</span>
          </span>
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <TwinRoleSwitcher currentRole="parent" />
        <button type="button" onClick={() => router.push("/parent/inbox")} aria-label="Open messages" style={{
          width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 18,
        }}>✉</button>
        <button type="button" onClick={() => router.push("/parent/profile")} aria-label="Open parent profile" style={{
          width: 44, height: 44, borderRadius: "50%", background: "#10b981", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800,
          color: "#fff", cursor: "pointer", fontFamily: "inherit",
        }}>{initials || "…"}</button>
      </div>
    </header>
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
        const authority = await getTwinAuthorityContext();
        requireTwinRole(authority, "parent");
        const { data, error } = await supabase.from("profiles").select("full_name").eq("id", authority.userId).single();
        if (error || !data) { router.replace("/"); return; }
        const name = data.full_name ?? "";
        setFullName(name);
        const parts = name.trim().split(" ").filter(Boolean);
        setInitials(parts.slice(0, 2).map((word: string) => word[0].toUpperCase()).join(""));
        setAuthReady(true);
      } catch {
        router.replace("/");
      }
    }
    void fetchProfile();
  }, [router]);

  if (!authReady) {
    return (
      <div role="status" aria-label="Loading Parent Portal" style={{ minHeight: "100vh", background: "#f0f2f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div aria-hidden="true" style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTop: "3px solid #10b981", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ fullName, initials }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; background: #f0f2f5; }
        button:focus-visible, a:focus-visible { outline: 3px solid #34d399; outline-offset: 2px; }
        @keyframes slideIn { from{ opacity:0; transform:translateY(10px) } to{ opacity:1; transform:translateY(0) } }
        @keyframes fadeIn  { from{ opacity:0 } to{ opacity:1 } }
        @keyframes shimmer { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }
      `}</style>
      <TopBar initials={initials} />
      <OfflineBar />
      <main style={{ maxWidth: 768, margin: "0 auto", padding: "16px 16px 96px", background: "#f0f2f5", color: "#111827" }}>{children}</main>
      <BottomNav activeId={activeId} />
    </UserContext.Provider>
  );
}
