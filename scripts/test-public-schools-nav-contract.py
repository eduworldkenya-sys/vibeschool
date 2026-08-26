#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
header = (root / 'components/public/PublicHeader.tsx').read_text(encoding='utf-8')
footer = (root / 'components/public/PublicFooter.tsx').read_text(encoding='utf-8')

errors = []
for fragment in ["['/schools', 'Find Schools']", "['/institutions', 'For Schools']"]:
    if fragment not in header:
        errors.append(f'PublicHeader missing navigation contract: {fragment}')

for fragment in ['href="/schools"', 'href="/institutions"']:
    if fragment not in footer:
        errors.append(f'PublicFooter missing school destination: {fragment}')

if errors:
    print('PUBLIC SCHOOLS NAV CONTRACT: FAIL')
    for error in errors:
        print(f' - {error}')
    sys.exit(1)

print('PUBLIC SCHOOLS NAV CONTRACT: PASS')
print('Find Schools and For Schools coexist as distinct public journeys.')
