export const CYBORG_CAPABILITY_VERSION = 'cyb1'
export const CYBORG_POLICY_VERSION = 'cyborg-boundary-v1'

export type CapabilityClaims = {
  version: 'cyb1'
  missionId: string
  missionRevision: string
  chatId: string
  invocationId: string
  callerServiceId: string
  provider: string
  model: string
  operation: string
  riskClass: 'read' | 'local_mutation' | 'remote_mutation' | 'production_mutation' | 'owner_only'
  authorityScope: string[]
  maxTokens: number
  toolScope: string[]
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted'
  parentInvocationId?: string
  policyVersion: string
  issuedAt: number
  notBefore: number
  expiresAt: number
  nonce: string
}

const encoder = new TextEncoder()
function b64(bytes: Uint8Array) { let s=''; for (const b of bytes) s+=String.fromCharCode(b); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'') }
function unb64(value:string) { const n=value.replace(/-/g,'+').replace(/_/g,'/'); const p=n+'='.repeat((4-n.length%4)%4); return Uint8Array.from(atob(p), c=>c.charCodeAt(0)) }
async function key(secret:string, usages:KeyUsage[]) { if (secret.length < 32) throw new Error('CYBORG_CAPABILITY_SIGNING_KEY_WEAK'); return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,usages) }

export async function hashValue(value:string) { return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))) }
export async function signCapability(claims:CapabilityClaims, secret:string) { const payload=b64(encoder.encode(JSON.stringify(claims))); const signature=new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret,['sign']),encoder.encode(payload))); return `${CYBORG_CAPABILITY_VERSION}.${payload}.${b64(signature)}` }

export async function verifyCapability(token:string, secret:string, expected:{missionId:string;missionRevision:string;chatId:string;invocationId:string;callerServiceId:string;provider:string;model:string;operation:string;maxTokens:number}) {
  if (!token) throw new Error('CYBORG_CAPABILITY_REQUIRED')
  const parts=token.split('.'); if(parts.length!==3||parts[0]!==CYBORG_CAPABILITY_VERSION) throw new Error('CYBORG_CAPABILITY_INVALID')
  const valid=await crypto.subtle.verify('HMAC',await key(secret,['verify']),unb64(parts[2]),encoder.encode(parts[1])); if(!valid) throw new Error('CYBORG_CAPABILITY_INVALID')
  let claims:CapabilityClaims; try { claims=JSON.parse(new TextDecoder().decode(unb64(parts[1]))) } catch { throw new Error('CYBORG_CAPABILITY_INVALID') }
  const now=Math.floor(Date.now()/1000)
  if(claims.version!==CYBORG_CAPABILITY_VERSION) throw new Error('CYBORG_CAPABILITY_INVALID')
  if(claims.notBefore>now) throw new Error('CYBORG_CAPABILITY_NOT_YET_VALID')
  if(claims.expiresAt<=now) throw new Error('CYBORG_CAPABILITY_EXPIRED')
  if(claims.missionId!==expected.missionId) throw new Error('CYBORG_CAPABILITY_MISSION_MISMATCH')
  if(claims.missionRevision!==expected.missionRevision) throw new Error('CYBORG_CAPABILITY_REVISION_MISMATCH')
  if(claims.chatId!==expected.chatId||claims.invocationId!==expected.invocationId) throw new Error('CYBORG_CAPABILITY_CHAT_MISMATCH')
  if(claims.callerServiceId!==expected.callerServiceId) throw new Error('CYBORG_CAPABILITY_CALLER_MISMATCH')
  if(claims.provider!==expected.provider) throw new Error('CYBORG_CAPABILITY_PROVIDER_MISMATCH')
  if(claims.model!==expected.model) throw new Error('CYBORG_CAPABILITY_MODEL_MISMATCH')
  if(claims.operation!==expected.operation) throw new Error('CYBORG_CAPABILITY_OPERATION_MISMATCH')
  if(claims.policyVersion!==CYBORG_POLICY_VERSION) throw new Error('CYBORG_CAPABILITY_POLICY_MISMATCH')
  if(expected.maxTokens>claims.maxTokens) throw new Error('CYBORG_CAPABILITY_TOKEN_BUDGET_EXCEEDED')
  return claims
}

export async function receiptHash(input:Record<string,unknown>) {
  return hashValue(JSON.stringify({
    invocationId:input.invocationId,missionId:input.missionId,missionRevision:input.missionRevision,chatId:input.chatId,rootMissionId:input.rootMissionId,
    parentInvocationId:input.parentInvocationId??null,cycle:input.cycle??null,planStep:input.planStep??null,callerServiceId:input.callerServiceId,
    provider:input.provider,model:input.model,operation:input.operation,requestHash:input.requestHash,responseHash:input.responseHash,capabilityHash:input.capabilityHash,
    policyDecision:input.policyDecision,policyDecisionHash:input.policyDecisionHash,previousReceiptHash:input.previousReceiptHash??null,startedAt:input.startedAt,completedAt:input.completedAt,
  }))
}
