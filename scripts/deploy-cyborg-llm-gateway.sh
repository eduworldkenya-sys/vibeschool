#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"

# cyborg-llm-gateway authenticates requests with a signed `Cyborg <capability>`
# authorization header inside the function. Supabase JWT verification must remain
# disabled at the platform boundary or the Edge Runtime rejects that custom
# authorization header before the capability verifier can run.
supabase functions deploy cyborg-llm-gateway \
  --project-ref "$SUPABASE_PROJECT_REF" \
  --no-verify-jwt
