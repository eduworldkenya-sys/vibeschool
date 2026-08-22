import { CyborgMission } from './contracts';
import { adversarialCompletionCritic, executeCycle, resolveSkills, SkillDefinition } from './orchestrator';
import { transition } from './kernel';

export interface CyborgPersistencePort {
  create(mission:CyborgMission):Promise<void>;
  load(id:string):Promise<CyborgMission|null>;
  save(mission:CyborgMission, expectedBaseRevision:string):Promise<void>;
  appendEvent(missionId:string,eventType:string,payload:unknown,evidenceHash:string):Promise<void>;
  acquireLease(missionId:string,holder:string,baseRevision:string,ttlSeconds:number):Promise<{generation:number;expiresAt:string}>;
  releaseLease(missionId:string,holder:string):Promise<void>;
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

  async run(missionId:string):Promise<CyborgMission>{
    let m=await this.persistence.load(missionId); if(!m) throw new Error('MISSION_NOT_FOUND');
    await this.persistence.acquireLease(m.id,this.holder,m.baseRevision,900);
    try {
      if(!m.skills.length) m={...m,skills:resolveSkills(m,this.skills)};
      while(!['complete','blocked','aborted'].includes(m.state)){
        const before=JSON.stringify({state:m.state,cycle:m.cycle,gates:m.gates,evidence:m.evidence.length,sideEffects:m.sideEffects.length});
        if(m.state==='received') m=transition(m,'investigating');
        if(m.state==='investigating') { m=await this.executor.investigate(m); if(m.state==='investigating') m=transition(m,'planned'); }
        if(m.state==='planned') { m=await this.executor.plan(m); if(m.state==='planned') m=transition(m,'executing'); }
        if(m.state==='executing') { const r=await this.executor.execute(m); m=r.mission; m=executeCycle(m,r.progressFingerprint); if(m.state==='executing') m=transition(m,'verifying'); }
        if(m.state==='verifying') { m=await this.executor.verify(m); if(m.gates.some(g=>g.required&&g.status==='fail')) m=transition(m,'repairing'); else if(m.state==='verifying') m=transition(m,'certifying'); }
        if(m.state==='repairing') { m=await this.executor.repair(m); if(m.state==='repairing') m=transition(m,'verifying'); }
        if(m.state==='certifying') {
          const failures=adversarialCompletionCritic(m);
          if(!failures.length) m=transition(m,'complete');
          else { await this.persistence.appendEvent(m.id,'completion_rejected',{failures},`${m.baseRevision}:${m.cycle}:${failures.join('|')}`); m={...m,state:'repairing'}; }
        }
        const after=JSON.stringify({state:m.state,cycle:m.cycle,gates:m.gates,evidence:m.evidence.length,sideEffects:m.sideEffects.length});
        await this.persistence.appendEvent(m.id,'cycle',{before,after,state:m.state,cycle:m.cycle},`${m.baseRevision}:${m.cycle}:${after}`);
        await this.persistence.save(m,m.baseRevision);
      }
      await this.persistence.recordSlo(m.id,'completion_accuracy',m.state==='complete'?1:0,{state:m.state});
      return m;
    } catch(error){
      await this.persistence.recordSlo(m.id,'tool_failure',1,{message:error instanceof Error?error.message:String(error)});
      throw error;
    } finally { await this.persistence.releaseLease(m.id,this.holder); }
  }
}
