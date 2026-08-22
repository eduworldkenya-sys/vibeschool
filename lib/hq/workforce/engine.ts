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

export function validateExecutionPolicy(worker: Pick<DigitalWorkerDefinition, "key" | "executionOrder" | "fallbackPolicy">) {
  if (worker.executionOrder.length === 0) {
    throw new Error(`Worker ${worker.key} must define at least one execution mode`)
  }

  const policy = worker.fallbackPolicy
  if (!policy) return

  if (policy.maxFallbackDepth < 0) {
    throw new Error(`Worker ${worker.key} has an invalid maxFallbackDepth`)
  }

  const fallbackModes = worker.executionOrder.slice(1)
  if (fallbackModes.length > policy.maxFallbackDepth) {
    throw new Error(`Worker ${worker.key} exceeds its allowed fallback depth`)
  }

  const disallowed = fallbackModes.filter((mode) => !policy.allowedFallbackModes.includes(mode))
  if (disallowed.length > 0) {
    throw new Error(`Worker ${worker.key} contains disallowed fallback modes: ${disallowed.join(", ")}`)
  }
}

export function createWorkerDefinition(
  input: Omit<DigitalWorkerDefinition, "executionOrder" | "status" | "version"> & {
    executionOrder?: WorkerExecutionMode[]
  },
): DigitalWorkerDefinition {
  const worker: DigitalWorkerDefinition = {
    ...input,
    executionOrder: input.executionOrder ?? DEFAULT_EXECUTION_ORDER,
    status: "draft",
    version: 1,
  }

  validateExecutionPolicy(worker)
  return worker
}

export function evaluateAuthority(rules: WorkerAuthorityRule[], action: string) {
  const exact = rules.find((rule) => rule.action === action)
  const wildcard = rules.find((rule) => rule.action === "*")
  return exact ?? wildcard ?? {
    action,
    risk: "high" as const,
    mode: "approval_required" as const,
    approvalRole: "founder_ceo",
    escalationPolicy: {
      escalateAfterHours: 24,
      backupApprovalRole: "founder_ceo",
      finalEscalationRole: "founder_ceo",
      notifyOnEscalate: true,
    },
  }
}

export function fallbackRequiresApproval(
  worker: Pick<DigitalWorkerDefinition, "executionOrder" | "fallbackPolicy">,
  mode: WorkerExecutionMode,
) {
  const modeIndex = worker.executionOrder.indexOf(mode)
  if (modeIndex <= 0) return false
  return worker.fallbackPolicy?.requireApprovalOnFallback === true
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
