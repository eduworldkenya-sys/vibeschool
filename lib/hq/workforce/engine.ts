import type { ClarificationPayload, ContextClassification, DigitalWorkerDefinition, WorkEnvelope, WorkerAuthorityRule, WorkerExecutionMode, WorkerExecutionResult, WorkerTriggerDefinition } from "./types"

const DEFAULT_EXECUTION_ORDER: WorkerExecutionMode[] = ["deterministic", "local_ai", "human", "external_ai"]
const QA_LOCKED_WORKER_KEYS = new Set(["qa_reliability", "quality-worker-01"])
const QA_EXECUTION_ORDER: WorkerExecutionMode[] = ["deterministic", "human"]
const CLASSIFICATION_RANK: Record<ContextClassification, number> = { public: 0, internal: 1, confidential: 2, restricted: 3 }
const ALWAYS_FORBIDDEN_CONTEXT_KEYS = new Set(["auth_token", "auth_tokens", "access_token", "refresh_token", "service_role", "service_role_key", "password", "secret"])

export function validateExecutionPolicy(worker: Pick<DigitalWorkerDefinition, "key" | "executionOrder" | "fallbackPolicy">) {
  if (worker.executionOrder.length === 0) throw new Error(`Worker ${worker.key} must define at least one execution mode`)
  const policy = worker.fallbackPolicy
  if (!policy) return
  if (policy.maxFallbackDepth < 0) throw new Error(`Worker ${worker.key} has an invalid maxFallbackDepth`)
  const fallbackModes = worker.executionOrder.slice(1)
  if (fallbackModes.length > policy.maxFallbackDepth) throw new Error(`Worker ${worker.key} exceeds its allowed fallback depth`)
  const disallowed = fallbackModes.filter((mode) => !policy.allowedFallbackModes.includes(mode))
  if (disallowed.length > 0) throw new Error(`Worker ${worker.key} contains disallowed fallback modes: ${disallowed.join(", ")}`)
}

export function createWorkerDefinition(input: Omit<DigitalWorkerDefinition, "executionOrder" | "status" | "version"> & { executionOrder?: WorkerExecutionMode[] }): DigitalWorkerDefinition {
  const qaLocked = QA_LOCKED_WORKER_KEYS.has(input.key)
  const worker: DigitalWorkerDefinition = {
    ...input,
    executionOrder: qaLocked ? [...QA_EXECUTION_ORDER] : (input.executionOrder ?? DEFAULT_EXECUTION_ORDER),
    fallbackPolicy: qaLocked ? { requireApprovalOnFallback: true, allowedFallbackModes: ["human"], maxFallbackDepth: 1 } : input.fallbackPolicy,
    status: "draft", version: 1,
  }
  validateExecutionPolicy(worker)
  return worker
}

export function evaluateAuthority(rules: WorkerAuthorityRule[], action: string) {
  const exact = rules.find((rule) => rule.action === action)
  const wildcard = rules.find((rule) => rule.action === "*")
  return exact ?? wildcard ?? { action, risk: "high" as const, mode: "approval_required" as const, approvalRole: "founder_ceo", escalationPolicy: { escalateAfterHours: 24, backupApprovalRole: "founder_ceo", finalEscalationRole: "founder_ceo", notifyOnEscalate: true } }
}

export function fallbackRequiresApproval(worker: Pick<DigitalWorkerDefinition, "executionOrder" | "fallbackPolicy">, mode: WorkerExecutionMode) {
  const modeIndex = worker.executionOrder.indexOf(mode)
  if (modeIndex <= 0) return false
  return worker.fallbackPolicy?.requireApprovalOnFallback === true
}

export function triggerMatches(trigger: WorkerTriggerDefinition, input: { eventType?: string; metricKey?: string; metricValue?: number; manual?: boolean }) {
  if (trigger.source === "manual") return input.manual === true
  if (trigger.source === "event") return trigger.eventType === input.eventType
  if (trigger.source !== "metric" || trigger.metricKey !== input.metricKey || input.metricValue == null || trigger.threshold == null) return false
  switch (trigger.operator) { case "lt": return input.metricValue < trigger.threshold; case "lte": return input.metricValue <= trigger.threshold; case "eq": return input.metricValue === trigger.threshold; case "gte": return input.metricValue >= trigger.threshold; case "gt": return input.metricValue > trigger.threshold; default: return false }
}

