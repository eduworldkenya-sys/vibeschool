import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';

export const CYBORG_CAPABILITY_VERSION = 'v1';
export const CYBORG_CAPABILITY_TTL_SECONDS = 90;

export interface CyborgCapabilityClaims {
  v: typeof CYBORG_CAPABILITY_VERSION;
  jti: string;
  missionId: string;
  conversationId?: string;
  provider: string;
  model: string;
  operation: 'model.invoke';
  issuedAt: number;
  expiresAt: number;
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}
function signature(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}
function requireSecret(secret?: string): string {
  if (!secret || secret.length < 32) throw new Error('CYBORG_CAPABILITY_SECRET_REQUIRED');
  return secret;
}

export function issueCyborgCapability(input: {
  secret?: string;
  missionId: string;
  conversationId?: string;
  provider: string;
  model: string;
  nowMs?: number;
  ttlSeconds?: number;
}): string {
  const secret = requireSecret(input.secret);
  if (!input.missionId.trim()) throw new Error('CYBORG_MISSION_REQUIRED');
  const issuedAt = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const ttl = Math.min(Math.max(input.ttlSeconds ?? CYBORG_CAPABILITY_TTL_SECONDS, 1), 300);
  const claims: CyborgCapabilityClaims = {
    v: CYBORG_CAPABILITY_VERSION,
    jti: randomUUID(),
    missionId: input.missionId,
    conversationId: input.conversationId,
    provider: input.provider,
    model: input.model,
    operation: 'model.invoke',
    issuedAt,
    expiresAt: issuedAt + ttl,
  };
  const payload = encode(JSON.stringify(claims));
  return `${payload}.${signature(secret, payload)}`;
}

export function verifyCyborgCapability(input: {
  secret?: string;
  token?: string;
  missionId: string;
  provider: string;
  model: string;
  nowMs?: number;
}): CyborgCapabilityClaims {
  const secret = requireSecret(input.secret);
  if (!input.token) throw new Error('CYBORG_CAPABILITY_REQUIRED');
  const [payload, suppliedSignature, extra] = input.token.split('.');
  if (!payload || !suppliedSignature || extra) throw new Error('CYBORG_CAPABILITY_INVALID');
  const expected = Buffer.from(signature(secret, payload));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error('CYBORG_CAPABILITY_INVALID');
  let claims: CyborgCapabilityClaims;
  try { claims = JSON.parse(decode(payload)) as CyborgCapabilityClaims; } catch { throw new Error('CYBORG_CAPABILITY_INVALID'); }
  const now = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (claims.v !== CYBORG_CAPABILITY_VERSION || claims.operation !== 'model.invoke') throw new Error('CYBORG_CAPABILITY_INVALID');
  if (claims.expiresAt <= now || claims.issuedAt > now + 5) throw new Error('CYBORG_CAPABILITY_EXPIRED');
  if (claims.missionId !== input.missionId) throw new Error('CYBORG_CAPABILITY_MISSION_MISMATCH');
  if (claims.provider !== input.provider) throw new Error('CYBORG_CAPABILITY_PROVIDER_MISMATCH');
  if (claims.model !== input.model) throw new Error('CYBORG_CAPABILITY_MODEL_MISMATCH');
  return claims;
}
