export type CyborgTaskClass =
  | 'deterministic'
  | 'classification'
  | 'routing'
  | 'standard'
  | 'repair'
  | 'certification'
  | 'adversarial_review'
  | 'security_review';

export type CyborgModelTier = 'cheap' | 'standard' | 'critical';

export interface CyborgEconomicBudget {
  maxTotalTokens: number;
  maxModelCalls: number;
  maxCostUsd: number;
}

export interface CyborgEconomicUsage {
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  deterministicHits: number;
  cacheHits: number;
}

export interface CyborgTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export const DEFAULT_CYBORG_ECONOMIC_BUDGET: CyborgEconomicBudget = {
  maxTotalTokens: 50_000,
  maxModelCalls: 20,
  maxCostUsd: 1,
};

export const CYBORG_ECONOMIC_BLOCK = 'BLOCKED_ECONOMIC';

const CRITICAL_TASKS = new Set<CyborgTaskClass>(['certification', 'adversarial_review', 'security_review']);

export function isCriticalTask(taskClass: CyborgTaskClass): boolean {
  return CRITICAL_TASKS.has(taskClass);
}

export function modelTierForTask(taskClass: CyborgTaskClass): CyborgModelTier {
  if (isCriticalTask(taskClass)) return 'critical';
  if (taskClass === 'classification' || taskClass === 'routing') return 'cheap';
  return 'standard';
}

export function estimateInputTokens(messages: unknown[]): number {
  const chars = JSON.stringify(messages).length;
  return Math.max(1, Math.ceil(chars / 4));
}

export function normalizeUsage(usage?: Record<string, number>): CyborgTokenUsage {
  const inputTokens = Math.max(0, Math.trunc(usage?.inputTokens ?? usage?.input_tokens ?? usage?.prompt_tokens ?? 0));
  const outputTokens = Math.max(0, Math.trunc(usage?.outputTokens ?? usage?.output_tokens ?? usage?.completion_tokens ?? 0));
  const explicitTotal = Math.max(0, Math.trunc(usage?.totalTokens ?? usage?.total_tokens ?? 0));
  return { inputTokens, outputTokens, totalTokens: explicitTotal || inputTokens + outputTokens };
}

export function estimateCostUsd(
  usage: CyborgTokenUsage,
  pricing?: { inputUsdPerMillion?: number; outputUsdPerMillion?: number },
): number {
  if (!pricing) return 0;
  const input = Math.max(0, pricing.inputUsdPerMillion ?? 0) * usage.inputTokens / 1_000_000;
  const output = Math.max(0, pricing.outputUsdPerMillion ?? 0) * usage.outputTokens / 1_000_000;
  return input + output;
}

function emptyUsage(): CyborgEconomicUsage {
  return { modelCalls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0, deterministicHits: 0, cacheHits: 0 };
}

export class CyborgEconomicLedger {
  private readonly usage = new Map<string, CyborgEconomicUsage>();

  snapshot(missionId: string): CyborgEconomicUsage {
    return { ...(this.usage.get(missionId) ?? emptyUsage()) };
  }

  preflight(missionId: string, estimatedInput: number, maxOutput: number, budget: CyborgEconomicBudget): void {
    const current = this.snapshot(missionId);
    const projectedTokens = current.totalTokens + Math.max(0, estimatedInput) + Math.max(0, maxOutput);
    if (current.modelCalls + 1 > budget.maxModelCalls) throw new Error(`${CYBORG_ECONOMIC_BLOCK}:MODEL_CALL_BUDGET`);
    if (projectedTokens > budget.maxTotalTokens) throw new Error(`${CYBORG_ECONOMIC_BLOCK}:TOKEN_BUDGET`);
    if (current.costUsd >= budget.maxCostUsd) throw new Error(`${CYBORG_ECONOMIC_BLOCK}:COST_BUDGET`);
  }

  recordModel(missionId: string, usage: CyborgTokenUsage, costUsd: number): CyborgEconomicUsage {
    const current = this.snapshot(missionId);
    const next = {
      ...current,
      modelCalls: current.modelCalls + 1,
      inputTokens: current.inputTokens + usage.inputTokens,
      outputTokens: current.outputTokens + usage.outputTokens,
      totalTokens: current.totalTokens + usage.totalTokens,
      costUsd: current.costUsd + Math.max(0, costUsd),
    };
    this.usage.set(missionId, next);
    return { ...next };
  }

  recordDeterministic(missionId: string): CyborgEconomicUsage {
    const current = this.snapshot(missionId);
    const next = { ...current, deterministicHits: current.deterministicHits + 1 };
    this.usage.set(missionId, next);
    return { ...next };
  }

  recordCache(missionId: string): CyborgEconomicUsage {
    const current = this.snapshot(missionId);
    const next = { ...current, cacheHits: current.cacheHits + 1 };
    this.usage.set(missionId, next);
    return { ...next };
  }
}

export class CyborgExactResponseCache<T> {
  private readonly values = new Map<string, T>();

  private key(scopeSha: string, key: string): string {
    if (!scopeSha.trim()) throw new Error('CYBORG_CACHE_SCOPE_SHA_REQUIRED');
    return `${scopeSha}:${key}`;
  }

  get(scopeSha: string, key: string): T | undefined {
    return this.values.get(this.key(scopeSha, key));
  }

  set(scopeSha: string, key: string, value: T): void {
    this.values.set(this.key(scopeSha, key), value);
  }
}

export function assertOptimizationAllowed(
  taskClass: CyborgTaskClass,
  mode: 'deterministic' | 'cache',
): void {
  if (isCriticalTask(taskClass)) throw new Error(`CYBORG_ASSURANCE_BYPASS_DENIED:${taskClass}:${mode}`);
  if (mode === 'deterministic' && taskClass !== 'deterministic') {
    throw new Error(`CYBORG_DETERMINISTIC_RESULT_NOT_AUTHORIZED:${taskClass}`);
  }
}
