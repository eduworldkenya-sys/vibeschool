"use client";
export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";
import { useStudent } from "@/lib/student-context";
import Skel from "@/components/student/Skel";
import { useHomeworkFeed, isOverdue, displayTitle } from "@/lib/homework/useHomeworkFeed";

function dueBadge(dateStr: string, submitted: boolean) {
  if (submitted) return { label: "Submitted", bg: "#d1fae5", text: "#065f46" };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(dateStr); due.setHours(0, 0, 0, 0);
  const d     = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (d < 0)   return { label: "Overdue",   bg: "#fee2e2", text: "#991b1b" };
  if (d === 0) return { label: "Due Today", bg: "#fef3c7", text: "#92400e" };
  if (d <= 2)  return { label: `Due in ${d}d`, bg: "#fff7ed", text: "#c2410c" };
  return { label: `Due in ${d}d`, bg: "var(--vs-accent-soft)", text: "var(--vs-accent)" };
}

function IconDoc() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="15" y2="17"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

export default function TasksPage() {
  const router = useRouter();
  const { identity, loading: idLoading } = useStudent();
  const feed = useHomeworkFeed(
    identity?.classId ?? null,
    identity?.studentId ?? null,
    identity?.schoolId ?? null
  );

  const isLoading = idLoading || (feed.loading && feed.items.length === 0);

  const overdue   = feed.overdue;
  const pending   = feed.pending;
  const submitted = feed.submitted;
  const sorted    = feed.active; // stale (14d+ overdue) items are archived out of the main list
  const pendingCount = overdue.length + pending.length;

  if (isLoading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
      <Skel h={80} radius={16} />
      <Skel h={72} radius={12} />
      <Skel h={72} radius={12} />
      <Skel h={72} radius={12} />
    </div>
  );

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)", borderRadius: 20, padding: "16px", marginBottom: 16, color: "#fff" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600, marginBottom: 2 }}>MY WORK</div>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 10 }}>
          {pendingCount === 0 ? "All caught up 🎉" : `${pendingCount} assignment${pendingCount === 1 ? "" : "s"} to do`}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Overdue",   value: overdue.length,   alert: overdue.length > 0 },
            { label: "Pending",   value: pending.length,   alert: pending.length > 0 },
            { label: "Submitted", value: submitted.length, alert: false              },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: s.alert ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Homework",  active: true,  href: null },
          { label: "Exercises", active: false, href: "/student/exercises" },
          { label: "Projects",  active: false, href: "/student/projects" },
        ].map(t => (
          <button
            key={t.label}
            onClick={() => t.href && router.push(t.href)}
            style={{
              flex: 1, padding: "9px 4px", borderRadius: 10,
              border: t.active ? "none" : "1px solid var(--vs-border)",
              background: t.active ? "var(--vs-accent)" : "var(--vs-card)",
              color: t.active ? "#fff" : "var(--vs-muted)",
              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* No class */}
      {!identity?.classId && (
        <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--vs-muted)" }}>No class assigned yet — assignments will appear here once your teacher adds you.</div>
        </div>
      )}

      {/* All caught up */}
      {identity?.classId && sorted.length === 0 && (
        <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
          <div style={{ color: "var(--vs-muted)", display: "flex", justifyContent: "center", marginBottom: 12 }}><IconDoc /></div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--vs-text)", marginBottom: 6 }}>No assignments yet</div>
          <div style={{ fontSize: 12, color: "var(--vs-muted)" }}>Your teacher has not posted any work yet.</div>
        </div>
      )}

      {/* Assignment list */}
      {sorted.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map(h => {
            const submittedFlag = h.status === "submitted" || h.status === "marked";
            const badge    = dueBadge(h.due_date, submittedFlag);
            const isMarked = h.status === "marked";
            const leftColor = isOverdue(h.due_date) && !submittedFlag
              ? "#ef4444"
              : submittedFlag ? "#10b981" : "#0f766e";

            return (
              <div
                key={h.id}
                style={{
                  background:  "var(--vs-card)",
                  borderRadius: 14,
                  borderLeft:  `4px solid ${leftColor}`,
                  boxShadow:   "0 1px 3px rgba(0,0,0,0.06)",
                  overflow:    "hidden",
                }}
              >
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vs-text)", flex: 1, lineHeight: 1.4 }}>{displayTitle(h.title, h.subject, h.type)}</div>
                    <span style={{ padding: "3px 8px", borderRadius: 20, background: badge.bg, color: badge.text, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{badge.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--vs-muted)", marginBottom: isMarked ? 8 : submittedFlag ? 0 : 10 }}>
                    {h.subject} · Due {new Date(h.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                  </div>

                  {isMarked && h.mark !== null && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#d1fae5", borderRadius: 20, fontSize: 11, fontWeight: 700, color: "#065f46", marginBottom: h.feedback ? 6 : 0 }}>
                      <IconCheck /> {h.mark} marks
                    </div>
                  )}
                  {isMarked && h.feedback && (
                    <div style={{ fontSize: 12, color: "var(--vs-muted)", lineHeight: 1.5 }}>{h.feedback}</div>
                  )}

                  {!submittedFlag && (
                    <button
                      onClick={() => router.push(`/student/homework/${h.id}`)}
                      style={{ width: "100%", padding: "10px 0", background: isOverdue(h.due_date) ? "#ef4444" : "var(--vs-accent)", color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {isOverdue(h.due_date) ? "Submit Now — Overdue" : "Start Assignment"}
                    </button>
                  )}

                  {submittedFlag && !isMarked && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>✓ Submitted — waiting for mark</div>
                      <button onClick={() => router.push(`/student/homework/${h.id}`)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--vs-muted)", padding: 0 }}><IconArrow /></button>
                    </div>
                  )}

                  {isMarked && (
                    <button onClick={() => router.push(`/student/homework/${h.id}`)} style={{ marginTop: 8, width: "100%", padding: "9px 0", background: "var(--vs-accent-soft)", color: "var(--vs-accent)", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      View Feedback
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Archived / stale overdue — kept out of the urgent list but still reachable */}
      {feed.stale.length > 0 && (
        <button
          onClick={() => router.push("/student/homework?filter=overdue")}
          style={{ width: "100%", marginTop: 12, padding: "10px 0", background: "none", border: "1px dashed var(--vs-border)", borderRadius: 12, fontSize: 11, fontWeight: 600, color: "var(--vs-muted)", cursor: "pointer", fontFamily: "inherit" }}
        >
          {feed.stale.length} older assignment{feed.stale.length === 1 ? "" : "s"} archived (14+ days overdue) — view all
        </button>
      )}

    </div>
  );
}
