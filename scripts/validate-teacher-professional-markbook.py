#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = (root / 'app/teacher/results/page.tsx').read_text()
component = (root / 'components/teacher/ProfessionalMarkbook.tsx').read_text()
migration = (root / 'supabase/migrations/20260820083000_teacher_markbook_marks_range.sql').read_text()

checks = {
    'professional markbook imported': "ProfessionalMarkbook" in page,
    'markbook component exists': 'Class markbook' in component,
    'keyboard next navigation': 'ArrowDown' in component and 'ArrowUp' in component and 'Enter' in component,
    'marks constrained in UI': 'max={100}' in component and 'min={0}' in component,
    'save feedback visible': 'Saved ✓' in component and 'Saving…' in component,
    'per-row error visible': 'errorByStudent' in component and 'role="alert"' in component,
    'absence workflow': 'Clear ABS' in component,
    'db upper bound': 'marks <= 100' in migration,
    'db lower bound': 'marks >= 0' in migration,
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(('PASS' if ok else 'FAIL') + ' - ' + name)

if failed:
    raise SystemExit('Teacher professional markbook contract failed: ' + ', '.join(failed))
