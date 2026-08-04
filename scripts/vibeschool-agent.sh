#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

source scripts/agent/common.sh

COMMAND="${1:-status}"
ARGUMENT="${2:-}"

case "$COMMAND" in
  status)
    agent_status
    ;;

  run)
    [ -n "$ARGUMENT" ] || agent_abort "usage: bash scripts/vibeschool-agent.sh run FIX-ID"
    agent_run_fix "$ARGUMENT"
    ;;

  report)
    agent_show_latest_report
    ;;

  clean)
    agent_clean_temporary_artifacts
    ;;

  help|-h|--help)
    cat <<'EOF'
Vibeschool Autonomous Engineering Runner — read-only foundation

Commands:
  status              Show repository and agent state
  run FIX-ID          Run one registered read-only fix audit
  report              Show the most recent compact report
  clean               Remove known temporary audit/build artifacts
  help                Show this help

Examples:
  bash scripts/vibeschool-agent.sh status
  bash scripts/vibeschool-agent.sh run LP-002A2B
  bash scripts/vibeschool-agent.sh report

Safety:
  - does not edit application source;
  - does not execute database migrations;
  - does not commit or push;
  - refuses unknown fix IDs;
  - stores raw evidence under .vibeschool-agent/logs/.
EOF
    ;;

  *)
    agent_abort "unknown command: $COMMAND"
    ;;
esac
