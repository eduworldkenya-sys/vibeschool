"use client";
import { useState } from "react";
import { teacherTabs, type TeacherTab } from "@/components/teacher/navigation";

export default function TeacherRedesignPage() {
  const [active, setActive] = useState<TeacherTab>("today");
  return <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "Canvas", color: "CanvasText" }}>
    <main aria-label={teacherTabs.find(tab => tab.id === active)?.label} style={{ flex: 1 }} />
    <nav aria-label="Redesign navigation" style={{ display: "flex", borderTop: "1px solid color-mix(in srgb, CanvasText 15%, transparent)", paddingBottom: "env(safe-area-inset-bottom)", background: "Canvas", position: "sticky", bottom: 0 }}>
      {teacherTabs.map(tab => <button key={tab.id} type="button" aria-current={active === tab.id ? "page" : undefined} onClick={() => setActive(tab.id)} style={{ flex: 1, minWidth: 0, minHeight: 64, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, border: 0, background: "transparent", color: "inherit", opacity: active === tab.id ? 1 : 0.65, fontWeight: active === tab.id ? 700 : 400, fontSize: 12, cursor: "pointer" }}><tab.icon size={22} aria-hidden="true"/><span>{tab.label}</span></button>)}
    </nav>
  </div>;
}
