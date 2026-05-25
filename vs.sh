#!/bin/bash
# ─────────────────────────────────────────────
#  vs.sh  —  VibeSchool dev helper (Termux)
#  Usage:
#    ./vs.sh "commit message"   → check + commit + push
#    ./vs.sh --check            → type-check only
#    ./vs.sh --status           → git status + last 5 commits
#    ./vs.sh --undo             → undo last commit (keep changes)
# ─────────────────────────────────────────────

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
RESET='\033[0m'

log()  { echo -e "${CYAN}▶ $1${RESET}"; }
ok()   { echo -e "${GREEN}✓ $1${RESET}"; }
warn() { echo -e "${YELLOW}⚠ $1${RESET}"; }
fail() { echo -e "${RED}✗ $1${RESET}"; exit 1; }

# ── Guard: must be in project root ───────────────────────────────────────────
if [ ! -f "package.json" ]; then
  fail "Run this from the vibeschool project root"
fi

# ── --status ─────────────────────────────────────────────────────────────────
if [ "$1" == "--status" ]; then
  echo ""
  log "Git status"
  git status -s
  echo ""
  log "Last 5 commits"
  git log --oneline -5
  exit 0
fi

# ── --undo ───────────────────────────────────────────────────────────────────
if [ "$1" == "--undo" ]; then
  warn "Undoing last commit (changes kept locally)..."
  git reset --soft HEAD~1
  ok "Undone. Files still modified — nothing pushed."
  exit 0
fi

# ── --check ──────────────────────────────────────────────────────────────────
if [ "$1" == "--check" ]; then
  log "Running TypeScript check..."
  npx tsc --noEmit && ok "No type errors" || fail "Type errors found — fix before pushing"
  exit 0
fi

# ── commit + push ─────────────────────────────────────────────────────────────
MSG="$1"
if [ -z "$MSG" ]; then
  fail "Provide a commit message: ./vs.sh \"your message\""
fi

echo ""
log "TypeScript check..."
npx tsc --noEmit && ok "Types clean" || fail "Type errors — fix before pushing"

echo ""
log "Staging all changes..."
git add -A
git status -s

echo ""
log "Committing: \"$MSG\""
git commit -m "$MSG" || warn "Nothing to commit"

echo ""
log "Pushing to main..."
git push

echo ""
ok "Done! Vercel is building now."
echo -e "  ${CYAN}https://vercel.com/eduworldkenya-sys/vibeschool/deployments${RESET}"
echo ""
