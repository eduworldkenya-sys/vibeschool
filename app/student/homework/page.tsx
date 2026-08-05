"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudent } from "@/lib/student-context";
import Skel from "@/components/student/Skel";
import {
  useHomeworkFeed,
  daysUntil,
  displayTitle,
  HomeworkFeedItem,
  LifecycleStatus,
} from "@/lib/homework/useHomeworkFeed";

type Filter = "all" | "pending" | "submitted" | "overdue";

function dueBadge(h: HomeworkFeedItem) {
  if (h.lifecycle === "marked" || h.lifecycle === "submitted") return { label: "Submitted", bg: "#d1fae5", color: "#065f46" };
  if (h.lifecycle === "stale")        return { label: "Archived",     bg: "#f3f4f6", color: "#6b7280" };
  if (h.lifecycle === "overdue")      return { label: "Overdue",      bg: "#fee2e2", color: "#991b1b" };
  if (h.lifecycle === "due_today")    return { label: "Due Today",    bg: "#fef3c7", color: "#92400e" };
  if (h.lifecycle === "due_tomorrow") return { label: "Due Tomorrow", bg: "#fff7ed", color: "#c2410c" };
  const n = daysUntil(h.due_date);
  return { label: `Due in ${n}d`, bg: "var(--vs-accent-soft)", color: "var(--vs-accent)" };
}

const SECTION: Record<LifecycleStatus, { score: number; label: string }> = {
  overdue:      { score: 0, label: "⚠️ Overdue" },
  due_today:    { score: 1, label: "🔥 Due Today" },
  due_tomorrow: { score: 2, label: "⏰ Due Tomorrow" },
  upcoming:     { score: 3, label: "📅 Upcoming" },
  submitted:    { score: 4, label: "✅ Done" },
  marked:       { score: 4, label: "✅ Done" },
  stale:        { score: 5, label: "🗄️ Archived (14+ days overdue)" },
};

function autoBandLabel(mark: number): string {
  if (mark >= 80) return "Excellent";
  if (mark >= 60) return "Good";
  if (mark >= 40) return "Fair";
  return "Needs Improvement";
}

