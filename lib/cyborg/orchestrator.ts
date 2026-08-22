import { CyborgMission, SkillBinding } from './contracts';
import { actionDisposition } from './policy';
import { mayComplete, nextCycle, transition } from './kernel';

export type ToolFailureKind = 'permission'|'transient'|'validation'|'stale_state'|'timeout'|'rate_limit'|'implementation';
export interface ToolCapability { id:string; actions:string[]; risk:'read'|'local_mutation'|'remote_mutation'|'production_mutation'|'owner_only'|'forbidden'; fallbackIds?:string[]; }
export interface SkillDefinition { id:string; version:string; dependencies:string[]; conflicts?:string[]; applies:(m:CyborgMission)=>boolean; }
export interface ChangeImpact { target:string; reason:string; requiredChecks:string[]; rollback?:string; }

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

export function adversarialCompletionCritic(m:CyborgMission):string[] {
  const failures:string[]=[]; const completion=mayComplete(m);
  if(!completion.ok) failures.push(...completion.reasons);
  if(!m.sideEffects.every(s=>s.evidenceIds.length>0)) failures.push('UNACCOUNTED_SIDE_EFFECT');
  if(m.sideEffects.some(s=>s.risk!=='read'&&!s.rollback)) failures.push('ROLLBACK_PLAN_MISSING');
  if(!m.checkpoint) failures.push('RECOVERY_CHECKPOINT_MISSING');
  if(!m.lease) failures.push('MISSION_LEASE_MISSING');
  if(m.confidence==null||m.confidence<0.9) failures.push('CONFIDENCE_BELOW_CERTIFICATION_THRESHOLD');
  return [...new Set(failures)];
}

export function executeCycle(m:CyborgMission, progressFingerprint:string):CyborgMission {
  const n=nextCycle(m,progressFingerprint); if(n.state==='blocked') return n;
  if(n.state==='certifying' && adversarialCompletionCritic(n).length===0) return transition(n,'complete');
  return n;
}

export function resumeMission(m:CyborgMission, holder:string, now=new Date()):CyborgMission {
  if(!m.lease) throw new Error('MISSION_LEASE_MISSING');
  if(new Date(m.lease.expiresAt).getTime()>now.getTime() && m.lease.holder!==holder) throw new Error('MISSION_LEASE_HELD');
  if(!m.checkpoint) throw new Error('RECOVERY_CHECKPOINT_MISSING');
  return {...m, lease:{holder,acquiredAt:now.toISOString(),expiresAt:new Date(now.getTime()+15*60_000).toISOString()}};
}
