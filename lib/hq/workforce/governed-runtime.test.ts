import assert from "node:assert/strict"
import test from "node:test"
import { claimGovernedTrigger, executeGovernedWorker, persistGovernedClarification } from "./governed-runtime"
import type { GovernedRuntimePersistence } from "./governed-runtime"
import type { WatchdogSnapshot } from "./watchdog"
import type {
  ClarificationPayload,
  DigitalWorkerDefinition,
  WorkEnvelope,
  WorkerExecutionResult,
} from "./types"

const now = new Date().toISOString()

const worker: DigitalWorkerDefinition = {
  key: "proof-worker",
  title: "Proof Worker",
  departmentKey: "quality",
  mission: "Governed runtime proof",
  responsibilities: ["Prove governed runtime controls"],
  competencies: ["runtime-governance"],
  executionOrder: ["deterministic", "local_ai"],
  fallbackPolicy: {
    requireApprovalOnFallback: true,
    allowedFallbackModes: ["local_ai"],
    maxFallbackDepth: 1,
  },
  contextPolicy: {
    maximumClassification: "internal",
    forbiddenContextKeys: ["secret"],
  },
  authority: [
    { action: "read", mode: "allow", risk: "low" },
    { action: "publish", mode: "deny", risk: "critical" },
    { action: "finance", mode: "approval_required", risk: "critical", approvalRole: "founder_ceo" },
  ],
  triggers: [],
  kpis: [],
  status: "active",
  version: 1,
}

const envelope = (payload: Record<string, unknown> = {}): WorkEnvelope<Record<string, unknown>> => ({
  id: "env-proof",
  type: "request",
  fromWorkerKey: "hq",
  toWorkerKey: worker.key,
  priority: "normal",
  createdAt: now,
  payload,
  budget: { tokenBudgetRemaining: 5000, computeBudgetRemaining: 10 },
})

const curriculum = {
  traceId: "trace-proof",
  missionId: "mission-proof",
  publicationId: "publication-proof",
  publicationRevisionId: "revision-proof",
  chapterId: "chapter-proof",
  iteration: 0,
}

const persistence = (
  overrides: Partial<GovernedRuntimePersistence> = {},
): GovernedRuntimePersistence => ({
  claimTrigger: async () => true,
  requestApproval: async () => "approval-proof",
  persistClarification: async () => "clarification-proof",
  checkBudget: async () => ({ allowed: true, remainingTokens: 5000, remainingCompute: 10 }),
  ...overrides,
})

const healthy: WatchdogSnapshot = {
  lastTelemetryAt: now,
  lastWorkerHeartbeatAt: now,
  maximumTelemetryAgeSeconds: 60,
  maximumHeartbeatAgeSeconds: 60,
}

const execute = async (): Promise<WorkerExecutionResult> => ({
  status: "completed",
  workerKey: worker.key,
  workflowKey: "proof",
  evidence: {},
})

test("lifecycle gate blocks probation workers before execution", async () => {
  let called = false
  const probationWorker: DigitalWorkerDefinition = { ...worker, status: "probation" }
  const result = await executeGovernedWorker({
    worker: probationWorker,
    workflowKey: "proof",
    action: "read",
    envelope: { ...envelope(), toWorkerKey: probationWorker.key },
    mode: "deterministic",
    watchdogSnapshot: healthy,
    persistence: persistence(),
    execute: async () => { called = true; return execute() },
  })
  assert.equal(result.status, "blocked")
  assert.match(result.reason ?? "", /lifecycle blocks execution/i)
  assert.equal(called, false)
})

test("watchdog fail-closes before execution", async () => {
  let called = false
  const unhealthy: WatchdogSnapshot = {
    lastTelemetryAt: null,
    lastWorkerHeartbeatAt: null,
    maximumTelemetryAgeSeconds: 60,
    maximumHeartbeatAgeSeconds: 60,
  }
  const result = await executeGovernedWorker({
    worker,
    workflowKey: "proof",
    action: "read",
    envelope: envelope(),
    mode: "deterministic",
    watchdogSnapshot: unhealthy,
    persistence: persistence(),
    execute: async () => { called = true; return execute() },
  })
  assert.equal(result.status, "blocked")
  assert.equal(called, false)
})

test("curriculum work fails closed without exact revision binding", async () => {
  let called = false
  const result = await executeGovernedWorker({
    worker,
    workflowKey: "chemistry.author",
    action: "read",
    envelope: envelope(),
    mode: "deterministic",
    watchdogSnapshot: healthy,
    persistence: persistence(),
    requireCurriculumBinding: true,
    execute: async () => { called = true; return execute() },
  })
  assert.equal(result.status, "blocked")
  assert.equal(result.reason, "CURRICULUM_BINDING_REQUIRED")
  assert.equal(called, false)
})

test("curriculum work carries exact mission and publication revision to executor", async () => {
  let seenRevision: string | undefined
  const result = await executeGovernedWorker({
    worker,
    workflowKey: "chemistry.author",
    action: "read",
    envelope: { ...envelope(), curriculum },
    mode: "deterministic",
    watchdogSnapshot: healthy,
    persistence: persistence(),
    requireCurriculumBinding: true,
    execute: async safeEnvelope => { seenRevision = safeEnvelope.curriculum?.publicationRevisionId; return execute() },
  })
  assert.equal(result.status, "completed")
  assert.equal(seenRevision, "revision-proof")
})

