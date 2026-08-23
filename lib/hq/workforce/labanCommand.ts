import type { CyborgMission, CyborgRisk, EvidenceRef, Hypothesis, MissionGate, SideEffect } from '../../cyborg/contracts'
import { CYBORG_FORBIDDEN, CYBORG_OWNER_GATES, actionDisposition } from '../../cyborg/policy'
import { adversarialCompletionCritic, blastRadius, reconcileTruth, type ChangeImpact, type TruthSnapshot } from '../../cyborg/orchestrator'

export const LABAN_COMMANDER_KEY = 'laban' as const
export const LABAN_CERTIFICATION_CONFIDENCE = 0.9

export type LabanCommandRole = 'commander' | 'executor' | 'verifier' | 'security_observer'

export interface LabanMissionSeed {
  commandMissionId: string
  objective: string
  baseRevision: string
  successCriteria: string[]
  constraints?: string[]
  gates?: MissionGate[]
  evidence?: EvidenceRef[]
  hypotheses?: Hypothesis[]
  sideEffects?: SideEffect[]
  confidence?: number
  maxCycles?: number
  maxRepeatedFailure?: number
  maxNoProgressCycles?: number
  maxToolCalls?: number
}

export interface LabanAuthorityEnvelope {
  workerKey: string
  capabilityKey: string
  capabilityVersion: number
  authorityGrantId: string
  planStepId: string
  scopeType: string
  scopeRef: Record<string, unknown>
  expiresAt: string
}

export interface LabanRoleAssignment {
  commander: string
  executor: string
  verifier: string
  securityObserver?: string
}

/**
 * Creates the Cyborg mission representation used by Laban command work.
 * This is coordination state only: creating a mission never confers runtime or consequential authority.
 */
export function createLabanCyborgMission(seed: LabanMissionSeed): CyborgMission {
  if (!seed.commandMissionId.trim()) throw new Error('LABAN_COMMAND_MISSION_ID_REQUIRED')
  if (!seed.objective.trim()) throw new Error('LABAN_COMMAND_OBJECTIVE_REQUIRED')
  if (!seed.baseRevision.trim()) throw new Error('LABAN_BASE_REVISION_REQUIRED')
  if (!seed.successCriteria.length) throw new Error('LABAN_SUCCESS_CRITERIA_REQUIRED')

  return {
    id: seed.commandMissionId,
    objective: seed.objective,
    state: 'received',
    baseRevision: seed.baseRevision,
    successCriteria: [...seed.successCriteria],
    constraints: [...(seed.constraints ?? []), 'commander=laban', 'consequential_mutation_requires_r1_4_authority'],
    ownerGates: [...CYBORG_OWNER_GATES],
    forbiddenActions: [...CYBORG_FORBIDDEN],
    gates: seed.gates ?? [],
    evidence: seed.evidence ?? [],
    hypotheses: seed.hypotheses ?? [],
    skills: [],
    sideEffects: seed.sideEffects ?? [],
    budget: {
      maxCycles: seed.maxCycles ?? 24,
      maxRepeatedFailure: seed.maxRepeatedFailure ?? 3,
      maxNoProgressCycles: seed.maxNoProgressCycles ?? 3,
      maxToolCalls: seed.maxToolCalls ?? 120,
    },
    cycle: 0,
    noProgressCycles: 0,
    confidence: seed.confidence ?? 0,
  }
}

/** Laban may command owner-gated work, but cannot silently authorize it. */
export function labanActionDisposition(action: string, risk: CyborgRisk) {
  return actionDisposition(risk, action)
}

/**
 * Consequential delegation is accepted only with complete canonical lineage.
 * Database R1.4 remains authoritative; this is a TypeScript fail-fast boundary.
 */
export function assertLabanAuthorityEnvelope(envelope: LabanAuthorityEnvelope, now = new Date()): void {
  if (!envelope.workerKey.trim()) throw new Error('LABAN_DELEGATE_WORKER_REQUIRED')
  if (!envelope.capabilityKey.trim() || envelope.capabilityVersion <= 0) throw new Error('LABAN_CERTIFIED_CAPABILITY_REQUIRED')
  if (!envelope.authorityGrantId.trim()) throw new Error('LABAN_AUTHORITY_GRANT_REQUIRED')
  if (!envelope.planStepId.trim()) throw new Error('LABAN_PLAN_STEP_REQUIRED')
  if (!envelope.scopeType.trim()) throw new Error('LABAN_SCOPE_REQUIRED')
  const expiry = new Date(envelope.expiresAt)
  if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= now.getTime()) throw new Error('LABAN_AUTHORITY_EXPIRED')
}

/** Commander, executor, verifier and security observer are mutually distrustful roles. */
export function assertLabanRoleSeparation(assignment: LabanRoleAssignment): void {
  if (assignment.commander !== LABAN_COMMANDER_KEY) throw new Error('LABAN_COMMANDER_IDENTITY_REQUIRED')
  const identities = [assignment.commander, assignment.executor, assignment.verifier, assignment.securityObserver].filter(Boolean) as string[]
  if (new Set(identities).size !== identities.length) throw new Error('LABAN_COMMAND_ROLE_SEPARATION_VIOLATION')
}

/** Reuses Cyborg dependency/blast-radius logic for command replanning. */
export function labanBlastRadius(changed: string[], dependencyMap: Record<string, string[]>): ChangeImpact[] {
  return blastRadius(changed, dependencyMap)
}

/** Reuses Cyborg truth reconciliation; contradictions must be repaired rather than hidden. */
export function reconcileLabanOutcome(before: TruthSnapshot, intended: TruthSnapshot, actual: TruthSnapshot): string[] {
  return reconcileTruth(before, intended, actual)
}

/**
 * Laban is never the independent assurance authority. Cyborg's completion critic must be clean,
 * the independent verifier must be different, and the certification confidence threshold must hold.
 */
export function evaluateLabanCompletion(mission: CyborgMission, verifierKey: string): { ok: boolean; failures: string[] } {
  const failures = adversarialCompletionCritic(mission)
  if (!verifierKey.trim()) failures.push('INDEPENDENT_VERIFIER_REQUIRED')
  if (verifierKey === LABAN_COMMANDER_KEY) failures.push('LABAN_CANNOT_SELF_CERTIFY')
  if ((mission.confidence ?? 0) < LABAN_CERTIFICATION_CONFIDENCE) failures.push('LABAN_CONFIDENCE_BELOW_CERTIFICATION_THRESHOLD')
  return { ok: failures.length === 0, failures: Array.from(new Set(failures)) }
}
