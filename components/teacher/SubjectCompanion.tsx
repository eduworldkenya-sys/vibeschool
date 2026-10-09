"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SubjectLessonHandoff from "@/components/teacher/SubjectLessonHandoff";

type Subject = { id: string; name: string };
type SubjectClass = {
  id: string;
  name: string;
  stream: string;
  studentCount: number;
};

type Tool = {
  id: string;
  label: string;
  help: string;
  group: "prepare" | "teach" | "evidence";
  needsClass?: boolean;
  href: (classId: string, subject: Subject) => string;
};

const tools: Tool[] = [
  {
    id: "scheme",
    label: "Scheme of Work",
    help: "See the curriculum sequence and what should come next.",
    group: "prepare",
    needsClass: true,
    href: (classId, subject) => `/teacher/scheme?classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subject.id)}`,
  },
  {
    id: "content",
    label: "Learning Content",
    help: "Find curriculum-aligned notes, examples, exercises and approved learning material.",
    group: "prepare",
    needsClass: true,
    href: (classId, subject) => `/teacher/vibelearn?tab=discover&classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subject.id)}`,
  },
  {
    id: "resources",
    label: "Resources",
    help: "Reuse your adopted class resources and teaching materials.",
    group: "prepare",
    needsClass: true,
    href: (classId, subject) => `/teacher/resources?classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subject.id)}`,
  },
  {
    id: "lessonplan",
    label: "Lesson Plans",
    help: "Prepare the next lesson from the same class and subject context.",
    group: "prepare",
    needsClass: true,
    href: (classId, subject) => `/teacher/lessonplan?classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subject.id)}`,
  },
  {
    id: "lesson-notes",
    label: "Lesson Notes / Teach",
    help: "Choose the prepared lesson, then open its lesson notes and classroom Teach mode without inventing a lesson.",
    group: "teach",
    needsClass: true,
    href: (classId, subject) => `/teacher/lesson-notes?classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subject.id)}`,
  },
  {
    id: "teacher-guide",
    label: "Teacher Guide",
    help: "Open the lesson-linked guide. VibeSchool will not invent a lesson when no occurrence is selected.",
    group: "teach",
    needsClass: true,
    href: (classId, subject) => `/teacher/teacher-guide?classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subject.id)}`,
  },
  {
    id: "timetable",
    label: "Teaching Schedule",
    help: "Find the next scheduled lesson for this subject.",
    group: "teach",
    href: (_classId, subject) => `/teacher/timetable?subjectId=${encodeURIComponent(subject.id)}`,
  },
  {
    id: "attendance",
    label: "Attendance",
    help: "Open the class register with this teaching context carried forward.",
    group: "teach",
    needsClass: true,
    href: (classId, subject) => `/teacher/attendance?classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subject.id)}`,
  },
  {
    id: "homework",
    label: "Homework",
    help: "Assign or review learner work for this class.",
    group: "teach",
    needsClass: true,
    href: (classId, subject) => `/teacher/classhub/${encodeURIComponent(classId)}/homework?subjectId=${encodeURIComponent(subject.id)}`,
  },
  {
    id: "assessment",
    label: "Assessment",
    help: "Create or review subject assessment evidence for this class.",
    group: "evidence",
    needsClass: true,
    href: (classId, subject) => `/teacher/assessment?classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subject.id)}`,
  },
  {
    id: "exams",
    label: "Exams",
    help: "Open Exam Centre with this class and subject already selected to enter marks, continue incomplete sheets and analyse results.",
    group: "evidence",
    needsClass: true,
    href: (classId, subject) => `/teacher/results?classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subject.id)}`,
  },
  {
    id: "students",
    label: "Students & Class Data",
    help: "Open the roster, learner profiles and the subject-specific class picture.",
    group: "evidence",
    needsClass: true,
    href: (classId, subject) => `/teacher/classhub/${encodeURIComponent(classId)}?mode=subject&subjectId=${encodeURIComponent(subject.id)}`,
  },
  {
    id: "workbook",
    label: "Class Workbook",
    help: "Open lists, trackers, groups and class intelligence for this subject.",
    group: "evidence",
    needsClass: true,
    href: (classId, subject) => `/teacher/classhub/${encodeURIComponent(classId)}/workbook?subjectId=${encodeURIComponent(subject.id)}`,
  },
  {
    id: "progress",
    label: "Learner Progress",
    help: "Review the class learning story and follow-up needs.",
    group: "evidence",
    needsClass: true,
    href: (classId, subject) => `/teacher/classhub/${encodeURIComponent(classId)}/progress?subjectId=${encodeURIComponent(subject.id)}`,
  },
];

