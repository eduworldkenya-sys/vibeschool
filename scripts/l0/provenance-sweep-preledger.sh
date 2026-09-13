#!/usr/bin/env bash
set -euo pipefail

# L0 recovery instrument: provenance only. No Supabase connection, no writes.
# Purpose: locate the historical 20260520000000 baseline in reachable git history
# before deriving any schema from production.

OUT_DIR="${1:-docs/L0_EVIDENCE/provenance-sweep}"
mkdir -p "$OUT_DIR"

printf 'timestamp_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$OUT_DIR/run.env"
printf 'head=%s\n' "$(git rev-parse HEAD)" >> "$OUT_DIR/run.env"
printf 'branch=%s\n' "$(git branch --show-current)" >> "$OUT_DIR/run.env"

# 1. Exact historical path lookup.
git log --all --format='%H %ad %s' --date=iso-strict -- \
  supabase/migrations/20260520000000_timetable_foundation_baseline.sql \
  > "$OUT_DIR/exact-path.log" || true

# 2. Deleted/renamed migration inventory.
git log --all --diff-filter=DR --name-status --format='%H %ad %s' --date=iso-strict -- \
  supabase/migrations > "$OUT_DIR/deleted-renamed-migrations.log" || true

# 3. Baseline/school/timetable commit messages across all reachable refs.
git log --all --format='%H %ad %s' --date=iso-strict --grep='baseline\|timetable_foundation\|schools\|timetable' -i \
  > "$OUT_DIR/keyword-commits.log" || true

# 4. All migration blobs containing the historical marker or baseline name.
git grep -n -i 'timetable_foundation_baseline\|20260520000000' $(git rev-list --all) -- \
  'supabase/migrations/**' 'docs/**' 'supabase/reconciliation/**' \
  > "$OUT_DIR/content-hits.log" 2>&1 || true

# 5. Dangling objects are evidence candidates, not automatically trusted.
git fsck --full --no-reflogs --unreachable 2> "$OUT_DIR/fsck.stderr" \
  | grep -E 'unreachable (blob|commit|tree)' > "$OUT_DIR/unreachable-objects.log" || true

# 6. Emit a deterministic verdict. FOUND means an exact path/content hit exists;
#    NOT_FOUND means only that reachable repository evidence did not expose it.
if [[ -s "$OUT_DIR/exact-path.log" || -s "$OUT_DIR/content-hits.log" ]]; then
  echo 'PROVENANCE_VERDICT=FOUND_CANDIDATE' > "$OUT_DIR/verdict.env"
else
  echo 'PROVENANCE_VERDICT=NOT_FOUND_IN_REACHABLE_GIT_INDEX' > "$OUT_DIR/verdict.env"
fi

cat <<'EOF' > "$OUT_DIR/README.txt"
This directory is an L0 evidence artifact.

It records a read-only git provenance sweep for the missing
20260520000000_timetable_foundation_baseline migration.

NOT_FOUND_IN_REACHABLE_GIT_INDEX is not proof that the file never existed.
It means only that the currently reachable git refs/index did not expose the
historical body. A separate local clone may contain reflog/dangling objects.

Do not use current production DDL as a historical baseline solely because this
sweep fails. If provenance fails, derive the pre-ledger foundation from
production catalog evidence plus the repository's later mutations, then prove
it with blank replay.
EOF
