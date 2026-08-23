export const CYBORG_CAPABILITY_VERSION = 'v1';
export const CYBORG_CAPABILITY_TTL_SECONDS = 90;
export interface CyborgCapabilityClaims { v: typeof CYBORG_CAPABILITY_VERSION; jti: string; missionId: string; conversationId?: string; provider: string; model: string; operation: 'model.invoke'; issuedAt: number; expiresAt: number; }
const te = new TextEncoder(); const td = new TextDecoder();
function b64url(bytes: Uint8Array): string { let s=''; for (const b of bytes) s+=String.fromCharCode(b); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function from64(value:string):Uint8Array { const s=value.replace(/-/g,'+').replace(/_/g,'/'); const padded=s+'='.repeat((4-s.length%4)%4); const raw=atob(padded); return Uint8Array.from(raw,c=>c.charCodeAt(0)); }
function requireSecret(secret?:string):string { if(!secret||secret.length<32) throw new Error('CYBORG_CAPABILITY_SECRET_REQUIRED'); return secret; }
async function sign(secret:string,payload:string):Promise<string>{ const key=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']); return b64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,te.encode(payload)))); }
export async function issueCyborgCapability(input:{secret?:string;missionId:string;conversationId?:string;provider:string;model:string;nowMs?:number;ttlSeconds?:number}):Promise<string>{
 const secret=requireSecret(input.secret); if(!input.missionId.trim()) throw new Error('CYBORG_MISSION_REQUIRED'); const issuedAt=Math.floor((input.nowMs??Date.now())/1000); const ttl=Math.min(Math.max(input.ttlSeconds??CYBORG_CAPABILITY_TTL_SECONDS,1),300);
 const claims:CyborgCapabilityClaims={v:CYBORG_CAPABILITY_VERSION,jti:crypto.randomUUID(),missionId:input.missionId,conversationId:input.conversationId,provider:input.provider,model:input.model,operation:'model.invoke',issuedAt,expiresAt:issuedAt+ttl};
 const payload=b64url(te.encode(JSON.stringify(claims))); return `${payload}.${await sign(secret,payload)}`;
}
export async function verifyCyborgCapability(input:{secret?:string;token?:string;missionId:string;provider:string;model:string;nowMs?:number}):Promise<CyborgCapabilityClaims>{
 const secret=requireSecret(input.secret); if(!input.token) throw new Error('CYBORG_CAPABILITY_REQUIRED'); const [payload,supplied,extra]=input.token.split('.'); if(!payload||!supplied||extra) throw new Error('CYBORG_CAPABILITY_INVALID');
 const expected=await sign(secret,payload); const a=te.encode(expected),b=te.encode(supplied); let diff=a.length^b.length; for(let i=0;i<Math.max(a.length,b.length);i++) diff|=(a[i]??0)^(b[i]??0); if(diff!==0) throw new Error('CYBORG_CAPABILITY_INVALID');
 let claims:CyborgCapabilityClaims; try{claims=JSON.parse(td.decode(from64(payload))) as CyborgCapabilityClaims}catch{throw new Error('CYBORG_CAPABILITY_INVALID')}; const now=Math.floor((input.nowMs??Date.now())/1000);
 if(claims.v!==CYBORG_CAPABILITY_VERSION||claims.operation!=='model.invoke') throw new Error('CYBORG_CAPABILITY_INVALID'); if(claims.expiresAt<=now||claims.issuedAt>now+5) throw new Error('CYBORG_CAPABILITY_EXPIRED'); if(claims.missionId!==input.missionId) throw new Error('CYBORG_CAPABILITY_MISSION_MISMATCH'); if(claims.provider!==input.provider) throw new Error('CYBORG_CAPABILITY_PROVIDER_MISMATCH'); if(claims.model!==input.model) throw new Error('CYBORG_CAPABILITY_MODEL_MISMATCH'); return claims;
}
