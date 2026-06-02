"use client";
'use client'
import { useState } from "react";
import { Card, SectionLabel, Btn, C } from "@/components/teacher/ui";

const FAQS = [
  { q: "How does the Pedagogical Chain generate lesson plans?",   a: "Plans are auto-generated 12 hours before each scheduled lesson using your scheme of work, class performance data, and KICD curriculum alignment. You can edit any plan before teaching." },
  { q: "Can parents see my VibeConnect messages?",                a: "Parent threads are visible only to you and the specific parent. Other teachers and students cannot access parent messages." },
  { q: "How do I resolve an Early Warning Flag?",                 a: "Tap 'Resolve' on any flag on the Home screen. Resolved flags are archived and visible in your class audit log." },
  { q: "How is attendance synced?",                              a: "Attendance saved via the register is instantly synced to ClassHub, the school admin panel, and the progressive learner record." },
  { q: "What does 'Your Twin' do?",                              a: "Your Twin is your always-on AI assistant. It monitors your class, surfaces insights, and can draft messages or flag concerns — all without you having to look for them." },
  { q: "How do I add a new resource to SubjectHub?",             a: "Go to SubjectHub → Shared Resources → Upload Resource. Files are available to all teachers in your department immediately." },
];

export default function HelpPage() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #065f46 0%, #10b981 100%)", borderRadius: 20, padding: "20px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Help & Support</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>How can we help?</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>Guides, FAQs, and direct support for VibeSchool.</div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          placeholder="Search help articles..."
          style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", color: C.textPrimary, boxSizing: "border-box" }}
        />
      </div>

      <Card>
        <SectionLabel>Frequently Asked Questions</SectionLabel>
        {FAQS.map((f, i) => (
          <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", gap: 12 }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, flex: 1 }}>{f.q}</span>
              <span style={{ fontSize: 18, color: C.textMuted, flexShrink: 0, transition: "transform 0.2s", transform: open === i ? "rotate(45deg)" : "none" }}>+</span>
            </button>
            {open === i && (
              <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, paddingBottom: 13 }}>{f.a}</div>
            )}
          </div>
        ))}
      </Card>

      <Card>
        <SectionLabel>Quick Guides</SectionLabel>
        {[
          { icon: "📖", title: "Getting Started with VibeSchool",   time: "3 min read" },
          { icon: "✅", title: "How to Mark Attendance",             time: "1 min read" },
          { icon: "💬", title: "Using VibeConnect with Parents",     time: "2 min read" },
          { icon: "✦",  title: "Making the Most of Your Twin",       time: "4 min read" },
        ].map(g => (
          <div key={g.title} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <span style={{ fontSize: 20 }}>{g.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{g.title}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{g.time}</div>
            </div>
            <span style={{ fontSize: 16, color: C.textMuted }}>›</span>
          </div>
        ))}
      </Card>

      <Card>
        <SectionLabel>Contact Support</SectionLabel>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 14 }}>Can't find what you need? Our support team typically responds within 2 hours during school hours.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn>💬 Live Chat</Btn>
          <Btn variant="ghost">✉ Email Support</Btn>
        </div>
      </Card>

      <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
        <div style={{ fontSize: 11, color: C.textMuted }}>VibeSchool v2.4.1 · © 2025 VibeEd Ltd</div>
      </div>
    </div>
  );
}
