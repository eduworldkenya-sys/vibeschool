#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PRIVACY = ROOT / "supabase/migrations/20260819021500_parent_core_journey_privacy_closure.sql"
COMMUNICATION = ROOT / "supabase/migrations/20260819021600_parent_communication_revocation_closure.sql"
LEARN = ROOT / "app/parent/learn/page.tsx"
CONNECT_ALIAS = ROOT / "app/parent/connect-child/page.tsx"


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
learn = read(LEARN)
connect_alias = read(CONNECT_ALIAS)

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

# Mobile child switching must fail closed before every asynchronous request.
require(learn, "const requestVersion = useRef(0)", "request generation guard")
require(learn, "setState(EMPTY)", "child-state clearing")
require(learn, "version !== requestVersion.current", "stale response rejection")
require(learn, '.not("released_at", "is", null)', "frontend released-result filter")
require(learn, '.eq("status", "published")', "published progress filter")
require(learn, "No cached child data has been shown", "fail-closed network copy")
forbid(learn, "cache.current", "cross-child result cache")
forbid(learn, "new Map<string, CachedData>", "legacy cross-child cache")

# Empty-state linking action must never become a dead route.
require(connect_alias, "redirect('/parent/connect')", "connect-child compatibility route")

print("Parent Core Journey Contract: PASS")
