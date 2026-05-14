"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
  const [open, setOpen] = useState(false);

  const sidebarContent = (isMobileDrawer = false) => (
    <>
      {/* Logo */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E5EB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
        {/* Close button — mobile drawer only */}
        {isMobileDrawer && (
          <button
            onClick={() => setOpen(false)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#9BA3AF", fontSize: "20px", lineHeight: 1, padding: "4px",
            }}
          >✕</button>
        )}
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
              onClick={() => setOpen(false)}
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
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00C07A", flexShrink: 0 }} />
          <span style={{ fontSize: "12px", color: "#00875A" }}>Twin Active</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* MOBILE TOPBAR */}
      <div
        id="mobile-topbar"
        style={{
          display: "none",
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
          height: "56px",
          background: "#FFFFFF",
          borderBottom: "1px solid #E2E5EB",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "7px",
            background: "linear-gradient(135deg, #00C07A, #0078D4)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "10px" }}>VS</span>
          </div>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#1A1D23" }}>VibeSchool</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "8px", color: "#1A1D23" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside id="desktop-sidebar" style={{
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
        {sidebarContent(false)}
      </aside>

      {/* MOBILE DRAWER */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 60,
              background: "rgba(0,0,0,0.4)",
            }}
          />
          <aside style={{
            position: "fixed",
            top: 0, left: 0,
            height: "100vh",
            width: "280px",
            background: "#FFFFFF",
            display: "flex",
            flexDirection: "column",
            zIndex: 70,
            boxShadow: "4px 0 24px rgba(0,0,0,0.12)",
          }}>
            {sidebarContent(true)}
          </aside>
        </>
      )}

      <style>{`
        @media (max-width: 768px) {
          #desktop-sidebar { display: none !important; }
          #mobile-topbar { display: flex !important; }
        }
        @media (min-width: 769px) {
          #mobile-topbar { display: none !important; }
          #desktop-sidebar { display: flex !important; }
        }
      `}</style>
    </>
  );
}