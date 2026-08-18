#!/usr/bin/env python3
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
config=json.loads((root/'config/school-trust-pack.json').read_text())
page=(root/'app/trust/schools/page.tsx').read_text()
allowed={'Available','Validation','Planned'}
assert set(config['statuses'])==allowed
assert config['reviewed_on']
assert len(config['items'])>=8
for item in config['items']:
  assert item['status'] in allowed and item['area'] and item['evidence']
  text=(item['area']+' '+item['evidence']).lower()
  for forbidden in ['soc 2 certified','iso 27001 certified','fully certified end-to-end','guaranteed secure','zero risk']:
    assert forbidden not in text, f'unsupported trust claim: {forbidden}'
required=['Marketing trust is not institutional due diligence.','CURRENT TRUST LEDGER','CHILD SAFETY & PRIVACY','AI & AUTOMATION','BUYER CHECKLIST','Discover → Diagnose → Pilot → Measure → Expand.','Print / save Trust Pack']
combined=page+(root/'components/public/TrustPackActions.tsx').read_text()
for token in required: assert token in combined, f'missing Trust Pack contract: {token}'
serialized=json.dumps(config).lower()
assert 'end-to-end certified' in serialized
assert 'twenty previously safe legacy class-teacher assignments were reconciled' in serialized
assert 'thirteen stale legacy teacher_id values' in serialized
assert 'one current-teacher class remains on a bounded compatibility fallback' in serialized
assert 'standalone classes.teacher_id is no longer accepted as an independent teacher-authority source' in serialized
assert "title:'School Trust Pack | Security, Privacy & Due Diligence'" in page
assert "title:'School Trust Pack | Security, Privacy & Due Diligence | VibeSchool'" not in page
print(f"School Trust Pack Contract: PASS ({len(config['items'])} trust controls)")
