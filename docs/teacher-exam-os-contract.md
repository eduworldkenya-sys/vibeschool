# Teacher Exam OS Canonical Contract

## Product identity

Teacher-facing navigation uses **Exams**. The workspace title is **Exam Centre**. The existing production route `/teacher/results` remains the canonical implementation route to avoid breaking report-card and workbook links. `/teacher/exams` is a compatibility redirect only.

## One-write authority

Exam marks are written only through `saveCanonicalExamResult(s)` → `teacher_save_exam_result(s)`. Exam Centre, Class Workbook and Twin actions must not create parallel result stores or direct upserts.

## Context handoff

SubjectHub and Class Hub carry known `classId` and `subjectId` into Exam Centre. Teachers should not re-select context that VibeSchool already knows.

## Teacher journey

1. Assess → Exams.
2. Choose an existing shared exam, class and subject.
3. Continue the mark sheet until every learner is recorded or marked absent.
4. Locked exams are read-only.
5. Use Explore for exam intelligence and Report Cards for reporting.
6. Workbook, Progress and learner intelligence consume the same canonical result records.

## Guardrails

- Unknown/empty roster stays explicit; the UI must not silently invent learners.
- Marks remain constrained to 0–100 by the existing canonical authority.
- Existing optimistic-concurrency checks remain intact.
- A locked exam rejects consequential writes at both UI and database authority layers.
- No route may advertise `/teacher/exams` as a standalone implementation until it becomes the canonical route; today it redirects.
