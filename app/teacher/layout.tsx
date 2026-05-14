"use client";

import TeacherSidebar from "@/components/teacher/TeacherSidebar";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "#F0F2F5",
      color: "#1A1D23",
      fontFamily: "var(--font-display, sans-serif)",
    }}>
      <TeacherSidebar />
      <main style={{
        flex: 1,
        marginLeft: "240px",
        minHeight: "100vh",
        overflowY: "auto",
        background: "#F0F2F5",
      }}>
        {children}
      </main>
    </div>
  );
}