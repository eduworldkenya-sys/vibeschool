"use client";
import { Card, SectionLabel, Btn, Avatar } from "@/components/teacher/ui";

const TEAM = [
  { name: "Mr. Odhiambo",  role: "Head of Mathematics", initials: "JO", bg: "#ede9fe", color: "#6d28d9" },
  { name: "Ms. Kamau",     role: "Grade 6 · Your account", initials: "WK", bg: "#d1fae5", color: "#065f46" },
  { name: "Mr. Sitati",    role: "Grade 7",             initials: "DS", bg: "#dbeafe", color: "#1d4ed8" },
  { name: "Ms. Abuor",     role: "Grade 8",             initials: "RA", bg: "#fef3c7", color: "#92400e" },
];

const RESOURCES = [
  { title: "Term 2 Scheme of Work — Mathematics", type: "PDF", size: "340 KB", date: "2 days ago" },
  { title: "KICD Algebra Resource Pack",           type: "ZIP", size: "4.1 MB", date: "1 week ago" },
  { title: "Assessment Rubric — Grade 6",          type: "DOCX", size: "88 KB",  date: "1 week ago" },
  { title: "Differentiation Strategies Guide",     type: "PDF", size: "1.2 MB", date: "2 weeks ago" },
];

export default function SubjectHubPage() {
  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #075985 0%, #0ea5e9 100%)", borderRadius: 20, padding: "20px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>SubjectHub</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Mathematics Department</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>Shared resources, team threads, and curriculum alignment.</div>
      </div>

      <Card>
        <SectionLabel>Department Team</SectionLabel>
        {TEAM.map(t => (
          <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid #e5e7eb" }}>
            <Avatar initials={t.initials} size={40} bg={t.bg} color={t.color} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{t.name}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{t.role}</div>
            </div>
            <Btn small variant="ghost">Message</Btn>
          </div>
        ))}
      </Card>

      <Card>
        <SectionLabel>Shared Resources</SectionLabel>
        {RESOURCES.map(r => (
          <div key={r.title} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#6b7280" }}>{r.type}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{r.title}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{r.size} · {r.date}</div>
            </div>
            <Btn small variant="muted">↓</Btn>
          </div>
        ))}
        <div style={{ marginTop: 14 }}>
          <Btn variant="ghost">+ Upload Resource</Btn>
        </div>
      </Card>
    </div>
  );
}