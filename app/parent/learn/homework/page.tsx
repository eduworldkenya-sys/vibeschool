"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TOKENS, ROUTES } from "@/lib/tokens";

interface Assignment {
  id: string;
  childOwner: string;
  title: string;
  subject: string;
  subjectIcon: string;
  dueDateISO: string;
  totalPoints: number;
  status: "pending" | "overdue" | "completed";
  scoreEarned?: number;
}

const MOCK_ASSIGNMENTS: Assignment[] = [
  { id: "hw-01", childOwner: "Jaden", title: "Insha: Maisha ya Nyumbani na Shambani", subject: "Shughuli za Kiswahili", subjectIcon: "🌍", dueDateISO: "2026-05-23T08:00:00.000Z", totalPoints: 20, status: "pending" },
  { id: "hw-02", childOwner: "Jaden", title: "Long Division & Remainders Workbook (Ex. 4B)", subject: "Mathematics Activities", subjectIcon: "📐", dueDateISO: "2026-05-25T13:00:00.000Z", totalPoints: 50, status: "pending" },
  { id: "hw-03", childOwner: "Jaden", title: "Phonetics & Reading Fluency Audio Check", subject: "English Language Arts", subjectIcon: "📚", dueDateISO: "2026-05-21T16:00:00.000Z", totalPoints: 30, status: "overdue" },
  { id: "hw-04", childOwner: "Jaden", title: "Metamorphosis Diagram & Labeling Project", subject: "Science & Environmental", subjectIcon: "🌱", dueDateISO: "2026-05-18T14:14:00.000Z", totalPoints: 40, status: "completed", scoreEarned: 38 },
  { id: "hw-05", childOwner: "Liam", title: "Primary Color Mixing & Shading Canvas", subject: "Creative Arts Activities", subjectIcon: "🎨", dueDateISO: "2026-05-21T12:00:00.000Z", totalPoints: 20, status: "overdue" },
  { id: "hw-06", childOwner: "Liam", title: "Number Patterns & Sequence Matching", subject: "Mathematics Activities", subjectIcon: "📐", dueDateISO: "2026-05-24T09:00:00.000Z", totalPoints: 15, status: "pending" }
];

