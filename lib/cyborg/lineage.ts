import { hashCyborgValue } from './capability';

export const CYBORG_LINEAGE_REQUIRED = 'CYBORG_LINEAGE_REQUIRED';
export const CYBORG_LINEAGE_HASH_MISMATCH = 'CYBORG_LINEAGE_HASH_MISMATCH';
export const CYBORG_RESPONSE_NOT_ADMITTED = 'CYBORG_RESPONSE_NOT_ADMITTED';

export type CyborgPolicyDecision = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL' | 'REQUIRE_REPLAN' | 'REQUIRE_REDACTION' | 'REQUIRE_STRONGER_MODEL';

export interface CyborgInvocationLineage {
  invocationId: string;
  missionId: string;
  missionRevision: string;
  chatId: string;
  rootMissionId: string;
  parentInvocationId?: string;
  cycle?: number;
  planStep?: string;
  callerServiceId: string;
  provider: string;
  model: string;
  operation: string;
  requestHash: string;
  responseHash: string;
  capabilityHash: string;
  policyDecision: CyborgPolicyDecision;
  policyDecisionHash: string;
  previousReceiptHash?: string;
  receiptHash: string;
  startedAt: string;
  completedAt: string;
  lineageVerified: true;
}

export interface CyborgAdmittedResponse<T = unknown> {
  output: T;
  lineage: CyborgInvocationLineage;
}

export async function createCyborgReceiptHash(input: Omit<CyborgInvocationLineage, 'receiptHash' | 'lineageVerified'>): Promise<string> {
  return hashCyborgValue(JSON.stringify({
    invocationId: input.invocationId,
    missionId: input.missionId,
    missionRevision: input.missionRevision,
    chatId: input.chatId,
    rootMissionId: input.rootMissionId,
    parentInvocationId: input.parentInvocationId ?? null,
    cycle: input.cycle ?? null,
    planStep: input.planStep ?? null,
    callerServiceId: input.callerServiceId,
    provider: input.provider,
    model: input.model,
    operation: input.operation,
    requestHash: input.requestHash,
    responseHash: input.responseHash,
    capabilityHash: input.capabilityHash,
    policyDecision: input.policyDecision,
    policyDecisionHash: input.policyDecisionHash,
    previousReceiptHash: input.previousReceiptHash ?? null,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  }));
}

export async function assertCyborgResponseAdmission<T>(response: CyborgAdmittedResponse<T>): Promise<CyborgAdmittedResponse<T>> {
  if (!response?.lineage || response.lineage.lineageVerified !== true) throw new Error(CYBORG_LINEAGE_REQUIRED);
  if (response.lineage.policyDecision !== 'ALLOW') throw new Error(CYBORG_RESPONSE_NOT_ADMITTED);
  const { receiptHash, lineageVerified: _verified, ...unsigned } = response.lineage;
  const expectedHash = await createCyborgReceiptHash(unsigned);
  if (expectedHash !== receiptHash) throw new Error(CYBORG_LINEAGE_HASH_MISMATCH);
  return response;
}