function IconWork() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  );
}
function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function HomeworkListPage() {
  const router  = useRouter();
  const { identity, loading: idLoading } = useStudent();
  const feed = useHomeworkFeed(
    identity?.classId ?? null,
    identity?.studentId ?? null,
    identity?.schoolId ?? null
  );

  const [filter, setFilter] = useState<Filter>("all");

  // Support /student/homework?filter=overdue deep links (used by the
  // "N archived assignments" link on /student/tasks) without pulling in
  // useSearchParams, which needs its own Suspense boundary.
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filter") as Filter | null;
    if (f && ["all", "pending", "submitted", "overdue"].includes(f)) setFilter(f);
  }, []);

  const pending   = feed.pending;
  const submitted = feed.submitted;
  // Overdue tab includes archived (14d+) items too — this is where the
  // "N archived assignments" link on /student/tasks lands.
  const overdueAll = feed.items.filter(h => h.lifecycle === "overdue" || h.lifecycle === "stale");

  const filtered = filter === "pending"   ? pending
    : filter === "submitted" ? submitted
    : filter === "overdue"   ? overdueAll
    : feed.items; // "all" — already sorted, stale sinks to the bottom

  const isLoading = idLoading || (feed.loading && feed.items.length === 0);

  if (isLoading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
      <Skel h={90} radius={16} /><Skel h={44} radius={12} />
      <Skel h={80} radius={12} /><Skel h={80} radius={12} /><Skel h={80} radius={12} />
    </div>
  );

  if (!identity?.classId) return (
    <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "var(--vs-muted)" }}>No class assigned yet — homework will appear here once you are added to a class.</div>
    </div>
  );

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: "all",       label: "All",       count: feed.items.length },
    { id: "pending",   label: "Pending",   count: pending.length     },
    { id: "submitted", label: "Submitted", count: submitted.length   },
    { id: "overdue",   label: "Overdue",   count: overdueAll.length  },
  ];

  // Group label helpers for "all" view
  let lastScore = -1;

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)", borderRadius: 20, padding: "16px", marginBottom: 16, color: "#fff" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600, marginBottom: 4 }}>MY ASSIGNMENTS</div>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 12 }}>Homework</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Total",     value: feed.items.length },
            { label: "Pending",   value: pending.length,    alert: pending.length > 0 },
            { label: "Submitted", value: submitted.length },
            { label: "Overdue",   value: overdueAll.length, alert: overdueAll.length > 0 },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: (s as {alert?:boolean}).alert ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            flexShrink: 0, padding: "8px 14px", borderRadius: 20, border: "none",
            cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
            background: filter === f.id ? "#0f766e" : "var(--vs-card)",
            color:      filter === f.id ? "#fff"    : "var(--vs-muted)",
            boxShadow:  filter === f.id ? "0 2px 8px rgba(15,118,110,0.3)" : "none",
          }}>
            {f.label} {f.count > 0 && <span style={{ opacity: 0.75 }}>· {f.count}</span>}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
          <div style={{ color: "var(--vs-muted)", display: "flex", justifyContent: "center", marginBottom: 12 }}><IconWork /></div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--vs-text)", marginBottom: 6 }}>
            {filter === "all" ? "No homework yet" : `No ${filter} homework`}
          </div>
          <div style={{ fontSize: 12, color: "var(--vs-muted)" }}>
            {filter === "all" ? "Your teacher has not posted any assignments yet." : "Nothing here right now."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(h => {
            const badge = dueBadge(h);
            const section = SECTION[h.lifecycle];

            // Section divider in "all" view
            let divider: React.ReactNode = null;
            if (filter === "all" && section.score !== lastScore) {
              lastScore = section.score;
              divider = (
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--vs-muted)", textTransform: "uppercase", letterSpacing: 1, marginTop: section.score === 0 ? 0 : 8, marginBottom: 2 }}>
                  {section.label}
                </div>
              );
            }

            return (
              <div key={h.id}>
                {divider}
                <button
                  onClick={() => router.push(`/student/homework/${h.id}`)}
                  style={{
                    width: "100%", background: "var(--vs-card)", border: "none",
                    borderRadius: 14, padding: 0, cursor: "pointer", fontFamily: "inherit",
                    textAlign: "left",
                    borderLeft: `4px solid ${h.lifecycle === "overdue" ? "#ef4444" : h.lifecycle === "stale" ? "#9ca3af" : h.status !== "pending" ? "#10b981" : section.score === 1 ? "#f59e0b" : "#0f766e"}`,
                    boxShadow: `0 1px 3px rgba(0,0,0,0.06)${section.score <= 1 && h.status === "pending" ? ", 0 0 0 1px rgba(239,68,68,0.08)" : ""}`,
                    opacity: h.lifecycle === "stale" ? 0.7 : 1,
                  }}
                >
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vs-text)", flex: 1, lineHeight: 1.4 }}>{displayTitle(h.title, h.subject, h.type)}</div>
                      <span style={{ padding: "3px 8px", borderRadius: 20, background: badge.bg, color: badge.color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{badge.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: h.instructions ? 8 : 0 }}>
                      <span style={{ fontSize: 11, color: "var(--vs-muted)" }}>{h.subject}</span>
                      <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--vs-border)", flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 20, background: "var(--vs-surface)", color: "var(--vs-muted)" }}>
                        {h.type.charAt(0).toUpperCase() + h.type.slice(1)}
                      </span>
                      <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--vs-border)", flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: "var(--vs-muted)" }}>
                        Due {new Date(h.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    {h.instructions && (
                      <div style={{ fontSize: 12, color: "var(--vs-muted)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", marginBottom: 8 }}>
                        {h.instructions}
                      </div>
                    )}
                    {h.status === "marked" && h.mark !== null && (
                      <div style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#d1fae5", borderRadius: 20, fontSize: 11, fontWeight: 700, color: "#065f46" }}>
                        <IconCheck /> {h.mark} marks · {autoBandLabel(h.mark)}
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                      <span style={{ color: "var(--vs-muted)" }}><IconArrow /></span>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
