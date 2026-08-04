#!/data/data/com.termux/files/usr/bin/bash
set -u

FIX_ID="LP-002A2B"

echo "FIX_ID=$FIX_ID"
echo "MODE=READ_ONLY"
echo "HEAD=$(git rev-parse --short HEAD)"

AUDIT_EXIT=0
TEST_EXIT=0
SCOPE_EXIT=0
DIFF_EXIT=0

echo
echo "=== REQUIRED FILES ==="
for file in \
  components/teacher/LessonPlanModal.tsx \
  lib/database.types.ts \
  supabase/migrations/20260803173622_add_lesson_plan_history.sql
do
  if [ -f "$file" ]; then
    echo "PASS: $file"
  else
    echo "FAIL: missing $file"
    AUDIT_EXIT=1
  fi
done

echo
echo "=== PARENT DELIVERY WRITER ==="
if grep -q \
  "from('parent_messages').insert" \
  components/teacher/LessonPlanModal.tsx
then
  echo "PASS: direct parent-message writer confirmed"
else
  echo "FAIL: expected direct parent-message writer not found"
  AUDIT_EXIT=1
fi

echo
echo "=== CURRENT GENERATED CONTRACT ==="
for field in \
  "generated_by: string" \
  "student_id: string" \
  "teacher_id: string"
do
  if grep -q "$field" lib/database.types.ts; then
    echo "PASS: $field"
  else
    echo "FAIL: missing generated contract field: $field"
    AUDIT_EXIT=1
  fi
done

echo
echo "=== MISSING DELIVERY IDENTITY PROOF ==="
if grep -n -A45 \
  'parent_messages: {' \
  lib/database.types.ts \
  | grep -q 'lesson_plan_id:'
then
  echo "FAIL: parent_messages already has lesson_plan_id; audit definition is stale"
  AUDIT_EXIT=1
else
  echo "PASS: parent_messages has no lesson_plan_id"
fi

if grep -RInE \
  --include='*.sql' \
  'unique.*lesson_plan_id.*student_id.*purpose|unique.*student_id.*lesson_plan_id.*purpose' \
  supabase/migrations \
  >/dev/null 2>&1
then
  echo "FAIL: parent delivery uniqueness already exists; audit definition is stale"
  AUDIT_EXIT=1
else
  echo "PASS: no parent delivery uniqueness migration exists"
fi

echo
echo "=== STATIC SAFETY TESTS ==="
python3 - <<'PY'
from pathlib import Path

modal = Path("components/teacher/LessonPlanModal.tsx").read_text()
types = Path("lib/database.types.ts").read_text()

checks = [
    (
        "direct parent_messages insert remains",
        "from('parent_messages').insert" in modal,
    ),
    (
        "lesson source marker remains",
        "generated_by: 'lesson_plan'" in modal,
    ),
    (
        "parent message generated type exists",
        "parent_messages: {" in types,
    ),
]

failed = False
for label, condition in checks:
    if condition:
        print(f"PASS: {label}")
    else:
        print(f"FAIL: {label}")
        failed = True

raise SystemExit(1 if failed else 0)
PY
TEST_EXIT=$?

echo
echo "=== READ-ONLY SCOPE CHECK ==="
source_changes="$(agent_source_status)"

if [ -n "$source_changes" ]; then
  echo "$source_changes"
  SCOPE_EXIT=1
else
  echo "PASS: no source files changed by audit"
fi

echo
echo "=== DIFF CHECK ==="
git diff --check
DIFF_EXIT=$?

echo
echo "AUDIT_EXIT=$AUDIT_EXIT"
echo "TEST_EXIT=$TEST_EXIT"
echo "SCOPE_EXIT=$SCOPE_EXIT"
echo "DIFF_EXIT=$DIFF_EXIT"

echo
echo "FINDING=parent_messages lacks canonical lesson delivery identity and idempotent mutation authority"
echo "NEXT_ACTION=implement guarded parent-delivery migration, RPC, shared service, and modal adoption"

if [ "$AUDIT_EXIT" -ne 0 ] \
  || [ "$TEST_EXIT" -ne 0 ] \
  || [ "$SCOPE_EXIT" -ne 0 ] \
  || [ "$DIFF_EXIT" -ne 0 ]
then
  exit 1
fi

exit 0
