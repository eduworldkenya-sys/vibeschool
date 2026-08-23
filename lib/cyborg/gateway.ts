import { CyborgMission } from './contracts';
import { CyborgRuntime } from './runtime';
import {
  assertOptimizationAllowed,
  CyborgEconomicBudget,
  CyborgEconomicLedger,
  CyborgEconomicUsage,
  CyborgExactResponseCache,
  CyborgTaskClass,
  DEFAULT_CYBORG_ECONOMIC_BUDGET,
  estimateCostUsd,
  estimateInputTokens,
  isCriticalTask,
  modelTierForTask,
  normalizeUsage,
} from './economics';

export const CYBORG_GATEWAY_ID = 'vibeschool.cyborg.universal-llm-gateway.v1';
export const NO_DIRECT_LLM_CALLS = 'NO_DIRECT_LLM_CALLS';
export const PREMATURE_MISSION_RETURN = 'PREMATURE_MISSION_RETURN';

export type LlmProvider = 'openai' | 'anthropic' | 'google' | 'local' | (string & {});

export interface CyborgModelRequest {
  provider: LlmProvider;
  model: string;
  missionId: string;
  messages: unknown[];
  metadata?: Record<string, unknown>;
}

export interface CyborgModelResponse {
  provider: LlmProvider;
  model: string;
  output: unknown;
  usage?: Record<string, number>;
  execution?: 'deterministic' | 'cache' | 'model';
  economic?: CyborgEconomicUsage & { recommendedModelTier: ReturnType<typeof modelTierForTask> };
}

export interface CyborgModelAdapter {
  readonly provider: LlmProvider;
  invoke(request: CyborgModelRequest): Promise<CyborgModelResponse>;
}

export interface MissionIntake {
  createOrResume(input: { objective: string; conversationId?: string; requestedProvider?: LlmProvider }): Promise<CyborgMission>;
}

function taskClassOf(metadata?: Record<string, unknown>): CyborgTaskClass {
  const value = metadata?.taskClass;
  if (
    value === 'deterministic' || value === 'classification' || value === 'routing' || value === 'standard' ||
    value === 'repair' || value === 'certification' || value === 'adversarial_review' || value === 'security_review'
  ) return value;
  return 'standard';
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function budgetOf(metadata?: Record<string, unknown>): CyborgEconomicBudget {
  const raw = metadata?.economicBudget;
  if (!raw || typeof raw !== 'object') return DEFAULT_CYBORG_ECONOMIC_BUDGET;
  const value = raw as Record<string, unknown>;
  return {
    maxTotalTokens: finiteNumber(value.maxTotalTokens, DEFAULT_CYBORG_ECONOMIC_BUDGET.maxTotalTokens),
    maxModelCalls: Math.max(1, Math.trunc(finiteNumber(value.maxModelCalls, DEFAULT_CYBORG_ECONOMIC_BUDGET.maxModelCalls))),
    maxCostUsd: finiteNumber(value.maxCostUsd, DEFAULT_CYBORG_ECONOMIC_BUDGET.maxCostUsd),
  };
}

function pricingOf(metadata?: Record<string, unknown>): { inputUsdPerMillion?: number; outputUsdPerMillion?: number } | undefined {
  const raw = metadata?.pricing;
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  return {
    inputUsdPerMillion: finiteNumber(value.inputUsdPerMillion, 0),
    outputUsdPerMillion: finiteNumber(value.outputUsdPerMillion, 0),
  };
}

function withEconomic(
  response: CyborgModelResponse,
  usage: CyborgEconomicUsage,
  taskClass: CyborgTaskClass,
  execution: 'deterministic' | 'cache' | 'model',
): CyborgModelResponse {
  return { ...response, execution, economic: { ...usage, recommendedModelTier: modelTierForTask(taskClass) } };
}

export async function invokeCyborgModel(adapter: CyborgModelAdapter, request: CyborgModelRequest): Promise<CyborgModelResponse> {
  if (!request.missionId?.trim()) throw new Error('CYBORG_MISSION_REQUIRED');
  if (adapter.provider !== request.provider) throw new Error(`CYBORG_PROVIDER_MISMATCH:${request.provider}`);
  return adapter.invoke(request);
}

export function createAnthropicMessagesAdapter(apiKey: string): CyborgModelAdapter {
  if (!apiKey) throw new Error('CYBORG_PROVIDER_CREDENTIAL_REQUIRED:anthropic');
  return {
    provider: 'anthropic',
    async invoke(request) {
      const maxTokens = typeof request.metadata?.maxTokens === 'number' ? request.metadata.maxTokens : 1024;
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: request.model, max_tokens: maxTokens, messages: request.messages }),
      });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(`CYBORG_PROVIDER_FAILURE:anthropic:${response.status}`);
      const rawUsage = payload.usage && typeof payload.usage === 'object' ? payload.usage as Record<string, unknown> : {};
      const inputTokens = finiteNumber(rawUsage.input_tokens, 0);
      const outputTokens = finiteNumber(rawUsage.output_tokens, 0);
      return {
        provider: 'anthropic',
        model: request.model,
        output: payload,
        usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      };
    },
  };
}

