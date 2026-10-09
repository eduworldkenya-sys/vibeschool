"use client";

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 750, color: "var(--teacher-ink, #1c2923)" }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--teacher-muted, #627168)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function WeekOverview({
  overview,
}: {
  overview?: { lessonsPlanned: number; lessonsTaught: number; assignmentsGiven: number; engagementPct: number };
}) {
  if (!overview) return null;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 750, color: "var(--teacher-muted, #627168)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 }}>
        This Week
      </div>
      <div style={{ display: "flex" }}>
        <Stat value={overview.lessonsPlanned} label="Lessons Planned" />
        <Stat value={overview.lessonsTaught} label="Lessons Taught" />
        <Stat value={overview.assignmentsGiven} label="Assignments" />
        <Stat value={`${overview.engagementPct}%`} label="Engagement" />
      </div>
    </div>
  );
}
