#!/usr/bin/env python3
"""Regression contract for prepared lessons, curriculum authority and mobile UX.

No live records, auth secrets or network calls. Run in CI before production merge.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
draft = (ROOT / "lib/teaching/lessonDrafts.ts").read_text()
prepare = (ROOT / "app/teacher/lessonplan/prepare/page.tsx").read_text()
listing = (ROOT / "app/teacher/lessonplan/page.tsx").read_text()
modal = (ROOT / "components/teacher/LessonPlanModal.tsx").read_text()
migration = (ROOT / "supabase/migrations/20261015123212_lesson_drafts_production_reconcile_20261015.sql").read_text().lower()

def require(content: str, phrase: str, purpose: str) -> None:
    assert phrase in content, f"{purpose}: missing {phrase!r}"

# Missing draft API may not invalidate legitimate operating assignments.
require(prepare, "Promise.allSettled", "isolated loading")
require(prepare, "setAssignments(rows)", "independent assignments")
require(prepare, "setDraftError", "draft-specific failure")
require(prepare, "setScheduleError", "timetable-specific failure")

# Only explicitly verified, canonical outcomes may be offered as linked sources.
require(prepare, ".eq('status', 'verified')", "verified outcomes")
require(prepare, "curriculumOutcomeId: selectedScheme?.curriculum_outcome_id", "draft outcome lineage")
require(draft, "curriculum_outcome_id", "repository outcome lineage")
require(listing, "outcomeBySlot", "readiness needs actual outcome")
require(listing, "verifiedOutcomes.has(p.curriculum_outcome_id)", "live verified-outcome readiness")
require(listing, "scheme.curriculum_outcome_id === p.curriculum_outcome_id", "matching Scheme outcome")
require(listing, "scheme.school_id === resolvedSchoolId", "school identity")
require(listing, "scheme.class_id === p.class_id", "class identity")
require(listing, "readinessState(plan, curriculumLinked)", "readiness classification")

# Prepared draft ownership, cross-school and class-subject authorization.
for expression in (
    "create table if not exists public.lesson_plan_drafts",
    "enable row level security",
    "public.lesson_draft_authorized",
    "tc.school_id = p_school_id",
    "tc.subject_id = p_subject_id",
    "new.teacher_id is distinct from auth.uid()",
    "new.curriculum_outcome_id",
    "co.status = 'verified'",
    "v_draft.school_id is distinct from v_slot.school_id",
    "v_draft.subject_id is distinct from v_slot.subject_id",
    "v_dow <> v_slot.day_of_week",
    "p_taught_date > v_slot.effective_until",
):
    require(migration, expression, "DB scope and identity")

# Attachment must never clone delivered teaching records.
for forbidden in ("insert into public.attendance", "insert into public.lesson_evidence", "insert into public.teaching_occurrences", "delete from public.lesson_plans"):
    assert forbidden not in migration, f"unexpected teaching-state write: {forbidden}"

# In-place context, with a deliberate secondary option to open a full workspace.
require(modal, "setWorkspacePanel(name)", "in-place sections")
require(modal, "workspacePanel !== 'Lesson'", "in-place panel")
require(modal, "Open full Scheme", "explicit full-page fallback")
require(modal, "displayLessonTime(slot.start)", "human-readable timetable")
require(modal, "Review lesson time", "unusual timetable disclosure")
require(listing, "onClick={()=>setReadinessFilter", "immediate plan filtering")
require(prepare, "editDraft(draft)", "editable prepared lesson")
require(prepare, "attach(draft,target)", "dated attachment")

# An already scheduled plan may never be silently substituted for a
# different draft. Repeated attachment of the same draft remains idempotent.
attach_sql = (ROOT / "supabase/migrations/20261015140000_lesson_draft_attachment_lineage.sql").read_text().lower()
for expression in (
    "add column if not exists prepared_draft_id",
    "lp.prepared_draft_id",
    "if v_existing_draft = p_draft_id then",
    "occurrence_already_has_different_plan",
    "draft_curriculum_review_required",
    "prepared_draft_id,",
    "create or replace function public.guard_lesson_plan_prepared_draft",
    "prepared_draft_provenance_immutable",
    "prepared_draft_provenance_mismatch",
    "d.school_id = new.school_id",
    "d.subject_id = new.subject_id",
    "ts.teacher_id = new.teacher_id",
):
    require(attach_sql, expression, "prepared draft lineage and collision control")
for forbidden in ("insert into public.attendance", "insert into public.lesson_evidence", "insert into public.teaching_occurrences"):
    assert forbidden not in attach_sql, f"unexpected teaching-state mutation: {forbidden}"
require(prepare, "setExistingPlanTarget(target)", "conflict navigation")
require(prepare, "Open existing lesson", "teacher-facing collision resolution")
require(prepare, "if (schemeId && !selectedScheme)", "linked Scheme edit preservation")

# Grade 1 English official source is an evidence reference, never a fake
# verified outcome or an invented Term 3 curriculum assignment.
hq = (ROOT / "app/hq/curriculum-authority/page.tsx").read_text()
official_source = "Grade-1-3-English-Activities-Revised-Sept.pdf"
require(modal, official_source, "Grade 1 in-place Scheme source reference")
require(modal, "No current-term Scheme lesson is linked", "honest Scheme gap")
require(modal, "timetableSlotId:slot.id", "preserve dated lesson identity when navigating")
require(prepare, official_source, "Prepare Ahead official source reference")
require(prepare, "Official reference only", "no false curriculum readiness")
require(hq, official_source, "HQ official Grade 1 evidence discovery")
require(hq, "grade.trim().toLowerCase() === \"grade 1\"", "source provenance is grade-specific")
require(hq, "owner-reviewed before any outcome promotion", "owner authority retained")

print("PASS: prepared lesson scope, outcome, mobile interaction and draft failure-isolation contracts")
