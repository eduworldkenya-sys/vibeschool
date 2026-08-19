"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import BottomNav from "@/components/student/BottomNav";
import OfflineBar from "@/components/student/OfflineBar";
import TwinWorkspaceProvider from "@/components/student/VibeTwin/TwinWorkspaceProvider";
import { ToastContext, ThemeContext } from "@/components/student/StudentUiContext";
import { StudentProvider, useStudent } from "@/lib/student-context";
import { readTheme, writeTheme, resolveTheme, StudentTheme } from "@/lib/student-theme";

function TopBar({ name, className, schoolName }: { name: string; className: string; schoolName: string }) {
  const router   = useRouter();
  const pathname = usePathname();
  const isRoot   = pathname === "/student" || pathname === "/student/";
  const initials = name.trim().split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "S";

  return (
    <div style={{
      background:     "#1C1A2E",
      color:          "#fff",
      padding:        "0 20px",
      height:         56,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "space-between",
      position:       "sticky",
      top:            0,
      zIndex:         600,
      boxShadow:      "0 2px 12px rgba(0,0,0,0.18)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {!isRoot && (
          <div
            onClick={() => router.back()}
            style={{ cursor: "pointer", fontSize: 22, color: "#fff", lineHeight: 1, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ‹
          </div>
        )}
        <div
          onClick={() => router.push("/student")}
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: "#7C6EF8",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 900, color: "#fff",
          }}>
            V
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>VibeSchool</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: -1 }}>
              {schoolName || className || "Student"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          onClick={() => router.push("/student/notifications")}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", minWidth: 44, minHeight: 44, justifyContent: "center" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>

        <div
          onClick={() => router.push("/student/profile")}
          style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "#7C6EF8",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800, color: "#fff", cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
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
      background: "#1C1A2E",
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

function StudentShell({ children }: { children: React.ReactNode }) {
  const { identity, loading, error, retry } = useStudent();

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0F0F1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.1)", borderTop: "3px solid #7C6EF8", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0F0F1A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
        <div style={{ fontSize: 14, color: "#F87171", textAlign: "center" }}>{error}</div>
        <button
          onClick={retry}
          style={{ padding: "10px 24px", background: "#7C6EF8", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <>
      <TopBar
        name={identity?.name ?? ""}
        className={identity?.className ?? ""}
        schoolName={identity?.schoolName ?? ""}
      />
      <OfflineBar />
      <main style={{
        maxWidth:      768,
        margin:        "0 auto",
        padding:       "clamp(12px, 3vw, 20px) clamp(12px, 4vw, 20px) 0",
        paddingBottom: 160,
        minHeight:     "calc(100dvh - 120px)",
      }}>
        {children}
      </main>
      <BottomNav />
    </>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setThemeState] = useState<StudentTheme>("auto");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const storedTheme = readTheme();
    setThemeState(storedTheme);
    setResolved(resolveTheme(storedTheme));
  }, []);

  const setTheme = useCallback((t: StudentTheme) => {
    writeTheme(t);
    setThemeState(t);
    setResolved(resolveTheme(t));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <ThemeContext.Provider value={{ theme, setTheme }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Plus Jakarta Sans', sans-serif; -webkit-overflow-scrolling: touch; }

          :root {
            --vs-bg:          ${resolved === "dark" ? "#0F0F1A" : "#F7F5FF"};
            --vs-surface:     ${resolved === "dark" ? "#1A1A2E" : "#FFFFFF"};
            --vs-border:      ${resolved === "dark" ? "#2D2D4E" : "#E5E3F5"};
            --vs-text:        ${resolved === "dark" ? "#F0EFFF" : "#1C1A2E"};
            --vs-muted:       ${resolved === "dark" ? "#9090B0" : "#6B6880"};
            --vs-accent:      ${resolved === "dark" ? "#7C6EF8" : "#5B4EE8"};
            --vs-accent-soft: ${resolved === "dark" ? "#1E1A3E" : "#EDE9FE"};
            --vs-success:     ${resolved === "dark" ? "#34D399" : "#059669"};
            --vs-warning:     ${resolved === "dark" ? "#FBBF24" : "#D97706"};
            --vs-error:       ${resolved === "dark" ? "#F87171" : "#DC2626"};
            --vs-card:        ${resolved === "dark" ? "#1A1A2E" : "#FFFFFF"};
            --vs-nav-bg:      ${resolved === "dark" ? "#0F0F1A" : "#FFFFFF"};
            --vs-nav-border:  ${resolved === "dark" ? "#2D2D4E" : "#E5E3F5"};
          }

          body { background: var(--vs-bg); color: var(--vs-text); }

          @keyframes slideIn  { from{ opacity:0; transform:translateY(10px) } to{ opacity:1; transform:translateY(0) } }
          @keyframes fadeIn   { from{ opacity:0 } to{ opacity:1 } }
          @keyframes shimmer  { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }
          @keyframes spin     { to{ transform:rotate(360deg) } }

          ::-webkit-scrollbar { width: 5px; }
          ::-webkit-scrollbar-thumb { background: var(--vs-border); border-radius: 10px; }
        `}</style>

        <div style={{ minHeight: "100dvh", background: "var(--vs-bg)" }}>
          <StudentProvider>
            <TwinWorkspaceProvider>
              <StudentShell>
                {children}
              </StudentShell>
            </TwinWorkspaceProvider>
          </StudentProvider>
          {toast && <Toast msg={toast} />}
        </div>
      </ThemeContext.Provider>
    </ToastContext.Provider>
  );
}