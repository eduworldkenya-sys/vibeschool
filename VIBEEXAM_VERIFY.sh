#!/bin/bash
echo ""
echo "═══════════════════════════════════════════"
echo "  VibeExam Upgrade — Verification"
echo "═══════════════════════════════════════════"
echo ""

cd ~/vibeschool
PASS=0
FAIL=0

check() {
  local label="$1"
  local cmd="$2"
  if eval "$cmd" &>/dev/null; then
    echo "  ✅  $label"
    PASS=$((PASS+1))
  else
    echo "  ❌  $label"
    FAIL=$((FAIL+1))
  fi
}

checkval() {
  local label="$1"
  local cmd="$2"
  local expected="$3"
  local result
  result=$(eval "$cmd" 2>/dev/null)
  if echo "$result" | grep -q "$expected"; then
    echo "  ✅  $label"
    PASS=$((PASS+1))
  else
    echo "  ❌  $label  (got: $result)"
    FAIL=$((FAIL+1))
  fi
}

# ── 1. Files exist ─────────────────────────────────────────
echo "▶ 1. File presence"
check "generate/route.ts exists"        "[ -f app/api/exam/generate/route.ts ]"
check "examData.ts exists"              "[ -f lib/examData.ts ]"
check "types.ts exists"                 "[ -f lib/types.ts ]"
check "SubjectPicker.tsx exists"        "[ -f components/exam/SubjectPicker.tsx ]"
check "QuestionReview.tsx exists"       "[ -f components/exam/QuestionReview.tsx ]"
check "session/page.tsx exists"         "[ -f app/exam/session/page.tsx ]"
check "Supabase migration exists"       "[ -f supabase/migrations/20260619_vibeexam.sql ]"
echo ""

# ── 2. AI prompt quality ───────────────────────────────────
echo "▶ 2. AI prompt — generate/route.ts"
checkval "Rate limiter present"         "cat app/api/exam/generate/route.ts" "rateLimitMap"
checkval "RATE_MAX_CALLS defined"       "cat app/api/exam/generate/route.ts" "RATE_MAX_CALLS"
checkval "Whitelist: ALLOWED_SUBJECTS"  "cat app/api/exam/generate/route.ts" "ALLOWED_SUBJECTS"
checkval "Whitelist: ALLOWED_FORMS"     "cat app/api/exam/generate/route.ts" "ALLOWED_FORMS"
checkval "Topic sanitisation"           "cat app/api/exam/generate/route.ts" "safeTopic"
checkval "Subject context injected"     "cat app/api/exam/generate/route.ts" "SUBJECT_CONTEXT"
checkval "Difficulty context injected"  "cat app/api/exam/generate/route.ts" "DIFFICULTY_INSTRUCTIONS"
checkval "Question validator present"   "cat app/api/exam/generate/route.ts" "validated"
checkval "429 rate limit response"      "cat app/api/exam/generate/route.ts" "status: 429"
checkval "max_tokens raised to 4096"    "cat app/api/exam/generate/route.ts" "max_tokens:  4096"
checkval "Kenyan context (Ksh)"         "cat app/api/exam/generate/route.ts" "Ksh"
checkval "Kenyan context (KCSE papers)" "cat app/api/exam/generate/route.ts" "2018"
echo ""

# ── 3. Subjects ────────────────────────────────────────────
echo "▶ 3. Subjects — examData.ts"
for subj in "MATH_DATA" "ENGLISH_DATA" "BIOLOGY_DATA" "CHEMISTRY_DATA" "PHYSICS_DATA" "GEOGRAPHY_DATA" "KISWAHILI_DATA" "CRE_DATA" "BUSINESS_DATA" "HISTORY_DATA"; do
  checkval "$subj defined" "cat lib/examData.ts" "$subj"
done
checkval "SUBJECT_DATA exports all 10"  "cat lib/examData.ts" "Business Studies"
checkval "Kiswahili topics in Kiswahili" "cat lib/examData.ts" "Ufahamu"
checkval "Physics Form 1 topics"        "cat lib/examData.ts" "Particulate Nature"
checkval "CRE Form 3 topics"            "cat lib/examData.ts" "Sermon on the Mount"
checkval "Geography Form 2 topics"      "cat lib/examData.ts" "Fishing"
echo ""

# ── 4. Types ───────────────────────────────────────────────
echo "▶ 4. Types — lib/types.ts"
checkval "Physics in ExamSubject"         "cat lib/types.ts" "Physics"
checkval "Geography in ExamSubject"       "cat lib/types.ts" "Geography"
checkval "Kiswahili in ExamSubject"       "cat lib/types.ts" "Kiswahili"
checkval "CRE in ExamSubject"             "cat lib/types.ts" "CRE"
checkval "Business Studies in ExamSubject" "cat lib/types.ts" "Business Studies"
echo ""

