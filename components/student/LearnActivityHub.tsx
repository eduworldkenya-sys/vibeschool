"use client";

import Link from "next/link";
import { BookOpen, FlaskConical, PencilLine, ClipboardCheck, PlayCircle, Puzzle, FolderOpen, CalendarDays } from "lucide-react";
import { useStudent } from "@/lib/student-context";

const activities = [
  { title: "Read", detail: "Published textbooks by grade", Icon: BookOpen, href: "/student/vibelearn/reading", ready: true },
  { title: "Practice", detail: "Questions by topic", Icon: PencilLine, href: "/student/vibelearn/practice", ready: true },
  { title: "Exams", detail: "Tests and assessments", Icon: ClipboardCheck, href: "/student/vibelearn/exams", ready: true },
  { title: "Lessons", detail: "Video and audio lessons", Icon: PlayCircle, ready: false },
  { title: "Activities", detail: "Games and challenges", Icon: Puzzle, ready: false },
  { title: "My Work", detail: "Tasks and homework", Icon: FolderOpen, href: "/student/tasks", ready: true },
  { title: "Study Plan", detail: "Revision and mistakes", Icon: CalendarDays, href: "/student/vibelearn/revision", ready: true },
] as const;

export default function LearnActivityHub() {
  const { identity } = useStudent();
  const hasSchoolClass = Boolean(identity?.classId);
  const project = {
    title: "Projects", detail: hasSchoolClass ? "School-assigned projects" : "Independent projects",
    Icon: FlaskConical, href: "/student/projects", ready: hasSchoolClass,
  };
  const items = [activities[0], activities[1], activities[2], project, ...activities.slice(3)];
  return (
    <section aria-labelledby="learn-activity-heading" style={{ marginBottom: 16 }}>
      <h2 id="learn-activity-heading" style={{ fontSize: 19, margin: "0 0 5px" }}>Explore learning activities</h2>
      <p style={{ fontSize: 12, color: "var(--vs-muted, #64748b)", margin: "0 0 13px" }}>
        Choose how you want to learn. Your activities and resources depend on your class and available content.
      </p>
      <nav aria-label="Learning activities" style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
        {items.map(item => {
          const style: React.CSSProperties = {
            display: "block", minWidth: 0, minHeight: 112, boxSizing: "border-box",
            border: "1px solid var(--vs-border, #e2e8f0)", borderRadius: 15,
            padding: 14, background: "var(--vs-card, #fff)", color: "var(--vs-text, #0f172a)",
            textDecoration: "none", fontFamily: "inherit", textAlign: "left",
          };
          const body = <>
            <item.Icon aria-hidden="true" size={23} strokeWidth={1.8} style={{ display: "block", marginBottom: 8 }} />
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
