"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionLabel, Btn, C } from "@/components/teacher/ui";

const FAQS = [
  { q: "How do I start today’s lesson?", a: "Open Today or Timetable, choose the scheduled lesson, then use Start Lesson. The class, subject and lesson context should carry into attendance and related teaching work." },
  { q: "How do I mark attendance quickly?", a: "Open Attendance from the active lesson or class. Learners start as present where the register has no previous mark, so you can mark only absent, late or excused exceptions before saving." },
  { q: "How do I assign homework from a lesson?", a: "Use Homework from the active teaching context when available. VibeSchool carries the class and lesson context so you do not need to select them again." },
  { q: "What should I do if a save fails?", a: "Keep the page open and retry once your connection returns. Do not repeat a submission while the button says Saving or Sending." },
  { q: "Where do I report a problem?", a: "Open Report a Problem below. VibeSchool adds safe screen and time context automatically, so you only need to explain what you were trying to do and what happened." },
];

export default function HelpPage() {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #065f46 0%, #10b981 100%)", borderRadius: 20, padding: 20, marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>Help & Support</div>
        <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4 }}>Get unstuck quickly</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", marginTop: 6, lineHeight: 1.5 }}>Short answers for common classroom tasks, plus a direct problem-report route.</div>
      </div>

      <Card>
        <SectionLabel>Common Questions</SectionLabel>
        {FAQS.map((item, index) => (
          <div key={item.q} style={{ borderBottom: index < FAQS.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <button
              type="button"
              aria-expanded={open === index}
              onClick={() => setOpen(open === index ? null : index)}
              style={{ width: "100%", minHeight: 48, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", gap: 12 }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: C.textPrimary, flex: 1 }}>{item.q}</span>
              <span aria-hidden="true" style={{ fontSize: 18, color: C.textMuted, flexShrink: 0, transform: open === index ? "rotate(45deg)" : "none" }}>+</span>
            </button>
            {open === index && <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.65, paddingBottom: 14 }}>{item.a}</div>}
          </div>
        ))}
      </Card>

      <Card>
        <SectionLabel>Need More Help?</SectionLabel>
        <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, margin: "0 0 14px" }}>Report an account, classroom or technical problem without needing to know any technical details.</p>
        <Btn onClick={() => router.push("/teacher/help/report")} style={{ width: "100%", minHeight: 48 }}>Report a Problem</Btn>
        <Btn variant="ghost" onClick={() => router.push("/contact")} style={{ width: "100%", minHeight: 48, marginTop: 10 }}>General Support & Contact</Btn>
      </Card>

      <div style={{ textAlign: "center", padding: "8px 0 20px", fontSize: 11, color: C.textMuted }}>Help should never block the lesson. Return to Today whenever you are ready.</div>
    </div>
  );
}
