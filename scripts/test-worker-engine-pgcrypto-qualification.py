#!/usr/bin/env python3
"""Guard Worker Engine migrations against unqualified pgcrypto digest() calls.

Supabase installs pgcrypto functions in the extensions schema. Production
migration execution may not include that schema in search_path, so Worker
Engine migrations must call extensions.digest(...) explicitly.
"""
from pathlib import Path
import re
import sys

MIGRATIONS = Path("supabase/migrations")
PATTERN = re.compile(r"(?<![A-Za-z0-9_.])digest\s*\(", re.IGNORECASE)

violations = []
for path in sorted(MIGRATIONS.glob("*worker_engine*.sql")):
    text = path.read_text(encoding="utf-8")
    for lineno, line in enumerate(text.splitlines(), 1):
        if PATTERN.search(line):
            violations.append(f"{path}:{lineno}: unqualified digest() call")

if violations:
    print("Worker Engine pgcrypto qualification gate FAILED", file=sys.stderr)
    for violation in violations:
        print(violation, file=sys.stderr)
    raise SystemExit(1)

print("Worker Engine pgcrypto qualification gate PASSED")
