#!/usr/bin/env python3
"""TOS-003: open exact lesson attendance immediately after Start Lesson.

Run from the Vibeschool repository root:

    python3 scripts/tos003-start-lesson-open-attendance.py

The patch is self-checking and modifies exactly one file.
"""

from pathlib import Path

PATH = Path("components/teacher/LessonPlanModal.tsx")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(
            f"ABORT: {label} anchor expected exactly once, found {count}. "
            "No files were changed."
        )
    return source.replace(old, new, 1)


def main() -> None:
    src = PATH.read_text(encoding="utf-8")

    out = replace_once(
        src,
        """import { useEffect, useRef, useState } from 'react'\n""",
        """import { useEffect, useRef, useState } from 'react'\nimport { useRouter } from 'next/navigation'\n""",
        "router import",
    )

    out = replace_once(
        out,
        """export default function LessonPlanModal({ slot, weekStart, taughtDate, onClose }: Props) {\n  const [phase,    setPhase]    = useState<Phase>('loading')\n""",
        """export default function LessonPlanModal({ slot, weekStart, taughtDate, onClose }: Props) {\n  const router = useRouter()\n  const [phase,    setPhase]    = useState<Phase>('loading')\n""",
        "router instance",
    )

    out = replace_once(
        out,
        """      setOccLifecycle(row.lifecycle)\n      showToast('Lesson started ✓')\n      refreshPulse('lesson')\n""",
        """      setOccLifecycle(row.lifecycle)\n      showToast('Lesson started ✓')\n      refreshPulse('lesson')\n\n      // TOS-003: attendance belongs to this exact teaching occurrence. The\n      // attendance page already validates and saves by timetable slot + date,\n      // so carry those identities immediately after the lifecycle transition.\n      const attendanceUrl =\n        `/teacher/attendance?mode=lesson` +\n        `&classId=${encodeURIComponent(slot.class_id)}` +\n        `&timetableSlotId=${encodeURIComponent(slot.id)}` +\n        `&date=${encodeURIComponent(taughtDate)}` +\n        `&subject=${encodeURIComponent(slot.subject)}`\n      router.push(attendanceUrl)\n""",
        "post-start attendance handoff",
    )

    PATH.write_text(out, encoding="utf-8")
    print("TOS-003 patch applied successfully.")
    print(f"Modified: {PATH}")
    print("Next: run git diff --check and npx tsc --noEmit -p .")


if __name__ == "__main__":
    main()
