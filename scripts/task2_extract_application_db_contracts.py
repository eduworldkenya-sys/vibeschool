#!/usr/bin/env python3
"""Extract literal Supabase table/RPC contracts used by application TypeScript.

The full literal inventory is diagnostic evidence, not a blanket Task 2 ownership
claim. Parallel/downstream work can legitimately reference contracts that are not
part of the Task 2 migration-foundation boundary yet. Task 2 therefore emits both:

- the complete literal application inventory, used to classify repository/production
  drift and to hand downstream reconciliation work to the owning task; and
- the explicit Task 2 shared-foundation contract, which is the only subset this
  task's zero-to-current reconstruction gate may enforce as a release blocker.

Dynamic/non-literal database access remains covered by generated types and
purpose-built contract tests. Supabase Storage `.storage.from("bucket")` calls are
excluded because bucket names are not PostgreSQL relations.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

# Next.js application/server code plus deployed Supabase Edge Functions.
SCAN_ROOTS = ("app", "components", "hooks", "lib", "supabase/functions")
EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
FROM_RE = re.compile(r"(?<!\.storage)\.from\(\s*(['\"])([A-Za-z_][A-Za-z0-9_]*)\1\s*\)")
RPC_RE = re.compile(r"\.rpc\(\s*(['\"])([A-Za-z_][A-Za-z0-9_]*)\1(?:\s*[,\)])")

# Task 2 owns deterministic reconstruction of this shared foundation. This list is
# intentionally aligned with scripts/sql/task2_database_integrity_verify.sql. Adding
# a downstream feature contract here requires an explicit dependency/ownership
# decision; literal application usage alone is not sufficient.
TASK2_REQUIRED_RELATIONS = (
    "schools",
    "profiles",
    "school_members",
    "students",
    "classes",
    "student_classes",
    "subjects",
    "academic_terms",
    "teacher_classes",
    "timetable_slots",
    "lesson_plans",
    "attendance",
    "homework",
    "homework_submissions",
    "class_join_requests",
    "exam_results",
    "content_learning_events",
    "notifications",
    "assessment_definitions",
    "assessment_assignments",
    "assessment_attempts",
    "assessment_items",
    "assessment_responses",
)

# Task 1 owns the composite auth journey. Task 2 certifies only the shared auth and
# identity primitives that must already exist before Task 1 reconciles onto T2.
TASK2_REQUIRED_RPCS = (
    "get_my_role",
    "get_my_onboarding_state",
    "get_my_auth_access_state",
    "current_student_id",
)


def _write_names(path: Path, names: list[str] | tuple[str, ...]) -> None:
    path.write_text("\n".join(names) + ("\n" if names else ""), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", default=".task2-artifacts/application-contracts")
    args = parser.parse_args()

    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    relations: dict[str, set[str]] = {}
    rpcs: dict[str, set[str]] = {}

    for root_name in SCAN_ROOTS:
        root = Path(root_name)
        if not root.exists():
            continue
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.suffix not in EXTENSIONS:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            relpath = path.as_posix()
            for match in FROM_RE.finditer(text):
                relations.setdefault(match.group(2), set()).add(relpath)
            for match in RPC_RE.finditer(text):
                rpcs.setdefault(match.group(2), set()).add(relpath)

    relation_names = sorted(relations)
    rpc_names = sorted(rpcs)

    # Preserve the original filenames for full-inventory drift diagnostics.
    _write_names(out / "relations.txt", relation_names)
    _write_names(out / "rpcs.txt", rpc_names)
    _write_names(out / "task2-required-relations.txt", TASK2_REQUIRED_RELATIONS)
    _write_names(out / "task2-required-rpcs.txt", TASK2_REQUIRED_RPCS)

    report = {
        "relations": {k: sorted(v) for k, v in sorted(relations.items())},
        "rpcs": {k: sorted(v) for k, v in sorted(rpcs.items())},
        "relation_count": len(relation_names),
        "rpc_count": len(rpc_names),
        "task2_required_relations": list(TASK2_REQUIRED_RELATIONS),
        "task2_required_rpcs": list(TASK2_REQUIRED_RPCS),
        "task2_required_relation_count": len(TASK2_REQUIRED_RELATIONS),
        "task2_required_rpc_count": len(TASK2_REQUIRED_RPCS),
    }
    (out / "contracts.json").write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "relation_count": len(relation_names),
                "rpc_count": len(rpc_names),
                "task2_required_relation_count": len(TASK2_REQUIRED_RELATIONS),
                "task2_required_rpc_count": len(TASK2_REQUIRED_RPCS),
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
