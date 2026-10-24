#!/usr/bin/env bash
set -euo pipefail

# VibeSchool repository branch forensic audit.
# READ-ONLY: this script never creates, updates, merges, renames, tags, or deletes refs.
# Requirements: git, gh, authenticated access to the target repository.

REPO="${REPO:-eduworldkenya-sys/vibeschool}"
OUT_DIR="${OUT_DIR:-audit-output-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT_DIR"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }
}

require_cmd git
require_cmd gh

gh auth status >/dev/null

git fetch --all --prune

MAIN_REF="origin/main"

git show-ref --verify --quiet "refs/remotes/$MAIN_REF" || {
  echo "Missing $MAIN_REF after fetch" >&2
  exit 1
}

MAIN_SHA="$(git rev-parse "$MAIN_REF")"
printf 'main_sha,%s\n' "$MAIN_SHA" > "$OUT_DIR/metadata.csv"
printf 'generated_at,%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUT_DIR/metadata.csv"
printf 'repository,%s\n' "$REPO" >> "$OUT_DIR/metadata.csv"

# Branch inventory from the actual Git ref graph.
printf '%s\n' 'branch,sha,last_commit_epoch,reachable_from_main,ahead_of_main,behind_main,unique_commits' > "$OUT_DIR/branches.csv"

while IFS= read -r ref; do
  branch="${ref#refs/remotes/origin/}"
  [[ "$branch" == "HEAD" ]] && continue
  sha="$(git rev-parse "$ref")"
  epoch="$(git show -s --format=%ct "$sha")"
  reachable=false
  if git merge-base --is-ancestor "$sha" "$MAIN_REF"; then reachable=true; fi
  ahead="$(git rev-list --count "$MAIN_REF..$sha")"
  behind="$(git rev-list --count "$sha..$MAIN_REF")"
  unique="$ahead"
  printf '%q,%s,%s,%s,%s,%s,%s\n' "$branch" "$sha" "$epoch" "$reachable" "$ahead" "$behind" "$unique" >> "$OUT_DIR/branches.csv"
done < <(git for-each-ref --format='%(refname)' 'refs/remotes/origin/*')

# Full GitHub PR inventory. Keep this separate from Git graph facts.
gh pr list --repo "$REPO" --state all --limit 1000 --json number,title,state,isDraft,mergedAt,headRefName,baseRefName,headRefOid,createdAt,updatedAt > "$OUT_DIR/pull-requests.json"

# Branch protection status. Missing protection is recorded as false/unknown rather than inferred.
printf '%s\n' 'branch,protection_status' > "$OUT_DIR/protection.csv"
while IFS= read -r branch; do
  [[ "$branch" == "main" ]] && continue
  encoded_branch="${branch//\//%2F}"
  if gh api -H 'Accept: application/vnd.github+json' "/repos/$REPO/branches/$encoded_branch/protection" >/dev/null 2>&1; then
    status=protected
  else
    status=not_protected_or_unavailable
  fi
  printf '%q,%s\n' "$branch" "$status" >> "$OUT_DIR/protection.csv"
done < <(git for-each-ref --format='%(refname:strip=3)' 'refs/remotes/origin/*' | grep -v '^HEAD$' | sort -u)

# Repository configuration references to branch names.
grep -RInE 'refs/heads/|origin/|branch:' .github vercel.json 2>/dev/null > "$OUT_DIR/config-branch-references.txt" || true

# Prove or disprove presence of the historical timetable baseline in reachable history.
git log --all --full-history --name-status -- '**/20260520000000_timetable_foundation_baseline.sql' > "$OUT_DIR/timetable-baseline-search.txt" || true

# VibeTwin and HQ ancestry matrix. This is evidence only; it makes no decisions.
cat > "$OUT_DIR/architecture-ancestry.txt" <<'EOF'
VibeTwin P-series ancestry
==========================
EOF
VIBETWIN=(
  feat/vibetwin-p1-dynamic-transformations
  feat/vibetwin-p2-representation-effectiveness
  feat/vibetwin-p3-growth-proof
  feat/vibetwin-p4-continuous-assessment
  feat/vibetwin-p5-adaptive-session-engine
  feat/vibetwin-p6-rich-content-generation
  feat/vibetwin-p7-socratic-tutor
  feat/vibetwin-p8-forgetting-engine
  feat/vibetwin-p9-teacher-synchronization
  feat/vibetwin-p10-adaptive-revision
  feat/vibetwin-p11-multimodal-teaching
  feat/vibetwin-p12-learning-companion
)

compare_pair() {
  local a="$1" b="$2"
  if ! git show-ref --verify --quiet "refs/remotes/origin/$a" || ! git show-ref --verify --quiet "refs/remotes/origin/$b"; then
    printf '%s -> %s : MISSING\n' "$a" "$b" >> "$OUT_DIR/architecture-ancestry.txt"
    return
  fi
  local sa sb mb
  sa="$(git rev-parse "origin/$a")"
  sb="$(git rev-parse "origin/$b")"
  mb="$(git merge-base "$sa" "$sb")"
  if git merge-base --is-ancestor "$sa" "$sb"; then
    relation='A_IS_ANCESTOR_OF_B'
  elif git merge-base --is-ancestor "$sb" "$sa"; then
    relation='B_IS_ANCESTOR_OF_A'
  elif [[ "$mb" == "$sa" ]]; then
    relation='A_IS_MERGE_BASE'
  elif [[ "$mb" == "$sb" ]]; then
    relation='B_IS_MERGE_BASE'
  else
    relation='DIVERGED_OR_PARALLEL'
  fi
  printf '%s -> %s : %s | merge-base=%s\n' "$a" "$b" "$relation" "$mb" >> "$OUT_DIR/architecture-ancestry.txt"
}

for ((i=0; i<${#VIBETWIN[@]}-1; i++)); do
  compare_pair "${VIBETWIN[$i]}" "${VIBETWIN[$((i+1))]}"
done

cat >> "$OUT_DIR/architecture-ancestry.txt" <<'EOF'

HQ architecture ancestry
========================
EOF
HQ=(
  feat/hq-operating-system
  feat/hq-autonomous-workforce-os
  feat/hq-product-nervous-system-20260809
  feat/hq-ui-consolidation-20260809
  feat/hq-workforce-final-hardening-20260809
  feat/hq-company-library-foundation-20260809
  feat/hq-company-library-final-20260809
  feat/hq-company-library-certified-20260809
)
for ((i=0; i<${#HQ[@]}-1; i++)); do
  compare_pair "${HQ[$i]}" "${HQ[$((i+1))]}"
done

cat > "$OUT_DIR/README.txt" <<'EOF'
This directory is generated by scripts/repository_branch_forensic_audit.sh.

The audit is evidence collection only. It does not authorize branch deletion,
merging, tagging, renaming, production deployment, or database changes.

Decision rules are documented in:
docs/engineering/REPOSITORY-BRANCH-ARCHAEOLOGY-AND-CLEANUP-LOG.md

Do not classify a branch as SHOULD_DELETE from this output alone. A deletion
candidate requires the documented safety gates and, for consequential cases,
explicit architectural approval.
EOF

echo "Audit complete: $OUT_DIR"
