#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20260819235920_parent_consequential_rpc_revocation_closure.sql"
text = MIGRATION.read_text(encoding="utf-8")


def require(needle: str, label: str) -> None:
    if needle not in text:
        raise AssertionError(f"Parent consequential RPC contract missing {label}: {needle}")


def forbid(needle: str, label: str) -> None:
    if needle in text:
        raise AssertionError(f"Parent consequential RPC contract regressed {label}: {needle}")


# Retire the sibling-ambiguous generic thread entrypoint.
require("revoke all on function public.parent_start_conversation(uuid,uuid,text)", "legacy thread RPC retirement")
require("from public, anon, authenticated, service_role", "legacy thread execute revocation")

# Canonical conversation creation is child-scoped, current-enrollment scoped,
# recipient-scoped and re-checks relationship authority.
require("create or replace function public.parent_start_child_thread", "canonical child thread RPC")
require("if not public.is_parent_of_student(p_student_id)", "active relationship check")
require("from public.student_classes sc", "canonical current enrollment")
require("sc.is_current = true", "current enrollment only")
require("tc.school_id = v_school_id", "teacher school scope")
require("t.student_id = p_student_id", "sibling-isolated thread reuse")
require("t.school_id = v_school_id", "cross-school thread isolation")
require("vp.left_at is null", "active participant membership")
require("student_id,\n    type,", "child identity persisted on new thread")
require("grant execute on function public.parent_start_child_thread(uuid,uuid,text)\n  to authenticated", "least execute authority")

# Stale sessions cannot retain consequential learner-state mutation.
require("create or replace function public.parent_set_student_self_use", "self-use RPC closure")
require("if not public.is_parent_of_student(p_student_id)", "self-use revocation check")
require("and deleted_at is null", "deleted learner mutation denial")

# SECURITY DEFINER result projection must implement academic release itself.
require("create or replace function public.parent_get_student_kcse_brief", "Parent KCSE brief closure")
require("and released_at is not null", "released gradebook filter")
require("if not public.is_parent_of_student(p_student_id)", "KCSE brief active relationship")
forbid("where student_id = p_student_id\n        order by released_at", "unreleased gradebook projection")

print("Parent Consequential RPC Authority Contract: PASS")
