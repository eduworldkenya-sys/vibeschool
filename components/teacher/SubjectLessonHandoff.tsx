"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildLessonNotesHref,
  buildTeacherGuideHref,
  loadSubjectLessonCandidates,
  resolveSubjectAuthority,
  type SubjectAuthority,
  type SubjectLessonCandidate,
} from "@/lib/teacher/subjectContext";

type Purpose = "guide" | "notes" | "overview";

function dateLabel(candidate: SubjectLessonCandidate) {
  if (candidate.relation === "today") return "Today";
  const parsed = new Date(`${candidate.occurrenceDate}T12:00:00+03:00`);
  return parsed.toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" });
}

function timeLabel(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour)) return value;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export default function SubjectLessonHandoff({
  classId,
  subjectId,
  purpose,
  compact = false,
}: {
  classId: string;
  subjectId: string;
  purpose: Purpose;
  compact?: boolean;
}) {
  const router = useRouter();
  const [authority, setAuthority] = useState<SubjectAuthority | null>(null);
  const [candidates, setCandidates] = useState<SubjectLessonCandidate[]>([]);
  const [loading, setLoading] = useState(Boolean(classId && subjectId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!classId || !subjectId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const resolved = await resolveSubjectAuthority(classId, subjectId);
        const rows = await loadSubjectLessonCandidates(resolved);
        if (cancelled) return;
        setAuthority(resolved);
        setCandidates(rows);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Teaching context could not be resolved.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [classId, subjectId]);

  const visible = useMemo(() => candidates.slice(0, compact ? 1 : 8), [candidates, compact]);

  function openCandidate(candidate: SubjectLessonCandidate) {
    if (!authority) return;
    if (purpose === "notes") {
      const notesHref = buildLessonNotesHref(authority, candidate);
      if (notesHref) {
        router.push(notesHref);
        return;
      }
      const q = new URLSearchParams({
        classId: authority.classId,
        subjectId: authority.subjectId,
        timetableSlotId: candidate.timetableSlotId,
        date: candidate.occurrenceDate,
      });
      router.push(`/teacher/lessonplan?${q.toString()}`);
      return;
    }
    router.push(buildTeacherGuideHref(authority, candidate));
  }

  const box: React.CSSProperties = {
    border: "1px solid #dbe3ea",
    borderRadius: 16,
    background: "#fff",
    padding: compact ? 12 : 16,
  };

  if (loading) {
    return <div role="status" style={{ ...box, color: "#64748b", fontSize: 12 }}>Finding your next lesson…</div>;
  }

  if (error) {
    return (
      <div style={{ ...box, borderColor: "#fecaca" }}>
        <div style={{ fontWeight: 750, color: "#991b1b", fontSize: 13 }}>Teaching context needs attention</div>
        <div style={{ color: "#7f1d1d", fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>{error}</div>
      </div>
    );
  }

  if (!authority) {
    return (
      <div style={box}>
        <div style={{ fontWeight: 750, color: "var(--teacher-ink, #1c2923)" }}>Choose a class first</div>
        <div style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>VibeSchool will keep the subject and class together.</div>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div style={box}>
        <div style={{ fontWeight: 750, color: "var(--teacher-ink, #1c2923)", fontSize: 13 }}>
          No scheduled {authority.subjectName} lesson found
        </div>
        <div style={{ color: "#64748b", fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
          {authority.className}{authority.stream ? ` ${authority.stream}` : ""} is assigned to you, but there is no lesson in the nearby timetable window. Nothing was invented.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={() => router.push(`/teacher/timetable?subjectId=${encodeURIComponent(subjectId)}`)} style={{ border: 0, borderRadius: 10, padding: "9px 11px", fontWeight: 800, background: "#0f172a", color: "#fff" }}>Open timetable</button>
          <button type="button" onClick={() => router.push(`/teacher/scheme?classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subjectId)}`)} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 11px", fontWeight: 800, background: "#fff", color: "#334155" }}>Open Scheme</button>
        </div>
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ fontSize: 11, fontWeight: 750, letterSpacing: 1, color: "#0369a1", textTransform: "uppercase" }}>
        {purpose === "overview" ? "Next teaching action" : purpose === "notes" ? "Choose prepared lesson" : "Choose lesson"}
      </div>
      {!compact && (
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>
          {authority.subjectName} · {authority.className}{authority.stream ? ` ${authority.stream}` : ""}. Only authorised timetable lessons are shown.
        </div>
      )}
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {visible.map((candidate) => {
          const needsPlan = purpose === "notes" && !candidate.lessonPlanId;
          return (
            <button
              key={`${candidate.timetableSlotId}:${candidate.occurrenceDate}`}
              type="button"
              onClick={() => openCandidate(candidate)}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                background: candidate.relation === "today" ? "#eff6ff" : "#f8fafc",
                padding: 11,
                textAlign: "left",
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ color: "#0f172a", fontSize: 12 }}>{candidate.lessonTitle || `${authority.subjectName} lesson`}</strong>
                <span style={{ color: candidate.relation === "today" ? "#1d4ed8" : "#64748b", fontSize: 11, fontWeight: 750 }}>{dateLabel(candidate)}</span>
              </div>
              <div style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>
                {timeLabel(candidate.startTime)}–{timeLabel(candidate.endTime)}
                {candidate.room ? ` · ${candidate.room}` : ""}
                {candidate.lessonPlanId ? " · Plan ready" : " · No lesson plan yet"}
              </div>
              {needsPlan && <div style={{ color: "#92400e", fontSize: 11, fontWeight: 800, marginTop: 5 }}>Prepare this lesson before opening notes →</div>}
            </button>
          );
        })}
      </div>
      {!compact && candidates.length > visible.length && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Showing the most relevant lessons first.</div>
      )}
    </div>
  );
}