export class CyborgUniversalGateway {
  constructor(
    private readonly intake: MissionIntake,
    private readonly runtime: CyborgRuntime,
    private readonly adapters: Map<LlmProvider, CyborgModelAdapter>,
    private readonly economics: CyborgEconomicLedger = new CyborgEconomicLedger(),
    private readonly exactCache: CyborgExactResponseCache<CyborgModelResponse> = new CyborgExactResponseCache<CyborgModelResponse>(),
  ) {}

  async start(input: { objective: string; conversationId?: string; requestedProvider?: LlmProvider }): Promise<CyborgMission> {
    const mission = await this.intake.createOrResume(input);
    return this.runtime.run(mission.id);
  }

  getMissionEconomics(missionId: string): CyborgEconomicUsage {
    return this.economics.snapshot(missionId);
  }

  async invokeModel(request: CyborgModelRequest): Promise<CyborgModelResponse> {
    if (!request.missionId?.trim()) throw new Error('CYBORG_MISSION_REQUIRED');
    const metadata = request.metadata ?? {};
    const taskClass = taskClassOf(metadata);

    if (Object.prototype.hasOwnProperty.call(metadata, 'deterministicResult')) {
      assertOptimizationAllowed(taskClass, 'deterministic');
      const usage = this.economics.recordDeterministic(request.missionId);
      return withEconomic({ provider: request.provider, model: request.model, output: metadata.deterministicResult, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }, usage, taskClass, 'deterministic');
    }

    const cacheable = metadata.cacheable === true;
    const cacheKey = typeof metadata.exactCacheKey === 'string' ? metadata.exactCacheKey : undefined;
    const cacheScopeSha = typeof metadata.cacheScopeSha === 'string' ? metadata.cacheScopeSha : undefined;
    if (cacheable) {
      assertOptimizationAllowed(taskClass, 'cache');
      if (!cacheKey || !cacheScopeSha) throw new Error('CYBORG_EXACT_CACHE_KEY_AND_SCOPE_REQUIRED');
      const cached = this.exactCache.get(cacheScopeSha, `${request.provider}:${request.model}:${cacheKey}`);
      if (cached) {
        const usage = this.economics.recordCache(request.missionId);
        return withEconomic(cached, usage, taskClass, 'cache');
      }
    }

    const adapter = this.adapters.get(request.provider);
    if (!adapter) throw new Error(`CYBORG_PROVIDER_NOT_REGISTERED:${request.provider}`);

    const budget = budgetOf(metadata);
    const estimatedInput = Math.trunc(finiteNumber(metadata.estimatedInputTokens, estimateInputTokens(request.messages)));
    const maxOutput = Math.trunc(finiteNumber(metadata.maxTokens, 1024));
    this.economics.preflight(request.missionId, estimatedInput, maxOutput, budget);

    const response = await invokeCyborgModel(adapter, request);
    let normalized = normalizeUsage(response.usage);
    if (normalized.totalTokens === 0) normalized = { inputTokens: estimatedInput, outputTokens: 0, totalTokens: estimatedInput };
    const costUsd = estimateCostUsd(normalized, pricingOf(metadata));
    const economic = this.economics.recordModel(request.missionId, normalized, costUsd);

    if (economic.totalTokens > budget.maxTotalTokens) throw new Error('BLOCKED_ECONOMIC:TOKEN_BUDGET');
    if (economic.modelCalls > budget.maxModelCalls) throw new Error('BLOCKED_ECONOMIC:MODEL_CALL_BUDGET');
    if (economic.costUsd > budget.maxCostUsd) throw new Error('BLOCKED_ECONOMIC:COST_BUDGET');

    const governed = withEconomic(response, economic, taskClass, 'model');
    if (cacheable && cacheKey && cacheScopeSha && !isCriticalTask(taskClass)) {
      this.exactCache.set(cacheScopeSha, `${request.provider}:${request.model}:${cacheKey}`, governed);
    }
    return governed;
  }

  assertReturnAllowed(mission: CyborgMission): void {
    if (!['complete', 'blocked', 'aborted'].includes(mission.state)) {
      throw new Error(PREMATURE_MISSION_RETURN);
    }
  }
}

/** Canonical entrypoint for governed VibeSchool AI work. */
export async function runCyborgMission(
  gateway: CyborgUniversalGateway,
  input: { objective: string; conversationId?: string; requestedProvider?: LlmProvider },
): Promise<CyborgMission> {
  const mission = await gateway.start(input);
  gateway.assertReturnAllowed(mission);
  return mission;
}
