import type {
  DigitalWorkerDefinition,
  WorkEnvelope,
  WorkerAuthorityRule,
  WorkerExecutionMode,
  WorkerExecutionResult,
  WorkerTriggerDefinition,
} from "./types"

const DEFAULT_EXECUTION_ORDER: WorkerExecutionMode[] = [
  "deterministic",
  "local_ai",
  "human",
  "external_ai",
]

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

/**
 * Pure admission predicate used by callers before invoking the atomic
 * hq_workforce_claim_trigger() database gate. Keeping this pure makes the
 * cooldown contract testable without weakening the database race protection.
 */
export function triggerCooldownElapsed(
  lastFiredAt: string | null | undefined,
  cooldownSeconds = 0,
  now = Date.now(),
): boolean {
  if (!lastFiredAt) return true
  if (!Number.isFinite(cooldownSeconds) || cooldownSeconds < 0) return false
  const last = Date.parse(lastFiredAt)
  if (!Number.isFinite(last)) return false
  return now - last >= cooldownSeconds * 1000
}

/**
 * Stable logical identity for trigger admission. The database function is the
 * final authority; this helper only prevents callers from inventing divergent
 * deduplication semantics.
 */
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

export function makeWorkEnvelope<T extends Record<string, unknown>>(
  input: Omit<WorkEnvelope<T>, "id" | "createdAt">,
): WorkEnvelope<T> {
  return {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
}

export function approvalRequired(
  workerKey: string,
  workflowKey: string,
  reason: string,
  evidence: Record<string, unknown> = {},
): WorkerExecutionResult {
  return { status: "approval_required", workerKey, workflowKey, reason, evidence }
}

/**
 * Digital workers are workflow identities, not LLM sessions.
 * This core intentionally contains no model SDK and performs no paid API call.
 * External AI is an explicit last-resort execution mode and must be separately enabled.
 */
export const WORKFORCE_POLICY = Object.freeze({
  paidAiEnabledByDefault: false,
  workerToWorkerNaturalLanguage: false,
  structuredWorkEnvelopesOnly: true,
  unknownActionRequiresApproval: true,
  defaultExecutionOrder: DEFAULT_EXECUTION_ORDER,
})
