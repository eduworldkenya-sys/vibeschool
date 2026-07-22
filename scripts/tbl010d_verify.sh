#!/data/data/com.termux/files/usr/bin/bash
# TBL-010D pre-commit verification.
# Run from the repo root in Termux before committing/pushing.
set -e

echo "== 1/3: npx tsc --noEmit =="
npx tsc --noEmit

echo "== 2/3: zero deprecated resolver imports/calls =="
if grep -R "resolveGlobalSubjectIdByName" app components lib \
  --include='*.ts' --include='*.tsx' \
  --exclude-dir=.audit-backups; then
  echo "FAIL: resolveGlobalSubjectIdByName still referenced"
  exit 1
fi

if grep -R "lastResolveDebug" app components lib \
  --include='*.ts' --include='*.tsx' \
  --exclude-dir=.audit-backups; then
  echo "FAIL: lastResolveDebug still referenced"
  exit 1
fi

echo "== 3/3: migration file present =="
if [ ! -f supabase/migrations/20260722163600_tbl010d_subject_identity_invariant.sql ]; then
  echo "FAIL: TBL-010D migration file missing"
  exit 1
fi

echo "All TBL-010D checks passed. Safe to commit and push."
echo 'git add -A && git commit -m '"'"'fix(subjects): TBL-010D enforce subject identity and remove name bridge'"'"''
