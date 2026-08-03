#!/usr/bin/env python3
"""TOS-002: start the exact teaching occurrence from LessonPlanModal.

Run from the Vibeschool repository root:

    python3 scripts/tos002-start-lesson-from-plan.py

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
        """import { completeTeachingOccurrence, fetchOccurrenceLifecycle, CompleteOccurrenceError, markSchemeItemCovered, MarkSchemeCoveredError } from '@/lib/teaching/occurrence'\nimport type { CompleteOccurrenceErrorCode, MarkCoveredErrorCode } from '@/lib/teaching/occurrence'\n""",
        """import { completeTeachingOccurrence, fetchOccurrenceLifecycle, startTeachingOccurrence, StartOccurrenceError, CompleteOccurrenceError, markSchemeItemCovered, MarkSchemeCoveredError } from '@/lib/teaching/occurrence'\nimport type { StartOccurrenceErrorCode, CompleteOccurrenceErrorCode, MarkCoveredErrorCode } from '@/lib/teaching/occurrence'\n""",
        "occurrence imports",
    )

    out = replace_once(
        out,
        """// Fix 18D: human-facing text for each stable complete_teaching_occurrence\n""",
        """// TOS-002: human-facing text for starting the exact occurrence from\n// the lesson workspace. The RPC remains the lifecycle authority.\nfunction startLessonErrorMessage(code: StartOccurrenceErrorCode): string {\n  switch (code) {\n    case 'not_authenticated':\n      return 'Your session expired. Please sign in again.'\n    case 'slot_not_found':\n      return 'This lesson slot no longer exists.'\n    case 'slot_not_owned':\n      return 'This lesson belongs to a different teacher.'\n    case 'invalid_occurrence_date':\n      return 'This date no longer matches the lesson schedule.'\n    case 'lesson_plan_required':\n      return 'Save the lesson plan before starting the lesson.'\n    case 'occurrence_completed':\n      return 'This lesson was already completed.'\n    case 'occurrence_cancelled':\n      return 'This lesson was cancelled.'\n    case 'occurrence_rescheduled':\n      return 'This lesson was rescheduled.'\n    default:\n      return 'Could not start the lesson. Please try again.'\n  }\n}\n\n// Fix 18D: human-facing text for each stable complete_teaching_occurrence\n""",
        "start error mapper",
    )

    out = replace_once(
        out,
        """  const [occLifecycle,   setOccLifecycle]   = useState<Lifecycle | null>(null)\n  const [completing,     setCompleting]     = useState(false)\n""",
        """  const [occLifecycle,   setOccLifecycle]   = useState<Lifecycle | null>(null)\n  const [startingLesson, setStartingLesson] = useState(false)\n  const [startLessonError, setStartLessonError] = useState<string | null>(null)\n  const [completing,     setCompleting]     = useState(false)\n""",
        "start state",
    )

    out = replace_once(
        out,
        """  // Fix 18D: the lesson workspace's own completion CTA — separate from the\n""",
        """  // TOS-002: start the exact timetable occurrence without forcing the\n  // teacher back through the timetable drawer. This uses the same guarded\n  // RPC and exact (slot, date) identity as the timetable flow.\n  async function handleStartLesson() {\n    if (!taughtDate || !planIdRef.current || startingLesson) return\n\n    setStartingLesson(true)\n    setStartLessonError(null)\n\n    try {\n      const row = await startTeachingOccurrence({\n        timetableSlotId: slot.id,\n        occurrenceDate: taughtDate,\n      })\n      setOccLifecycle(row.lifecycle)\n      showToast('Lesson started ✓')\n      refreshPulse('lesson')\n    } catch (err) {\n      const code = err instanceof StartOccurrenceError ? err.code : 'unknown'\n      console.error('[LessonPlanModal] startLesson', err)\n      setStartLessonError(startLessonErrorMessage(code))\n    } finally {\n      setStartingLesson(false)\n    }\n  }\n\n  // Fix 18D: the lesson workspace's own completion CTA — separate from the\n""",
        "start handler",
    )

    out = replace_once(
        out,
        """                {completeError && (\n""",
        """                {startLessonError && (\n                  <div style={{\n                    padding: '10px 12px', borderRadius: 10,\n                    background: '#fef2f2', border: '1px solid #fca5a5',\n                    fontSize: 12, fontWeight: 600, color: '#b91c1c',\n                  }}>\n                    ⚠ {startLessonError}\n                  </div>\n                )}\n                {planId && occLifecycle !== 'in_progress' && occLifecycle !== 'completed'\n                  && occLifecycle !== 'cancelled' && occLifecycle !== 'rescheduled' && (\n                  <button onClick={handleStartLesson} disabled={startingLesson} style={{\n                    width: '100%', padding: '13px', borderRadius: 12, border: 'none',\n                    background: C.accent, color: '#fff', fontSize: 13, fontWeight: 800,\n                    cursor: startingLesson ? 'not-allowed' : 'pointer',\n                    opacity: startingLesson ? 0.7 : 1, fontFamily: 'inherit',\n                  }}>\n                    {startingLesson ? 'Starting lesson…' : '▶ Start Lesson'}\n                  </button>\n                )}\n                {completeError && (\n""",
        "start button",
    )

    PATH.write_text(out, encoding="utf-8")
    print("TOS-002 patch applied successfully.")
    print(f"Modified: {PATH}")
    print("Next: run git diff --check and npx tsc --noEmit -p .")


if __name__ == "__main__":
    main()
