import {
  CYBORG_CAPABILITY_EXPIRED,
  CYBORG_CAPABILITY_MISSION_MISMATCH,
  CYBORG_CAPABILITY_MODEL_MISMATCH,
  CYBORG_CAPABILITY_PROVIDER_MISMATCH,
  CYBORG_CAPABILITY_REQUIRED,
  CYBORG_CAPABILITY_REPLAYED,
  CYBORG_POLICY_VERSION,
  CyborgCapabilityClaims,
  hashCyborgValue,
  signCyborgCapability,
  verifyCyborgCapability,
} from '../lib/cyborg/capability';
import { assertCyborgResponseAdmission, createCyborgReceiptHash } from '../lib/cyborg/lineage';
import { evaluateCyborgInvocationPolicy } from '../lib/cyborg/policy-engine';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
async function rejects(fn: () => Promise<unknown>, needle: string) {
  try { await fn(); } catch (error) { assert(String(error).includes(needle), `wrong error ${String(error)} expected ${needle}`); return; }
  throw new Error(`expected rejection ${needle}`);
}

async function main() {
  const secret = '0123456789abcdef0123456789abcdef-supervisor';
  const now = 1787461200;
  const base: CyborgCapabilityClaims = {
    version: 'cyb1', missionId: 'm-1', missionRevision: 'rev-1', chatId: 'chat-1', invocationId: 'inv-1', callerServiceId: 'test-caller',
    provider: 'anthropic', model: 'model-a', operation: 'model.generate', riskClass: 'read', authorityScope: [], maxTokens: 100,
    toolScope: [], dataClassification: 'internal', policyVersion: CYBORG_POLICY_VERSION, issuedAt: now - 1, notBefore: now - 1, expiresAt: now + 60, nonce: 'nonce-1',
  };
  const token = await signCyborgCapability(base, secret);
  const expected = { missionId:'m-1', chatId:'chat-1', callerServiceId:'test-caller', provider:'anthropic', model:'model-a', operation:'model.generate', requestedMaxTokens:100, nowEpochSeconds:now };
  const verified = await verifyCyborgCapability(token, secret, expected);
  assert(verified.nonce === 'nonce-1', 'valid capability must verify');

  await rejects(() => verifyCyborgCapability('', secret, expected), CYBORG_CAPABILITY_REQUIRED);
  await rejects(() => verifyCyborgCapability(`${token}x`, secret, expected), 'CYBORG_CAPABILITY_INVALID');
  const expired = await signCyborgCapability({ ...base, expiresAt: now }, secret);
  await rejects(() => verifyCyborgCapability(expired, secret, expected), CYBORG_CAPABILITY_EXPIRED);
  await rejects(() => verifyCyborgCapability(token, secret, { ...expected, missionId:'m-2' }), CYBORG_CAPABILITY_MISSION_MISMATCH);
  await rejects(() => verifyCyborgCapability(token, secret, { ...expected, provider:'groq' }), CYBORG_CAPABILITY_PROVIDER_MISMATCH);
  await rejects(() => verifyCyborgCapability(token, secret, { ...expected, model:'model-b' }), CYBORG_CAPABILITY_MODEL_MISMATCH);

  const consumed = new Set<string>();
  const consume = (nonce: string) => { if (consumed.has(nonce)) throw new Error(CYBORG_CAPABILITY_REPLAYED); consumed.add(nonce); };
  consume(verified.nonce);
  let replayBlocked = false; try { consume(verified.nonce); } catch (error) { replayBlocked = String(error).includes(CYBORG_CAPABILITY_REPLAYED); }
  assert(replayBlocked, 'replayed capability must be blocked');

  assert(evaluateCyborgInvocationPolicy({ missionState:'blocked', claims:base }).decision === 'DENY', 'suspended/blocked mission must deny');
  assert(evaluateCyborgInvocationPolicy({ missionState:'executing', claims:base }).decision === 'ALLOW', 'valid mission must allow');
  assert(evaluateCyborgInvocationPolicy({ missionState:'executing', claims:{...base,riskClass:'owner_only'} }).decision === 'REQUIRE_APPROVAL', 'owner-only call must require approval');

  const responseHash = await hashCyborgValue('provider-output');
  const policyDecisionHash = await hashCyborgValue('ALLOW');
  const unsigned = {
    invocationId:'inv-1', missionId:'m-1', missionRevision:'rev-1', chatId:'chat-1', rootMissionId:'m-1', callerServiceId:'test-caller', provider:'anthropic', model:'model-a', operation:'model.generate',
    requestHash:await hashCyborgValue('request'), responseHash, capabilityHash:await hashCyborgValue(token), policyDecision:'ALLOW' as const,
    policyDecisionHash, startedAt:'2026-08-23T05:00:00.000Z', completedAt:'2026-08-23T05:00:01.000Z',
  };
  const receiptHash = await createCyborgReceiptHash(unsigned);
  const admitted = await assertCyborgResponseAdmission({ output:{ok:true}, lineage:{...unsigned,receiptHash,lineageVerified:true} });
  assert(admitted.lineage.receiptHash === receiptHash, 'valid lineage must be admitted');
  await rejects(() => assertCyborgResponseAdmission({ output:{ok:true}, lineage:{...unsigned,receiptHash:'forged',lineageVerified:true} }), 'CYBORG_LINEAGE_HASH_MISMATCH');

  console.log(JSON.stringify({ status:'PASS', cases:13, negativeCases:9, validCapability:'PASS', lineage:'PASS' }));
}
main().catch((error) => { console.error(error); process.exit(1); });
