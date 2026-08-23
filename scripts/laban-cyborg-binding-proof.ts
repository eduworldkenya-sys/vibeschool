import assert from 'node:assert/strict'
import {
  LABAN_CERTIFICATION_CONFIDENCE,
  assertLabanAuthorityEnvelope,
  assertLabanRoleSeparation,
  createLabanCyborgMission,
  evaluateLabanCompletion,
  labanActionDisposition,
  labanBlastRadius,
  reconcileLabanOutcome,
} from '../lib/hq/workforce/labanCommand'

const mission = createLabanCyborgMission({
  commandMissionId: 'mission-laban-proof',
  objective: 'Prove governed command convergence',
  baseRevision: 'deadbeef',
  successCriteria: ['authority remains canonical', 'completion is independently verified'],
})

assert.equal(mission.state, 'received')
assert.equal(mission.ownerGates.includes('authority_grant'), true)
assert.equal(mission.ownerGates.includes('runtime_activation'), true)
assert.equal(mission.forbiddenActions.includes('self_certification'), true)
assert.equal(mission.constraints.includes('commander=laban'), true)
assert.equal(mission.constraints.includes('consequential_mutation_requires_r1_4_authority'), true)
assert.equal(mission.budget.maxCycles > 0, true)
assert.equal(mission.budget.maxNoProgressCycles > 0, true)

assert.equal(labanActionDisposition('runtime_activation', 'owner_only'), 'owner_gate')
assert.equal(labanActionDisposition('self_certification', 'forbidden'), 'deny')
assert.equal(labanActionDisposition('read_repository', 'read'), 'allow')

assert.throws(() => assertLabanAuthorityEnvelope({
  workerKey: 'brian', capabilityKey: 'engineering.delivery', capabilityVersion: 1,
  authorityGrantId: 'grant-1', planStepId: 'step-1', scopeType: 'platform_internal', scopeRef: {},
  expiresAt: '2020-01-01T00:00:00.000Z',
}, new Date('2026-08-23T00:00:00.000Z')), /LABAN_AUTHORITY_EXPIRED/)

assert.doesNotThrow(() => assertLabanAuthorityEnvelope({
  workerKey: 'brian', capabilityKey: 'engineering.delivery', capabilityVersion: 1,
  authorityGrantId: 'grant-1', planStepId: 'step-1', scopeType: 'platform_internal', scopeRef: {},
  expiresAt: '2030-01-01T00:00:00.000Z',
}, new Date('2026-08-23T00:00:00.000Z')))

assert.throws(() => assertLabanRoleSeparation({
  commander: 'laban', executor: 'brian', verifier: 'laban', securityObserver: 'michael',
}), /LABAN_COMMAND_ROLE_SEPARATION_VIOLATION/)
assert.doesNotThrow(() => assertLabanRoleSeparation({
  commander: 'laban', executor: 'brian', verifier: 'luca', securityObserver: 'michael',
}))

const impact = labanBlastRadius(['foundation'], { foundation: ['consumer'], consumer: ['journey'] })
assert.deepEqual(impact.map(x => x.target), ['foundation', 'consumer', 'journey'])

const truthFailures = reconcileLabanOutcome(
  { revision: 'a', environment: 'production', assertions: { safe: true, untouched: 1 } },
  { revision: 'b', environment: 'production', assertions: { safe: true } },
  { revision: 'b', environment: 'production', assertions: { safe: false, untouched: 2 } },
)
assert.equal(truthFailures.includes('OUTCOME_MISMATCH:safe'), true)
assert.equal(truthFailures.includes('UNPLANNED_SIDE_EFFECT:untouched'), true)

const completion = evaluateLabanCompletion({
  ...mission,
  state: 'certifying',
  confidence: LABAN_CERTIFICATION_CONFIDENCE - 0.01,
}, 'laban')
assert.equal(completion.ok, false)
assert.equal(completion.failures.includes('LABAN_CANNOT_SELF_CERTIFY'), true)
assert.equal(completion.failures.includes('LABAN_CONFIDENCE_BELOW_CERTIFICATION_THRESHOLD'), true)

console.log('PASS: Laban command is bound to Cyborg governance, authority, separation, truth and completion controls')
