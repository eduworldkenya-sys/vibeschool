export type WorkerExecutionMode = "deterministic" | "local_ai" | "human" | "external_ai"
export type WorkerStatus = "draft" | "probation" | "active" | "restricted" | "suspended" | "retired"
export type WorkerRisk = "low" | "normal" | "high" | "critical"
export type WorkMessageType = "assign" | "request" | "consult" | "clarify" | "review" | "escalate" | "approve" | "reject" | "inform" | "handoff" | "verify"
export type ContextClassification = "public" | "internal" | "confidential" | "restricted"

export interface WorkerKpiDefinition { key: string; label: string; direction: "higher" | "lower" | "boolean"; target?: number; unit?: string }
export interface WorkerAuthorityRule {
  action: string; risk: WorkerRisk; mode: "allow" | "deny" | "approval_required"; approvalRole?: string
  escalationPolicy?: { escalateAfterHours: number; backupApprovalRole: string; finalEscalationRole: string; notifyOnEscalate: boolean }
}
export interface WorkerTriggerDefinition {
  key: string; source: "event" | "schedule" | "metric" | "manual"; eventType?: string; metricKey?: string
  operator?: "lt" | "lte" | "eq" | "gte" | "gt"; threshold?: number; workflowKey: string
  cooldownSeconds?: number; dedupeWindowSeconds?: number
}
export interface WorkerFallbackPolicy { requireApprovalOnFallback: boolean; allowedFallbackModes: WorkerExecutionMode[]; maxFallbackDepth: number }
export interface WorkerContextPolicy {
  maximumClassification: ContextClassification
  ephemeralContext?: boolean
  forbiddenContextKeys: string[]
}
export interface DigitalWorkerDefinition {
  key: string; title: string; departmentKey: string; managerKey?: string; mission: string
  responsibilities: string[]; competencies: string[]; executionOrder: WorkerExecutionMode[]; fallbackPolicy?: WorkerFallbackPolicy
  contextPolicy?: WorkerContextPolicy; authority: WorkerAuthorityRule[]; triggers: WorkerTriggerDefinition[]; kpis: WorkerKpiDefinition[]
  status: WorkerStatus; version: number
}

/** Exact curriculum/publication lineage. Workers must never infer or guess these bindings. */
export interface CurriculumWorkBinding {
  traceId: string
  missionId: string
  publicationId: string
  publicationRevisionId: string
  strandId?: string
  chapterId?: string
  parentAttemptId?: string
  iteration: number
}

/** Mission-local budget carried with the envelope in addition to the durable worker budget. */
export interface WorkEnvelopeBudget {
  tokenBudgetRemaining: number
  computeBudgetRemaining: number
}

export interface WorkEnvelope<TPayload = Record<string, unknown>> {
  id: string; type: WorkMessageType; fromWorkerKey: string; toWorkerKey: string; workItemId?: string
  priority: "low" | "normal" | "high" | "critical"; payload: TPayload; classification?: ContextClassification; createdAt: string
  curriculum?: CurriculumWorkBinding
  budget?: WorkEnvelopeBudget
}
export interface ClarificationPayload { questionKey: string; requiredFields: string[]; reason: string; responseToEnvelopeId: string }
export interface WorkerExecutionResult<T = Record<string, unknown>> {
  status: "completed" | "blocked" | "approval_required" | "failed"; workerKey: string; workflowKey: string
  output?: T; evidence: Record<string, unknown>; next?: WorkEnvelope[]; reason?: string
}
