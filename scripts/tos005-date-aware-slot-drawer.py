#!/usr/bin/env python3
"""TOS-005: make timetable drawer time badges date-aware.

Run from the Vibeschool repository root:

    python3 scripts/tos005-date-aware-slot-drawer.py

The patch is self-checking and modifies exactly one file.
"""

from pathlib import Path

PATH = Path("app/teacher/timetable/page.tsx")


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
        """  const isNow  = timeToMin(slot.startTime) <= curMin && timeToMin(slot.endTime) > curMin\n  const isNext = !isNow && timeToMin(slot.startTime) > curMin\n""",
        """  // TOS-005: clock-only comparisons are valid only for today's\n  // occurrence. A past Monday slot viewed after midnight must not be labelled\n  // \"Starting in...\" merely because its clock time is later than the current\n  // Tuesday clock time. Lifecycle remains authoritative for past/future dates.\n  const isTodayOccurrence = occurrenceDate === nairobiDateStr()\n  const isNow =\n    isTodayOccurrence &&\n    timeToMin(slot.startTime) <= curMin &&\n    timeToMin(slot.endTime) > curMin\n  const isNext =\n    isTodayOccurrence &&\n    !isNow &&\n    timeToMin(slot.startTime) > curMin\n""",
        "date-aware drawer timing",
    )

    PATH.write_text(out, encoding="utf-8")
    print("TOS-005 patch applied successfully.")
    print(f"Modified: {PATH}")
    print("Next: run git diff --check and npx tsc --noEmit -p .")


if __name__ == "__main__":
    main()
