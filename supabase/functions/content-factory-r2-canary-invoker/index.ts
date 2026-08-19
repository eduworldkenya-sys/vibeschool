import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const JSON_HEADERS = { "Content-Type": "application/json" }
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

const hasInternalAuthority = (req: Request) => {
  if (!SERVICE_ROLE_KEY) return false
  return req.headers.get("authorization") === `Bearer ${SERVICE_ROLE_KEY}`
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" })
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(500, { error: "runtime_config_missing" })

  // This is an internal commissioning endpoint. A prepared canary session UUID is
  // not an authentication credential. Prove service authority before constructing
  // an elevated client, parsing caller-controlled identifiers, or touching state.
  if (!hasInternalAuthority(req)) return json(401, { error: "internal_authorization_required" })

  const body = await req.json().catch(() => ({})) as { sessionId?: string; phase?: string }
  if (!body.sessionId || !body.phase || !["research", "semantic", "authoring"].includes(body.phase)) {
    return json(400, { error: "sessionId_and_valid_phase_required" })
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: gate, error: gateError } = await db.rpc(
    "hq_content_factory_r2_canary_consume_exact_session",
    { p_session_id: body.sessionId, p_phase: body.phase },
  )
  if (gateError || !gate?.task_id) return json(403, { error: "gate2_exact_session_denied" })

  const response = await fetch(`${SUPABASE_URL}/functions/v1/content-factory-r2-dispatch`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ taskId: gate.task_id }),
  })

  const payload = await response.json().catch(() => ({ error: "dispatcher_non_json_response" }))
  return json(response.ok ? 200 : response.status, {
    ok: response.ok,
    phase: body.phase,
    taskId: gate.task_id,
    dispatcherStatus: response.status,
    dispatcher: payload,
  })
})
