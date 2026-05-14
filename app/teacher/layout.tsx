"use client";

import TeacherSidebar from "@/components/teacher/TeacherSidebar";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#F0F2F5",
      color: "#1A1D23",
      fontFamily: "var(--font-display, sans-serif)",
    }}>
      <TeacherSidebar />

      {/* Desktop: offset for sidebar. Mobile: offset for topbar */}
      <main style={{ minHeight: "100vh", background: "#F0F2F5" }}>
        <div id="main-inner" style={{ padding: "0" }}>
          {children}
        </div>
      </main>

      <style>{`
        @media (min-width: 769px) {
          main { margin-left: 240px; }
        }
        @media (max-width: 768px) {
          main { margin-left: 0; padding-top: 56px; }
        }
      `}</style>
    </div>
  );
}