"use client";
import { useState } from "react";
import { Card, SectionLabel, Btn, C } from "@/components/teacher/ui";

const RESOURCES = [
  { id: 1, title: "Term 2 Scheme of Work — Mathematics", type: "PDF",  size: "340 KB", date: "2 days ago",  class: "All" },
  { id: 2, title: "Linear Equations Worksheet — Grade 6", type: "DOCX", size: "112 KB", date: "3 days ago",  class: "6B"  },
  { id: 3, title: "KICD Algebra Resource Pack",           type: "ZIP",  size: "4.1 MB", date: "1 week ago",  class: "All" },
  { id: 4, title: "Assessment Rubric — Grade 6",          type: "DOCX", size: "88 KB",  date: "1 week ago",  class: "6B"  },
  { id: 5, title: "Geometry Visual Aid — Angles",         type: "PNG",  size: "2.3 MB", date: "2 weeks ago", class: "6B"  },
  { id: 6, title: "Differentiation Strategies Guide",     type: "PDF",  size: "1.2 MB", date: "2 weeks ago", class: "All" },
];

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  PDF:  { bg: "#fee2e2", color: "#991b1b" },
  DOCX: { bg: "#dbeafe", color: "#1d4ed8" },
  ZIP:  { bg: "#fef3c7", color: "#92400e" },
  PNG:  { bg: "#d1fae5", color: "#065f46" },
};

export default function ResourcesPage() {
  const [filter, setFilter] = useState("All");
  const classes = ["All", "6B", "7A", "8C"];
  const filtered = filter === "All" ? RESOURCES : RESOURCES.filter(r => r.class === filter || r.class === "All");

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #374151 0%, #6b7280 100%)", borderRadius: 20, padding: "20px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Resources</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Teaching Materials</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>Upload, manage, and share resources with your classes.</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {classes.map(c => (
          <button key={c} onClick={() => setFilter(c)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: filter === c ? C.accent : C.surface, color: filter === c ? "#fff" : C.textMuted }}>
            {c}
          </button>
        ))}
        <button style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${C.accent}`, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: "transparent", color: C.accent }}>
          + Upload
        </button>
      </div>

      <Card style={{ padding: 0 }}>
        {filtered.map((r, i) => {
          const tc = TYPE_COLORS[r.type] || { bg: C.surface, color: C.textMuted };
          return (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: tc.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: tc.color, flexShrink: 0 }}>
                {r.type}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{r.size} · {r.date} · {r.class}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <Btn small variant="muted">↓</Btn>
                <Btn small variant="ghost">Share</Btn>
              </div>
            </div>
          );
        })}
      </Card>

      <Card>
        <SectionLabel>Storage</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 10, background: C.accent, width: "34%" }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, flexShrink: 0 }}>3.4 / 10 GB</span>
        </div>
        <div style={{ fontSize: 12, color: C.textMuted }}>34% used · 6.6 GB remaining</div>
      </Card>
    </div>
  );
}