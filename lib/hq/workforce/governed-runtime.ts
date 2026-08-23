import {
  approvalRequired,
  evaluateAuthority,
  fallbackRequiresApproval,
  sanitizeEnvelopeForWorker,
  triggerMatches,
  validateCurriculumWorkBinding,
} from "./engine"
import type {
  ClarificationPayload,
  DigitalWorkerDefinition,
  WorkEnvelope,
  WorkerExecutionMode,
  WorkerExecutionResult,
  WorkerTriggerDefinition,
} from "./types"
import { evaluateIndependentWatchdog, type WatchdogSnapshot } from "./watchdog"

export interface WorkerBudgetDecision {
  allowed: boolean
  reason?: string
  remainingTokens?: number
  remainingCompute?: number
}

export interface GovernedRuntimePersistence {
  claimTrigger(input: { workerKey: string; triggerKey: string; dedupeKey: string; cooldownSeconds: number; dedupeWindowSeconds: number; details: Record<string, unknown> }): Promise<boolean>
  requestApproval(input: { requestKey: string; workerKey: string; workflowKey: string; requestKind: "authority" | "fallback"; requestedMode?: WorkerExecutionMode; approvalRole: string; backupApprovalRole: string; finalEscalationRole: string; escalateAfterHours: number; evidence: Record<string, unknown> }): Promise<string>
  persistClarification(input: { requestKey: string; envelope: WorkEnvelope<ClarificationPayload & Record<string, unknown>> }): Promise<string>
  checkBudget?(input: { workerKey: string; workflowKey: string; mode: WorkerExecutionMode; estimatedTokens: number; estimatedCompute: number; envelopeId: string }): Promise<WorkerBudgetDecision>
}

export interface GovernedExecutionInput<TPayload extends Record<string, unknown>> {
  worker: DigitalWorkerDefinition; workflowKey: string; action: string; envelope: WorkEnvelope<TPayload>; mode: WorkerExecutionMode
  watchdogSnapshot: WatchdogSnapshot; persistence: GovernedRuntimePersistence
  requireCurriculumBinding?: boolean
  estimatedTokens?: number
  estimatedCompute?: number
  execute: (safeEnvelope: WorkEnvelope<Record<string, unknown>>, mode: WorkerExecutionMode) => Promise<WorkerExecutionResult>
}
export interface GovernedTriggerInput { worker: DigitalWorkerDefinition; trigger: WorkerTriggerDefinition; signal: { eventType?: string; metricKey?: string; metricValue?: number; manual?: boolean }; dedupeKey: string; details?: Record<string, unknown>; persistence: GovernedRuntimePersistence }

function defaultEscalation() { return { escalateAfterHours: 24, backupApprovalRole: "founder_ceo", finalEscalationRole: "founder_ceo", notifyOnEscalate: true } }
function blocked(worker: DigitalWorkerDefinition, workflowKey: string, reason: string, evidence: Record<string, unknown>): WorkerExecutionResult {
  return { status: "blocked", workerKey: worker.key, workflowKey, reason, evidence }
}
function validateEnvelope<T extends Record<string, unknown>>(envelope: WorkEnvelope<T>, worker: DigitalWorkerDefinition): string | null {
  if (!envelope || typeof envelope !== "object") return "INVALID_WORK_ENVELOPE"
  if (!envelope.id?.trim() || !envelope.fromWorkerKey?.trim() || !envelope.toWorkerKey?.trim() || !envelope.createdAt?.trim()) return "INVALID_WORK_ENVELOPE"
  if (envelope.toWorkerKey !== worker.key) return "WORK_ENVELOPE_RECIPIENT_MISMATCH"
  if (!envelope.payload || typeof envelope.payload !== "object" || Array.isArray(envelope.payload)) return "INVALID_WORK_ENVELOPE_PAYLOAD"
  if (Number.isNaN(Date.parse(envelope.createdAt))) return "INVALID_WORK_ENVELOPE_TIMESTAMP"
  return null
}
function workerMayExecute(worker: DigitalWorkerDefinition): boolean { return worker.status === "active" || worker.status === "restricted" }
function modeConsumesModelBudget(mode: WorkerExecutionMode): boolean { return mode === "local_ai" || mode === "external_ai" }

function validateEnvelopeBudget(input: GovernedExecutionInput<Record<string, unknown>>): string | null {
  if (!modeConsumesModelBudget(input.mode)) return null
  const budget = input.envelope.budget
  if (!budget) return "WORK_ENVELOPE_BUDGET_REQUIRED"
  if (!Number.isFinite(budget.tokenBudgetRemaining) || budget.tokenBudgetRemaining < 0) return "WORK_ENVELOPE_TOKEN_BUDGET_INVALID"
  if (!Number.isFinite(budget.computeBudgetRemaining) || budget.computeBudgetRemaining < 0) return "WORK_ENVELOPE_COMPUTE_BUDGET_INVALID"
  const estimatedTokens = Math.max(0, input.estimatedTokens ?? 0)
  const estimatedCompute = Math.max(0, input.estimatedCompute ?? 0)
  if (estimatedTokens > budget.tokenBudgetRemaining || estimatedCompute > budget.computeBudgetRemaining) return "WORK_ENVELOPE_BUDGET_EXCEEDED"
  return null
}

