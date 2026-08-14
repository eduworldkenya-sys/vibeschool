#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
failures: list[str] = []

def text(path: str) -> str:
    p = ROOT / path
    if not p.exists():
        failures.append(f"missing required file: {path}")
        return ""
    return p.read_text(encoding="utf-8")

def require(path: str, needle: str, message: str) -> None:
    body = text(path)
    if needle not in body:
        failures.append(f"{path}: {message}")

def forbid(path: str, needle: str, message: str) -> None:
    body = text(path)
    if needle in body:
        failures.append(f"{path}: {message}")

core = "lib/learner/profile-core.ts"
student_ctx = "lib/student-context.tsx"
student_profile = "app/student/profile/page.tsx"
goals = "app/student/profile/goals/page.tsx"
parent_profile = "app/parent/child/[id]/profile/page.tsx"
teacher_profile = "app/teacher/classhub/[id]/student/[studentId]/page.tsx"
admin_inbox = "app/admin/students/corrections/page.tsx"
admin_layout = "app/admin/students/layout.tsx"
prereq = "supabase/migrations/20260814111900_restore_pretracked_child_change_requests_prerequisite.sql"
hardening = "supabase/migrations/20260814112000_learner_profile_change_request_hardening.sql"
docs = "docs/LEARNER_PROFILE_ARCHITECTURE.md"

# Canonical learner identity.
require(core, ".from('students')", "Learner Core must pivot on public.students")
require(core, "getLearnerCoreIdentityForProfile", "authenticated learner lookup must be centralized")
require(core, "expectedClassId", "teacher-safe class-scoped lookup capability must remain available")
require(student_ctx, "getLearnerCoreIdentityForProfile", "StudentProvider must use Learner Core")
require(student_profile, "getLearnerCoreIdentity", "Student profile must use Learner Core")
require(parent_profile, "getLearnerCoreIdentity", "Parent profile must use Learner Core after link authorization")
require(teacher_profile, ".eq('id', studentId).eq('class_id', classId)", "Teacher learner identity must remain atomically class-scoped")

# Shared learning semantics and real goal-management journey.
require(student_profile, "summarizeAttendance", "Student profile attendance must use shared attendance semantics")
require(student_profile, "'/student/profile/goals'", "Profile goals CTA must open the dedicated goals surface")
require(goals, "updateStudentHomePreferences", "Goals page must use the typed Student Home service")
forbid(goals, "student_update_home_preferences", "Goals page must not bypass the typed service with a raw RPC")

# Parent correction flow must use canonical field names and expose status.
require(parent_profile, 'type CorrectionField = "name" | "admission_number" | "date_of_birth" | "gender"', "correction fields must be allowlisted")
require(parent_profile, '["Full name", data.name, "name"]', "full-name correction must map to canonical students.name")
require(parent_profile, 'from("child_change_requests")', "parent must be able to read/submit correction requests")
require(parent_profile, 'item.status === "pending"', "duplicate pending correction UX guard must remain")
forbid(parent_profile, '["Full name", data.name, "full_name"]', "legacy full_name correction key must not return")

# Database boundary: linked-parent only, append-only parent requests, unique pending request.
require(prereq, "alter table public.child_change_requests enable row level security", "pretracked prerequisite must fail closed with RLS")
require(prereq, "public.parent_student_links", "parent link must be checked by RLS")
require(prereq, "revoke all privileges on table public.child_change_requests from public, anon, authenticated", "prerequisite grants must be explicit")
require(prereq, "authorization-test: public.child_change_requests", "migration authorization declaration must be present")
require(hardening, "ux_child_change_requests_one_pending_field", "database must prevent duplicate pending corrections")
require(hardening, "revoke update, delete, truncate on table public.child_change_requests from authenticated", "parents must not mutate submitted/reviewer state")
require(hardening, "field in ('name','admission_number','date_of_birth','gender')", "database correction allowlist must remain narrow")
require(hardening, "list_school_child_change_requests", "school review inbox RPC must exist")
require(hardening, "review_child_change_request", "controlled reviewer mutation RPC must exist")
require(hardening, "sm.role in ('admin','owner')", "only verified live school authority roles may review")
forbid(hardening, "school_admin", "nonexistent school_members enum role must not be assumed")
if re.search(r"update\s+public\.students\s+set[^;]*updated_at", text(hardening), flags=re.I | re.S):
    failures.append(f"{hardening}: reviewer RPC must not assume students.updated_at exists")

# Receiving workflow must be discoverable and use only guarded RPCs.
require(admin_inbox, 'rpc("list_school_child_change_requests"', "admin inbox must load through authority-filtered RPC")
require(admin_inbox, 'rpc("review_child_change_request"', "admin inbox must review through controlled RPC")
require(admin_layout, "/admin/students/corrections", "correction inbox must be discoverable from Student administration")

# Documentation must match implemented authority.
require(docs, "append-only", "architecture must document append-only parent correction requests")
require(docs, "review_child_change_request", "architecture must identify the controlled review boundary")
require(docs, "RLS is the final boundary", "architecture must not treat UI checks as security")

if failures:
    print("Learner profile contract FAILED:")
    for failure in failures:
        print(f"- {failure}")
    sys.exit(1)

print("PASS: learner profile identity, correction authority, role projections and regression contract")
