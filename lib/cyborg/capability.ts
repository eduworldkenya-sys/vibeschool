export const CYBORG_CAPABILITY_VERSION = 'cyb1';
export const CYBORG_POLICY_VERSION = 'cyborg-boundary-v1';
export const CYBORG_CAPABILITY_REQUIRED = 'CYBORG_CAPABILITY_REQUIRED';
export const CYBORG_CAPABILITY_INVALID = 'CYBORG_CAPABILITY_INVALID';
export const CYBORG_CAPABILITY_EXPIRED = 'CYBORG_CAPABILITY_EXPIRED';
export const CYBORG_CAPABILITY_NOT_YET_VALID = 'CYBORG_CAPABILITY_NOT_YET_VALID';
export const CYBORG_CAPABILITY_REPLAYED = 'CYBORG_CAPABILITY_REPLAYED';
export const CYBORG_CAPABILITY_MISSION_MISMATCH = 'CYBORG_CAPABILITY_MISSION_MISMATCH';
export const CYBORG_CAPABILITY_CHAT_MISMATCH = 'CYBORG_CAPABILITY_CHAT_MISMATCH';
export const CYBORG_CAPABILITY_CALLER_MISMATCH = 'CYBORG_CAPABILITY_CALLER_MISMATCH';
export const CYBORG_CAPABILITY_PROVIDER_MISMATCH = 'CYBORG_CAPABILITY_PROVIDER_MISMATCH';
export const CYBORG_CAPABILITY_MODEL_MISMATCH = 'CYBORG_CAPABILITY_MODEL_MISMATCH';
export const CYBORG_CAPABILITY_OPERATION_MISMATCH = 'CYBORG_CAPABILITY_OPERATION_MISMATCH';
export const CYBORG_CAPABILITY_POLICY_MISMATCH = 'CYBORG_CAPABILITY_POLICY_MISMATCH';
export const CYBORG_CAPABILITY_REQUEST_MISMATCH = 'CYBORG_CAPABILITY_REQUEST_MISMATCH';
export const CYBORG_CAPABILITY_TOKEN_BUDGET_EXCEEDED = 'CYBORG_CAPABILITY_TOKEN_BUDGET_EXCEEDED';

export type CyborgDataClassification = 'public' | 'internal' | 'confidential' | 'restricted';
export type CyborgInvocationRisk = 'read' | 'local_mutation' | 'remote_mutation' | 'production_mutation' | 'owner_only';

export interface CyborgCapabilityClaims {
  version: typeof CYBORG_CAPABILITY_VERSION;
  missionId: string;
  missionRevision: string;
  chatId: string;
  invocationId: string;
  callerServiceId: string;
  provider: string;
  model: string;
  operation: string;
  requestHash: string;
  riskClass: CyborgInvocationRisk;
  authorityScope: string[];
  maxTokens: number;
  toolScope: string[];
  dataClassification: CyborgDataClassification;
  parentInvocationId?: string;
  policyVersion: string;
  issuedAt: number;
  notBefore: number;
  expiresAt: number;
  nonce: string;
}