# ── 5. SubjectPicker ───────────────────────────────────────
echo "▶ 5. SubjectPicker.tsx"
checkval "Physics button"           "cat components/exam/SubjectPicker.tsx" "Physics"
checkval "Geography button"         "cat components/exam/SubjectPicker.tsx" "Geography"
checkval "Kiswahili button"         "cat components/exam/SubjectPicker.tsx" "Kiswahili"
checkval "CRE button"               "cat components/exam/SubjectPicker.tsx" "CRE"
checkval "Business Studies button"  "cat components/exam/SubjectPicker.tsx" "Business Studies"
SUBJECT_COUNT=$(grep -c '"icon":' components/exam/SubjectPicker.tsx || true)
if [ "$SUBJECT_COUNT" -ge 10 ]; then
  echo "  ✅  10 subjects in picker ($SUBJECT_COUNT found)"
  PASS=$((PASS+1))
else
  echo "  ❌  Expected 10 subjects, found $SUBJECT_COUNT"
  FAIL=$((FAIL+1))
fi
echo ""

# ── 6. QuestionReview ──────────────────────────────────────
echo "▶ 6. QuestionReview.tsx"
checkval "answerMap built"          "cat components/exam/QuestionReview.tsx" "answerMap"
checkval "Correct option highlight" "cat components/exam/QuestionReview.tsx" "isCorrectOpt"
checkval "Selected option highlight" "cat components/exam/QuestionReview.tsx" "isSelectedOpt"
checkval "Explanation rendered"     "cat components/exam/QuestionReview.tsx" "q.explanation"
checkval "teachingNote rendered"    "cat components/exam/QuestionReview.tsx" "q.teachingNote"
checkval "Close button"             "cat components/exam/QuestionReview.tsx" "onClose"
checkval "Fixed overlay positioning" "cat components/exam/QuestionReview.tsx" "position.*fixed"
echo ""

# ── 7. session/page.tsx wiring ─────────────────────────────
echo "▶ 7. session/page.tsx — Review wiring"
checkval "QuestionReview imported"  "cat app/exam/session/page.tsx" "import QuestionReview"
checkval "showReview state"         "cat app/exam/session/page.tsx" "showReview"
checkval "setShowReview(true)"      "cat app/exam/session/page.tsx" "setShowReview(true)"
checkval "setShowReview(false)"     "cat app/exam/session/page.tsx" "setShowReview(false)"
checkval "Review All Questions btn" "cat app/exam/session/page.tsx" "Review All Questions"
checkval "QuestionReview rendered"  "cat app/exam/session/page.tsx" "<QuestionReview"
echo ""

# ── 8. Supabase migration ──────────────────────────────────
echo "▶ 8. Supabase migration SQL"
checkval "exam_sessions table"      "cat supabase/migrations/20260619_vibeexam.sql" "CREATE TABLE IF NOT EXISTS exam_sessions"
checkval "exam_question_log table"  "cat supabase/migrations/20260619_vibeexam.sql" "exam_question_log"
checkval "exam_flags table"         "cat supabase/migrations/20260619_vibeexam.sql" "exam_flags"
checkval "exam_streaks table"       "cat supabase/migrations/20260619_vibeexam.sql" "exam_streaks"
checkval "RLS enabled"              "cat supabase/migrations/20260619_vibeexam.sql" "ROW LEVEL SECURITY"
checkval "update_exam_streak fn"    "cat supabase/migrations/20260619_vibeexam.sql" "update_exam_streak"
checkval "Analytics view"           "cat supabase/migrations/20260619_vibeexam.sql" "exam_topic_analytics"
checkval "exam_subject enum"        "cat supabase/migrations/20260619_vibeexam.sql" "CREATE TYPE exam_subject"
checkval "Indexes present"          "cat supabase/migrations/20260619_vibeexam.sql" "CREATE INDEX"
echo ""

# ── 9. TypeScript check ────────────────────────────────────
echo "▶ 9. TypeScript — npx tsc --noEmit"
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
  echo "  ❌  TypeScript errors found:"
  npx tsc --noEmit 2>&1 | grep "error TS" | head -10
  FAIL=$((FAIL+1))
else
  echo "  ✅  No TypeScript errors"
  PASS=$((PASS+1))
fi
echo ""

# ── Summary ────────────────────────────────────────────────
echo "═══════════════════════════════════════════"
echo "  RESULTS: $PASS passed · $FAIL failed"
if [ "$FAIL" -eq 0 ]; then
  echo ""
  echo "  🟢 All checks passed. Ready to push:"
  echo ""
  echo "  git add -A"
  echo "  git commit -m 'feat(exam): 10 subjects, hardened AI prompt, rate limit, question review, Supabase schema'"
  echo "  git commit --allow-empty -m 'chore: trigger vercel rebuild'"
  echo "  git push"
  echo ""
  echo "  Then run supabase/migrations/20260619_vibeexam.sql"
  echo "  in the Supabase SQL editor."
else
  echo ""
  echo "  🔴 $FAIL checks failed — fix before pushing."
fi
echo "═══════════════════════════════════════════"
