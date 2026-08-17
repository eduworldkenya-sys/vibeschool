#!/usr/bin/env python3
from pathlib import Path

root=Path(__file__).resolve().parents[1]
component=(root/'components/public/SchoolReadinessAssessment.tsx').read_text()

required=[
  'YOUR VIBESCHOOL IMPROVEMENT PRESCRIPTION',
  'STRONGEST AREA',
  'BIGGEST FRAGMENTATION',
  'RECOMMENDED FIRST WORKFLOW',
  '30-DAY BOUNDED PILOT',
  'Days 1–5 — Baseline',
  'Days 6–10 — Prepare',
  'Days 11–24 — Run',
  'Days 25–30 — Decide',
  'Print / save prescription',
  "firstWorkflow:'Plan → Teach → Evidence → Assess → Next Action'",
]
for token in required:
    assert token in component, f'missing prescription contract: {token}'

# The readiness answers must remain browser-local; the only existing network action is aggregate event telemetry.
for forbidden in ['localStorage','sessionStorage','JSON.stringify(answers)','fetch(answers','school_id','student_id','learner_id']:
    assert forbidden not in component, f'readiness prescription leaks/stores answers via {forbidden}'

assert "trackPublicEvent(bandEvent[result.band])" in component
assert 'self-assessment and planning aid, not an external audit or certification' in component
assert 'Expansion is earned by evidence, not assumed.' in component
print('Readiness Prescription Contract: PASS')
