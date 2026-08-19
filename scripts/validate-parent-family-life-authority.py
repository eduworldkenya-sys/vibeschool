#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20260819235930_parent_family_life_bola_closure.sql"
text = MIGRATION.read_text(encoding="utf-8")


def require(needle: str, label: str) -> None:
    if needle not in text:
        raise AssertionError(f"Parent Family Life contract missing {label}: {needle}")


for table in ("child_goals", "child_skills", "child_books", "child_events"):
    require(f"{table}.parent_id = (select auth.uid())", f"{table} ownership binding")
    require(f"public.is_parent_of_student({table}.student_id)", f"{table} active relationship binding")

require("g.student_id = child_goal_milestones.student_id", "milestone learner/goal consistency")
require("public.is_parent_of_student(g.student_id)", "milestone active relationship")
require("create or replace function public.parent_get_linked_pathway_passports", "Pathway Passport Parent projection")
require("coalesce(l.access_level, 'full') <> 'none'", "Pathway Passport revocation filter")
require("from public, anon, service_role", "Pathway Passport execute minimisation")
require("to authenticated", "Pathway Passport authenticated grant")

print("Parent Family Life Cross-Child Authority Contract: PASS")
