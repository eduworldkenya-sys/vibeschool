#!/bin/bash
MSG="$1"
if [ -z "$MSG" ]; then
  echo "❌ Usage: ./vibe-push.sh \"what you did\""
  exit 1
fi
DATE=$(date '+%Y-%m-%d %H:%M')
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git add -A
git commit -m "$MSG"
git push origin "$BRANCH"
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
