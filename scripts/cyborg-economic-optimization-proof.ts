import { strict as assert } from 'node:assert';
import type { EconomicRun } from '../lib/cyborg/economicOptimization';
import {
  CYBORG_ECONOMIC_OBJECTIVE,
  allowedOptimizationLevers,
  compareEconomicRuns,
} from '../lib/cyborg/economicOptimization';

const usage = (
  modelCalls: number,
  inputTokens: number,
  outputTokens: number,
  costUsd: number,
  deterministicHits = 0,
  cacheHits = 0,
) => ({
  modelCalls,
  inputTokens,
  outputTokens,
  totalTokens: inputTokens + outputTokens,
  costUsd,
  deterministicHits,
  cacheHits,
});

const baseline: EconomicRun = {
  runId: 'baseline',
  measurements: [
    { missionId: 'a', missionClass: 'chemistry-authoring', taskClass: 'standard', evidenceSha: 'sha-a', usage: usage(4, 30_000, 10_000, 0.8), assurance: 'PASS' },
    { missionId: 'q', missionClass: 'quality-review', taskClass: 'certification', evidenceSha: 'sha-q', usage: usage(2, 12_000, 4_000, 0.4), assurance: 'PASS' },
    { missionId: 'c', missionClass: 'critic-review', taskClass: 'adversarial_review', evidenceSha: 'sha-c', usage: usage(2, 12_000, 4_000, 0.4), assurance: 'PASS' },
    { missionId: 'r', missionClass: 'repair', taskClass: 'repair', evidenceSha: 'sha-r', usage: usage(3, 20_000, 6_000, 0.5), assurance: 'PASS' },
    { missionId: 'l', missionClass: 'laban-orchestration', taskClass: 'routing', evidenceSha: 'sha-l', usage: usage(3, 8_000, 2_000, 0.15), assurance: 'PASS' },
    { missionId: 'g', missionClass: 'governance-check', taskClass: 'deterministic', evidenceSha: 'sha-g', usage: usage(1, 2_000, 500, 0.05), assurance: 'PASS' },
  ],
};

const optimized: EconomicRun = {
  runId: 'optimized',
  measurements: [
    { missionId: 'a2', missionClass: 'chemistry-authoring', taskClass: 'standard', evidenceSha: 'sha-a2', usage: usage(2, 9_000, 3_000, 0.24, 0, 1), assurance: 'PASS' },
    { missionId: 'q2', missionClass: 'quality-review', taskClass: 'certification', evidenceSha: 'sha-q2', usage: usage(1, 9_000, 3_000, 0.3), assurance: 'PASS' },
    { missionId: 'c2', missionClass: 'critic-review', taskClass: 'adversarial_review', evidenceSha: 'sha-c2', usage: usage(1, 9_000, 3_000, 0.3), assurance: 'PASS' },
    { missionId: 'r2', missionClass: 'repair', taskClass: 'repair', evidenceSha: 'sha-r2', usage: usage(1, 5_000, 2_000, 0.13, 0, 1), assurance: 'PASS' },
    { missionId: 'l2', missionClass: 'laban-orchestration', taskClass: 'routing', evidenceSha: 'sha-l2', usage: usage(1, 1_500, 500, 0.03, 0, 1), assurance: 'PASS' },
    { missionId: 'g2', missionClass: 'governance-check', taskClass: 'deterministic', evidenceSha: 'sha-g2', usage: usage(0, 0, 0, 0, 1, 0), assurance: 'PASS' },
  ],
};

assert.equal(CYBORG_ECONOMIC_OBJECTIVE, 'MINIMIZE_TOKEN_COST_SUBJECT_TO_EQUAL_OR_STRONGER_ASSURANCE');

const result = compareEconomicRuns(baseline, optimized);
assert.equal(result.assurancePreserved, true);
assert(result.tokenReductionPercent > 50);
assert(result.modelCallReductionPercent > 50);
assert(result.costReductionPercent > 50);
assert(result.remainingTokenPercent < 50);
assert.equal(result.reachedTargetPercent, 50);

assert.deepEqual(allowedOptimizationLevers('certification'), ['CONTEXT_REDUCTION']);
assert(allowedOptimizationLevers('routing').includes('LOWER_COST_MODEL'));
assert(allowedOptimizationLevers('deterministic').includes('DETERMINISTIC_EXECUTION'));

const assuranceRegression: EconomicRun = {
  ...optimized,
  runId: 'regressed',
  measurements: optimized.measurements.map((m) =>
    m.missionClass === 'quality-review' ? { ...m, assurance: 'FAIL' as const } : m,
  ),
};
assert.throws(() => compareEconomicRuns(baseline, assuranceRegression), /CYBORG_ASSURANCE_REGRESSION/);

const criticalBypass: EconomicRun = {
  ...optimized,
  runId: 'critical-bypass',
  measurements: optimized.measurements.map((m) =>
    m.missionClass === 'critic-review' ? { ...m, usage: usage(0, 0, 0, 0, 0, 1) } : m,
  ),
};
assert.throws(() => compareEconomicRuns(baseline, criticalBypass), /CYBORG_CRITICAL_ASSURANCE_EXECUTION_REQUIRED/);

const nonEquivalent: EconomicRun = {
  ...optimized,
  measurements: optimized.measurements.slice(0, -1),
};
assert.throws(() => compareEconomicRuns(baseline, nonEquivalent), /CYBORG_ECONOMIC_COMPARISON_NOT_EQUIVALENT/);

console.log('Cyborg economic optimization proof passed');
console.log(JSON.stringify(result, null, 2));
