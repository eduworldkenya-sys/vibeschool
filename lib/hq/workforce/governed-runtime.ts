import {
  approvalRequired,
  evaluateAuthority,
  fallbackRequiresApproval,
  sanitizeEnvelopeForWorker,
  triggerMatches,
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

export interface GovernedRuntimePersistence {
  claimTrigger(input: {
    workerKey: string
    triggerKey: string
    dedupeKey: string
    cooldownSeconds: number
    dedupeWindowSeconds: number
    details: Record<string, unknown>
  }): Promise<boolean>
  requestApproval(input: {
    requestKey: string
    workerKey: string
    workflowKey: string
    requestKind: "authority" | "fallback"
    requestedMode?: WorkerExecutionMode
    approvalRole: string
    backupApprovalRole: string
    finalEscalationRole: string
    escalateAfterHours: number
    evidence: Record<string, unknown>
  }): Promise<string>
  persistClarification(input: {
    requestKey: string
    envelope: WorkEnvelope<ClarificationPayload & Record<string, unknown>>
  }): Promise<string>
}

export interface GovernedExecutionInput<TPayload extends Record<string, unknown>> {
  worker: DigitalWorkerDefinition
  workflowKey: string
  action: string
  envelope: WorkEnvelope<TPayload>
  mode: WorkerExecutionMode
  watchdogSnapshot: WatchdogSnapshot
  persistence: GovernedRuntimePersistence
  execute: (
    safeEnvelope: WorkEnvelope<Record<string, unknown>>,
    mode: WorkerExecutionMode,
  ) => Promise<WorkerExecutionResult>
}

export interface GovernedTriggerInput {
  worker: DigitalWorkerDefinition
  trigger: WorkerTriggerDefinition
  signal: { eventType?: string; metricKey?: string; metricValue?: number; manual?: boolean }
  dedupeKey: string
  details?: Record<string, unknown>
  persistence: GovernedRuntimePersistence
}

function defaultEscalation() {
  return {
    escalateAfterHours: 24,
    backupApprovalRole: "founder_ceo",
    finalEscalationRole: "founder_ceo",
    notifyOnEscalate: true,
  }
}

/**
 * Canonical pre-execution gate for the existing HQ Workforce engine.
 * This function is deliberately non-activating: callers must already be inside
 * an explicitly commissioned runtime path before invoking it.
 */
export async function executeGovernedWorker<TPayload extends Record<string, unknown>>(
  input: GovernedExecutionInput<TPayload>,
): Promise<WorkerExecutionResult> {
  const { worker, workflowKey, action, mode, persistence } = input

  const watchdogFindings = evaluateIndependentWatchdog(input.watchdogSnapshot)
  if (watchdogFindings.length > 0) {
    return {
      status: "blocked",
      workerKey: worker.key,
      workflowKey,
      reason: "Independent watchdog blocked execution.",
      evidence: { watchdogFindings },
    }
  }

  const safeEnvelope = sanitizeEnvelopeForWorker(input.envelope, worker)
  const authority = evaluateAuthority(worker.authority, action)

  if (authority.mode === "deny") {
    return {
      status: "blocked",
      workerKey: worker.key,
      workflowKey,
      reason: `Authority policy denied action: ${action}`,
      evidence: { action, authorityRisk: authority.risk },
    }
  }

  if (authority.mode === "approval_required") {
    const escalation = authority.escalationPolicy ?? defaultEscalation()
    const approvalRole = authority.approvalRole ?? "founder_ceo"
    const requestKey = `authority:${worker.key}:${workflowKey}:${safeEnvelope.id}:${action}`
    const requestId = await persistence.requestApproval({
      requestKey,
      workerKey: worker.key,
      workflowKey,
      requestKind: "authority",
      requestedMode: mode,
      approvalRole,
      backupApprovalRole: escalation.backupApprovalRole,
      finalEscalationRole: escalation.finalEscalationRole,
      escalateAfterHours: escalation.escalateAfterHours,
      evidence: { action, authorityRisk: authority.risk, envelopeId: safeEnvelope.id },
    })
    return approvalRequired(worker.key, workflowKey, `Authority approval required for ${action}.`, {
      requestId,
      requestKey,
      approvalRole,
    })
  }

  if (fallbackRequiresApproval(worker, mode)) {
    const escalation = defaultEscalation()
    const requestKey = `fallback:${worker.key}:${workflowKey}:${safeEnvelope.id}:${mode}`
    const requestId = await persistence.requestApproval({
      requestKey,
      workerKey: worker.key,
      workflowKey,
      requestKind: "fallback",
      requestedMode: mode,
      approvalRole: "founder_ceo",
      backupApprovalRole: escalation.backupApprovalRole,
      finalEscalationRole: escalation.finalEscalationRole,
      escalateAfterHours: escalation.escalateAfterHours,
      evidence: {
        envelopeId: safeEnvelope.id,
        defaultMode: worker.executionOrder[0],
        requestedMode: mode,
      },
    })
    return approvalRequired(worker.key, workflowKey, `Fallback to ${mode} requires approval.`, {
      requestId,
      requestKey,
      requestedMode: mode,
    })
  }

  return input.execute(safeEnvelope, mode)
}

/**
 * Durable trigger admission. The persistence adapter must map this to the
 * service-only hq_workforce_claim_trigger RPC introduced by PR #441.
 */
export async function claimGovernedTrigger(input: GovernedTriggerInput): Promise<boolean> {
  if (!triggerMatches(input.trigger, input.signal)) return false
  if (input.trigger.source !== "metric") return true

  return input.persistence.claimTrigger({
    workerKey: input.worker.key,
    triggerKey: input.trigger.key,
    dedupeKey: input.dedupeKey,
    cooldownSeconds: Math.max(0, input.trigger.cooldownSeconds ?? 3600),
    dedupeWindowSeconds: Math.max(
      0,
      input.trigger.dedupeWindowSeconds ?? input.trigger.cooldownSeconds ?? 3600,
    ),
    details: input.details ?? {},
  })
}

/** Persist a structured clarification before any worker-to-worker continuation. */
export async function persistGovernedClarification(
  persistence: GovernedRuntimePersistence,
  requestKey: string,
  envelope: WorkEnvelope<ClarificationPayload & Record<string, unknown>>,
): Promise<string> {
  if (envelope.type !== "clarify") throw new Error("CLARIFICATION_ENVELOPE_REQUIRED")
  if (!envelope.payload.questionKey.trim() || envelope.payload.requiredFields.length === 0) {
    throw new Error("INVALID_STRUCTURED_CLARIFICATION")
  }
  return persistence.persistClarification({ requestKey, envelope })
}
