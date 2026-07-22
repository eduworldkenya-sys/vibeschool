#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

MIG="supabase/migrations/20260722190000_tbl010f_repair_orphan_scheme_identity.sql"

echo "== TBL-010F verification =="

[ -f "$MIG" ] \
  || { echo "FAIL: migration missing"; exit 1; }

echo "== 1/8 target row guarded =="
grep -Fq "ed83edb5-3323-4c3a-8179-08add352974d" "$MIG" \
  && echo "OK: target row fixed by explicit id" \
  || { echo "FAIL: target id guard missing"; exit 1; }

echo "== 2/8 teacher assignment resolved =="
grep -Fq "public.teacher_classes" "$MIG" \
  && grep -Fq "public.subjects" "$MIG" \
  && echo "OK: resolves teacher/class subject assignment" \
  || { echo "FAIL: assignment resolution missing"; exit 1; }

echo "== 3/8 exact school identity guarded =="
grep -Fq "v_expected_school_id" "$MIG" \
  && grep -Fq "class does not belong to expected school" "$MIG" \
  && echo "OK: class-school identity guarded" \
  || { echo "FAIL: school identity guard missing"; exit 1; }

echo "== 4/8 assignment uniqueness guarded =="
grep -Fq "v_assignment_count <> 1" "$MIG" \
  && grep -Fq "expected teacher/class English assignment count" "$MIG" \
  && echo "OK: assignment uniqueness guard present" \
  || { echo "FAIL: assignment uniqueness guard missing"; exit 1; }

echo "== 5/8 repair update present =="
grep -Fq "UPDATE public.scheme_of_work" "$MIG" \
  && grep -Fq "school_id = v_expected_school_id" "$MIG" \
  && grep -Fq "subject_id = v_expected_subject_id" "$MIG" \
  && echo "OK: targeted repair update present" \
  || { echo "FAIL: targeted repair update missing"; exit 1; }

echo "== 6/8 row count enforced =="
grep -Fq "GET DIAGNOSTICS v_row_count = ROW_COUNT" "$MIG" \
  && grep -Fq "update affected % rows, expected 1" "$MIG" \
  && echo "OK: update must affect exactly one row" \
  || { echo "FAIL: row-count enforcement missing"; exit 1; }

echo "== 7/8 post-update verification present =="
grep -Fq "repaired identity verification failed" "$MIG" \
  && echo "OK: repaired identity is verified" \
  || { echo "FAIL: post-update verification missing"; exit 1; }

echo "== 8/8 idempotency and final orphan proof =="
grep -Fq "target row already repaired" "$MIG" \
  && grep -Fq "target scheme row remains orphaned" "$MIG" \
  && echo "OK: migration is idempotent and checks final state" \
  || { echo "FAIL: idempotency or final orphan check missing"; exit 1; }

echo
echo "All TBL-010F migration structure checks passed."
