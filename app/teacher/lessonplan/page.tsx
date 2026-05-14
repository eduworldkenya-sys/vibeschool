"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LESSON_PLANS, TODAY_SLOTS } from "@/lib/data";
import { ReadinessChip, Btn, Card, SectionLabel } from "@/components/teacher/ui";
import LessonPlanModal from "@/components/teacher/LessonPlanModal";

export default function LessonPlanPage() {
  const router = useRouter();
  const [lessonModal, setLessonModal] = useState(null);

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", borderRadius: 20, padding: "20px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Lesson Plan Generator</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Built by the Pedagogical Chain</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>Auto-generated 12 hours before each lesson. Always differentiated.</div>
      </div>

      <Card>
        <SectionLabel>Today & Upcoming</SectionLabel>
        {LESSON_PLANS.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{p.title}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{p.class} · {p.date}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{p.topic}</div>
            </div>
            <ReadinessChip status={p.status} />
            <Btn small variant="ghost" onClick={() => setLessonModal(TODAY_SLOTS.find(s => s.class === p.class) || TODAY_SLOTS[0])}>View</Btn>
          </div>
        ))}
      </Card>

      <Card>
        <SectionLabel>Generate New Plan</SectionLabel>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
          The Pedagogical Chain auto-generates plans 12 hours before each lesson. Trigger manually if needed.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn>Generate for Next Lesson</Btn>
          <Btn variant="ghost">Browse All Plans</Btn>
        </div>
      </Card>

      <Card>
        <SectionLabel>Differentiation Summary</SectionLabel>
        {[
          { level: "Higher", color: "#7c3aed", bg: "#ede9fe", count: 2, desc: "Multi-step and extension tasks" },
          { level: "On Track", color: "#10b981", bg: "#d1fae5", count: 4, desc: "Core curriculum delivery" },
          { level: "Support", color: "#f59e0b", bg: "#fef3c7", count: 2, desc: "Scaffolded and visual methods" },
        ].map(d => (
          <div key={d.level} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: d.bg, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: d.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 800 }}>{d.count}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: d.color }}>{d.level}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{d.desc}</div>
            </div>
          </div>
        ))}
      </Card>

      {lessonModal && <LessonPlanModal slot={lessonModal} onClose={() => setLessonModal(null)} />}
    </div>
  );
}