import { CyborgMission, MissionLease } from './contracts';
import { adversarialCompletionCritic, executeCycle, resolveSkills, SkillDefinition } from './orchestrator';
import { transition } from './kernel';

export interface CyborgPersistencePort {
  create(mission:CyborgMission):Promise<void>;
  load(id:string):Promise<CyborgMission|null>;
  save(mission:CyborgMission, expectedBaseRevision:string, expectedLeaseGeneration:number):Promise<void>;
  appendEvent(missionId:string,eventType:string,payload:unknown,evidenceHash:string):Promise<void>;
  acquireLease(missionId:string,holder:string,baseRevision:string,ttlSeconds:number):Promise<{generation:number;acquiredAt?:string;expiresAt:string}>;
  releaseLease(missionId:string,holder:string,generation:number):Promise<void>;
  recordSlo(missionId:string,metric:string,value:number,dimensions?:Record<string,unknown>):Promise<void>;
}

export interface CyborgExecutionPort {
  investigate(mission:CyborgMission):Promise<CyborgMission>;
  plan(mission:CyborgMission):Promise<CyborgMission>;
  execute(mission:CyborgMission):Promise<{mission:CyborgMission;progressFingerprint:string}>;
  verify(mission:CyborgMission):Promise<CyborgMission>;
  repair(mission:CyborgMission):Promise<CyborgMission>;
}

export class CyborgRuntime {
  constructor(private persistence:CyborgPersistencePort,private executor:CyborgExecutionPort,private skills:SkillDefinition[],private holder:string){}

  private async lease(m:CyborgMission):Promise<MissionLease>{
    const acquired=await this.persistence.acquireLease(m.id,this.holder,m.baseRevision,900);
    return {
      holder:this.holder,
      baseRevision:m.baseRevision,
      generation:acquired.generation,
      acquiredAt:acquired.acquiredAt || new Date().toISOString(),
      expiresAt:acquired.expiresAt,
    };
  }

  async run(missionId:string):Promise<CyborgMission>{
    let m=await this.persistence.load(missionId); if(!m) throw new Error('MISSION_NOT_FOUND');
    let lease=await this.lease(m); m={...m,lease};
    try {
      if(!m.skills.length) m={...m,skills:resolveSkills(m,this.skills)};
      while(!['complete','blocked','aborted'].includes(m.state)){
        lease=await this.lease(m); m={...m,lease};
        const before=JSON.stringify({state:m.state,cycle:m.cycle,gates:m.gates,evidence:m.evidence.length,sideEffects:m.sideEffects.length,leaseGeneration:lease.generation});
        if(m.state==='received') m=transition(m,'investigating');
        if(m.state==='investigating') { m=await this.executor.investigate(m); if(m.state==='investigating') m=transition(m,'planned'); }
        if(m.state==='planned') { m=await this.executor.plan(m); if(m.state==='planned') m=transition(m,'executing'); }
        if(m.state==='executing') { const r=await this.executor.execute(m); m={...r.mission,lease}; m=executeCycle(m,r.progressFingerprint); if(m.state==='executing') m=transition(m,'verifying'); }
        if(m.state==='verifying') { m=await this.executor.verify(m); m={...m,lease}; if(m.gates.some(g=>g.required&&g.status==='fail')) m=transition(m,'repairing'); else if(m.state==='verifying') m=transition(m,'certifying'); }
        if(m.state==='repairing') { m=await this.executor.repair(m); m={...m,lease}; if(m.state==='repairing') m=transition(m,'verifying'); }
        if(m.state==='certifying') {
          const failures=adversarialCompletionCritic(m);
          if(!failures.length) m=transition(m,'complete');
          else { await this.persistence.appendEvent(m.id,'completion_rejected',{failures},`${m.baseRevision}:${m.cycle}:${lease.generation}:${failures.join('|')}`); m={...m,state:'repairing'}; }
        }
        const after=JSON.stringify({state:m.state,cycle:m.cycle,gates:m.gates,evidence:m.evidence.length,sideEffects:m.sideEffects.length,leaseGeneration:lease.generation});
        await this.persistence.appendEvent(m.id,'cycle',{before,after,state:m.state,cycle:m.cycle,leaseGeneration:lease.generation},`${m.baseRevision}:${m.cycle}:${lease.generation}:${after}`);
        await this.persistence.save(m,m.baseRevision,lease.generation);
      }
      await this.persistence.recordSlo(m.id,'completion_accuracy',m.state==='complete'?1:0,{state:m.state});
      return m;
    } catch(error){
      await this.persistence.recordSlo(m.id,'tool_failure',1,{message:error instanceof Error?error.message:String(error)});
      throw error;
    } finally { await this.persistence.releaseLease(m.id,this.holder,lease.generation); }
  }
}
