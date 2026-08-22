import assert from "node:assert/strict"
import test from "node:test"
import { claimGovernedTrigger, executeGovernedWorker, persistGovernedClarification } from "./governed-runtime"
import type { GovernedRuntimePersistence } from "./governed-runtime"
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
  status: "probation",
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
})

const persistence = (
  overrides: Partial<GovernedRuntimePersistence> = {},
): GovernedRuntimePersistence => ({
  claimTrigger: async () => true,
  requestApproval: async () => "approval-proof",
  persistClarification: async () => "clarification-proof",
  ...overrides,
})

const healthy = { telemetryUpdatedAt: now, workerHeartbeatAt: now }
const execute = async (): Promise<WorkerExecutionResult> => ({
  status: "completed",
  workerKey: worker.key,
  workflowKey: "proof",
  evidence: {},
})

test("watchdog fail-closes before execution", async () => {
  let called = false
  const result = await executeGovernedWorker({
    worker,
    workflowKey: "proof",
    action: "read",
    envelope: envelope(),
    mode: "deterministic",
    watchdogSnapshot: { telemetryUpdatedAt: null, workerHeartbeatAt: null },
    persistence: persistence(),
    execute: async () => {
      called = true
      return execute()
    },
  })
  assert.equal(result.status, "blocked")
  assert.equal(called, false)
})

test("authority deny blocks execution", async () => {
  let called = false
  const result = await executeGovernedWorker({
    worker,
    workflowKey: "proof",
    action: "publish",
    envelope: envelope(),
    mode: "deterministic",
    watchdogSnapshot: healthy,
    persistence: persistence(),
    execute: async () => {
      called = true
      return execute()
    },
  })
  assert.equal(result.status, "blocked")
  assert.equal(called, false)
})

test("authority approval persists and stops", async () => {
  let approvals = 0
  let called = false
  const result = await executeGovernedWorker({
    worker,
    workflowKey: "proof",
    action: "finance",
    envelope: envelope(),
    mode: "deterministic",
    watchdogSnapshot: healthy,
    persistence: persistence({
      requestApproval: async () => {
        approvals += 1
        return "approval-proof"
      },
    }),
    execute: async () => {
      called = true
      return execute()
    },
  })
  assert.equal(result.status, "approval_required")
  assert.equal(approvals, 1)
  assert.equal(called, false)
})

test("fallback requires approval", async () => {
  let called = false
  const result = await executeGovernedWorker({
    worker,
    workflowKey: "proof",
    action: "read",
    envelope: envelope(),
    mode: "local_ai",
    watchdogSnapshot: healthy,
    persistence: persistence(),
    execute: async () => {
      called = true
      return execute()
    },
  })
  assert.equal(result.status, "approval_required")
  assert.equal(called, false)
})

test("context is sanitized before executor", async () => {
  let seen: Record<string, unknown> | undefined
  await executeGovernedWorker({
    worker,
    workflowKey: "proof",
    action: "read",
    envelope: envelope({ safe: "yes", secret: "never" }),
    mode: "deterministic",
    watchdogSnapshot: healthy,
    persistence: persistence(),
    execute: async safeEnvelope => {
      seen = safeEnvelope.payload
      return execute()
    },
  })
  assert.equal(seen?.secret, undefined)
  assert.equal(seen?.safe, "yes")
})

test("metric trigger delegates durable admission", async () => {
  let claims = 0
  const trigger = {
    key: "metric-proof",
    source: "metric" as const,
    metricKey: "errors",
    operator: "gte" as const,
    threshold: 1,
    workflowKey: "proof",
    cooldownSeconds: 60,
    dedupeWindowSeconds: 60,
  }
  const accepted = await claimGovernedTrigger({
    worker,
    trigger,
    signal: { metricKey: "errors", metricValue: 2 },
    dedupeKey: "same",
    persistence: persistence({
      claimTrigger: async () => {
        claims += 1
        return claims === 1
      },
    }),
  })
  assert.equal(accepted, true)
  assert.equal(claims, 1)
})

test("persistence failure fails closed", async () => {
  let called = false
  await assert.rejects(() =>
    executeGovernedWorker({
      worker,
      workflowKey: "proof",
      action: "finance",
      envelope: envelope(),
      mode: "deterministic",
      watchdogSnapshot: healthy,
      persistence: persistence({
        requestApproval: async () => {
          throw new Error("DB_DOWN")
        },
      }),
      execute: async () => {
        called = true
        return execute()
      },
    }),
  )
  assert.equal(called, false)
})

test("clarification must be structured", async () => {
  const bad: WorkEnvelope<ClarificationPayload & Record<string, unknown>> = {
    ...envelope(),
    type: "clarify",
    payload: {
      questionKey: "",
      requiredFields: [],
      reason: "Missing data",
      responseToEnvelopeId: "env-parent",
    },
  }
  await assert.rejects(
    () => persistGovernedClarification(persistence(), "clarify:bad", bad),
    /INVALID_STRUCTURED_CLARIFICATION/,
  )
})
