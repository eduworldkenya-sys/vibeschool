#!/usr/bin/env python3
"""TOS-004: return from saved lesson attendance to the exact lesson workspace.

Run from the Vibeschool repository root:

    python3 scripts/tos004-return-to-lesson-after-attendance.py

The patch is self-checking and modifies exactly two files.
"""

from pathlib import Path

LESSON_MODAL = Path("components/teacher/LessonPlanModal.tsx")
ATTENDANCE = Path("app/teacher/attendance/page.tsx")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(
            f"ABORT: {label} anchor expected exactly once, found {count}. "
            "No files were changed."
        )
    return source.replace(old, new, 1)


def main() -> None:
    lesson_src = LESSON_MODAL.read_text(encoding="utf-8")
    attendance_src = ATTENDANCE.read_text(encoding="utf-8")

    lesson_new = replace_once(
        lesson_src,
        """        `&timetableSlotId=${encodeURIComponent(slot.id)}` +\n        `&date=${encodeURIComponent(taughtDate)}` +\n        `&subject=${encodeURIComponent(slot.subject)}`\n""",
        """        `&timetableSlotId=${encodeURIComponent(slot.id)}` +\n        `&date=${encodeURIComponent(taughtDate)}` +\n        `&subjectId=${encodeURIComponent(slot.subject_id)}` +\n        `&subject=${encodeURIComponent(slot.subject)}`\n""",
        "attendance subject identity",
    )

    attendance_new = replace_once(
        attendance_src,
        """  const urlDate            = searchParams.get('date')\n  const urlTimetableSlotId = searchParams.get('timetableSlotId')\n""",
        """  const urlDate            = searchParams.get('date')\n  const urlSubjectId       = searchParams.get('subjectId')\n  const urlTimetableSlotId = searchParams.get('timetableSlotId')\n""",
        "attendance route subject identity",
    )

    attendance_new = replace_once(
        attendance_new,
        """      setSaveState('saved')\n      refreshPulse('attendance')\n      setTimeout(() => setSaveState('idle'), 2500)\n""",
        """      setSaveState('saved')\n      refreshPulse('attendance')\n\n      // TOS-004: lesson-mode attendance is a task inside the active teaching\n      // workspace. After a successful authoritative save, reopen the exact\n      // lesson occurrence rather than leaving the teacher stranded here.\n      if (isLesson && activeSlot && urlDate && urlSubjectId) {\n        const lessonUrl =\n          `/teacher/lessonplan?` +\n          `timetableSlotId=${encodeURIComponent(activeSlot.id)}` +\n          `&date=${encodeURIComponent(urlDate)}` +\n          `&subjectId=${encodeURIComponent(urlSubjectId)}` +\n          `&classId=${encodeURIComponent(activeSlot.classId)}`\n        router.push(lessonUrl)\n      } else {\n        setTimeout(() => setSaveState('idle'), 2500)\n      }\n""",
        "attendance save return",
    )

    # Validate every anchor before writing either file.
    LESSON_MODAL.write_text(lesson_new, encoding="utf-8")
    ATTENDANCE.write_text(attendance_new, encoding="utf-8")

    print("TOS-004 patch applied successfully.")
    print(f"Modified: {LESSON_MODAL}")
    print(f"Modified: {ATTENDANCE}")
    print("Next: run git diff --check and npx tsc --noEmit -p .")


if __name__ == "__main__":
    main()
