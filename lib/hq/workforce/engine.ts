import type {
  DigitalWorkerDefinition,
  WorkEnvelope,
  WorkerAuthorityRule,
  WorkerExecutionMode,
  WorkerExecutionResult,
  WorkerFallbackDecision,
  WorkerFallbackPolicy,
  WorkerRisk,
  WorkerTriggerDefinition,
} from "./types"

const DEFAULT_EXECUTION_ORDER: WorkerExecutionMode[] = [
  "deterministic",
  "local_ai",
  "human",
  "external_ai",
]

const RISK_RANK: Record<WorkerRisk, number> = { low: 0, normal: 1, high: 2, critical: 3 }

export function createWorkerDefinition(
  input: Omit<DigitalWorkerDefinition, "executionOrder" | "status" | "version"> & {
    executionOrder?: WorkerExecutionMode[]
  },
): DigitalWorkerDefinition {
  return {
    ...input,
    executionOrder: input.executionOrder ?? DEFAULT_EXECUTION_ORDER,
    status: "draft",
    version: 1,
  }
}

export function evaluateAuthority(rules: WorkerAuthorityRule[], action: string) {
  const exact = rules.find((rule) => rule.action === action)
  const wildcard = rules.find((rule) => rule.action === "*")
  return exact ?? wildcard ?? { action, risk: "high" as const, mode: "approval_required" as const, approvalRole: "founder_ceo" }
}

export function triggerMatches(
  trigger: WorkerTriggerDefinition,
  input: { eventType?: string; metricKey?: string; metricValue?: number; manual?: boolean },
) {
  if (trigger.source === "manual") return input.manual === true
  if (trigger.source === "event") return trigger.eventType === input.eventType
  if (trigger.source !== "metric" || trigger.metricKey !== input.metricKey || input.metricValue == null || trigger.threshold == null) return false

  switch (trigger.operator) {
    case "lt": return input.metricValue < trigger.threshold
    case "lte": return input.metricValue <= trigger.threshold
    case "eq": return input.metricValue === trigger.threshold
    case "gte": return input.metricValue >= trigger.threshold
    case "gt": return input.metricValue > trigger.threshold
    default: return false
  }
}

export function triggerCooldownElapsed(lastFiredAt: string | null | undefined, cooldownSeconds = 0, now = Date.now()): boolean {
  if (!lastFiredAt) return true
  if (!Number.isFinite(cooldownSeconds) || cooldownSeconds < 0) return false
  const last = Date.parse(lastFiredAt)
  if (!Number.isFinite(last)) return false
  return now - last >= cooldownSeconds * 1000
}

export function triggerDeduplicationKey(
  trigger: WorkerTriggerDefinition,
  input: { eventId?: string; workItemId?: string; metricKey?: string; metricValue?: number; scheduledAt?: string },
): string {
  if (trigger.deduplicationKey) return trigger.deduplicationKey
  if (input.workItemId) return `work-item:${input.workItemId}`
  if (input.eventId) return `event:${input.eventId}`
  if (trigger.source === "metric") return `metric:${input.metricKey ?? trigger.metricKey ?? "unknown"}:${input.metricValue ?? "unknown"}`
  if (trigger.source === "schedule") return `schedule:${input.scheduledAt ?? "unknown"}`
  return `trigger:${trigger.key}`
}

export function evaluateFallback(
  policy: WorkerFallbackPolicy | undefined,
  originalRisk: WorkerRisk,
  fallbackRisk: WorkerRisk,
  fallbackMode: WorkerExecutionMode,
  depth: number,
): WorkerFallbackDecision {
  if (!policy) return { status: "blocked", reason: "fallback_policy_missing" }
  if (!Number.isInteger(depth) || depth < 1) return { status: "blocked", reason: "fallback_depth_invalid" }
  if (depth > policy.maxFallbackDepth) return { status: "blocked", reason: "fallback_depth_exceeded" }
  if (policy.allowedFallbackModes && !policy.allowedFallbackModes.includes(fallbackMode)) {
    return { status: "blocked", reason: "fallback_mode_not_allowed" }
  }
  const riskIncreased = RISK_RANK[fallbackRisk] > RISK_RANK[originalRisk]
  if (riskIncreased && policy.requireApprovalOnRiskIncrease) {
    return { status: "approval_required", reason: "fallback_risk_increased" }
  }
  return { status: "allow", reason: "fallback_authorized" }
}

export function sanitizeWorkerContext(
  context: Record<string, unknown>,
  allowedKeys: string[],
  maxSerializedBytes = 16_384,
): Record<string, unknown> {
  if (!Number.isInteger(maxSerializedBytes) || maxSerializedBytes <= 0) return {}
  const allowed = new Set(allowedKeys)
  const sanitized: Record<string, unknown> = {}
  for (const key of Object.keys(context)) {
    if (allowed.has(key)) sanitized[key] = context[key]
  }
  const serialized = JSON.stringify(sanitized)
  if (new TextEncoder().encode(serialized).byteLength > maxSerializedBytes) return {}
  return JSON.parse(serialized) as Record<string, unknown>
}

export function makeWorkEnvelope<T extends Record<string, unknown>>(
  input: Omit<WorkEnvelope<T>, "id" | "createdAt">,
): WorkEnvelope<T> {
  return {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
}

export function makeMissingDataRequest(
  fromWorkerKey: string,
  toWorkerKey: string,
  workItemId: string,
  fields: string[],
  priority: WorkEnvelope["priority"] = "normal",
): WorkEnvelope<{ fields: string[] }> {
  return makeWorkEnvelope({
    type: "request_missing_data",
    fromWorkerKey,
    toWorkerKey,
    workItemId,
    priority,
    payload: { fields: [...new Set(fields.filter(Boolean))] },
  })
}

export function approvalRequired(
  workerKey: string,
  workflowKey: string,
  reason: string,
  evidence: Record<string, unknown> = {},
): WorkerExecutionResult {
  return { status: "approval_required", workerKey, workflowKey, reason, evidence }
}

export const WORKFORCE_POLICY = Object.freeze({
  paidAiEnabledByDefault: false,
  workerToWorkerNaturalLanguage: false,
  structuredWorkEnvelopesOnly: true,
  unknownActionRequiresApproval: true,
  fallbackMustRecheckAuthority: true,
  contextIsTaskScoped: true,
  defaultExecutionOrder: DEFAULT_EXECUTION_ORDER,
})
