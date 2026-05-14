"use client";

import TeacherSidebar from "@/components/teacher/TeacherSidebar";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#0D0F14] text-white font-sans">
      <TeacherSidebar />
      <main className="flex-1 ml-64 min-h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}