test("mission-local model budget blocks before durable budget or execution", async () => {
  let budgetChecks = 0
  let called = false
  const result = await executeGovernedWorker({
    worker,
    workflowKey: "proof",
    action: "read",
    envelope: { ...envelope(), budget: { tokenBudgetRemaining: 100, computeBudgetRemaining: 1 } },
    mode: "local_ai",
    estimatedTokens: 101,
    estimatedCompute: 1,
    watchdogSnapshot: healthy,
    persistence: persistence({ checkBudget: async () => { budgetChecks += 1; return { allowed: true } } }),
    execute: async () => { called = true; return execute() },
  })
  assert.equal(result.status, "blocked")
  assert.equal(result.reason, "WORK_ENVELOPE_BUDGET_EXCEEDED")
  assert.equal(budgetChecks, 0)
  assert.equal(called, false)
})

test("model execution fails closed when durable budget checker is absent", async () => {
  let called = false
  const result = await executeGovernedWorker({
    worker,
    workflowKey: "proof",
    action: "read",
    envelope: envelope(),
    mode: "local_ai",
    estimatedTokens: 100,
    estimatedCompute: 1,
    watchdogSnapshot: healthy,
    persistence: persistence({ checkBudget: undefined }),
    execute: async () => { called = true; return execute() },
  })
  assert.equal(result.status, "blocked")
  assert.equal(result.reason, "WORKER_BUDGET_CHECK_REQUIRED")
  assert.equal(called, false)
})

test("durable worker budget denial blocks model execution", async () => {
  let called = false
  const result = await executeGovernedWorker({
    worker,
    workflowKey: "proof",
    action: "read",
    envelope: envelope(),
    mode: "local_ai",
    estimatedTokens: 100,
    estimatedCompute: 1,
    watchdogSnapshot: healthy,
    persistence: persistence({ checkBudget: async () => ({ allowed: false, reason: "WORKER_HOURLY_BUDGET_EXCEEDED", remainingTokens: 50, remainingCompute: 0 }) }),
    execute: async () => { called = true; return execute() },
  })
  assert.equal(result.status, "blocked")
  assert.equal(result.reason, "WORKER_HOURLY_BUDGET_EXCEEDED")
  assert.equal(called, false)
})

test("authority deny blocks execution", async () => {
  let called = false
  const result = await executeGovernedWorker({ worker, workflowKey: "proof", action: "publish", envelope: envelope(), mode: "deterministic", watchdogSnapshot: healthy, persistence: persistence(), execute: async () => { called = true; return execute() } })
  assert.equal(result.status, "blocked")
  assert.equal(called, false)
})

test("authority approval persists and stops", async () => {
  let approvals = 0
  let called = false
  const result = await executeGovernedWorker({ worker, workflowKey: "proof", action: "finance", envelope: envelope(), mode: "deterministic", watchdogSnapshot: healthy, persistence: persistence({ requestApproval: async () => { approvals += 1; return "approval-proof" } }), execute: async () => { called = true; return execute() } })
  assert.equal(result.status, "approval_required")
  assert.equal(approvals, 1)
  assert.equal(called, false)
})

test("fallback requires approval", async () => {
  let called = false
  const result = await executeGovernedWorker({ worker, workflowKey: "proof", action: "read", envelope: envelope(), mode: "local_ai", estimatedTokens: 100, estimatedCompute: 1, watchdogSnapshot: healthy, persistence: persistence(), execute: async () => { called = true; return execute() } })
  assert.equal(result.status, "approval_required")
  assert.equal(called, false)
})

test("context is sanitized before executor", async () => {
  let seen: Record<string, unknown> | undefined
  await executeGovernedWorker({ worker, workflowKey: "proof", action: "read", envelope: envelope({ safe: "yes", secret: "never" }), mode: "deterministic", watchdogSnapshot: healthy, persistence: persistence(), execute: async safeEnvelope => { seen = safeEnvelope.payload; return execute() } })
  assert.equal(seen?.secret, undefined)
  assert.equal(seen?.safe, "yes")
})

test("metric trigger delegates durable admission", async () => {
  let claims = 0
  const trigger = { key: "metric-proof", source: "metric" as const, metricKey: "errors", operator: "gte" as const, threshold: 1, workflowKey: "proof", cooldownSeconds: 60, dedupeWindowSeconds: 60 }
  const accepted = await claimGovernedTrigger({ worker, trigger, signal: { metricKey: "errors", metricValue: 2 }, dedupeKey: "same", persistence: persistence({ claimTrigger: async () => { claims += 1; return claims === 1 } }) })
  assert.equal(accepted, true)
  assert.equal(claims, 1)
})

test("persistence failure fails closed", async () => {
  let called = false
  await assert.rejects(() => executeGovernedWorker({ worker, workflowKey: "proof", action: "finance", envelope: envelope(), mode: "deterministic", watchdogSnapshot: healthy, persistence: persistence({ requestApproval: async () => { throw new Error("DB_DOWN") } }), execute: async () => { called = true; return execute() } }))
  assert.equal(called, false)
})

test("clarification must be structured", async () => {
  const bad: WorkEnvelope<ClarificationPayload & Record<string, unknown>> = { ...envelope(), type: "clarify", payload: { questionKey: "", requiredFields: [], reason: "Missing data", responseToEnvelopeId: "env-parent" } }
  await assert.rejects(() => persistGovernedClarification(persistence(), "clarify:bad", bad), /INVALID_STRUCTURED_CLARIFICATION/)
})
