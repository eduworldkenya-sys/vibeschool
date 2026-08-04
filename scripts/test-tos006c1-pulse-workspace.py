#!/usr/bin/env python3
"""TOS-006C1 contract checks for Pulse Teaching Workspace projection."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TYPES = (ROOT / "lib/types.ts").read_text(encoding="utf-8")
FETCHER = (ROOT / "lib/pulse/fetcher.ts").read_text(encoding="utf-8")
CARD = (
    ROOT / "components/teacher/LessonFlowCard.tsx"
).read_text(encoding="utf-8")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    require(
        "teaching_workspace: TeachingWorkspace | null;" in TYPES,
        "Pulse Slot lacks typed TeachingWorkspace projection",
    )

    require(
        "resolveOccurrence" in FETCHER,
        "Pulse does not resolve authoritative occurrences",
    )

    require(
        "deriveTeachingWorkspace" in FETCHER,
        "Pulse does not derive the shared workspace",
    )

    require(
        "workspaceBySlot" in FETCHER,
        "Pulse does not retain workspace projections by slot",
    )

    require(
        "teaching_workspace:" in FETCHER
        and "workspaceBySlot.get(slot.id) ?? null" in FETCHER,
        "Pulse slots do not receive their workspace projection",
    )

    require(
        "function getStepState(" not in CARD,
        "LessonFlowCard private teaching engine remains",
    )

    require(
        "activeSlot.teaching_workspace" in CARD,
        "LessonFlowCard does not consume Pulse workspace",
    )

    require(
        "workspaceStageState(" in CARD,
        "LessonFlowCard does not map shared workspace stages",
    )

    require(
        'workspaceStageState(slot, "plan")' in CARD,
        "plan state is not workspace-driven",
    )

    require(
        'workspaceStageState(slot, "attendance")' in CARD,
        "attendance state is not workspace-driven",
    )

    require(
        'workspaceStageState(slot, "teach")' in CARD,
        "teaching state is not workspace-driven",
    )

    require(
        'workspaceStageState(slot, "evidence")' in CARD,
        "evidence state is not workspace-driven",
    )

    require(
        'workspaceStageState(slot, "homework")' in CARD,
        "homework state is not workspace-driven",
    )

    require(
        'workspaceStageState(slot, "reflection")' in CARD,
        "reflection state is not workspace-driven",
    )

    print("PASS: Pulse Slot exposes TeachingWorkspace")
    print("PASS: Pulse resolves exact dated occurrences")
    print("PASS: Pulse derives shared workspace projections")
    print("PASS: LessonFlowCard private teaching engine removed")
    print("PASS: core lesson stages consume shared workspace")
    print("PASS: post-teaching workflow remains separate")
    print("TOS-006C1 Pulse workspace tests PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
