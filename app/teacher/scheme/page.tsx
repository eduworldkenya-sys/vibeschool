"use client";
import { useState } from "react";
import { Card, SectionLabel, Btn, C } from "@/components/teacher/ui";

const TOPICS = [
  { id: 1,  strand: "Number",    topic: "Integers & Operations",         weeks: "1–2",  status: "done"    },
  { id: 2,  strand: "Number",    topic: "Fractions & Decimals",           weeks: "2–3",  status: "done"    },
  { id: 3,  strand: "Number",    topic: "Percentages",                    weeks: "3–4",  status: "done"    },
  { id: 4,  strand: "Algebra",   topic: "Introduction to Algebra",        weeks: "4–5",  status: "done"    },
  { id: 5,  strand: "Algebra",   topic: "Simplifying Expressions",        weeks: "5",    status: "done"    },
  { id: 6,  strand: "Algebra",   topic: "Linear Equations — One Variable", weeks: "6",  status: "current" },
  { id: 7,  strand: "Algebra",   topic: "Linear Equations — Two Variables", weeks: "6–7", status: "upcoming"},
  { id: 8,  strand: "Geometry",  topic: "Angles & Lines",                 weeks: "7",    status: "upcoming"},
  { id: 9,  strand: "Geometry",  topic: "Polygons & Properties",          weeks: "7–8",  status: "upcoming"},
  { id: 10, strand: "Geometry",  topic: "Area & Perimeter",               weeks: "8",    status: "upcoming"},
  { id: 11, strand: "Data",      topic: "Mean, Median, Mode",             weeks: "9",    status: "upcoming"},
  { id: 12, strand: "Data",      topic: "Grouped Data & Frequency",       weeks: "9–10", status: "upcoming"},
];

const STATUS_MAP = {
  done:     { bg: "#d1fae5", color: "#065f46", label: "Done"     },
  current:  { bg: "#fef3c7", color: "#92400e", label: "Current"  },
  upcoming: { bg: "#f3f4f6", color: "#6b7280", label: "Upcoming" },
};

const STRANDS = ["All", "Number", "Algebra", "Geometry", "Data"];

export default function SchemePage() {
  const [filter, setFilter] = useState("All");
  const filtered = filter === "All" ? TOPICS : TOPICS.filter(t => t.strand === filter);
  const done = TOPICS.filter(t => t.status === "done").length;

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #4f46e5 100%)", borderRadius: 20, padding: "20px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Scheme of Work</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Curriculum Map — Term 2</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>Grade 6B · Mathematics · 10 weeks</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.2)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 10, background: C.accent, width: `${(done / TOPICS.length) * 100}%` }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.8)", flexShrink: 0 }}>{done}/{TOPICS.length} topics</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {STRANDS.map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, flexShrink: 0, background: filter === s ? C.accent : C.surface, color: filter === s ? "#fff" : C.textMuted }}>
            {s}
          </button>
        ))}
      </div>

      <Card style={{ padding: 0 }}>
        {filtered.map((t, i) => {
          const s = STATUS_MAP[t.status];
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {t.status === "done" ? <span style={{ fontSize: 13, color: s.color }}>✓</span> : t.status === "current" ? <span style={{ fontSize: 10, color: s.color }}>●</span> : <span style={{ fontSize: 10, color: s.color }}>○</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{t.topic}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{t.strand} · Week{t.weeks.includes("–") ? "s" : ""} {t.weeks}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20, background: s.bg, color: s.color, flexShrink: 0 }}>{s.label}</span>
            </div>
          );
        })}
      </Card>

      <Card>
        <SectionLabel>Summary</SectionLabel>
        {[
          { label: "Topics Completed",  value: `${done} / ${TOPICS.length}` },
          { label: "Weeks Remaining",   value: "4" },
          { label: "On Track",          value: "Yes ✓" },
          { label: "Next Topic",        value: "Linear Equations — Two Variables" },
        ].map(r => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13, color: C.textMuted }}>{r.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{r.value}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}