export function triggerEligible(trigger: WorkerTriggerDefinition, input: { nowMs?: number; lastTriggeredAt?: string | null; dedupeSeenAt?: string | null }) {
  const now = input.nowMs ?? Date.now()
  const cooldownMs = Math.max(0, trigger.cooldownSeconds ?? 0) * 1000
  const dedupeMs = Math.max(0, trigger.dedupeWindowSeconds ?? trigger.cooldownSeconds ?? 0) * 1000
  const last = input.lastTriggeredAt ? Date.parse(input.lastTriggeredAt) : NaN
  const seen = input.dedupeSeenAt ? Date.parse(input.dedupeSeenAt) : NaN
  if (Number.isFinite(last) && cooldownMs > 0 && now - last < cooldownMs) return false
  if (Number.isFinite(seen) && dedupeMs > 0 && now - seen < dedupeMs) return false
  return true
}

function sanitizeValue(value: unknown, forbidden: Set<string>): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, forbidden))
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !forbidden.has(key.toLowerCase())).map(([key, child]) => [key, sanitizeValue(child, forbidden)]))
}

export function sanitizeEnvelopeForWorker<T extends Record<string, unknown>>(envelope: WorkEnvelope<T>, worker: Pick<DigitalWorkerDefinition, "key" | "contextPolicy">): WorkEnvelope<Record<string, unknown>> {
  const policy = worker.contextPolicy
  const classification = envelope.classification ?? "internal"
  if (policy && CLASSIFICATION_RANK[classification] > CLASSIFICATION_RANK[policy.maximumClassification]) throw new Error(`CONTEXT_CLASSIFICATION_BLOCKED:${worker.key}:${classification}`)
  const forbidden = new Set([...ALWAYS_FORBIDDEN_CONTEXT_KEYS, ...(policy?.forbiddenContextKeys ?? []).map((key) => key.toLowerCase())])
  return { ...envelope, payload: sanitizeValue(envelope.payload, forbidden) as Record<string, unknown> }
}

export function makeWorkEnvelope<T extends Record<string, unknown>>(input: Omit<WorkEnvelope<T>, "id" | "createdAt">): WorkEnvelope<T> { return { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() } }

export function makeClarificationEnvelope(input: { fromWorkerKey: string; toWorkerKey: string; workItemId?: string; priority: WorkEnvelope["priority"]; responseToEnvelopeId: string; questionKey: string; requiredFields: string[]; reason: string }): WorkEnvelope<ClarificationPayload & Record<string, unknown>> {
  if (!input.questionKey.trim() || input.requiredFields.length === 0 || !input.reason.trim()) throw new Error("INVALID_STRUCTURED_CLARIFICATION")
  return makeWorkEnvelope({ type: "clarify", fromWorkerKey: input.fromWorkerKey, toWorkerKey: input.toWorkerKey, workItemId: input.workItemId, priority: input.priority, classification: "internal", payload: { questionKey: input.questionKey, requiredFields: [...new Set(input.requiredFields)], reason: input.reason, responseToEnvelopeId: input.responseToEnvelopeId } })
}

export function approvalRequired(workerKey: string, workflowKey: string, reason: string, evidence: Record<string, unknown> = {}): WorkerExecutionResult { return { status: "approval_required", workerKey, workflowKey, reason, evidence } }

export const WORKFORCE_POLICY = Object.freeze({ paidAiEnabledByDefault: false, workerToWorkerNaturalLanguage: false, structuredWorkEnvelopesOnly: true, structuredClarificationEnabled: true, unknownActionRequiresApproval: true, defaultExecutionOrder: DEFAULT_EXECUTION_ORDER })
