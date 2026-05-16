#!/usr/bin/env python3
"""
fix_colours.py
Run from your project root: python3 fix_colours.py
Replaces hardcoded hex colours with C token references across all teacher pages.
"""

import os
import re

# Map hex → C token
REPLACEMENTS = {
    "'#10b981'": "C.accent",
    '"#10b981"': "C.accent",
    "'#d1fae5'": "C.accentLight",
    '"#d1fae5"': "C.accentLight",
    "'#111827'": "C.textPrimary",
    '"#111827"': "C.textPrimary",
    "'#6b7280'": "C.textMuted",
    '"#6b7280"': "C.textMuted",
    "'#f8f9fa'": "C.surface",
    '"#f8f9fa"': "C.surface",
    "'#e5e7eb'": "C.border",
    '"#e5e7eb"': "C.border",
    "'#1e1b4b'": "C.dark",
    '"#1e1b4b"': "C.dark",
    "'#ef4444'": "C.error",
    '"#ef4444"': "C.error",
    "'#f59e0b'": "C.warning",
    '"#f59e0b"': "C.warning",
    "'#ffffff'": "C.bg",
    '"#ffffff"': "C.bg",
}

# C import line to inject if missing
C_IMPORT = "import { Card, SectionLabel, Btn, C, ReadinessChip } from '@/components/teacher/ui'\n"

# Files to skip (layout and CSS handled separately)
SKIP_FILES = {"layout.tsx", "teacher-home.module.css"}

def fix_file(path: str) -> int:
    with open(path, "r", encoding="utf-8") as f:
        original = f.read()

    content = original

    # Count how many replacements will happen
    count = 0
    for old, new in REPLACEMENTS.items():
        occurrences = content.count(old)
        if occurrences:
            count += occurrences
            content = content.replace(old, new)

    if count == 0:
        return 0

    # Inject C import if not already present
    if "from '@/components/teacher/ui'" not in content:
        # Insert after 'use client' line if present
        if "'use client'" in content:
            content = content.replace("'use client'\n", f"'use client'\n{C_IMPORT}", 1)
        else:
            content = C_IMPORT + content

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    return count

def main():
    root = os.path.join("app", "teacher")
    total_files = 0
    total_fixes = 0

    for dirpath, _, filenames in os.walk(root):
        for filename in filenames:
            if filename in SKIP_FILES:
                continue
            if not filename.endswith((".tsx", ".ts")):
                continue

            filepath = os.path.join(dirpath, filename)
            fixes = fix_file(filepath)
            if fixes > 0:
                print(f"  ✓ {filepath}  ({fixes} replacements)")
                total_files += 1
                total_fixes += fixes

    print(f"\nDone — {total_fixes} replacements across {total_files} files.")
    print("Run:  npx tsc --noEmit 2>&1 | grep 'error TS'  to verify.")

if __name__ == "__main__":
    main()
