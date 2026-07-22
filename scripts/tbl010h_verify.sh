#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

PAGE="app/teacher/scheme/page.tsx"
MIG="supabase/migrations/20260722220000_tbl010h_curriculum_global_subject_identity.sql"

echo "== TBL-010H verification =="

[ -f "$PAGE" ] || { echo "FAIL: scheme page missing"; exit 1; }
[ -f "$MIG" ] || { echo "FAIL: migration missing"; exit 1; }

grep -Fq ".eq('global_subject_id', globalSubjectId)" "$PAGE" \
  && echo "OK: curriculum loads by global subject ID" \
  || { echo "FAIL: ID-based curriculum query missing"; exit 1; }

if grep -Fq ".eq('subject', selectedSubjectObj.label)" "$PAGE"; then
  echo "FAIL: subject-name curriculum match still exists"
  exit 1
else
  echo "OK: subject-name curriculum match removed"
fi

grep -Fq "ADD COLUMN IF NOT EXISTS global_subject_id uuid" "$MIG" \
  && echo "OK: identity column migration exists" \
  || { echo "FAIL: identity column missing"; exit 1; }

grep -Fq "ALTER COLUMN global_subject_id SET NOT NULL" "$MIG" \
  && echo "OK: global subject identity enforced" \
  || { echo "FAIL: NOT NULL missing"; exit 1; }

grep -Fq "curriculum_global_subject_id_fkey" "$MIG" \
  && echo "OK: foreign key exists" \
  || { echo "FAIL: foreign key missing"; exit 1; }

grep -Fq "curriculum_global_subject_lookup_idx" "$MIG" \
  && echo "OK: lookup index exists" \
  || { echo "FAIL: lookup index missing"; exit 1; }

npx tsc --noEmit

echo
echo "All TBL-010H checks passed."
