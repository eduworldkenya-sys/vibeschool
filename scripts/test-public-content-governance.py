#!/usr/bin/env python3
from pathlib import Path
from datetime import date
import json
import sys

ROOT=Path(__file__).resolve().parents[1]
config=json.loads((ROOT/'config/public-content-governance.json').read_text(encoding='utf-8'))
errors=[]
seen=set()

today=date.today()
for entry in config.get('entries',[]):
    route=entry.get('route','')
    if not route.startswith('/') or route in seen: errors.append(f'invalid/duplicate route: {route!r}')
    seen.add(route)
    if not entry.get('owner'): errors.append(f'{route}: missing owner')
    if not entry.get('basis'): errors.append(f'{route}: missing evidence/review basis')
    try: review_by=date.fromisoformat(entry['review_by'])
    except Exception: errors.append(f'{route}: invalid review_by'); continue
    if review_by < today: errors.append(f'{route}: public content review expired on {review_by.isoformat()}')

for required in ['/','/contact','/institutions','/trust','/trust/child-safety','/trust/security','/trust/responsible-ai','/legal/privacy','/legal/terms','/legal/aup','/pathways','/pathways/schools']:
    if required not in seen: errors.append(f'missing governed route: {required}')

if errors:
    print('PUBLIC CONTENT GOVERNANCE: FAIL')
    for e in errors: print(' -',e)
    sys.exit(1)
print('PUBLIC CONTENT GOVERNANCE: PASS')
print(f'{len(seen)} public surfaces have owners, review basis and non-expired review dates.')