export default function TodaysBriefing() {
  const router = useRouter();
  const childrenList = Array.from(new Set(MOCK_ASSIGNMENTS.map(a => a.childOwner)));
  const [activeChild, setActiveChild] = useState<string>("Jaden");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const list = MOCK_ASSIGNMENTS.filter(a => a.childOwner === activeChild);
  const overdue = list.filter(a => a.status === "overdue");
  const pending = list.filter(a => a.status === "pending");
  const completed = list.filter(a => a.status === "completed");

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "24px 16px", backgroundColor: TOKENS.bgDefault, minHeight: "100vh", fontFamily: TOKENS.fontFamily, color: TOKENS.textPrimary, WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" }}>
      
      {/* Persistent Multi-Child Navigation Segmented Control */}
      <div style={{ display: "flex", gap: "8px", background: "#f1f5f9", padding: "4px", borderRadius: "14px", marginBottom: "20px" }}>
        {childrenList.map((name) => {
          const isActive = activeChild === name;
          return (
            <button
              key={name}
              onClick={() => setActiveChild(name)}
              style={{ flex: 1, padding: "10px", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "700", fontFamily: TOKENS.fontBody, cursor: "pointer", backgroundColor: isActive ? TOKENS.bgCard : "transparent", color: isActive ? TOKENS.textPrimary : TOKENS.textMuted, boxShadow: isActive ? "0 2px 4px rgba(0,0,0,0.04)" : "none", transition: "all 0.2s" }}
            >
              {name} • {name === "Jaden" ? "Gr. 3" : "Gr. 1"}
            </button>
          );
        })}
      </div>

      {/* Hero Summary Card: Resolves 80% of visits in 2 seconds */}
      {overdue.length > 0 ? (
        <div style={{ backgroundColor: TOKENS.overdueBg, border: `1px solid ${TOKENS.overdueBorder}`, borderRadius: TOKENS.radiusCard, padding: "20px", marginBottom: "24px" }}>
          <h1 style={{ fontFamily: TOKENS.fontHeader, fontSize: "22px", margin: 0, color: TOKENS.overdueText }}>{overdue.length} thing needs attention tonight</h1>
          <p style={{ fontFamily: TOKENS.fontBody, fontSize: "14px", margin: "4px 0 0 0", color: TOKENS.textPrimary }}>Action is required on outstanding tasks for {activeChild}.</p>
        </div>
      ) : (
        <div style={{ backgroundColor: TOKENS.completedBg, border: `1px solid ${TOKENS.completedBorder}`, borderRadius: TOKENS.radiusCard, padding: "20px", marginBottom: "24px" }}>
          <h1 style={{ fontFamily: TOKENS.fontHeader, fontSize: "22px", margin: 0, color: TOKENS.completedText }}>{activeChild} is all clear 🌟</h1>
          <p style={{ fontFamily: TOKENS.fontBody, fontSize: "14px", margin: "4px 0 0 0", color: TOKENS.textPrimary }}>All current assignments are completed or turned in.</p>
        </div>
      )}

      {/* 7-Day Week Snapshot Strip */}
      <div style={{ backgroundColor: TOKENS.bgCard, border: `1px solid ${TOKENS.borderDefault}`, borderRadius: "16px", padding: "12px", marginBottom: "24px", display: "flex", justifyContent: "space-between", textAlign: "center" }}>
        {[
          { label: "M", status: "clear" },
          { label: "T", status: "clear" },
          { label: "W", status: "completed" },
          { label: "T", status: "overdue" },
          { label: "F", status: "pending" },
          { label: "S", status: "clear" },
          { label: "S", status: "clear" }
        ].map((day, idx) => (
          <div key={idx} style={{ flex: 1 }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: TOKENS.textMuted, fontFamily: TOKENS.fontBody }}>{day.label}</span>
            <div style={{ height: "6px", width: "6px", borderRadius: "50%", margin: "6px auto 0 auto", backgroundColor: day.status === "overdue" ? TOKENS.danger : day.status === "pending" ? TOKENS.warning : day.status === "completed" ? TOKENS.success : "transparent" }} />
          </div>
        ))}
      </div>

      {/* Dynamic Narrative Timeline Stream */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {overdue.length > 0 && (
          <div>
            <h2 style={{ fontFamily: TOKENS.fontHeader, fontSize: "14px", textTransform: "uppercase", letterSpacing: "1px", color: TOKENS.overdueText, margin: "0 0 12px 0" }}>⚠️ Overdue</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {overdue.map(a => {
                const isHovered = hoveredId === a.id;
                return (
                  <div
                    key={a.id}
                    onClick={() => router.push(ROUTES.homeworkDetail(a.id))}
                    onMouseEnter={() => setHoveredId(a.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{ backgroundColor: TOKENS.bgCard, border: `1px solid ${TOKENS.borderDefault}`, borderLeft: `6px solid ${TOKENS.danger}`, borderRadius: TOKENS.radiusCard, padding: "16px", cursor: "pointer", transform: isHovered ? "translateY(-2px) scale(1.01)" : "scale(1)", boxShadow: isHovered ? "0 12px 24px rgba(0,0,0,0.04)" : "none", transition: "all 0.2s ease" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: TOKENS.textMuted, fontFamily: TOKENS.fontBody }}>{a.subject}</span>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: TOKENS.overdueText, backgroundColor: TOKENS.overdueBg, padding: "2px 8px", borderRadius: "6px" }}>Action Needed</span>
                    </div>
                    <h3 style={{ fontFamily: TOKENS.fontHeader, fontSize: "16px", margin: 0, color: TOKENS.textPrimary }}>{a.title}</h3>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {pending.length > 0 && (
          <div>
            <h2 style={{ fontFamily: TOKENS.fontHeader, fontSize: "14px", textTransform: "uppercase", letterSpacing: "1px", color: TOKENS.textMuted, margin: "0 0 12px 0" }}>⏳ Upcoming This Week</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {pending.map(a => {
                const isHovered = hoveredId === a.id;
                return (
                  <div
                    key={a.id}
                    onClick={() => router.push(ROUTES.homeworkDetail(a.id))}
                    onMouseEnter={() => setHoveredId(a.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{ backgroundColor: TOKENS.bgCard, border: `1px solid ${TOKENS.borderDefault}`, borderLeft: `6px solid ${TOKENS.warning}`, borderRadius: TOKENS.radiusCard, padding: "16px", cursor: "pointer", transform: isHovered ? "translateY(-2px) scale(1.01)" : "scale(1)", boxShadow: isHovered ? "0 12px 24px rgba(0,0,0,0.04)" : "none", transition: "all 0.2s ease" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: TOKENS.textMuted, fontFamily: TOKENS.fontBody }}>{a.subject}</span>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: TOKENS.pendingText }}>Due Soon</span>
                    </div>
                    <h3 style={{ fontFamily: TOKENS.fontHeader, fontSize: "16px", margin: 0, color: TOKENS.textPrimary }}>{a.title}</h3>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div>
            <h2 style={{ fontFamily: TOKENS.fontHeader, fontSize: "14px", textTransform: "uppercase", letterSpacing: "1px", color: TOKENS.completedText, margin: "0 0 12px 0" }}>🎉 Completed</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {completed.map(a => (
                <div
                  key={a.id}
                  onClick={() => router.push(ROUTES.homeworkDetail(a.id))}
                  style={{ backgroundColor: TOKENS.completedBg, border: `1px solid ${TOKENS.completedBorder}`, borderRadius: TOKENS.radiusCard, padding: "14px 16px", cursor: "pointer", opacity: 0.85 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: TOKENS.completedText, fontFamily: TOKENS.fontBody }}>{a.subject}</span>
                      <h4 style={{ fontFamily: TOKENS.fontHeader, fontSize: "15px", margin: 0, color: TOKENS.textPrimary, textDecoration: "line-through" }}>{a.title}</h4>
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: "900", color: TOKENS.completedText }}>{a.scoreEarned ? Math.round((a.scoreEarned / a.totalPoints) * 100) : 0}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {list.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", background: TOKENS.bgCard, borderRadius: TOKENS.radiusCard, border: `1px solid ${TOKENS.borderDefault}` }}>
            <span style={{ fontSize: "40px" }}>🌟</span>
            <h3 style={{ fontFamily: TOKENS.fontHeader, fontSize: "18px", marginTop: "12px", marginBottom: "4px" }}>All caught up!</h3>
            <p style={{ fontFamily: TOKENS.fontBody, fontSize: "13px", color: TOKENS.textMuted, margin: 0 }}>No assignments found for {activeChild} right now.</p>
          </div>
        )}

      </div>
    </div>
  );
}