/** Canonical fail-closed pre-execution gate. This is non-activating. */
export async function executeGovernedWorker<TPayload extends Record<string, unknown>>(input: GovernedExecutionInput<TPayload>): Promise<WorkerExecutionResult> {
  const { worker, workflowKey, action, mode, persistence } = input
  if (!workerMayExecute(worker)) return blocked(worker, workflowKey, `Worker lifecycle blocks execution: ${worker.status}`, { workerStatus: worker.status })
  if (!worker.executionOrder.includes(mode)) return blocked(worker, workflowKey, `Execution mode is not configured for worker: ${mode}`, { requestedMode: mode, executionOrder: worker.executionOrder })
  const envelopeError = validateEnvelope(input.envelope, worker)
  if (envelopeError) return blocked(worker, workflowKey, envelopeError, { envelopeId: input.envelope?.id, toWorkerKey: input.envelope?.toWorkerKey })

  if (input.requireCurriculumBinding) {
    const bindingError = validateCurriculumWorkBinding(input.envelope.curriculum)
    if (bindingError) return blocked(worker, workflowKey, bindingError, { envelopeId: input.envelope.id })
  }

  const watchdogFindings = evaluateIndependentWatchdog(input.watchdogSnapshot)
  if (watchdogFindings.length > 0) return blocked(worker, workflowKey, "Independent watchdog blocked execution.", { watchdogFindings })

  const budgetError = validateEnvelopeBudget(input as GovernedExecutionInput<Record<string, unknown>>)
  if (budgetError) return blocked(worker, workflowKey, budgetError, { envelopeId: input.envelope.id, mode })

  if (modeConsumesModelBudget(mode)) {
    if (!persistence.checkBudget) return blocked(worker, workflowKey, "WORKER_BUDGET_CHECK_REQUIRED", { envelopeId: input.envelope.id, mode })
    const estimatedTokens = Math.max(0, input.estimatedTokens ?? 0)
    const estimatedCompute = Math.max(0, input.estimatedCompute ?? 0)
    const budgetDecision = await persistence.checkBudget({ workerKey: worker.key, workflowKey, mode, estimatedTokens, estimatedCompute, envelopeId: input.envelope.id })
    if (!budgetDecision.allowed) return blocked(worker, workflowKey, budgetDecision.reason ?? "WORKER_BUDGET_EXCEEDED", { remainingTokens: budgetDecision.remainingTokens, remainingCompute: budgetDecision.remainingCompute, estimatedTokens, estimatedCompute })
  }

  const safeEnvelope = sanitizeEnvelopeForWorker(input.envelope, worker)
  const authority = evaluateAuthority(worker.authority, action)
  if (authority.mode === "deny") return blocked(worker, workflowKey, `Authority policy denied action: ${action}`, { action, authorityRisk: authority.risk })

  if (authority.mode === "approval_required") {
    const escalation = authority.escalationPolicy ?? defaultEscalation(); const approvalRole = authority.approvalRole ?? "founder_ceo"
    const requestKey = `authority:${worker.key}:${workflowKey}:${safeEnvelope.id}:${action}`
    const requestId = await persistence.requestApproval({ requestKey, workerKey: worker.key, workflowKey, requestKind: "authority", requestedMode: mode, approvalRole, backupApprovalRole: escalation.backupApprovalRole, finalEscalationRole: escalation.finalEscalationRole, escalateAfterHours: escalation.escalateAfterHours, evidence: { action, authorityRisk: authority.risk, envelopeId: safeEnvelope.id } })
    return approvalRequired(worker.key, workflowKey, `Authority approval required for ${action}.`, { requestId, requestKey, approvalRole })
  }
  if (fallbackRequiresApproval(worker, mode)) {
    const escalation = defaultEscalation(); const requestKey = `fallback:${worker.key}:${workflowKey}:${safeEnvelope.id}:${mode}`
    const requestId = await persistence.requestApproval({ requestKey, workerKey: worker.key, workflowKey, requestKind: "fallback", requestedMode: mode, approvalRole: "founder_ceo", backupApprovalRole: escalation.backupApprovalRole, finalEscalationRole: escalation.finalEscalationRole, escalateAfterHours: escalation.escalateAfterHours, evidence: { envelopeId: safeEnvelope.id, defaultMode: worker.executionOrder[0], requestedMode: mode } })
    return approvalRequired(worker.key, workflowKey, `Fallback to ${mode} requires approval.`, { requestId, requestKey, requestedMode: mode })
  }
  return input.execute(safeEnvelope, mode)
}

export async function claimGovernedTrigger(input: GovernedTriggerInput): Promise<boolean> {
  if (!workerMayExecute(input.worker)) return false
  if (!triggerMatches(input.trigger, input.signal)) return false
  if (input.trigger.source !== "metric") return true
  return input.persistence.claimTrigger({ workerKey: input.worker.key, triggerKey: input.trigger.key, dedupeKey: input.dedupeKey, cooldownSeconds: Math.max(0, input.trigger.cooldownSeconds ?? 3600), dedupeWindowSeconds: Math.max(0, input.trigger.dedupeWindowSeconds ?? input.trigger.cooldownSeconds ?? 3600), details: input.details ?? {} })
}

export async function persistGovernedClarification(persistence: GovernedRuntimePersistence, requestKey: string, envelope: WorkEnvelope<ClarificationPayload & Record<string, unknown>>): Promise<string> {
  if (envelope.type !== "clarify") throw new Error("CLARIFICATION_ENVELOPE_REQUIRED")
  if (!envelope.payload.questionKey.trim() || envelope.payload.requiredFields.length === 0) throw new Error("INVALID_STRUCTURED_CLARIFICATION")
  return persistence.persistClarification({ requestKey, envelope })
}
