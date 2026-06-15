#!/bin/bash

ROOT="/data/data/com.termux/files/home/vibeschool"
PASS=0
FAIL=0

ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

check_file() {
  [ -f "$ROOT/$1" ] && ok "$1" || fail "MISSING: $1"
}

check_contains() {
  local file="$ROOT/$1"
  local pattern="$2"
  local label="$3"
  if [ -f "$file" ]; then
    grep -q "$pattern" "$file" && ok "$label" || fail "$label — pattern not found in $1"
  else
    fail "$label — file missing: $1"
  fi
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  VIBEEXAM VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "── STEP 1: Types ──"
check_contains "lib/types.ts" "ExamDifficulty" "ExamDifficulty type"
check_contains "lib/types.ts" "ExamQuestion" "ExamQuestion type"
check_contains "lib/types.ts" "ExamSession" "ExamSession type"
check_contains "lib/types.ts" "ExamResult" "ExamResult type"

echo ""
echo "── STEP 2: Exam Data ──"
check_file "lib/examData.ts"
check_contains "lib/examData.ts" "Form 1" "Form 1 topics"
check_contains "lib/examData.ts" "Form 4" "Form 4 topics"

echo ""
echo "── STEP 3: Exam Tracker ──"
check_file "lib/examTracker.ts"
check_contains "lib/examTracker.ts" "=== 3" "FIX4: prompt fires exactly at 3"
check_contains "lib/examTracker.ts" "shouldShowRegisterPrompt" "shouldShowRegisterPrompt export"

echo ""
echo "── STEPS 4-5: API Routes ──"
check_file "app/api/exam/generate/route.ts"
check_file "app/api/exam/evaluate/route.ts"
check_contains "app/api/exam/generate/route.ts" "safeCount" "FIX3: count sanitized"
check_contains "app/api/exam/generate/route.ts" "Math.min" "FIX3: Math.min clamp"
check_contains "app/api/exam/generate/route.ts" "llama-3.3-70b-versatile" "Groq model correct"
check_contains "app/api/exam/generate/route.ts" "GROQ_API_KEY" "GROQ_API_KEY env var"

echo ""
echo "── STEPS 6-13: Components ──"
check_file "components/exam/ProgressBar.tsx"
check_file "components/exam/QuestionCard.tsx"
check_file "components/exam/AnswerOption.tsx"
check_file "components/exam/FeedbackCard.tsx"
check_file "components/exam/ScoreCard.tsx"
check_file "components/exam/SubjectPicker.tsx"
check_file "components/exam/TopicPicker.tsx"
check_file "components/exam/ShareButton.tsx"
check_contains "components/exam/FeedbackCard.tsx" "svg" "SVG icons (no lucide)"
check_contains "components/exam/ShareButton.tsx" "wa.me" "WhatsApp share link"
check_contains "components/exam/ProgressBar.tsx" "C8A84B" "Gold accent color"

echo ""
echo "── STEPS 14-18: Pages ──"
check_file "app/exam/page.tsx"
check_file "app/exam/session/page.tsx"
check_file "app/exam/feedback/page.tsx"
check_file "app/exam/results/page.tsx"
check_file "app/exam/register/page.tsx"

echo ""
echo "── FIX 1: router in useEffect ──"
python3 - << 'PYEOF'
path = "/data/data/com.termux/files/home/vibeschool/app/exam/session/page.tsx"
with open(path) as f:
    lines = f.readlines()
in_effect = False
depth = 0
ok = True
for i, line in enumerate(lines):
    if 'useEffect' in line:
        in_effect = True
    if in_effect:
        depth += line.count('{') - line.count('}')
        if depth <= 0:
            in_effect = False
    if ('router.replace' in line) and not in_effect:
        # allow inside arrow functions / handlers (not bare render body)
        stripped = line.strip()
        if not stripped.startswith('//'):
            print(f"  ❌ FIX1 FAILED: router.replace outside useEffect at line {i+1}")
            ok = False
if ok:
    print("  ✅ FIX1: router.replace is inside useEffect")
PYEOF

echo ""
echo "── FIX 2: setLoading inside try ──"
python3 - << 'PYEOF'
path = "/data/data/com.termux/files/home/vibeschool/app/exam/results/page.tsx"
with open(path) as f:
    content = f.read()
try_block = content[content.find('try {'):content.find('} catch')]
if 'setLoading(false)' in try_block:
    print("  ✅ FIX2: setLoading(false) is inside try block")
else:
    print("  ❌ FIX2 FAILED: setLoading(false) not inside try block")
PYEOF

echo ""
echo "── FIX 5: Signup route exists ──"
[ -f "$ROOT/app/global/signup/page.tsx" ] && ok "FIX5: /global/signup/page.tsx exists" || fail "FIX5: /global/signup/page.tsx MISSING"

echo ""
echo "── MIDDLEWARE: /exam is public ──"
python3 - << 'PYEOF'
path = "/data/data/com.termux/files/home/vibeschool/middleware.ts"
with open(path) as f:
    content = f.read()
if "'/exam'" in content or '"/exam"' in content:
    print("  ❌ MIDDLEWARE: /exam found in protectedPrefixes — blocks anonymous users")
else:
    print("  ✅ MIDDLEWARE: /exam is public")
PYEOF

echo ""
echo "── ENV: GROQ_API_KEY ──"
if [ -f "$ROOT/.env.local" ]; then
    grep -q "GROQ_API_KEY" "$ROOT/.env.local" && ok "GROQ_API_KEY in .env.local" || fail "GROQ_API_KEY missing from .env.local — add to Vercel too"
else
    echo "  ⚠️  .env.local not found — ensure GROQ_API_KEY is set in Vercel env vars"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RESULT: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
if [ $FAIL -eq 0 ]; then
    echo "  All checks passed. Run:"
    echo "  npx tsc --noEmit && ./vibe-push.sh \"feat: VibeExam — free AI KCSE mock exam feature\""
else
    echo "  Fix the ❌ items above before pushing."
fi
echo ""
