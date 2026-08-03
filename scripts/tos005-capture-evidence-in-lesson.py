#!/usr/bin/env python3
"""TOS-005: expose existing evidence capture inside the exact lesson workspace.

Run from the Vibeschool repository root:

    python3 scripts/tos005-capture-evidence-in-lesson.py

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
        """import ReflectionSheet from '@/components/teacher/ReflectionSheet'\nimport CoverageSheet from '@/components/teacher/CoverageSheet'\n""",
        """import ReflectionSheet from '@/components/teacher/ReflectionSheet'\nimport CoverageSheet from '@/components/teacher/CoverageSheet'\nimport EvidenceCaptureSheet from '@/components/teacher/EvidenceCaptureSheet'\n""",
        "evidence import",
    )

    out = replace_once(
        out,
        """  const [showReflection, setShowReflection] = useState(false)\n""",
        """  const [showReflection, setShowReflection] = useState(false)\n  const [showEvidence,   setShowEvidence]   = useState(false)\n""",
        "evidence state",
    )

    out = replace_once(
        out,
        """                {completeError && (\n""",
        """                {planId && (occLifecycle === 'in_progress' || occLifecycle === 'completed') && (\n                  <button onClick={() => setShowEvidence(true)} style={{\n                    width: '100%', padding: '13px', borderRadius: 12,\n                    border: '1.5px solid ' + C.accent, background: '#ecfdf5',\n                    color: '#065f46', fontSize: 13, fontWeight: 800,\n                    cursor: 'pointer', fontFamily: 'inherit',\n                  }}>\n                    📷 Capture Learning Evidence\n                  </button>\n                )}\n                {completeError && (\n""",
        "evidence action",
    )

    out = replace_once(
        out,
        """      {showReflection && teacherId && planId && (\n""",
        """      {showEvidence && teacherId && planId && (\n        <EvidenceCaptureSheet\n          lessonId={planId}\n          classId={slot.class_id}\n          teacherId={teacherId}\n          defaultTitle={topic ? `${slot.subject} — ${topic}` : `${slot.subject} lesson evidence`}\n          onClose={() => setShowEvidence(false)}\n          onSaved={() => {\n            showToast('Evidence saved ✓')\n            refreshPulse('lesson')\n          }}\n        />\n      )}\n\n      {showReflection && teacherId && planId && (\n""",
        "evidence sheet render",
    )

    PATH.write_text(out, encoding="utf-8")
    print("TOS-005 patch applied successfully.")
    print(f"Modified: {PATH}")
    print("Next: run git diff --check and npx tsc --noEmit -p .")


if __name__ == "__main__":
    main()
