"use client";

import Link from "next/link";

const activities = [
  { title: "Reading Library", detail: "Read books, notes and stories", icon: "📚", href: "#class-resources", ready: true },
  { title: "Projects", detail: "Investigate and create", icon: "🧪", ready: false },
  { title: "Topic Practice", detail: "Questions by topic", icon: "✏️", href: "/student/vibelearn/practice", ready: true },
  { title: "Exams", detail: "Practise and take assessments", icon: "📝", href: "/student/vibelearn/exams", ready: true },
  { title: "Video & Audio Lessons", detail: "Learn through watching and listening", icon: "▶️", ready: false },
  { title: "Games & Challenges", detail: "Learn by playing", icon: "🧩", ready: false },
  { title: "My Work", detail: "Homework and saved activities", icon: "📁", href: "/student/tasks", ready: true },
  { title: "Study Plan", detail: "Plan your next steps", icon: "📅", href: "/student/vibelearn/revision", ready: true },
] as const;

export default function LearnActivityHub() {
  return (
    <section aria-labelledby="learn-activity-heading" style={{ marginBottom: 16 }}>
      <h2 id="learn-activity-heading" style={{ fontSize: 19, margin: "0 0 5px" }}>Explore learning activities</h2>
      <p style={{ fontSize: 12, color: "var(--vs-muted, #64748b)", margin: "0 0 13px" }}>
        Choose how you want to learn. Activities are available across primary and secondary levels when suitable content is published.
      </p>
      <nav aria-label="Independent learning activities" style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
        {activities.map(item => {
          const style: React.CSSProperties = {
            display: "block", minWidth: 0, minHeight: 112, boxSizing: "border-box",
            border: "1px solid var(--vs-border, #e2e8f0)", borderRadius: 15,
            padding: 14, background: "var(--vs-card, #fff)", color: "var(--vs-text, #0f172a)",
            textDecoration: "none", fontFamily: "inherit", textAlign: "left",
          };
          const body = <>
            <span aria-hidden="true" style={{ display: "block", fontSize: 23, marginBottom: 7 }}>{item.icon}</span>
            <strong style={{ display: "block", fontSize: 14 }}>{item.title}</strong>
            <span style={{ display: "block", fontSize: 11, marginTop: 4, color: "var(--vs-muted, #64748b)", lineHeight: 1.4 }}>{item.detail}</span>
            {!item.ready && <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: "#92400e", marginTop: 8 }}>Coming soon</span>}
          </>;
          if (!item.ready || !("href" in item)) return <div key={item.title} style={style} aria-label={item.title + " coming soon"}>{body}</div>;
          return <Link key={item.title} style={style} href={item.href}>{body}</Link>;
        })}
      </nav>
    </section>
  );
}
