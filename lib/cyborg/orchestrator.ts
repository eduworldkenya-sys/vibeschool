import { CyborgMission, SideEffect, SkillBinding } from './contracts';
import { actionDisposition } from './policy';
import { mayComplete, nextCycle, transition } from './kernel';

export type ToolFailureKind = 'permission'|'transient'|'validation'|'stale_state'|'timeout'|'rate_limit'|'implementation';
export interface ToolCapability { id:string; actions:string[]; risk:'read'|'local_mutation'|'remote_mutation'|'production_mutation'|'owner_only'|'forbidden'; fallbackIds?:string[]; }
export interface SkillDefinition { id:string; version:string; dependencies:string[]; conflicts?:string[]; applies:(m:CyborgMission)=>boolean; }
export interface ChangeImpact { target:string; reason:string; requiredChecks:string[]; rollback?:string; }
export interface TruthSnapshot { revision:string; environment:string; assertions:Record<string,string|number|boolean|null>; }

export function resolveSkills(m:CyborgMission, registry:SkillDefinition[]): SkillBinding[] {
  const selected = registry.filter(s=>s.applies(m)); const ids = new Set(selected.map(s=>s.id));
  for (const s of selected) {
    for (const d of s.dependencies) if (!ids.has(d)) throw new Error(`SKILL_DEPENDENCY_MISSING:${s.id}:${d}`);
    for (const c of s.conflicts||[]) if (ids.has(c)) throw new Error(`SKILL_CONFLICT:${s.id}:${c}`);
  }
  return selected.map(s=>({id:s.id,version:s.version,required:true,dependencies:s.dependencies,evidenceIds:[]}));
}

export function chooseTool(action:string, tools:ToolCapability[]) {
  const primary = tools.find(t=>t.actions.includes(action)); if (!primary) throw new Error(`CAPABILITY_MISSING:${action}`);
  const disposition = actionDisposition(primary.risk, action);
  return { primary, disposition, fallbacks:(primary.fallbackIds||[]).map(id=>tools.find(t=>t.id===id)).filter(Boolean) as ToolCapability[] };
}

export function classifyToolFailure(message:string):ToolFailureKind {
  const x=message.toLowerCase();
  if(/403|permission|forbidden/.test(x)) return 'permission'; if(/429|rate limit/.test(x)) return 'rate_limit';
  if(/timeout|timed out/.test(x)) return 'timeout'; if(/stale|head moved|conflict/.test(x)) return 'stale_state';
  if(/invalid|validation|schema/.test(x)) return 'validation'; if(/502|503|disconnect|temporar/.test(x)) return 'transient'; return 'implementation';
}

export function blastRadius(changed:string[], dependencyMap:Record<string,string[]>):ChangeImpact[] {
  const seen=new Set<string>(); const q=[...changed]; const out:ChangeImpact[]=[];
  while(q.length){const x=q.shift()!; if(seen.has(x)) continue; seen.add(x); out.push({target:x,reason:changed.includes(x)?'direct_change':'dependency',requiredChecks:[`verify:${x}`],rollback:`restore:${x}`}); for(const d of dependencyMap[x]||[]) q.push(d);}
  return out;
}

export async function executeRollback(sideEffects:SideEffect[], executor:(rollback:string,sideEffect:SideEffect)=>Promise<void>):Promise<string[]> {
  const completed:string[]=[];
  for(const effect of sideEffects.slice().reverse()) {
    if(effect.risk==='read') continue;
    if(!effect.rollback) throw new Error(`ROLLBACK_PLAN_MISSING:${effect.id}`);
    await executor(effect.rollback,effect); completed.push(effect.id);
  }
  return completed;
}

export function reconcileTruth(before:TruthSnapshot,intended:TruthSnapshot,actual:TruthSnapshot):string[] {
  const failures:string[]=[];
  if(actual.environment!==intended.environment) failures.push('ENVIRONMENT_IDENTITY_MISMATCH');
  if(actual.revision!==intended.revision) failures.push('REVISION_MISMATCH');
  for(const [key,value] of Object.entries(intended.assertions)) if(actual.assertions[key]!==value) failures.push(`OUTCOME_MISMATCH:${key}`);
  for(const key of Object.keys(before.assertions)) if(!(key in intended.assertions) && actual.assertions[key]!==before.assertions[key]) failures.push(`UNPLANNED_SIDE_EFFECT:${key}`);
  return failures;
}

export function adversarialCompletionCritic(m:CyborgMission):string[] {
  const failures:string[]=[]; const completion=mayComplete(m);
  if(!completion.ok) failures.push(...completion.reasons);
  if(!m.sideEffects.every(s=>s.evidenceIds.length>0)) failures.push('UNACCOUNTED_SIDE_EFFECT');
  if(m.sideEffects.some(s=>s.risk!=='read'&&!s.rollback)) failures.push('ROLLBACK_PLAN_MISSING');
  if(!m.checkpoint) failures.push('RECOVERY_CHECKPOINT_MISSING');
  if(!m.lease) failures.push('MISSION_LEASE_MISSING');
  if(m.lease && m.lease.baseRevision!==m.baseRevision) failures.push('LEASE_REVISION_MISMATCH');
  if(m.lease && m.lease.generation<=0) failures.push('LEASE_FENCING_INVALID');
  if(m.confidence==null||m.confidence<0.9) failures.push('CONFIDENCE_BELOW_CERTIFICATION_THRESHOLD');
  return Array.from(new Set(failures));
}

export function executeCycle(m:CyborgMission, progressFingerprint:string):CyborgMission {
  const n=nextCycle(m,progressFingerprint); if(n.state==='blocked') return n;
  if(n.state==='certifying' && adversarialCompletionCritic(n).length===0) return transition(n,'complete');
  return n;
}

export function resumeMission(m:CyborgMission, holder:string, now=new Date()):CyborgMission {
  if(!m.lease) throw new Error('MISSION_LEASE_MISSING');
  if(m.lease.baseRevision!==m.baseRevision) throw new Error('LEASE_REVISION_MISMATCH');
  if(new Date(m.lease.expiresAt).getTime()>now.getTime() && m.lease.holder!==holder) throw new Error('MISSION_LEASE_HELD');
  if(!m.checkpoint) throw new Error('RECOVERY_CHECKPOINT_MISSING');
  return {...m, lease:{holder,baseRevision:m.baseRevision,generation:m.lease.generation+1,acquiredAt:now.toISOString(),expiresAt:new Date(now.getTime()+15*60_000).toISOString()}};
}
