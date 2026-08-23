import assert from "node:assert/strict"
import test from "node:test"
import {
  assertLabanVerifierIndependence,
  chooseLabanPlan,
  deriveLabanConfidence,
  detectLabanResourceConflicts,
  diagnoseLabanFailure,
  labanAutonomyDisposition,
  orderLabanPortfolio,
  rankLabanWorkers,
  runLabanCommandLoop,
  selectLabanStrategicMemory,
  type LabanCommandAdapters,
  type LabanCommandMission,
  type LabanEvidenceSignal,
} from "./labanCommander"

const strongEvidence: LabanEvidenceSignal[] = [
  { id: "ci", quality: 1, freshness: 1, independence: 1, supports: true },
  { id: "db", quality: 0.98, freshness: 1, independence: 0.95, supports: true },
  { id: "verifier", quality: 1, freshness: 1, independence: 1, supports: true },
]

test("confidence is derived from evidence and contradictions reduce it", () => {
  const strong = deriveLabanConfidence(strongEvidence)
  const contradicted = deriveLabanConfidence([...strongEvidence, { id: "conflict", quality: 1, freshness: 1, independence: 1, supports: false }])
  assert.ok(strong.confidence >= 0.9)
  assert.ok(contradicted.confidence < strong.confidence)
})

test("worker ranking rejects uncertified and chooses current best worker", () => {
  const ranked = rankLabanWorkers([
    { workerKey: "stale", certified: true, specializationQualified: true, health: 0.6, recentSuccessRate: 0.5, freshness: 0.4, workload: 0.9, latencyScore: 0.5, costScore: 0.8, recentFailurePenalty: 0.8 },
    { workerKey: "best", certified: true, specializationQualified: true, health: 1, recentSuccessRate: 0.98, freshness: 1, workload: 0.1, latencyScore: 0.9, costScore: 0.9, recentFailurePenalty: 0 },
    { workerKey: "uncertified", certified: false, specializationQualified: true, health: 1, recentSuccessRate: 1, freshness: 1, workload: 0, latencyScore: 1, costScore: 1, recentFailurePenalty: 0 },
  ])
  assert.equal(ranked[0]?.workerKey, "best")
  assert.equal(ranked.some((item) => item.workerKey === "uncertified"), false)
})

test("failure diagnosis escalates architecture and systemic defects above retries", () => {
  assert.equal(diagnoseLabanFailure({ retryable: true, workerCompetencyMismatch: false, invalidPlanAssumption: false, staleOrContradictoryEvidence: false, canonicalDependencyBroken: true, crossMissionOrPlatformImpact: false }), "architecture")
  assert.equal(diagnoseLabanFailure({ retryable: true, workerCompetencyMismatch: false, invalidPlanAssumption: false, staleOrContradictoryEvidence: false, canonicalDependencyBroken: true, crossMissionOrPlatformImpact: true }), "systemic")
})

test("plan optimizer prefers quality while accounting for time cost risk and capacity", () => {
  const selected = chooseLabanPlan([
    { id: "expensive", expectedQuality: 0.99, expectedMinutes: 95, expectedCost: 95, risk: 0.4, workerPressure: 0.8 },
    { id: "balanced", expectedQuality: 0.97, expectedMinutes: 40, expectedCost: 35, risk: 0.1, workerPressure: 0.2 },
  ], { maxMinutes: 100, maxCost: 100 })
  assert.equal(selected.id, "balanced")
})

test("strategic memory requires successful regression-backed lessons", () => {
  const selected = selectLabanStrategicMemory([
    { missionType: "chemistry", rootCause: "missing source", repairPattern: "source gate", regressionRef: "test-1", success: true, relevance: 1, freshness: 1 },
    { missionType: "chemistry", rootCause: "bad", repairPattern: "none", regressionRef: "", success: true, relevance: 1, freshness: 1 },
    { missionType: "math", rootCause: "other", repairPattern: "other", regressionRef: "test-2", success: true, relevance: 1, freshness: 1 },
  ], "chemistry")
  assert.deepEqual(selected.map((item) => item.regressionRef), ["test-1"])
})

test("verifier independence rejects executor session and author-only evidence", () => {
  assert.throws(() => assertLabanVerifierIndependence({ commanderKey: "laban", executorKey: "brian", verifierKey: "critic", verifierSessionId: "same", executorSessionId: "same", evidenceIds: ["fresh"], authorEvidenceIds: [], freshEvidence: true }), /SESSION_NOT_INDEPENDENT/)
  assert.throws(() => assertLabanVerifierIndependence({ commanderKey: "laban", executorKey: "brian", verifierKey: "critic", verifierSessionId: "verify", executorSessionId: "execute", evidenceIds: ["author-1"], authorEvidenceIds: ["author-1"], freshEvidence: true }), /REUSED_AUTHOR_EVIDENCE_ONLY/)
})

