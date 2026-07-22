#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

PAGE="app/teacher/scheme/page.tsx"
MIG="supabase/migrations/20260722213000_tbl010g_enforce_scheme_identity.sql"

echo "== TBL-010G verification =="

[ -f "$PAGE" ] || { echo "FAIL: scheme page missing"; exit 1; }
[ -f "$MIG" ] || { echo "FAIL: migration missing"; exit 1; }

echo "== 1/8 assignment guard exists =="
grep -Fq "async function assertSchemeAssignmentIdentity" "$PAGE" \
  && echo "OK: identity guard exists" \
  || { echo "FAIL: identity guard missing"; exit 1; }

echo "== 2/8 teacher assignment verified =="
grep -Fq ".from('teacher_classes')" "$PAGE" \
  && grep -Fq ".eq('teacher_id', uid)" "$PAGE" \
  && grep -Fq ".eq('class_id', selectedClass)" "$PAGE" \
  && grep -Fq ".eq('subject_id', selectedSubject)" "$PAGE" \
  && echo "OK: exact assignment verified" \
  || { echo "FAIL: assignment verification incomplete"; exit 1; }

echo "== 3/8 class school verified =="
grep -Fq ".from('classes')" "$PAGE" \
  && grep -Fq ".eq('school_id', schoolId)" "$PAGE" \
  && echo "OK: class-school identity verified" \
  || { echo "FAIL: class-school verification missing"; exit 1; }

echo "== 4/8 subject school verified =="
grep -Fq ".from('subjects')" "$PAGE" \
  && grep -Fq "The selected subject does not belong to your active school" "$PAGE" \
  && echo "OK: subject-school identity verified" \
  || { echo "FAIL: subject-school verification missing"; exit 1; }

echo "== 5/8 curriculum insert guarded =="
COUNT=$(grep -Fc "await assertSchemeAssignmentIdentity()" "$PAGE")
[ "$COUNT" -eq 2 ] \
  && echo "OK: both insert paths guarded" \
  || { echo "FAIL: expected 2 guarded insert paths, found $COUNT"; exit 1; }

echo "== 6/8 null-data preflight exists =="
grep -Fq "WHERE school_id IS NULL" "$MIG" \
  && grep -Fq "OR subject_id IS NULL" "$MIG" \
  && echo "OK: migration aborts on remaining orphans" \
  || { echo "FAIL: orphan preflight missing"; exit 1; }

echo "== 7/8 NOT NULL enforcement exists =="
grep -Fq "ALTER COLUMN school_id SET NOT NULL" "$MIG" \
  && grep -Fq "ALTER COLUMN subject_id SET NOT NULL" "$MIG" \
  && echo "OK: identity columns enforced" \
  || { echo "FAIL: NOT NULL enforcement missing"; exit 1; }

echo "== 8/8 postcondition exists =="
grep -Fq "scheme identity columns remain nullable" "$MIG" \
  && echo "OK: postcondition present" \
  || { echo "FAIL: postcondition missing"; exit 1; }

npx tsc --noEmit

echo
echo "All TBL-010G checks passed."
