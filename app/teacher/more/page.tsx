"use client";
import { useRouter } from "next/navigation";
import { Card } from "@/components/teacher/ui";

const ITEMS = [
  { icon: "🏫", label: "ClassHub",        desc: "Your class overview and learner profiles",    href: "/teacher/classhub" },
  { icon: "🔬", label: "SubjectHub",       desc: "Subject teams and shared resources",           href: "/teacher/subjecthub" },
  { icon: "🎓", label: "VibeLearn",        desc: "Student-facing learning platform",             href: "/teacher/vibelearn" },
  { icon: "📦", label: "Resources",        desc: "Upload and manage teaching materials",         href: "/teacher/resources" },
  { icon: "📊", label: "Assessment",       desc: "Scores, trends, and progressive records",      href: "/teacher/assessment" },
  { icon: "🗓️", label: "SmartTimetable",  desc: "Full weekly timetable view",                   href: "/teacher/timetable" },
  { icon: "🏛️", label: "SchoolHub",       desc: "School-wide admin and governance",             href: "/teacher/schoolhub" },
  { icon: "📋", label: "Scheme of Work",   desc: "Curriculum map and topic tracker",             href: "/teacher/scheme" },
  { icon: "⚙️", label: "Settings",        desc: "Account, notifications, preferences",          href: "/teacher/settings" },
  { icon: "❓", label: "Help & Support",   desc: "Guides, FAQs, and contact",                   href: "/teacher/help" },
];

export default function MorePage() {
  const router = useRouter();
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 16 }}>More</div>
      <Card style={{ padding: 0 }}>
        {ITEMS.map((item, i) => (
          <div key={item.label}
            onClick={() => router.push(item.href)}
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: i < ITEMS.length - 1 ? "1px solid #e5e7eb" : "none", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f8f9fa")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: 22 }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{item.label}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{item.desc}</div>
            </div>
            <span style={{ fontSize: 16, color: "#6b7280" }}>›</span>
          </div>
        ))}
      </Card>
    </div>
  );
}