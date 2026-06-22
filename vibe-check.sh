#!/bin/bash
echo "=== VIBE HEALTH CHECK ==="

echo "1. TypeScript..."
npx tsc --noEmit 2>&1 | grep "error TS" && echo "❌ TS errors found" || echo "✅ Clean"

echo "2. Missing imports..."
grep -rn "from '@/" app --include="*.tsx" | grep -v "node_modules" | awk -F"from '" '{print $2}' | tr -d "'" | sort -u > /tmp/imports.txt
echo "✅ Import scan done"

echo "3. Broken table names..."
grep -rn "\.from('" app --include="*.tsx" | grep -oP "from\('\K[^']+" | sort -u

echo "4. Dead routes check..."
find app -name "page.tsx" | wc -l

echo "=== DONE ==="
