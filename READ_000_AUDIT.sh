#!/usr/bin/env bash
set -euo pipefail

echo "========================================"
echo " READ ARCHITECTURE INVENTORY"
echo "========================================"
echo

echo "Repository:"
git rev-parse --show-toplevel
echo

echo "Current branch:"
git branch --show-current
echo

echo "Latest commit:"
git log -1 --oneline
echo

echo "========================================"
echo "READ RELATED FILES"
echo "========================================"

find app components lib -type f \
| grep -Ei 'read|reader|textbook|publication|chapter|ebook|epage|vibelearn|workspace|assignment|progress|bookmark|analytics|publication|reader|chapter|vibe_' \
|| true

echo
echo "========================================"
echo "PUBLICATION REFERENCES"
echo "========================================"

grep -RIn \
"vibe_publications\|vibe_chapters\|vibelearn_content\|vibe_chapter_assignments\|vibe_workspace_items\|vibe_reading_progress\|vibe_saved_items" \
app components lib \
2>/dev/null || true

echo
echo "========================================"
echo "ROUTES"
echo "========================================"

find app -maxdepth 4 -type f \
| grep -Ei 'read|textbook|ebook|epage|publication|reader|vibelearn' \
|| true

echo
echo "========================================"
echo "API ROUTES"
echo "========================================"

find app/api -type f 2>/dev/null \
| grep -Ei 'read|textbook|ebook|publication|reader|chapter|vibelearn' \
|| true

echo
echo "========================================"
echo "DONE"
echo "========================================"
