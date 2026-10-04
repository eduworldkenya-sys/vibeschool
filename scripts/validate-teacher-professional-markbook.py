#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = (root / 'app/teacher/results/page.tsx').read_text()
component = (root / 'components/teacher/ProfessionalMarkbook.tsx').read_text()
migration = (root / 'supabase/migrations/20260820083000_teacher_markbook_marks_range.sql').read_text()

checks = {
    'professional markbook imported': "ProfessionalMarkbook" in page,
    'marks entry component exists': 'Enter marks' in component,
    'keyboard next navigation': 'ArrowDown' in component and 'ArrowUp' in component and 'Enter' in component,
    'marks constrained in UI': 'max={100}' in component and 'min={0}' in component,
    'save feedback visible': 'Saved ✓' in component and 'Saving…' in component,
    'per-row error visible': 'errorByStudent' in component and 'role="alert"' in component,
    'absence workflow': 'Mark absent' in component and 'Clear absence' in component and 'Absent ✓' in component,
    'bulk paste workflow': 'Paste marks' in component and 'Add to marks' in component and 'ABS or Absent' in component,
    'save all workflow': 'Save all' in component and 'onSaveAll' in component,
    'phone-first layout': 'mobile-list' in component and '@media (max-width: 720px)' in component,
    'secondary report action': 'View learner report' in component and '>⋯<' in component,
    'db upper bound': 'marks <= 100' in migration,
    'db lower bound': 'marks >= 0' in migration,
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(('PASS' if ok else 'FAIL') + ' - ' + name)

if failed:
    raise SystemExit('Teacher professional markbook contract failed: ' + ', '.join(failed))
