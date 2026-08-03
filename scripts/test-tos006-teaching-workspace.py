#!/usr/bin/env python3
"""
Static contract tests for TOS-006 Teaching Workspace consolidation.

These tests intentionally inspect the shared TypeScript controller without
requiring Node execution. Runtime TypeScript validation remains covered by the
repository's normal TypeScript/build gate.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT / "lib/teaching/workspace.ts"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    text = WORKSPACE.read_text(encoding="utf-8")

    require(
        "export function deriveTeachingWorkspace" in text,
        "shared workspace resolver is missing",
    )

    require(
        "TeachingOccurrence" in text,
        "workspace does not consume TeachingOccurrence",
    )

    require(
        "OccurrenceKey" in text,
        "workspace does not preserve OccurrenceKey",
    )

    require(
        "from '@/lib/supabase'" not in text
        and 'from "@/lib/supabase"' not in text
        and "supabase." not in text
        and "supabase(" not in text,
        "workspace controller must remain database-independent",
    )

    require(
        "useState" not in text
        and "useEffect" not in text
        and "useMemo" not in text,
        "workspace controller must remain React-independent",
    )

    required_capabilities = [
        "canStart",
        "canComplete",
        "canRecover",
        "canCaptureAttendance",
        "canCaptureEvidence",
        "canAssignHomework",
        "canWriteReflection",
    ]

    for capability in required_capabilities:
        require(
            capability in text,
            f"missing workspace capability: {capability}",
        )

    required_stages = [
        "'plan'",
        "'attendance'",
        "'teach'",
        "'evidence'",
        "'homework'",
        "'assessment'",
        "'reflection'",
        "'complete'",
    ]

    for stage in required_stages:
        require(
            stage in text,
            f"missing teaching stage: {stage}",
        )

    lifecycle_cases = [
        "case 'planned':",
        "case 'ready':",
        "case 'in_progress':",
        "case 'completed':",
        "case 'missed':",
        "case 'cancelled':",
        "case 'rescheduled':",
    ]

    for case in lifecycle_cases:
        require(
            case in text,
            f"primary action omits lifecycle: {case}",
        )

    require(
        re.search(
            r"occurrence\.attendance\.state\s*===\s*'complete'",
            text,
        )
        is not None,
        "attendance completion is not derived from TeachingOccurrence",
    )

    require(
        re.search(
            r"occurrence\.evidence\.count\s*>\s*0",
            text,
        )
        is not None,
        "evidence completion is not derived from TeachingOccurrence",
    )

    require(
        "occurrence.homework.issued" in text,
        "homework completion is not derived from TeachingOccurrence",
    )

    require(
        "occurrence.reflection.completed" in text,
        "reflection completion is not derived from TeachingOccurrence",
    )

    timetable_text = (
        ROOT / "app/teacher/timetable/page.tsx"
    ).read_text(encoding="utf-8")

    require(
        "deriveTeachingWorkspace" in timetable_text,
        "timetable drawer does not consume shared workspace",
    )

    require(
        "const lifecycleAction:" not in timetable_text,
        "timetable drawer still owns a private lifecycle action map",
    )

    require(
        "workspace?.canCaptureAttendance" in timetable_text,
        "attendance availability is not derived from workspace",
    )

    require(
        "workspace?.canRecover" in timetable_text,
        "recovery availability is not derived from workspace",
    )

    print("PASS: timetable drawer consumes shared workspace")
    print("PASS: timetable private lifecycle map removed")
    print("PASS: drawer capabilities derive from workspace")

    print("PASS: shared resolver exists")
    print("PASS: controller consumes TeachingOccurrence")
    print("PASS: controller preserves OccurrenceKey")
    print("PASS: controller is database-independent")
    print("PASS: controller is React-independent")
    print("PASS: all lifecycle capabilities are centralized")
    print("PASS: all workspace stages are centralized")
    print("PASS: all lifecycle states are handled")
    print("PASS: lesson progress derives from occurrence state")
    print("TOS-006 teaching workspace contract tests PASSED")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