export interface CyborgCapabilityExpectation {
  missionId: string;
  chatId: string;
  callerServiceId: string;
  provider: string;
  model: string;
  operation: string;
  requestHash: string;
  requestedMaxTokens: number;
  policyVersion?: string;
  nowEpochSeconds?: number;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  let binary: string;
  try { binary = atob(padded); } catch { throw new Error(CYBORG_CAPABILITY_INVALID); }
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
async function importHmacKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  if (!secret || secret.length < 32) throw new Error('CYBORG_CAPABILITY_SIGNING_KEY_WEAK');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usage);
}
function validateClaimsShape(value: unknown): CyborgCapabilityClaims {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(CYBORG_CAPABILITY_INVALID);
  const row = value as Record<string, unknown>;
  const requiredStrings = ['missionId','missionRevision','chatId','invocationId','callerServiceId','provider','model','operation','requestHash','riskClass','dataClassification','policyVersion','nonce'] as const;
  for (const field of requiredStrings) if (typeof row[field] !== 'string' || !(row[field] as string).trim()) throw new Error(CYBORG_CAPABILITY_INVALID);
  for (const field of ['issuedAt','notBefore','expiresAt','maxTokens'] as const) if (typeof row[field] !== 'number' || !Number.isFinite(row[field] as number)) throw new Error(CYBORG_CAPABILITY_INVALID);
  if (row.version !== CYBORG_CAPABILITY_VERSION) throw new Error(CYBORG_CAPABILITY_INVALID);
  if (!Array.isArray(row.authorityScope) || !row.authorityScope.every((item) => typeof item === 'string')) throw new Error(CYBORG_CAPABILITY_INVALID);
  if (!Array.isArray(row.toolScope) || !row.toolScope.every((item) => typeof item === 'string')) throw new Error(CYBORG_CAPABILITY_INVALID);
  if (row.parentInvocationId !== undefined && typeof row.parentInvocationId !== 'string') throw new Error(CYBORG_CAPABILITY_INVALID);
  return row as unknown as CyborgCapabilityClaims;
}
export async function hashCyborgValue(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return toBase64Url(digest);
}
export async function hashCyborgModelRequest(input: {callerServiceId:string;provider:string;model:string;operation:string;maxTokens:number;messages:unknown[];metadata?:Record<string,unknown>}): Promise<string> {
  return hashCyborgValue(JSON.stringify({callerServiceId:input.callerServiceId,provider:input.provider,model:input.model,operation:input.operation,maxTokens:input.maxTokens,messages:input.messages,metadata:input.metadata??{}}));
}
export async function signCyborgCapability(claims: CyborgCapabilityClaims, secret: string): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify(claims)));
  const key = await importHmacKey(secret, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return `${CYBORG_CAPABILITY_VERSION}.${payload}.${toBase64Url(signature)}`;
}
export async function verifyCyborgCapability(token: string, secret: string, expected: CyborgCapabilityExpectation): Promise<CyborgCapabilityClaims> {
  if (!token?.trim()) throw new Error(CYBORG_CAPABILITY_REQUIRED);
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== CYBORG_CAPABILITY_VERSION) throw new Error(CYBORG_CAPABILITY_INVALID);
  const [, payload, encodedSignature] = parts;
  const key = await importHmacKey(secret, ['verify']);
  const valid = await crypto.subtle.verify('HMAC', key, fromBase64Url(encodedSignature), encoder.encode(payload));
  if (!valid) throw new Error(CYBORG_CAPABILITY_INVALID);
  let decoded: unknown;
  try { decoded = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))); } catch { throw new Error(CYBORG_CAPABILITY_INVALID); }
  const claims = validateClaimsShape(decoded);
  const now = expected.nowEpochSeconds ?? Math.floor(Date.now() / 1000);
  if (claims.notBefore > now) throw new Error(CYBORG_CAPABILITY_NOT_YET_VALID);
  if (claims.expiresAt <= now) throw new Error(CYBORG_CAPABILITY_EXPIRED);
  if (claims.missionId !== expected.missionId) throw new Error(CYBORG_CAPABILITY_MISSION_MISMATCH);
  if (claims.chatId !== expected.chatId) throw new Error(CYBORG_CAPABILITY_CHAT_MISMATCH);
  if (claims.callerServiceId !== expected.callerServiceId) throw new Error(CYBORG_CAPABILITY_CALLER_MISMATCH);
  if (claims.provider !== expected.provider) throw new Error(CYBORG_CAPABILITY_PROVIDER_MISMATCH);
  if (claims.model !== expected.model) throw new Error(CYBORG_CAPABILITY_MODEL_MISMATCH);
  if (claims.operation !== expected.operation) throw new Error(CYBORG_CAPABILITY_OPERATION_MISMATCH);
  if (claims.requestHash !== expected.requestHash) throw new Error(CYBORG_CAPABILITY_REQUEST_MISMATCH);
  if (claims.policyVersion !== (expected.policyVersion ?? CYBORG_POLICY_VERSION)) throw new Error(CYBORG_CAPABILITY_POLICY_MISMATCH);
  if (expected.requestedMaxTokens > claims.maxTokens) throw new Error(CYBORG_CAPABILITY_TOKEN_BUDGET_EXCEEDED);
  return claims;
}
