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
require(listing, "Boolean(p.scheme_id && p.curriculum_outcome_id)", "Scheme/outcome readiness")
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

print("PASS: prepared lesson scope, outcome, mobile interaction and draft failure-isolation contracts")
