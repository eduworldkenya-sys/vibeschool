export type LabanPriority = "P0" | "P1" | "P2" | "P3"
export type LabanFailureClass = "local_retry" | "competency" | "plan" | "evidence" | "architecture" | "systemic"
export type LabanAutonomy = "autonomous" | "bounded_authority" | "owner_gate"

export interface LabanEvidenceSignal {
  id: string
  quality: number
  freshness: number
  independence: number
  supports: boolean
}

export interface LabanConfidenceBreakdown {
  confidence: number
  evidenceQuality: number
  freshness: number
  independence: number
  contradictionPenalty: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export function deriveLabanConfidence(evidence: LabanEvidenceSignal[]): LabanConfidenceBreakdown {
  if (evidence.length === 0) {
    return { confidence: 0, evidenceQuality: 0, freshness: 0, independence: 0, contradictionPenalty: 1 }
  }

  const avg = (values: number[]) => values.reduce((sum, value) => sum + clamp01(value), 0) / values.length
  const evidenceQuality = avg(evidence.map((item) => item.quality))
  const freshness = avg(evidence.map((item) => item.freshness))
  const independence = avg(evidence.map((item) => item.independence))
  const contradictions = evidence.filter((item) => !item.supports).length / evidence.length
  const contradictionPenalty = clamp01(contradictions * 0.8)
  const confidence = clamp01((evidenceQuality * 0.42) + (freshness * 0.24) + (independence * 0.34) - contradictionPenalty)

  return { confidence, evidenceQuality, freshness, independence, contradictionPenalty }
}

export interface LabanWorkerCandidate {
  workerKey: string
  certified: boolean
  specializationQualified: boolean
  health: number
  recentSuccessRate: number
  freshness: number
  workload: number
  latencyScore: number
  costScore: number
  recentFailurePenalty: number
}

export interface LabanWorkerSelection {
  workerKey: string
  score: number
}

export function rankLabanWorkers(candidates: LabanWorkerCandidate[]): LabanWorkerSelection[] {
  return candidates
    .filter((worker) => worker.certified && worker.specializationQualified)
    .map((worker) => ({
      workerKey: worker.workerKey,
      score: clamp01(
        (clamp01(worker.health) * 0.22) +
        (clamp01(worker.recentSuccessRate) * 0.25) +
        (clamp01(worker.freshness) * 0.15) +
        ((1 - clamp01(worker.workload)) * 0.12) +
        (clamp01(worker.latencyScore) * 0.08) +
        (clamp01(worker.costScore) * 0.08) +
        ((1 - clamp01(worker.recentFailurePenalty)) * 0.10)
      ),
    }))
    .sort((a, b) => b.score - a.score || a.workerKey.localeCompare(b.workerKey))
}

export interface LabanFailureSignal {
  retryable: boolean
  workerCompetencyMismatch: boolean
  invalidPlanAssumption: boolean
  staleOrContradictoryEvidence: boolean
  canonicalDependencyBroken: boolean
  crossMissionOrPlatformImpact: boolean
}

export function diagnoseLabanFailure(signal: LabanFailureSignal): LabanFailureClass {
  if (signal.crossMissionOrPlatformImpact) return "systemic"
  if (signal.canonicalDependencyBroken) return "architecture"
  if (signal.staleOrContradictoryEvidence) return "evidence"
  if (signal.invalidPlanAssumption) return "plan"
  if (signal.workerCompetencyMismatch) return "competency"
  return signal.retryable ? "local_retry" : "plan"
}

export function labanFailureAction(failureClass: LabanFailureClass): "retry" | "replace_worker" | "replan" | "invalidate_evidence" | "interrupt_dependents" | "global_escalation" {
  switch (failureClass) {
    case "local_retry": return "retry"
    case "competency": return "replace_worker"
    case "plan": return "replan"
    case "evidence": return "invalidate_evidence"
    case "architecture": return "interrupt_dependents"
    case "systemic": return "global_escalation"
  }
}

export interface LabanPlanCandidate {
  id: string
  expectedQuality: number
  expectedMinutes: number
  expectedCost: number
  risk: number
  workerPressure: number
}

export function scoreLabanPlan(plan: LabanPlanCandidate, limits: { maxMinutes: number; maxCost: number }): number {
  const timeEfficiency = limits.maxMinutes <= 0 ? 0 : clamp01(1 - (plan.expectedMinutes / limits.maxMinutes))
  const costEfficiency = limits.maxCost <= 0 ? 0 : clamp01(1 - (plan.expectedCost / limits.maxCost))
  return clamp01(
    (clamp01(plan.expectedQuality) * 0.46) +
    (timeEfficiency * 0.16) +
    (costEfficiency * 0.14) +
    ((1 - clamp01(plan.risk)) * 0.16) +
    ((1 - clamp01(plan.workerPressure)) * 0.08)
  )
}

export function chooseLabanPlan(plans: LabanPlanCandidate[], limits: { maxMinutes: number; maxCost: number }): LabanPlanCandidate {
  if (plans.length === 0) throw new Error("LABAN_PLAN_REQUIRED")
  return [...plans].sort((a, b) => scoreLabanPlan(b, limits) - scoreLabanPlan(a, limits) || a.id.localeCompare(b.id))[0]
}

export interface LabanMemoryRecord {
  missionType: string
  rootCause: string
  repairPattern: string
  regressionRef: string
  success: boolean
  relevance: number
  freshness: number
}

export function selectLabanStrategicMemory(records: LabanMemoryRecord[], missionType: string): LabanMemoryRecord[] {
  return records
    .filter((record) => record.missionType === missionType && record.success && Boolean(record.regressionRef.trim()))
    .sort((a, b) => ((b.relevance * b.freshness) - (a.relevance * a.freshness)))
    .slice(0, 5)
}

export interface LabanVerifierProvenance {
  commanderKey: string
  executorKey: string
  verifierKey: string
  verifierSessionId: string
  executorSessionId: string
  evidenceIds: string[]
  authorEvidenceIds: string[]
  freshEvidence: boolean
}

export function assertLabanVerifierIndependence(provenance: LabanVerifierProvenance): void {
  if (!provenance.verifierKey.trim()) throw new Error("LABAN_VERIFIER_REQUIRED")
  if (provenance.verifierKey === provenance.commanderKey) throw new Error("LABAN_VERIFIER_IS_COMMANDER")
  if (provenance.verifierKey === provenance.executorKey) throw new Error("LABAN_VERIFIER_IS_EXECUTOR")
  if (!provenance.verifierSessionId.trim() || provenance.verifierSessionId === provenance.executorSessionId) throw new Error("LABAN_VERIFIER_SESSION_NOT_INDEPENDENT")
  if (!provenance.freshEvidence) throw new Error("LABAN_VERIFIER_EVIDENCE_STALE")
  const authorSet = new Set(provenance.authorEvidenceIds)
  if (provenance.evidenceIds.length === 0 || provenance.evidenceIds.every((id) => authorSet.has(id))) throw new Error("LABAN_VERIFIER_REUSED_AUTHOR_EVIDENCE_ONLY")
}

export function labanAutonomyDisposition(input: { reversible: boolean; sensitive: boolean; consequential: boolean }): LabanAutonomy {
  if (input.consequential || !input.reversible) return "owner_gate"
  if (input.sensitive) return "bounded_authority"
  return "autonomous"
}

const priorityWeight: Record<LabanPriority, number> = { P0: 4, P1: 3, P2: 2, P3: 1 }

export interface LabanPortfolioMission {
  missionId: string
  priority: LabanPriority
  deadlineAt?: string
  requiredWorkers: string[]
  blocked: boolean
}

export function orderLabanPortfolio(missions: LabanPortfolioMission[], now = new Date()): LabanPortfolioMission[] {
  const deadlineUrgency = (mission: LabanPortfolioMission) => {
    if (!mission.deadlineAt) return Number.POSITIVE_INFINITY
    const deadline = new Date(mission.deadlineAt).getTime()
    return Number.isFinite(deadline) ? deadline - now.getTime() : Number.POSITIVE_INFINITY
  }
  return [...missions].sort((a, b) => {
    if (a.blocked !== b.blocked) return a.blocked ? 1 : -1
    const priorityDelta = priorityWeight[b.priority] - priorityWeight[a.priority]
    if (priorityDelta !== 0) return priorityDelta
    const deadlineDelta = deadlineUrgency(a) - deadlineUrgency(b)
    return deadlineDelta !== 0 ? deadlineDelta : a.missionId.localeCompare(b.missionId)
  })
}

export function detectLabanResourceConflicts(missions: LabanPortfolioMission[]): Record<string, string[]> {
  const assignments = new Map<string, string[]>()
  for (const mission of missions.filter((item) => !item.blocked)) {
    for (const worker of mission.requiredWorkers) assignments.set(worker, [...(assignments.get(worker) ?? []), mission.missionId])
  }
  return Object.fromEntries(Array.from(assignments.entries()).filter(([, missionIds]) => missionIds.length > 1))
}

export interface LabanCommandStep {
  id: string
  objective: string
  consequential: boolean
  reversible: boolean
  sensitive: boolean
  completed: boolean
  attempts: number
}

export interface LabanCommandMission {
  missionId: string
  missionType: string
  priority: LabanPriority
  steps: LabanCommandStep[]
  evidence: LabanEvidenceSignal[]
  maxCycles: number
}

export interface LabanStepResult {
  ok: boolean
  evidence: LabanEvidenceSignal[]
  failure?: LabanFailureSignal
}

export interface LabanCommandAdapters {
  runtimeCommissioned(): Promise<boolean>
  globalStopActive(): Promise<boolean>
  authorityGranted(step: LabanCommandStep): Promise<boolean>
  selectCandidates(step: LabanCommandStep): Promise<LabanWorkerCandidate[]>
  execute(step: LabanCommandStep, workerKey: string, memories: LabanMemoryRecord[]): Promise<LabanStepResult>
  verify(step: LabanCommandStep, workerKey: string): Promise<{ ok: boolean; provenance: LabanVerifierProvenance; evidence: LabanEvidenceSignal[] }>
  loadMemory(missionType: string): Promise<LabanMemoryRecord[]>
  persist(event: LabanCommandEvent): Promise<void>
}

export interface LabanCommandEvent {
  missionId: string
  cycle: number
  stepId: string
  action: string
  workerKey?: string
  confidence: number
  detail?: string
}

export interface LabanCommandOutcome {
  status: "completed" | "blocked" | "exhausted"
  cycles: number
  confidence: number
  blockedReason?: string
}

export async function runLabanCommandLoop(mission: LabanCommandMission, adapters: LabanCommandAdapters): Promise<LabanCommandOutcome> {
  if (!mission.missionId.trim() || mission.steps.length === 0) throw new Error("LABAN_MISSION_INVALID")
  if (!(await adapters.runtimeCommissioned())) return { status: "blocked", cycles: 0, confidence: deriveLabanConfidence(mission.evidence).confidence, blockedReason: "LABAN_RUNTIME_NOT_COMMISSIONED" }
  if (await adapters.globalStopActive()) return { status: "blocked", cycles: 0, confidence: deriveLabanConfidence(mission.evidence).confidence, blockedReason: "LABAN_GLOBAL_STOP_ACTIVE" }

  const memories = selectLabanStrategicMemory(await adapters.loadMemory(mission.missionType), mission.missionType)
  let cycle = 0

  while (cycle < mission.maxCycles) {
    cycle += 1
    const step = mission.steps.find((item) => !item.completed)
    if (!step) {
      const confidence = deriveLabanConfidence(mission.evidence).confidence
      return { status: confidence >= 0.9 ? "completed" : "blocked", cycles: cycle - 1, confidence, blockedReason: confidence >= 0.9 ? undefined : "LABAN_EVIDENCE_CONFIDENCE_BELOW_THRESHOLD" }
    }

    const autonomy = labanAutonomyDisposition(step)
    if (autonomy !== "autonomous" && !(await adapters.authorityGranted(step))) {
      await adapters.persist({ missionId: mission.missionId, cycle, stepId: step.id, action: "authority_blocked", confidence: deriveLabanConfidence(mission.evidence).confidence })
      return { status: "blocked", cycles: cycle, confidence: deriveLabanConfidence(mission.evidence).confidence, blockedReason: "LABAN_AUTHORITY_REQUIRED" }
    }

    const ranked = rankLabanWorkers(await adapters.selectCandidates(step))
    if (ranked.length === 0) return { status: "blocked", cycles: cycle, confidence: deriveLabanConfidence(mission.evidence).confidence, blockedReason: "LABAN_NO_QUALIFIED_WORKER" }
    const worker = ranked[0]
    step.attempts += 1
    await adapters.persist({ missionId: mission.missionId, cycle, stepId: step.id, action: "dispatch", workerKey: worker.workerKey, confidence: deriveLabanConfidence(mission.evidence).confidence })

    const result = await adapters.execute(step, worker.workerKey, memories)
    mission.evidence.push(...result.evidence)
    if (!result.ok) {
      const failureClass = diagnoseLabanFailure(result.failure ?? { retryable: false, workerCompetencyMismatch: false, invalidPlanAssumption: true, staleOrContradictoryEvidence: false, canonicalDependencyBroken: false, crossMissionOrPlatformImpact: false })
      const action = labanFailureAction(failureClass)
      await adapters.persist({ missionId: mission.missionId, cycle, stepId: step.id, action, workerKey: worker.workerKey, confidence: deriveLabanConfidence(mission.evidence).confidence, detail: failureClass })
      if (failureClass === "systemic" || failureClass === "architecture") return { status: "blocked", cycles: cycle, confidence: deriveLabanConfidence(mission.evidence).confidence, blockedReason: `LABAN_${failureClass.toUpperCase()}_FAILURE` }
      continue
    }

    const verification = await adapters.verify(step, worker.workerKey)
    assertLabanVerifierIndependence(verification.provenance)
    mission.evidence.push(...verification.evidence)
    if (!verification.ok) {
      await adapters.persist({ missionId: mission.missionId, cycle, stepId: step.id, action: "verification_failed", workerKey: worker.workerKey, confidence: deriveLabanConfidence(mission.evidence).confidence })
      continue
    }

    step.completed = true
    await adapters.persist({ missionId: mission.missionId, cycle, stepId: step.id, action: "step_completed", workerKey: worker.workerKey, confidence: deriveLabanConfidence(mission.evidence).confidence })
  }

  return { status: "exhausted", cycles: cycle, confidence: deriveLabanConfidence(mission.evidence).confidence, blockedReason: "LABAN_CYCLE_BUDGET_EXHAUSTED" }
}
