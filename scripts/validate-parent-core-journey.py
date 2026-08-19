#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PRIVACY = ROOT / "supabase/migrations/20260819021500_parent_core_journey_privacy_closure.sql"
COMMUNICATION = ROOT / "supabase/migrations/20260819021600_parent_communication_revocation_closure.sql"
POST_TASK1_CLAIM = ROOT / "supabase/migrations/20260819235910_parent_claim_least_authority_post_task1.sql"
CANONICAL_CREATION = ROOT / "supabase/migrations/20260819235850_auth_legacy_parent_child_creation_tombstone.sql"
NOTIFICATION_NAV = ROOT / "supabase/migrations/20260819021900_parent_notification_navigation_closure.sql"
LEARN = ROOT / "app/parent/learn/page.tsx"
ASSESSMENTS = ROOT / "app/parent/assessments/page.tsx"
CHILD_HUB = ROOT / "app/parent/child/[id]/page.tsx"
CHILD_HOMEWORK = ROOT / "app/parent/child/[id]/homework/page.tsx"
LINK = ROOT / "app/parent/link-child/page.tsx"
CONNECT_ALIAS = ROOT / "app/parent/connect-child/page.tsx"
CREATE_CHILD = ROOT / "app/parent/create-child/page.tsx"


def read(path: Path) -> str:
    if not path.exists():
        raise AssertionError(f"required Parent contract file missing: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def require(text: str, needle: str, label: str) -> None:
    if needle not in text:
        raise AssertionError(f"Parent core journey contract missing {label}: {needle}")


def forbid(text: str, needle: str, label: str) -> None:
    if needle in text:
        raise AssertionError(f"Parent core journey contract regressed {label}: {needle}")


privacy = read(PRIVACY)
communication = read(COMMUNICATION)
claim = read(POST_TASK1_CLAIM)
canonical_creation = read(CANONICAL_CREATION)
notification_nav = read(NOTIFICATION_NAV)
learn = read(LEARN)
assessments = read(ASSESSMENTS)
child_hub = read(CHILD_HUB)
child_homework = read(CHILD_HOMEWORK)
link = read(LINK)
connect_alias = read(CONNECT_ALIAS)
create_child = read(CREATE_CHILD)

# Canonical parent -> student relationship and revocation semantics.
require(privacy, "is_parent_of_student", "canonical relationship predicate")
require(privacy, "coalesce(psl.access_level, 'full') <> 'none'", "revoked-link denial")
require(privacy, "assessment_gradebook_entries.released_at is not null", "released assessment gate")
require(privacy, "e.is_locked = true", "legacy exam publication boundary")
require(privacy, "drop policy if exists trad_grades_parent_read", "publication-less legacy grade closure")
require(privacy, "drop policy if exists finance_fee_payments_parent_insert", "authoritative fee ledger write closure")
require(privacy, "coalesce(psl.can_view_finance, false)", "explicit finance permission")
require(privacy, 'drop policy if exists "parent reads audit log"', "internal audit-log minimisation")

# Revocation must also close notifications and child-scoped communication.
require(communication, "parent_events.student_id is null", "non-child notification allowance")
require(communication, "public.is_parent_of_student(parent_events.student_id)", "revoked child event denial")
require(communication, "private.vc_child_scope_authorized", "VibeConnect child-scope guard")
require(communication, "active parent relationship required", "thread creation revocation guard")
require(communication, 'drop policy if exists "thread members can insert messages"', "message-send reauthorization")

# Task 1 now owns role-transition safety. Task 6 must run after it and narrow the
# family relationship grant to least authority without weakening Task 1.
require(claim, "v_role is distinct from 'parent'", "established Parent identity requirement")
require(claim, "role in ('parent', 'shared')", "student-only claim rejection")
require(claim, "v_code_row.parent_claimed_at is not null", "one-time Parent claim")
require(claim, "auth.uid() <> p_user_id", "claim authenticated-account binding")
require(claim, "false,\n      false,\n      true,\n      'full'", "no primary/pickup authority grant")
require(claim, "return case when v_existing_link_id is null then 'success' else 'already_linked' end", "idempotent relationship recovery")
require(claim, "revoke all on function public.redeem_parent_claim(text,uuid)", "claim execute minimisation")
require(claim, "from public, anon, service_role", "service-role direct claim revocation")
require(claim, "grant execute on function public.redeem_parent_claim(text,uuid) to authenticated", "authenticated Parent claim boundary")
require(link, "one-time", "truthful claim-code copy")
require(link, "does not automatically grant pickup authority", "minimum-authority explanation")
forbid(link, "same code can be used by the parent and the student", "false reusable-code promise")

# Canonical learner creation is owned by Task 1's fail-closed compatibility
# tombstone. Task 6 must never reopen it for service_role or browsers.
require(canonical_creation, "verified_parent_child_relationship_required", "canonical learner creation tombstone")
require(canonical_creation, "from public, anon, authenticated, service_role", "all-role learner creation revocation")
forbid(canonical_creation, "grant execute on function public.create_child_for_parent", "legacy learner creation regrant")
require(create_child, "redirect('/parent/link-child')", "retired self-create route")
forbid(create_child, "create_child_for_parent", "browser canonical learner creation")

# Child-scoped events must not navigate to dead routes or sibling-ambiguous views.
require(notification_nav, "private.parent_event_normalize_action_href", "notification action normalizer")
require(notification_nav, "action_href like '/parent/report-cards%'", "dead report-card route repair")
require(notification_nav, "action_href like '/parent/learn?studentId=%'", "ambiguous learning route repair")
require(notification_nav, "'/parent/child/' || new.student_id::text", "deterministic child destination")

# Mobile child switching must fail closed before every asynchronous request.
require(learn, "const requestVersion = useRef(0)", "request generation guard")
require(learn, "setState(EMPTY)", "child-state clearing")
require(learn, "version !== requestVersion.current", "stale response rejection")
require(learn, '.not("released_at", "is", null)', "frontend released-result filter")
require(learn, '.eq("status", "published")', "published progress filter")
require(learn, "No cached child data has been shown", "fail-closed network copy")
forbid(learn, "cache.current", "cross-child result cache")
forbid(learn, "new Map<string, CachedData>", "legacy cross-child cache")

# Assessments must clear one child's rendered evidence before resolving another
# browser-supplied child ID, and the deep-link must be re-authorized by RLS.
require(assessments, "setStudentId(null)", "assessment child-id clearing")
require(assessments, "setStudentName('Learner')", "assessment learner-name clearing")
require(assessments, "setSummary(null)", "assessment sibling-summary clearing")
require(assessments, "setLoading(true)", "assessment child-switch loading gate")
require(assessments, ".from('students')", "assessment deep-link RLS authority gate")
require(assessments, "This learner is not linked to your active parent account.", "assessment unauthorized-child fail-closed state")
require(assessments, "router.push(`/parent/child/${studentId}`)", "assessment valid return navigation")
forbid(assessments, "/parent/report-cards", "retired report-card route")

# The canonical child hub must have real core actions rather than pilot dead ends.
require(child_hub, "`/parent/child/${child.id}/homework`", "child-scoped homework navigation")
require(child_hub, "`/parent/child/${child.id}/messages`", "child-scoped communication navigation")
require(child_hub, "`/parent/assessments?studentId=${child.id}`", "child-scoped released-results navigation")
forbid(child_hub, "Homework coming soon", "dead homework action")
forbid(child_hub, "Send Encouragement", "non-functional encouragement action")
require(child_homework, '.from("students")', "homework deep-link RLS authority gate")
require(child_homework, '.from("homework")', "homework teacher-assignment source")
require(child_homework, '.from("homework_submissions")', "homework learner-status source")
require(child_homework, "No cached data from another learner has been shown", "homework fail-closed network state")
require(child_homework, "const requestVersion = useRef(0)", "homework request generation guard")
require(child_homework, "const version = ++requestVersion.current", "homework request version allocation")
require(child_homework, "version !== requestVersion.current", "homework stale response rejection")
require(child_homework, "setChildName(\"\")", "homework child-name clearing")
require(child_homework, "setItems([])", "homework sibling-data clearing")
require(child_homework, "requestVersion.current += 1", "homework unmount invalidation")

# Empty-state linking action must enter the verified claim flow.
require(connect_alias, "redirect('/parent/link-child')", "verified child-link compatibility route")

print("Parent Core Journey Contract: PASS")
