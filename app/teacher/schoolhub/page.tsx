"use client";
import { ANNOUNCEMENTS, TEACHER } from "@/lib/data";
import { Card, SectionLabel, Btn } from "@/components/teacher/ui";

const POLICIES = [
  { title: "Child Safeguarding Policy",   updated: "Jan 2025" },
  { title: "Assessment & Grading Policy", updated: "Aug 2024" },
  { title: "Attendance Policy",           updated: "Jan 2025" },
  { title: "Code of Conduct",             updated: "Jan 2025" },
];

export default function SchoolHubPage() {
  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)", borderRadius: 20, padding: "20px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>SchoolHub</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{TEACHER.school}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>School-wide admin, governance, and notices.</div>
      </div>

      <Card>
        <SectionLabel>Pinned Notices</SectionLabel>
        {ANNOUNCEMENTS.map(a => (
          <div key={a.id} style={{ padding: "12px 0", borderBottom: "1px solid #e5e7eb" }}>
            {a.pinned && <div style={{ fontSize: 9, fontWeight: 800, color: "#10b981", textTransform: "uppercase", marginBottom: 4 }}>📌 Pinned</div>}
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{a.title}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{a.body}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{a.date}</div>
          </div>
        ))}
      </Card>

      <Card>
        <SectionLabel>School Policies</SectionLabel>
        {POLICIES.map(p => (
          <div key={p.title} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid #e5e7eb" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{p.title}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Updated {p.updated}</div>
            </div>
            <Btn small variant="muted">PDF</Btn>
          </div>
        ))}
      </Card>

      <Card>
        <SectionLabel>School Calendar</SectionLabel>
        {[
          { event: "Term 2 Ends",           date: "Friday, 6 June 2025" },
          { event: "Report Cards Released",  date: "Tuesday, 10 June 2025" },
          { event: "Term 3 Begins",          date: "Monday, 7 July 2025" },
          { event: "National Examinations",  date: "October 2025" },
        ].map(e => (
          <div key={e.event} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>{e.event}</span>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{e.date}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}