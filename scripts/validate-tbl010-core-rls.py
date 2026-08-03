#!/usr/bin/env python3
"""Static validator for the TBL-010 core timetable RLS recovery migration."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = (
    ROOT
    / "supabase/migrations/"
    "20260803160000_tbl010_core_rls_recovery.sql"
)

if not MIGRATION.is_file():
    print("TBL-010 validation FAILED: migration missing")
    raise SystemExit(1)

text = MIGRATION.read_text(encoding="utf-8")
lower = text.lower()

errors: list[str] = []

tables = (
    "timetable_slots",
    "teacher_classes",
    "teaching_occurrences",
    "school_periods",
)

for table in tables:
    required = (
        f"alter table public.{table} enable row level security;"
    )
    if required not in lower:
        errors.append(f"RLS enablement missing for {table}")

required_policies = {
    "teachers_manage_own_slots": (
        "public.timetable_slots",
        "all",
    ),
    "timetable_slots_admin": (
        "public.timetable_slots",
        "all",
    ),
    "timetable_slots_student_read": (
        "public.timetable_slots",
        "select",
    ),
    "pol_teacher_classes_select": (
        "public.teacher_classes",
        "select",
    ),
    "teacher_classes_admin_insert": (
        "public.teacher_classes",
        "insert",
    ),
    "teacher_classes_admin_update": (
        "public.teacher_classes",
        "update",
    ),
    "teacher_classes_admin_delete": (
        "public.teacher_classes",
        "delete",
    ),
    "teaching_occurrences_teacher_read": (
        "public.teaching_occurrences",
        "select",
    ),
    "teaching_occurrences_admin_read": (
        "public.teaching_occurrences",
        "select",
    ),
    "teaching_occurrences_no_delete": (
        "public.teaching_occurrences",
        "delete",
    ),
    "school_periods_teacher_read": (
        "public.school_periods",
        "select",
    ),
    "school_periods_admin_all": (
        "public.school_periods",
        "all",
    ),
}

for name, (table, command) in required_policies.items():
    pattern = re.compile(
        rf"create\s+policy\s+{re.escape(name)}\s+"
        rf"on\s+{re.escape(table)}\s+"
        rf"for\s+{command}\s+"
        rf"to\s+authenticated\b",
        re.IGNORECASE | re.DOTALL,
    )

    if not pattern.search(text):
        errors.append(
            f"missing or malformed policy {name} "
            f"({table}, {command})"
        )

# Assignment writes must be admin-controlled, never teacher self-write.
for obsolete in (
    "pol_teacher_classes_insert",
    "pol_teacher_classes_update",
    "pol_teacher_classes_delete",
):
    create_pattern = re.compile(
        rf"create\s+policy\s+{obsolete}\b",
        re.IGNORECASE,
    )
    if create_pattern.search(text):
        errors.append(
            f"unsafe historical self-write policy recreated: {obsolete}"
        )

for policy in (
    "teacher_classes_admin_insert",
    "teacher_classes_admin_update",
    "teacher_classes_admin_delete",
):
    start = lower.find(f"create policy {policy}")
    if start < 0:
        continue

    end = lower.find(";", start)
    block = lower[start:end]

    if "is_school_admin(school_id)" not in block:
        errors.append(
            f"{policy} does not require school-admin authority"
        )

# Occurrence direct write policies must be removed and not recreated.
for forbidden in (
    "create policy teaching_occurrences_teacher_write",
    "create policy teaching_occurrences_teacher_update",
):
    if forbidden in lower:
        errors.append(
            f"forbidden direct occurrence write policy present: {forbidden}"
        )

if "using (false)" not in lower:
    errors.append(
        "explicit teaching_occurrences no-delete condition missing"
    )

# Student timetable reads must require current membership and school identity.
student_start = lower.find(
    "create policy timetable_slots_student_read"
)
student_end = lower.find(";", student_start)
student_block = lower[student_start:student_end]

for requirement in (
    "sc.is_current = true",
    "sc.class_id = timetable_slots.class_id",
    "sc.school_id = timetable_slots.school_id",
    "s.profile_id = (select auth.uid())",
):
    if requirement not in student_block:
        errors.append(
            "student timetable policy missing: " + requirement
        )

# Teacher slot writes must still require the exact assignment tuple.
teacher_start = lower.find(
    "create policy teachers_manage_own_slots"
)
teacher_end = lower.find(";", teacher_start)
teacher_block = lower[teacher_start:teacher_end]

for requirement in (
    "tc.teacher_id = (select auth.uid())",
    "tc.school_id = timetable_slots.school_id",
    "tc.class_id = timetable_slots.class_id",
    "tc.subject_id = timetable_slots.subject_id",
):
    if requirement not in teacher_block:
        errors.append(
            "teacher slot policy missing: " + requirement
        )

if errors:
    print("TBL-010 validation FAILED:")
    for error in errors:
        print("  -", error)
    raise SystemExit(1)

print("TBL-010 core RLS static validation PASSED")
