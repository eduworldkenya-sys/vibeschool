export type WorkerExecutionMode = "deterministic" | "local_ai" | "human" | "external_ai"
export type WorkerStatus = "draft" | "probation" | "active" | "restricted" | "suspended" | "retired"
export type WorkerRisk = "low" | "normal" | "high" | "critical"
export type WorkMessageType = "assign" | "request" | "consult" | "request_missing_data" | "review" | "escalate" | "approve" | "reject" | "inform" | "handoff" | "verify"

export interface WorkerKpiDefinition {
  key: string
  label: string
  direction: "higher" | "lower" | "boolean"
  target?: number
  unit?: string
}

export interface WorkerApprovalEscalationPolicy {
  escalateAfterHours: number
  backupApprovalRole?: string
  finalEscalationRole: string
  notifyOnEscalate: boolean
}

export interface WorkerAuthorityRule {
  action: string
  risk: WorkerRisk
  mode: "allow" | "deny" | "approval_required"
  approvalRole?: string
  escalationPolicy?: WorkerApprovalEscalationPolicy
}

export interface WorkerTriggerDefinition {
  key: string
  source: "event" | "schedule" | "metric" | "manual"
  eventType?: string
  metricKey?: string
  operator?: "lt" | "lte" | "eq" | "gte" | "gt"
  threshold?: number
  workflowKey: string
  /** Minimum time between successful admissions for this trigger. */
  cooldownSeconds?: number
  /** Stable logical key used to collapse repeated evaluations of the same work. */
  deduplicationKey?: string
  /** Maximum successful admissions in the rolling enforcement window. */
  maxFiresPerWindow?: number
}

export interface WorkerFallbackPolicy {
  requireApprovalOnRiskIncrease: boolean
  allowedFallbackModes?: WorkerExecutionMode[]
  maxFallbackDepth: number
}

export interface WorkerFallbackDecision {
  status: "allow" | "approval_required" | "blocked"
  reason: string
}

export interface WorkerContextPolicy {
  allowedKeys: string[]
  maxSerializedBytes: number
}

export interface DigitalWorkerDefinition {
  key: string
  title: string
  departmentKey: string
  managerKey?: string
  mission: string
  responsibilities: string[]
  competencies: string[]
  executionOrder: WorkerExecutionMode[]
  fallbackPolicy?: WorkerFallbackPolicy
  contextPolicy?: WorkerContextPolicy
  authority: WorkerAuthorityRule[]
  triggers: WorkerTriggerDefinition[]
  kpis: WorkerKpiDefinition[]
  status: WorkerStatus
  version: number
}

export interface WorkEnvelope<TPayload = Record<string, unknown>> {
  id: string
  type: WorkMessageType
  fromWorkerKey: string
  toWorkerKey: string
  workItemId?: string
  priority: "low" | "normal" | "high" | "critical"
  payload: TPayload
  createdAt: string
}

export interface WorkerExecutionResult<T = Record<string, unknown>> {
  status: "completed" | "blocked" | "approval_required" | "failed"
  workerKey: string
  workflowKey: string
  output?: T
  evidence: Record<string, unknown>
  next?: WorkEnvelope[]
  reason?: string
}
