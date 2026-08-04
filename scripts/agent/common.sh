#!/data/data/com.termux/files/usr/bin/bash

AGENT_ROOT=".vibeschool-agent"
AGENT_LOGS="$AGENT_ROOT/logs"
AGENT_REPORTS="$AGENT_ROOT/reports"
AGENT_STATE="$AGENT_ROOT/state.json"
AGENT_FIXES="scripts/agent/fixes"

mkdir -p "$AGENT_LOGS" "$AGENT_REPORTS"

agent_abort() {
  echo "ABORT: $*" >&2
  exit 1
}

agent_timestamp() {
  date -u +"%Y%m%dT%H%M%SZ"
}

agent_known_temp_paths() {
  find . -maxdepth 1 \
    \( \
      -name '.*-audit' \
      -o -name '.*-backups' \
      -o -name '.*-tsc' \
      -o -name '.ops001*-artifacts' \
      -o -name 'PASTE_ME_*.sh' \
    \) \
    -print \
    2>/dev/null \
    | sort
}

agent_source_status() {
  git status --porcelain \
    | grep -vE \
      '^\?\? (\.[A-Za-z0-9_-]+-(audit|backups|tsc)/|\.ops001[^/]*/|PASTE_ME_[^/]+\.sh$)' \
    | grep -vE \
      '^(\?\?| M) (\.gitignore|\.vibeschool-agent/|\.vibeschool-agent/state\.json|scripts/vibeschool-agent\.sh|scripts/agent/.*|scripts/test-ops001-agent-runner\.py)$' \
    || true
}

agent_status() {
  local branch head source_changes temp_count latest

  branch="$(git branch --show-current)"
  head="$(git rev-parse --short HEAD)"
  source_changes="$(agent_source_status)"
  temp_count="$(agent_known_temp_paths | sed '/^$/d' | wc -l | tr -d ' ')"
  latest="$(
    python3 - <<'PY'
import json
from pathlib import Path

path = Path(".vibeschool-agent/state.json")
if not path.exists():
    print("none")
else:
    try:
        data = json.loads(path.read_text())
        last_run = data.get("last_run")
        if isinstance(last_run, dict):
            print(last_run.get("fix_id") or "none")
        else:
            print("none")
    except Exception:
        print("invalid-state")
PY
  )"

  echo "VIBESCHOOL_AGENT=READY"
  echo "MODE=READ_ONLY"
  echo "BRANCH=$branch"
  echo "HEAD=$head"

  if [ -n "$source_changes" ]; then
    echo "SOURCE_TREE=DIRTY"
  else
    echo "SOURCE_TREE=CLEAN"
  fi

  echo "TEMP_ARTIFACTS=$temp_count"
  echo "LAST_FIX=$latest"

  if [ -n "$source_changes" ]; then
    echo
    echo "=== SOURCE CHANGES ==="
    printf '%s\n' "$source_changes"
  fi

  if [ "$temp_count" -gt 0 ]; then
    echo
    echo "=== KNOWN TEMPORARY ARTIFACTS ==="
    agent_known_temp_paths
  fi
}

agent_run_fix() {
  local fix_id="$1"
  local definition="$AGENT_FIXES/$fix_id.sh"
  local run_id log_dir report_file source_changes result

  [ -f "$definition" ] || agent_abort "unregistered fix ID: $fix_id"

  source_changes="$(agent_source_status)"
  if [ -n "$source_changes" ]; then
    echo "The runner found source changes outside recognized temporary artifacts:"
    printf '%s\n' "$source_changes"
    agent_abort "commit, stash, or intentionally register those changes before running an autonomous audit"
  fi

  run_id="$(agent_timestamp)-$fix_id"
  log_dir="$AGENT_LOGS/$run_id"
  report_file="$AGENT_REPORTS/$run_id.md"
  mkdir -p "$log_dir"

  export VIBE_AGENT_FIX_ID="$fix_id"
  export VIBE_AGENT_RUN_ID="$run_id"
  export VIBE_AGENT_LOG_DIR="$log_dir"
  export VIBE_AGENT_REPORT_FILE="$report_file"

  set +e
  bash "$definition" >"$log_dir/raw.log" 2>&1
  result=$?
  set -e

  python3 scripts/agent/report.py \
    --fix-id "$fix_id" \
    --run-id "$run_id" \
    --exit-code "$result" \
    --raw-log "$log_dir/raw.log" \
    --report "$report_file" \
    --state "$AGENT_STATE"

  cat "$report_file"

  if [ "$result" -ne 0 ]; then
    exit "$result"
  fi
}

agent_show_latest_report() {
  local latest

  latest="$(
    find "$AGENT_REPORTS" -maxdepth 1 -type f -name '*.md' \
      -print 2>/dev/null \
      | sort \
      | tail -1
  )"

  [ -n "$latest" ] || agent_abort "no agent report exists yet"
  cat "$latest"
}

agent_clean_temporary_artifacts() {
  local paths=()

  while IFS= read -r path; do
    [ -n "$path" ] && paths+=("$path")
  done < <(agent_known_temp_paths)

  if [ "${#paths[@]}" -eq 0 ]; then
    echo "CLEAN_RESULT=NOTHING_TO_REMOVE"
    return
  fi

  echo "The following recognized temporary artifacts will be removed:"
  printf '  %s\n' "${paths[@]}"

  rm -rf -- "${paths[@]}"

  echo "CLEAN_RESULT=REMOVED"
  echo "REMOVED_COUNT=${#paths[@]}"
}
