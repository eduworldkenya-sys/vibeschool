#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be a postgres owner/operator connection}"
: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"

command -v psql >/dev/null || { echo "psql is required" >&2; exit 2; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 2; }
command -v curl >/dev/null || { echo "curl is required" >&2; exit 2; }

SESSION_ID=""
FINALIZED=0

sql_json() {
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc "$1"
}

invoke_worker() {
  local function_name="$1"
  local body="$2"
  curl --fail-with-body --silent --show-error \
    -X POST "${SUPABASE_URL%/}/functions/v1/${function_name}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    --data "$body"
}

abort_on_exit() {
  local code=$?
  if [[ $code -ne 0 && -n "$SESSION_ID" && $FINALIZED -eq 0 ]]; then
    local safe_reason="exact-session invoker failed with exit code ${code}"
    psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -v sid="$SESSION_ID" -v reason="$safe_reason" \
      -c "select public.hq_content_factory_r2_operator_abort_canary(:'sid'::uuid, :'reason');" >/dev/null 2>&1 || true
  fi
  exit "$code"
}
trap abort_on_exit EXIT

prepare="$(sql_json "select public.hq_content_factory_r2_operator_prepare_canary();")"
SESSION_ID="$(jq -r '.session_id' <<<"$prepare")"
TOKEN="$(jq -r '.invocation_token' <<<"$prepare")"
PROPOSAL_ID="$(jq -r '.proposal_id' <<<"$prepare")"
JOB_ID="$(jq -r '.research_job_id' <<<"$prepare")"
RESEARCH_TASK_ID="$(jq -r '.research_task_id' <<<"$prepare")"

[[ -n "$SESSION_ID" && "$SESSION_ID" != "null" ]] || { echo "prepare did not return a session" >&2; exit 3; }

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -v sid="$SESSION_ID" \
  -c "select public.hq_content_factory_r2_operator_attach_canary_seed(:'sid'::uuid);" >/dev/null

sql_json "select public.hq_content_factory_r2_canary_consume_invocation('${TOKEN}','research');" >/dev/null
invoke_worker "content-research-worker" "$(jq -nc --arg taskId "$RESEARCH_TASK_ID" --arg jobId "$JOB_ID" '{taskId:$taskId,jobId:$jobId}')" >/dev/null

SOURCE_ID="$(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atq -v pid="$PROPOSAL_ID" -c "select id from public.curriculum_intelligence_sources where proposal_id=:'pid'::uuid order by created_at desc,id desc limit 1;")"
[[ -n "$SOURCE_ID" ]] || { echo "research produced no persisted source" >&2; exit 4; }

semantic_bind="$(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atq -v sid="$SESSION_ID" -v source_id="$SOURCE_ID" -c "select public.hq_content_factory_r2_operator_bind_semantic(:'sid'::uuid, :'source_id'::uuid);")"
SEMANTIC_TASK_ID="$(jq -r '.semantic_task_id' <<<"$semantic_bind")"
sql_json "select public.hq_content_factory_r2_canary_consume_invocation('${TOKEN}','semantic');" >/dev/null
invoke_worker "content-semantic-verifier" "$(jq -nc --arg taskId "$SEMANTIC_TASK_ID" --arg sourceId "$SOURCE_ID" '{taskId:$taskId,sourceId:$sourceId}')" >/dev/null

authoring_bind="$(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atq -v sid="$SESSION_ID" -c "select public.hq_content_factory_r2_operator_bind_authoring(:'sid'::uuid);")"
AUTHORING_TASK_ID="$(jq -r '.authoring_task_id' <<<"$authoring_bind")"
sql_json "select public.hq_content_factory_r2_canary_consume_invocation('${TOKEN}','authoring');" >/dev/null
invoke_worker "content-authoring-worker" "$(jq -nc --arg taskId "$AUTHORING_TASK_ID" --arg proposalId "$PROPOSAL_ID" '{taskId:$taskId,proposalId:$proposalId}')" >/dev/null

final="$(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atq -v sid="$SESSION_ID" -c "select public.hq_content_factory_r2_operator_finalize_canary(:'sid'::uuid);")"
FINALIZED=1
trap - EXIT
jq . <<<"$final"
