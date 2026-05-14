"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/teacher", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { label: "My Profile", href: "/teacher/profile", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
  { label: "Qualifications", href: "/teacher/qualifications", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 6 3 6 3s6-1 6-3v-5"/></svg> },
  { label: "Professional Dev", href: "/teacher/pd", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg> },
  { label: "Attendance & Leave", href: "/teacher/leave", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 16l2 2 4-4"/></svg> },
  { label: "Documents", href: "/teacher/documents", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg> },
  { label: "Appraisal", href: "/teacher/appraisal", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> },
  { label: "Twin AI", href: "/teacher/twin", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg> },
  { label: "Messages", href: "/teacher/messages", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> },
];

export default function TeacherSidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      position: "fixed",
      top: 0, left: 0,
      height: "100vh",
      width: "240px",
      background: "#FFFFFF",
      borderRight: "1px solid #E2E5EB",
      display: "flex",
      flexDirection: "column",
      zIndex: 40,
      boxShadow: "2px 0 8px rgba(0,0,0,0.04)",
    }}>

      {/* Logo */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E5EB" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px",
            background: "linear-gradient(135deg, #00C07A, #0078D4)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "11px" }}>VS</span>
          </div>
          <div>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "#1A1D23", margin: 0 }}>VibeSchool</p>
            <p style={{ fontSize: "11px", color: "#9BA3AF", margin: 0 }}>MwalimuSmart</p>
          </div>
        </div>
      </div>

      {/* Teacher strip */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E5EB" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "50%",
            background: "linear-gradient(135deg, #E6FAF4, #E0F2FF)",
            border: "1px solid #E2E5EB",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "13px", fontWeight: 600, color: "#00875A", flexShrink: 0,
          }}>JC</div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: "13px", fontWeight: 500, color: "#1A1D23", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Mrs. J. Chebet
            </p>
            <p style={{ fontSize: "11px", color: "#9BA3AF", margin: 0 }}>HOD — Mathematics</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "10px",
                marginBottom: "2px",
                fontSize: "13px",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#00875A" : "#5A6270",
                background: isActive ? "#E6FAF4" : "transparent",
                border: isActive ? "1px solid #A7EDD4" : "1px solid transparent",
                textDecoration: "none",
                transition: "all 0.15s",
              }}
            >
              <span style={{ color: isActive ? "#00875A" : "#9BA3AF", flexShrink: 0 }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "16px", borderTop: "1px solid #E2E5EB" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "10px 12px", borderRadius: "10px",
          background: "#E6FAF4", border: "1px solid #A7EDD4",
        }}>
          <span style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: "#00C07A", flexShrink: 0,
          }} />
          <span style={{ fontSize: "12px", color: "#00875A" }}>Twin Active</span>
        </div>
      </div>
    </aside>
  );
}