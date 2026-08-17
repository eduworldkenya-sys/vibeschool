#!/usr/bin/env python3
from pathlib import Path
root=Path(__file__).resolve().parents[1]
component=(root/'components/public/SchoolBusinessCaseBuilder.tsx').read_text()
page=(root/'app/institutions/business-case/page.tsx').read_text()
required=[
  'YOUR ASSUMPTIONS',
  'not a savings guarantee, price quote, ROI claim',
  'Addressable workload in measured window',
  'Capacity if your target is achieved',
  'RECOMMENDED FIRST PILOT',
  'PRIMARY BASELINE MEASURE',
  'DECISION RULE',
  'Print / save business case',
]
for token in required: assert token in component, f'missing business-case contract: {token}'
for forbidden in ['fetch(','sendBeacon','localStorage','sessionStorage','school_id','student_id','learner_id']:
  assert forbidden not in component, f'business-case inputs must remain local: {forbidden}'
assert 'VibeSchool\'s business-case builder does not replace procurement, legal, finance or data-protection review.' in page
assert 'ppra.go.ke/standard-tender-documents' in page and 'odpc.go.ke/guidelines-2' in page
print('School Buyer / ROI Contract: PASS')