test("autonomy doctrine preserves owner gate for irreversible or consequential action", () => {
  assert.equal(labanAutonomyDisposition({ reversible: true, sensitive: false, consequential: false }), "autonomous")
  assert.equal(labanAutonomyDisposition({ reversible: true, sensitive: true, consequential: false }), "bounded_authority")
  assert.equal(labanAutonomyDisposition({ reversible: false, sensitive: false, consequential: false }), "owner_gate")
  assert.equal(labanAutonomyDisposition({ reversible: true, sensitive: false, consequential: true }), "owner_gate")
})

test("portfolio command prioritizes P0 and exposes worker contention", () => {
  const ordered = orderLabanPortfolio([
    { missionId: "p2", priority: "P2", requiredWorkers: ["brian"], blocked: false },
    { missionId: "p0", priority: "P0", requiredWorkers: ["brian", "critic"], blocked: false },
    { missionId: "blocked-p0", priority: "P0", requiredWorkers: ["critic"], blocked: true },
  ])
  assert.deepEqual(ordered.map((item) => item.missionId), ["p0", "p2", "blocked-p0"])
  assert.deepEqual(detectLabanResourceConflicts(ordered), { brian: ["p0", "p2"] })
})

function mission(): LabanCommandMission {
  return {
    missionId: "mission-1",
    missionType: "chemistry",
    priority: "P1",
    steps: [{ id: "author", objective: "author", consequential: false, reversible: true, sensitive: false, completed: false, attempts: 0 }],
    evidence: [...strongEvidence],
    maxCycles: 3,
  }
}

function adapters(overrides: Partial<LabanCommandAdapters> = {}): LabanCommandAdapters {
  const base: LabanCommandAdapters = {
    runtimeCommissioned: async () => true,
    globalStopActive: async () => false,
    authorityGranted: async () => false,
    selectCandidates: async () => [{ workerKey: "author", certified: true, specializationQualified: true, health: 1, recentSuccessRate: 1, freshness: 1, workload: 0, latencyScore: 1, costScore: 1, recentFailurePenalty: 0 }],
    execute: async () => ({ ok: true, evidence: [{ id: "execution", quality: 1, freshness: 1, independence: 0.8, supports: true }] }),
    verify: async (_step, workerKey) => ({ ok: true, provenance: { commanderKey: "laban", executorKey: workerKey, verifierKey: "critic", verifierSessionId: "verify-1", executorSessionId: "exec-1", evidenceIds: ["fresh-verification"], authorEvidenceIds: ["execution"], freshEvidence: true }, evidence: [{ id: "fresh-verification", quality: 1, freshness: 1, independence: 1, supports: true }] }),
    loadMemory: async () => [{ missionType: "chemistry", rootCause: "old defect", repairPattern: "preflight", regressionRef: "regression-1", success: true, relevance: 1, freshness: 1 }],
    persist: async () => undefined,
  }
  return { ...base, ...overrides }
}

test("command loop fails closed when runtime is not commissioned", async () => {
  const outcome = await runLabanCommandLoop(mission(), adapters({ runtimeCommissioned: async () => false }))
  assert.equal(outcome.status, "blocked")
  assert.equal(outcome.blockedReason, "LABAN_RUNTIME_NOT_COMMISSIONED")
})

test("command loop fails closed on Global Stop", async () => {
  const outcome = await runLabanCommandLoop(mission(), adapters({ globalStopActive: async () => true }))
  assert.equal(outcome.status, "blocked")
  assert.equal(outcome.blockedReason, "LABAN_GLOBAL_STOP_ACTIVE")
})

test("command loop runs through execution, independent verification and objective completion", async () => {
  const events: string[] = []
  const outcome = await runLabanCommandLoop(mission(), adapters({ persist: async (event) => { events.push(event.action) } }))
  assert.equal(outcome.status, "completed")
  assert.ok(outcome.confidence >= 0.9)
  assert.deepEqual(events, ["dispatch", "step_completed"])
})

test("command loop interrupts on architecture defect instead of blindly retrying", async () => {
  const outcome = await runLabanCommandLoop(mission(), adapters({
    execute: async () => ({ ok: false, evidence: [], failure: { retryable: true, workerCompetencyMismatch: false, invalidPlanAssumption: false, staleOrContradictoryEvidence: false, canonicalDependencyBroken: true, crossMissionOrPlatformImpact: false } }),
  }))
  assert.equal(outcome.status, "blocked")
  assert.equal(outcome.blockedReason, "LABAN_ARCHITECTURE_FAILURE")
})
