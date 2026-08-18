import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const JSON_HEADERS = { "Content-Type": "application/json" }
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type TaskRow = {
  id: string
  status: string
  worker_key: string
  tool_contract_id: string
  payload: Record<string, unknown>
}

type ToolRow = {
  id: string
  handler_key: string
  status: string
}

type Route = {
  slug: "content-research-worker" | "content-semantic-verifier" | "content-authoring-worker"
  body: Record<string, unknown>
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function resolveRoute(task: TaskRow, tool: ToolRow): Route {
  const payload = task.payload ?? {}
  if (tool.handler_key === "content.research.external") {
    const jobId = payload.research_job_id
    if (!nonEmptyString(jobId)) throw new Error("dispatch_research_job_id_required")
    return {
      slug: "content-research-worker",
      body: { taskId: task.id, jobId },
    }
  }
  if (tool.handler_key === "content.evidence.semantic_verify") {
    const sourceId = payload.source_id
    if (!nonEmptyString(sourceId)) throw new Error("dispatch_source_id_required")
    const body: Record<string, unknown> = { taskId: task.id, sourceId }
    if (nonEmptyString(payload.model_key)) body.modelKey = payload.model_key
    if (typeof payload.token_budget === "number" && Number.isFinite(payload.token_budget)) {
      body.tokenBudget = payload.token_budget
    }
    return { slug: "content-semantic-verifier", body }
  }
  if (tool.handler_key === "content.authoring.source_grounded") {
    const proposalId = payload.proposal_id
    if (!nonEmptyString(proposalId)) throw new Error("dispatch_proposal_id_required")
    const body: Record<string, unknown> = { taskId: task.id, proposalId }
    if (nonEmptyString(payload.model_key)) body.modelKey = payload.model_key
    if (typeof payload.token_budget === "number" && Number.isFinite(payload.token_budget)) {
      body.tokenBudget = payload.token_budget
    }
    return { slug: "content-authoring-worker", body }
  }
  throw new Error(`dispatch_handler_not_allowlisted:${tool.handler_key}`)
}

async function invoke(route: Route) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${route.slug}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(route.body),
  })
  const payload = await response.json().catch(() => ({ error: "executor_non_json_response" }))
  return { response, payload }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405)
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return reply({ error: "supabase_runtime_config_missing" }, 500)

  // Internal dispatcher only. verify_jwt is enabled at deployment and this second boundary
  // requires the service role token. The target executor performs its own claim/authorization.
  const auth = req.headers.get("Authorization") ?? ""
  if (auth !== `Bearer ${SERVICE_ROLE_KEY}`) return reply({ error: "service_role_required" }, 401)

  const body = await req.json().catch(() => ({})) as { taskId?: string }
  if (!body.taskId) return reply({ error: "taskId_required" }, 400)

  try {
    const { data: taskData, error: taskError } = await db
      .from("hq_workforce_task_contracts")
      .select("id,status,worker_key,tool_contract_id,payload")
      .eq("id", body.taskId)
      .maybeSingle()
    if (taskError) throw new Error(`dispatch_task_lookup_failed:${taskError.message}`)
    if (!taskData) return reply({ error: "dispatch_task_not_found" }, 404)

    const task = taskData as TaskRow
    if (task.status !== "queued") throw new Error(`dispatch_task_not_queued:${task.status}`)
    if (!nonEmptyString(task.worker_key)) throw new Error("dispatch_worker_key_missing")

    const { data: toolData, error: toolError } = await db
      .from("hq_workforce_tool_contracts")
      .select("id,handler_key,status")
      .eq("id", task.tool_contract_id)
      .maybeSingle()
    if (toolError) throw new Error(`dispatch_tool_lookup_failed:${toolError.message}`)
    if (!toolData) throw new Error("dispatch_tool_not_found")

    const tool = toolData as ToolRow
    if (tool.status !== "approved") throw new Error("dispatch_tool_not_approved")
    const route = resolveRoute(task, tool)
    const { response, payload } = await invoke(route)

    if (!response.ok) {
      console.error(JSON.stringify({
        event: "content_factory_r2_dispatch_failed",
        task_id: task.id,
        worker_key: task.worker_key,
        handler: tool.handler_key,
        executor: route.slug,
        status: response.status,
        response: payload,
      }))
      return reply({
        ok: false,
        taskId: task.id,
        handler: tool.handler_key,
        executor: route.slug,
        executorStatus: response.status,
        executorResponse: payload,
      }, response.status >= 400 && response.status < 600 ? response.status : 500)
    }

    return reply({
      ok: true,
      taskId: task.id,
      handler: tool.handler_key,
      executor: route.slug,
      executorResponse: payload,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    return reply({ error: message }, 500)
  }
})
