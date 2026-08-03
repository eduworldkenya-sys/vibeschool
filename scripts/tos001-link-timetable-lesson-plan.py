#!/usr/bin/env python3
"""TOS-001: link a selected timetable occurrence to its exact lesson plan.

Self-checking repository patch. Run from the Vibeschool repository root:

    python3 scripts/tos001-link-timetable-lesson-plan.py

The script changes exactly two files and aborts before writing unless every
expected source anchor occurs exactly once.
"""

from __future__ import annotations

from pathlib import Path

TIMETABLE = Path("app/teacher/timetable/page.tsx")
LESSON_PLAN = Path("app/teacher/lessonplan/page.tsx")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(
            f"ABORT: {label} anchor expected exactly once, found {count}. "
            "No files were changed."
        )
    return source.replace(old, new, 1)


def main() -> None:
    timetable_src = TIMETABLE.read_text(encoding="utf-8")
    lesson_src = LESSON_PLAN.read_text(encoding="utf-8")

    timetable_new = replace_once(
        timetable_src,
        """  const lessonUrl = `/teacher/lessonplan?subjectId=${encodeURIComponent(slot.subjectId)}&classId=${slot.classId}`;\n""",
        """  // TOS-001: preserve the exact scheduled occurrence. Class and subject\n  // identify the teaching assignment, but only slot + date identify the\n  // lesson-plan row and teaching occurrence selected by the teacher.\n  const lessonUrl =\n    `/teacher/lessonplan?` +\n    `timetableSlotId=${encodeURIComponent(slot.id)}` +\n    `&date=${encodeURIComponent(occurrenceDate)}` +\n    `&subjectId=${encodeURIComponent(slot.subjectId)}` +\n    `&classId=${encodeURIComponent(slot.classId)}`;\n""",
        "timetable exact lesson URL",
    )

    lesson_new = replace_once(
        lesson_src,
        """function LessonPlanInner() {\n  const [weekStart,   setWeekStart]   = useState(nairobiWeekStart())\n  const router                        = useRouter()\n  const urlClassId                    = useSearchParams().get('classId')\n""",
        """function weekStartForDate(date: string): string {\n  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) return nairobiWeekStart()\n\n  const [year, month, day] = date.split('-').map(Number)\n  const parsed = new Date(Date.UTC(year, month - 1, day))\n  if (Number.isNaN(parsed.getTime())) return nairobiWeekStart()\n\n  const mondayOffset = (parsed.getUTCDay() + 6) % 7\n  return nairobiDateAdd(date, -mondayOffset)\n}\n\nfunction LessonPlanInner() {\n  const searchParams                  = useSearchParams()\n  const router                        = useRouter()\n  const urlClassId                    = searchParams.get('classId')\n  const urlSubjectId                  = searchParams.get('subjectId')\n  const urlTimetableSlotId            = searchParams.get('timetableSlotId')\n  const urlOccurrenceDate             = searchParams.get('date')\n  const [weekStart,   setWeekStart]   = useState(() =>\n    urlOccurrenceDate ? weekStartForDate(urlOccurrenceDate) : nairobiWeekStart()\n  )\n""",
        "lesson-plan route identity",
    )

    lesson_new = replace_once(
        lesson_new,
        """      setItems(mapped)\n      setLoading(false)\n""",
        """      setItems(mapped)\n\n      // TOS-001: a timetable CTA must open the selected occurrence directly,\n      // not merely land on the weekly lesson-plan index. The exact pair is\n      // the same identity used by LessonPlanModal and lesson_plans:\n      // (timetable_slot_id, taught_date).\n      if (urlTimetableSlotId && urlOccurrenceDate) {\n        const target = mapped.find(({ slot }) =>\n          slot.id === urlTimetableSlotId &&\n          slot.occurrenceDate === urlOccurrenceDate &&\n          (!urlClassId || slot.class_id === urlClassId) &&\n          (!urlSubjectId || slot.subject_id === urlSubjectId)\n        )\n\n        if (target) {\n          setActiveSlot(target.slot)\n        } else {\n          setLoadError('The selected timetable lesson is no longer available for this date.')\n        }\n      }\n\n      setLoading(false)\n""",
        "lesson-plan direct-open target",
    )

    lesson_new = replace_once(
        lesson_new,
        """  }, [weekStart])\n""",
        """  }, [weekStart, urlClassId, urlSubjectId, urlTimetableSlotId, urlOccurrenceDate])\n""",
        "lesson-plan load dependencies",
    )

    # All anchors have now been validated. Write only after the complete patch
    # has been assembled, so a mismatch cannot leave a half-patched repository.
    TIMETABLE.write_text(timetable_new, encoding="utf-8")
    LESSON_PLAN.write_text(lesson_new, encoding="utf-8")

    print("TOS-001 patch applied successfully.")
    print(f"Modified: {TIMETABLE}")
    print(f"Modified: {LESSON_PLAN}")
    print("Next: run npx tsc --noEmit -p . and git diff --check")


if __name__ == "__main__":
    main()
