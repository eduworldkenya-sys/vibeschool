#!/bin/bash
MSG="$1"
if [ -z "$MSG" ]; then
  echo "❌ Usage: ./vibe-push.sh \"what you did\""
  exit 1
fi

# ── TypeScript check ──────────────────────────
echo "🔍 Checking TypeScript..."
TS_ERRORS=$(npx tsc --noEmit 2>&1 | grep "error TS" || true)
if [ -n "$TS_ERRORS" ]; then
  echo "❌ TypeScript errors — fix before pushing:"
  echo "$TS_ERRORS"
  exit 1
fi
echo "✅ TypeScript clean"

# ── Push ─────────────────────────────────────
DATE=$(date '+%Y-%m-%d %H:%M')
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git add -A
git commit -m "$MSG"
git push origin "$BRANCH"

# ── Force Vercel rebuild ──────────────────────
git commit --allow-empty -m "fix: force Vercel rebuild"
git push origin "$BRANCH"

# ── Devlog ───────────────────────────────────
COMMIT=$(git rev-parse --short HEAD)
cat >> ~/vibeschool/DEVLOG.md << ENTRY
## [$DATE] $COMMIT
**What:** $MSG
**Status:** ✅ pushed
ENTRY
git add DEVLOG.md
git commit -m "devlog: $MSG"
git push origin "$BRANCH"

echo "✅ Done — logged: $MSG"
