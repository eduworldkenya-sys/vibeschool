"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const topics = [
  { q: "What should I look at first?", a: "Start with Home. It shows your children, anything that needs attention, and the next useful action. You do not need to open every section every day." },
  { q: "How should I read attendance?", a: "Attendance is based on recently recorded school records. If there is not enough evidence to make a useful judgement, VibeSchool tells you instead of treating missing records as good or bad." },
  { q: "How do I understand learning progress?", a: "Open your child's profile and choose learning progress. Start with the summary, then open the underlying evidence when you want more detail." },
  { q: "How do I contact the school?", a: "Open Messages. Use the child context when contacting school so the conversation is associated with the right learner." },
  { q: "Why can't I see something?", a: "Parent access is limited to information your account is authorized to see. Some school information may also be withheld until it is published or released for parents." },
  { q: "Something about my child is wrong. What should I do?", a: "Do not assume the displayed information is correct. Contact the school through Messages or the school's support channel and request a correction. VibeSchool should preserve the source record rather than silently changing it." },
];

export default function ParentHelpPage() {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(0);
  return <main aria-labelledby="parent-guide-title" style={{ paddingBottom: 24 }}>
    <section style={hero}><div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.62)" }}>PARENT GUIDE</div><h1 id="parent-guide-title" style={{ fontSize: 23, margin: "6px 0" }}>How VibeSchool works</h1><p style={{ fontSize: 13, lineHeight: 1.55, color: "rgba(255,255,255,.72)", margin: 0 }}>Use VibeSchool to understand your child's school journey, notice what needs attention and stay connected with the people supporting them.</p></section>
    <section aria-labelledby="journey-title" style={card}><h2 id="journey-title" style={heading}>The simple way to use VibeSchool</h2><ol style={{ display: "grid", gap: 10, margin: "12px 0 0", padding: 0, listStyle: "none" }}>{[["Orient", "Start at Home and see what changed."],["Understand", "Open the evidence behind important updates."],["Act", "Take the suggested next step when one is needed."],["Confirm", "Check that your message, request or action was completed."]].map(([t,d], i) => <li key={t} style={step}><div aria-hidden="true" style={stepNumber}>{i + 1}</div><div><div style={{ fontSize: 13, fontWeight: 850 }}>{t}</div><div style={muted}>{d}</div></div></li>)}</ol></section>
    <div style={{ margin: "18px 2px 9px", fontSize: 15, fontWeight: 850 }}>Common questions</div>
    <section aria-label="Common questions" style={card}>{topics.map((topic, i) => { const id = `parent-help-answer-${i}`; return <div key={topic.q} style={{ borderBottom: i === topics.length - 1 ? "none" : "1px solid #e5e7eb" }}><button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} aria-controls={id} style={question}>{topic.q}<span aria-hidden="true">{open === i ? "−" : "+"}</span></button>{open === i && <p id={id} style={{ ...muted, padding: "0 0 13px" }}>{topic.a}</p>}</div>; })}</section>
    <section aria-labelledby="help-more-title" style={{ ...card, marginTop: 12, background: "#f8fafc" }}><div id="help-more-title" style={{ fontSize: 14, fontWeight: 850 }}>Need more help?</div><p style={{ ...muted, marginTop: 4 }}>If information is incorrect, access is wrong, or something does not work as expected, use Messages to contact the school or your school's support channel. Keep the child and the issue clear so the right person can help.</p><button type="button" onClick={() => router.push("/parent/messages")} style={primary}>Open Messages</button></section>
  </main>;
}

const hero: React.CSSProperties = { background: "linear-gradient(135deg,#1e1b4b,#312e81)", color: "#fff", borderRadius: 20, padding: 18, marginBottom: 12 };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 15, boxShadow: "0 1px 3px rgba(0,0,0,.04)" };
const heading: React.CSSProperties = { fontSize: 16, fontWeight: 850, margin: 0 };
const step: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10 };
const stepNumber: React.CSSProperties = { width: 30, height: 30, borderRadius: 10, background: "#ede9fe", color: "#1e1b4b", display: "grid", placeItems: "center", fontWeight: 900, flexShrink: 0 };
const question: React.CSSProperties = { width: "100%", minHeight: 48, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, border: "none", background: "transparent", textAlign: "left", fontSize: 13, fontWeight: 800, cursor: "pointer", color: "#111827" };
const muted: React.CSSProperties = { fontSize: 11, lineHeight: 1.55, color: "#6b7280", margin: 0 };
const primary: React.CSSProperties = { marginTop: 12, border: "none", borderRadius: 11, padding: "10px 13px", background: "#1e1b4b", color: "#fff", fontWeight: 800, cursor: "pointer", minHeight: 40 };