const groupCopy = {
  prepare: {
    title: "Prepare",
    help: "Curriculum → Scheme → content → lesson preparation",
  },
  teach: {
    title: "Teach & follow up",
    help: "Guide → lesson notes / Teach → timetable → attendance → homework",
  },
  evidence: {
    title: "Check learning",
    help: "Assessment → marks → students / class data → intelligence → progress",
  },
} as const;

export default function SubjectCompanion({
  subject,
  classes,
}: {
  subject: Subject;
  classes: SubjectClass[];
}) {
  const router = useRouter();
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? "");

  const selectedClass = useMemo(
    () => classes.find((row) => row.id === selectedClassId) ?? classes[0] ?? null,
    [classes, selectedClassId],
  );

  const classLabel = selectedClass
    ? `${selectedClass.name}${selectedClass.stream ? ` · ${selectedClass.stream}` : ""}`
    : "No class selected";

  function open(tool: Tool) {
    if (tool.needsClass && !selectedClass) {
      router.push("/teacher/onboarding/class");
      return;
    }
    router.push(tool.href(selectedClass?.id ?? "", subject));
  }

  return (
    <section
      aria-label="Subject companion"
      style={{
        margin: "14px 16px 0",
        background: "#fff",
        borderRadius: 20,
        padding: 16,
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 750, letterSpacing: 1.2, textTransform: "uppercase", color: "#075985" }}>
            {subject.name} workspace
          </div>
          <h2 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--teacher-ink, #1c2923)" }}>Everything for teaching this subject</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--teacher-muted, #627168)" }}>
            Keep one class and subject context while you prepare, teach, assess and follow up.
          </p>
        </div>
      </div>

      {classes.length > 0 ? (
        <label style={{ display: "block", marginTop: 14, fontSize: 11, fontWeight: 800, color: "#475569" }}>
          WORKING CLASS
          <select
            aria-label="Working class"
            value={selectedClass?.id ?? ""}
            onChange={(event) => setSelectedClassId(event.target.value)}
            style={{
              width: "100%",
              marginTop: 6,
              minHeight: 44,
              borderRadius: 12,
              border: "1px solid #dbe3ea",
              background: "var(--teacher-canvas, #f5f6f2)",
              padding: "0 12px",
              color: "var(--teacher-ink, #1c2923)",
              fontWeight: 800,
              fontFamily: "inherit",
            }}
          >
            {classes.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}{row.stream ? ` · ${row.stream}` : ""} · {row.studentCount} learners
              </option>
            ))}
          </select>
        </label>
      ) : (
        <button
          type="button"
          onClick={() => router.push("/teacher/onboarding/class")}
          style={{ marginTop: 14, width: "100%", minHeight: 44, border: 0, borderRadius: 12, background: "#eef2ff", color: "#3730a3", fontWeight: 800 }}
        >
          Set up a class for {subject.name}
        </button>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
        Current context: <strong style={{ color: "#334155" }}>{classLabel}</strong>
      </div>

      {selectedClass && (
        <div style={{ marginTop: 12 }}>
          <SubjectLessonHandoff
            classId={selectedClass.id}
            subjectId={subject.id}
            purpose="overview"
            compact
          />
        </div>
      )}

      {(["prepare", "teach", "evidence"] as const).map((group) => (
        <div key={group} style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 750, color: "var(--teacher-ink, #1c2923)" }}>{groupCopy[group].title}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{groupCopy[group].help}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
            {tools.filter((tool) => tool.group === group).map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => open(tool)}
                style={{
                  minHeight: 82,
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  background: "#fff",
                  textAlign: "left",
                  padding: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 750, color: "var(--teacher-ink, #1c2923)" }}>{tool.label}</div>
                <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.45, color: "var(--teacher-muted, #627168)" }}>{tool.help}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
