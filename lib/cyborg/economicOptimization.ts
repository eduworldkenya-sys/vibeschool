import type { CyborgEconomicUsage, CyborgTaskClass } from './economics';
import { isCriticalTask } from './economics';

export const CYBORG_ECONOMIC_OBJECTIVE =
  'MINIMIZE_TOKEN_COST_SUBJECT_TO_EQUAL_OR_STRONGER_ASSURANCE' as const;

export const CYBORG_REMAINING_TOKEN_TARGETS = [50, 25, 10, 5, 1] as const;

export type AssuranceResult = 'PASS' | 'FAIL' | 'BLOCKED';

export interface EconomicMissionMeasurement {
  missionId: string;
  missionClass: string;
  taskClass: CyborgTaskClass;
  evidenceSha: string;
  usage: CyborgEconomicUsage;
  assurance: AssuranceResult;
}

export interface EconomicRun {
  runId: string;
  measurements: EconomicMissionMeasurement[];
}

export interface EconomicAggregate {
  missions: number;
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  deterministicHits: number;
  cacheHits: number;
  assurancePassed: number;
  assuranceFailed: number;
  assuranceBlocked: number;
}

export interface EconomicComparison {
  baseline: EconomicAggregate;
  optimized: EconomicAggregate;
  tokenReductionPercent: number;
  remainingTokenPercent: number;
  modelCallReductionPercent: number;
  costReductionPercent: number;
  assurancePreserved: boolean;
  reachedTargetPercent: number | null;
}

function reductionPercent(before: number, after: number): number {
  if (before <= 0) return after <= 0 ? 0 : -100;
  return ((before - after) / before) * 100;
}

export function aggregateEconomicRun(run: EconomicRun): EconomicAggregate {
  return run.measurements.reduce<EconomicAggregate>((total, item) => ({
    missions: total.missions + 1,
    modelCalls: total.modelCalls + item.usage.modelCalls,
    inputTokens: total.inputTokens + item.usage.inputTokens,
    outputTokens: total.outputTokens + item.usage.outputTokens,
    totalTokens: total.totalTokens + item.usage.totalTokens,
    costUsd: total.costUsd + item.usage.costUsd,
    deterministicHits: total.deterministicHits + item.usage.deterministicHits,
    cacheHits: total.cacheHits + item.usage.cacheHits,
    assurancePassed: total.assurancePassed + (item.assurance === 'PASS' ? 1 : 0),
    assuranceFailed: total.assuranceFailed + (item.assurance === 'FAIL' ? 1 : 0),
    assuranceBlocked: total.assuranceBlocked + (item.assurance === 'BLOCKED' ? 1 : 0),
  }), {
    missions: 0,
    modelCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    deterministicHits: 0,
    cacheHits: 0,
    assurancePassed: 0,
    assuranceFailed: 0,
    assuranceBlocked: 0,
  });
}

function assertComparable(baseline: EconomicRun, optimized: EconomicRun): void {
  const key = (m: EconomicMissionMeasurement) => `${m.missionClass}:${m.taskClass}`;
  const baselineKeys = baseline.measurements.map(key).sort();
  const optimizedKeys = optimized.measurements.map(key).sort();
  if (baselineKeys.length !== optimizedKeys.length || baselineKeys.some((value, index) => value !== optimizedKeys[index])) {
    throw new Error('CYBORG_ECONOMIC_COMPARISON_NOT_EQUIVALENT');
  }
  for (const measurement of [...baseline.measurements, ...optimized.measurements]) {
    if (!measurement.evidenceSha.trim()) throw new Error('CYBORG_ECONOMIC_EVIDENCE_SHA_REQUIRED');
  }
}

export function compareEconomicRuns(baseline: EconomicRun, optimized: EconomicRun): EconomicComparison {
  assertComparable(baseline, optimized);
  const before = aggregateEconomicRun(baseline);
  const after = aggregateEconomicRun(optimized);

  // Optimization may never turn a passing mission into FAIL/BLOCKED, and
  // assurance-critical missions must still be freshly represented in the optimized run.
  const baselineByClass = new Map(baseline.measurements.map(m => [`${m.missionClass}:${m.taskClass}`, m]));
  for (const candidate of optimized.measurements) {
    const original = baselineByClass.get(`${candidate.missionClass}:${candidate.taskClass}`);
    if (original?.assurance === 'PASS' && candidate.assurance !== 'PASS') {
      throw new Error(`CYBORG_ASSURANCE_REGRESSION:${candidate.missionClass}`);
    }
    if (isCriticalTask(candidate.taskClass) && candidate.usage.modelCalls < 1) {
      throw new Error(`CYBORG_CRITICAL_ASSURANCE_EXECUTION_REQUIRED:${candidate.missionClass}`);
    }
  }

  const remainingTokenPercent = before.totalTokens > 0 ? (after.totalTokens / before.totalTokens) * 100 : 100;
  const reachedTargetPercent = [...CYBORG_REMAINING_TOKEN_TARGETS]
    .reverse()
    .find(target => remainingTokenPercent <= target) ?? null;

  return {
    baseline: before,
    optimized: after,
    tokenReductionPercent: reductionPercent(before.totalTokens, after.totalTokens),
    remainingTokenPercent,
    modelCallReductionPercent: reductionPercent(before.modelCalls, after.modelCalls),
    costReductionPercent: reductionPercent(before.costUsd, after.costUsd),
    assurancePreserved: after.assuranceFailed <= before.assuranceFailed && after.assuranceBlocked <= before.assuranceBlocked,
    reachedTargetPercent,
  };
}

export type OptimizationLever =
  | 'DETERMINISTIC_EXECUTION'
  | 'EXACT_RESULT_CACHE'
  | 'CONTEXT_REDUCTION'
  | 'LOWER_COST_MODEL'
  | 'UNCHANGED_EVIDENCE_REUSE';

export function allowedOptimizationLevers(taskClass: CyborgTaskClass): OptimizationLever[] {
  if (isCriticalTask(taskClass)) return ['CONTEXT_REDUCTION'];
  if (taskClass === 'deterministic') return ['DETERMINISTIC_EXECUTION', 'EXACT_RESULT_CACHE', 'CONTEXT_REDUCTION'];
  if (taskClass === 'classification' || taskClass === 'routing') {
    return ['EXACT_RESULT_CACHE', 'CONTEXT_REDUCTION', 'LOWER_COST_MODEL', 'UNCHANGED_EVIDENCE_REUSE'];
  }
  return ['EXACT_RESULT_CACHE', 'CONTEXT_REDUCTION', 'LOWER_COST_MODEL', 'UNCHANGED_EVIDENCE_REUSE'];
}
