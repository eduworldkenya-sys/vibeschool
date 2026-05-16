"use client";
import { Card, SectionLabel, Btn, C, ReadinessChip } from "@/components/teacher/ui";

const ASSIGNMENTS = [
  { title: "Linear Equations — Practice Set",  class: "6B", due: "Today",     submissions: 6, total: 8 },
  { title: "Angles in Polygons — Quiz",         class: "6B", due: "Tomorrow",  submissions: 0, total: 8 },
  { title: "Data Handling — Group Task",        class: "7A", due: "Friday",    submissions: 12, total: 22 },
  { title: "Quadratics — Intro Worksheet",      class: "8C", due: "Next Mon",  submissions: 0, total: 18 },
];

export default function VibeLearnPage() {
  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #854d0e 0%, #f59e0b 100%)", borderRadius: 20, padding: "20px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>VibeLearn</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Student Learning Platform</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>Assignments, resources, and progress — your students' view.</div>
      </div>

      <Card>
        <SectionLabel>Active Assignments</SectionLabel>
        {ASSIGNMENTS.map(a => (
          <div key={a.title} style={{ padding: "12px 0", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{a.title}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{a.class} · Due {a.due}</div>
              </div>
              <Btn small variant="ghost">View</Btn>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 10, background: C.accent, width: `${(a.submissions / a.total) * 100}%` }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, flexShrink: 0 }}>{a.submissions}/{a.total} submitted</span>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 14 }}>
          <Btn>+ New Assignment</Btn>
        </div>
      </Card>

      <Card>
        <SectionLabel>Learner Activity</SectionLabel>
        <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: C.textMuted }}>
          Learner activity will appear here once VibeLearn is fully activated.
        </div>
      </Card>
    </div>
  );
}