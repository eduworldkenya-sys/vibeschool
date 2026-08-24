#!/usr/bin/env python3
from pathlib import Path
text=Path('docs/chemistry/COMMISSIONING.md').read_text()
for token in ['Commission chapter','expired lease recovery','Human Review','Global Stop remains ON','Human publication/release authority is not automated']:
    if token not in text:
        raise SystemExit('Chemistry commissioning documentation missing: '+token)
print('Chemistry commissioning documentation: PASS')
