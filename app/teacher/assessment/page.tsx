"use client";
import { STUDENTS } from "@/lib/data";
import { Card, SectionLabel, Btn } from "@/components/teacher/ui";

const ASSESSMENTS = [
  { id: 1, title: "Term 2 Mid-Point Test",    class: "6B", date: "Week 6",   avg: 71, status: "completed" },
  { id: 2, title: "Algebra Quiz — Unit 3",    class: "6B", date: "Week 4",   avg: 68, status: "completed" },
  { id: 3, title: "Data Handling CAT",        class: "7A", date: "Week 5",   avg: 74, status: "completed" },
  { id: 4, title: "End of Term Exam",         class: "All",date: "Week 10",  avg: null, status: "upcoming" },
];

export default function AssessmentPage() {
  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #92400e 0%, #f59e0b 100%)", borderRadius: 20, padding: "20px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Assessment</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Scores & Progressive Records</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>Linked to scheme of work and parent reports.</div>
      </div>

      <Card>
        <SectionLabel>Assessments</SectionLabel>
        {ASSESSMENTS.map(a => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{a.title}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{a.class} · {a.date}</div>
            </div>
            {a.avg !== null ? (
              <span style={{ fontSize: 14, fontWeight: 800, color: a.avg >= 70 ? "#10b981" : a.avg >= 55 ? "#f59e0b" : "#ef4444" }}>{a.avg}%</span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", background: "#ede9fe", padding: "3px 10px", borderRadius: 20 }}>Upcoming</span>
            )}
            <Btn small variant="ghost">View</Btn>
          </div>
        ))}
        <div style={{ marginTop: 14 }}>
          <Btn>+ New Assessment</Btn>
        </div>
      </Card>

      <Card>
        <SectionLabel>Grade 6B — Individual Scores</SectionLabel>
        {STUDENTS.map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.name}</div>
            <div style={{ width: 120, height: 6, background: "#e5e7eb", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 10, background: s.score >= 80 ? "#10b981" : s.score >= 60 ? "#f59e0b" : "#ef4444", width: `${s.score}%` }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", width: 36, textAlign: "right" }}>{s.score}%</span>
          </div>
        ))}
      </Card>
    </div>
  );
}