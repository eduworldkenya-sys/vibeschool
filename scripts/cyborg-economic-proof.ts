import {
  assertOptimizationAllowed,
  CyborgEconomicLedger,
  CyborgExactResponseCache,
  estimateInputTokens,
  modelTierForTask,
  normalizeUsage,
} from '../lib/cyborg/economics';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CYBORG_ECONOMIC_PROOF_FAILED:${message}`);
}

function expectThrow(fn: () => unknown, includes: string): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.includes(includes), `expected ${includes}, got ${message}`);
    return;
  }
  throw new Error(`CYBORG_ECONOMIC_PROOF_FAILED:expected throw ${includes}`);
}

assert(modelTierForTask('classification') === 'cheap', 'classification must route cheap');
assert(modelTierForTask('standard') === 'standard', 'standard task tier');
assert(modelTierForTask('certification') === 'critical', 'certification must route critical');
assert(modelTierForTask('adversarial_review') === 'critical', 'adversarial review must route critical');

assertOptimizationAllowed('deterministic', 'deterministic');
expectThrow(() => assertOptimizationAllowed('standard', 'deterministic'), 'CYBORG_DETERMINISTIC_RESULT_NOT_AUTHORIZED');
expectThrow(() => assertOptimizationAllowed('certification', 'cache'), 'CYBORG_ASSURANCE_BYPASS_DENIED');
expectThrow(() => assertOptimizationAllowed('security_review', 'deterministic'), 'CYBORG_ASSURANCE_BYPASS_DENIED');

const cache = new CyborgExactResponseCache<string>();
cache.set('abc123', 'same-directive', 'cached-result');
assert(cache.get('abc123', 'same-directive') === 'cached-result', 'exact cache hit');
assert(cache.get('def456', 'same-directive') === undefined, 'cache must invalidate across SHA scope');
expectThrow(() => cache.get('', 'same-directive'), 'CYBORG_CACHE_SCOPE_SHA_REQUIRED');

const usage = normalizeUsage({ input_tokens: 120, output_tokens: 30 });
assert(usage.inputTokens === 120 && usage.outputTokens === 30 && usage.totalTokens === 150, 'provider usage normalization');
assert(estimateInputTokens([{ role: 'user', content: 'classify this' }]) > 0, 'input token estimate');

const ledger = new CyborgEconomicLedger();
ledger.preflight('mission-1', 100, 50, { maxTotalTokens: 200, maxModelCalls: 1, maxCostUsd: 1 });
ledger.recordModel('mission-1', { inputTokens: 100, outputTokens: 50, totalTokens: 150 }, 0.25);
expectThrow(
  () => ledger.preflight('mission-1', 1, 1, { maxTotalTokens: 200, maxModelCalls: 1, maxCostUsd: 1 }),
  'BLOCKED_ECONOMIC:MODEL_CALL_BUDGET',
);

const deterministic = ledger.recordDeterministic('mission-2');
assert(deterministic.modelCalls === 0 && deterministic.deterministicHits === 1, 'deterministic path must consume zero model calls');
const cacheHit = ledger.recordCache('mission-2');
assert(cacheHit.modelCalls === 0 && cacheHit.cacheHits === 1, 'cache path must consume zero model calls');

console.log('CYBORG_ECONOMIC_EXECUTION_PROOF_PASS');
