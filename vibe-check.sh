#!/bin/bash
echo ""
echo "╔══════════════════════════════════════╗"
echo "║     VIBE HEALTH CHECK                ║"
echo "╚══════════════════════════════════════╝"

# ── 1. TypeScript ─────────────────────────────
echo ""
echo "1. TypeScript..."
TS=$(npx tsc --noEmit 2>&1 | grep "error TS" || true)
[ -n "$TS" ] && echo "❌ TS errors:" && echo "$TS" || echo "✅ Clean"

# ── 2. Banned imports ─────────────────────────
echo ""
echo "2. Banned imports..."
BANNED=$(grep -rn "createClientComponentClient\|auth-helpers-nextjs" app --include="*.tsx" || true)
[ -n "$BANNED" ] && echo "❌ Found banned import:" && echo "$BANNED" || echo "✅ No banned imports"

# ── 3. Wrong supabase import ──────────────────
echo ""
echo "3. Supabase import check..."
WRONG=$(grep -rn "from '@/utils/supabase\|from '@/lib/supabaseClient\|createClient()" app --include="*.tsx" || true)
[ -n "$WRONG" ] && echo "❌ Wrong supabase import:" && echo "$WRONG" || echo "✅ All imports clean"

# ── 4. Banned table queries ───────────────────
echo ""
echo "4. Banned table queries..."
BANNED_TABLES="notifications|announcements|scheme_of_work|threads|messages|resources|marks"
BAD=$(grep -rn "\.from('" app --include="*.tsx" | grep -E "$BANNED_TABLES" || true)
[ -n "$BAD" ] && echo "❌ Querying non-existent tables:" && echo "$BAD" || echo "✅ No banned tables"

# ── 5. All tables being queried ───────────────
echo ""
echo "5. Tables queried across app..."
grep -rn "\.from('" app --include="*.tsx" | grep -oP "from\('\K[^']+" | sort -u

# ── 6. minHeight 100vh violations ────────────
echo ""
echo "6. minHeight 100vh check..."
VH=$(grep -rn "minHeight.*100vh\|min-h-screen" app/teacher --include="*.tsx" || true)
[ -n "$VH" ] && echo "❌ minHeight violation:" && echo "$VH" || echo "✅ Clean"

# ── 7. Tailwind className in page files ───────
echo ""
echo "7. Tailwind className in pages..."
TW=$(grep -rn "className=" app/teacher --include="page.tsx" || true)
[ -n "$TW" ] && echo "⚠️  className found in page files:" && echo "$TW" || echo "✅ No Tailwind in pages"

# ── 8. Missing 'use client' ───────────────────
echo ""
echo "8. Missing 'use client'..."
while IFS= read -r file; do
  FIRST=$(head -1 "$file")
  if [[ "$FIRST" != *"use client"* ]]; then
    echo "❌ Missing: $file"
  fi
done < <(find app/teacher -name "page.tsx")
echo "✅ use client check done"

# ── 9. Page count ─────────────────────────────
echo ""
echo "9. Pages..."
find app -name "page.tsx" | wc -l | xargs echo "Total page.tsx files:"

# ── 10. Sequential awaits warning ────────────
echo ""
echo "10. Sequential await pattern..."
SEQ=$(grep -rn "= await supabase" app/teacher --include="page.tsx" | grep -v "Promise.all" || true)
[ -n "$SEQ" ] && echo "⚠️  Possible sequential awaits (verify manually):" && echo "$SEQ" || echo "✅ Clean"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     DONE                             ║"
echo "╚══════════════════════════════════════╝"
echo ""
