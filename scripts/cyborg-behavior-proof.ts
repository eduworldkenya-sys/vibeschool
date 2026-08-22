import { CyborgMission } from '../lib/cyborg/contracts';
import { mayComplete, nextCycle } from '../lib/cyborg/kernel';
import { actionDisposition } from '../lib/cyborg/policy';
import { blastRadius, classifyToolFailure, executeRollback, reconcileTruth, resolveSkills, resumeMission } from '../lib/cyborg/orchestrator';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function throws(fn:()=>unknown, needle:string){ try { fn(); } catch(e){ assert(String(e).includes(needle),`wrong error:${String(e)}`); return; } throw new Error(`expected:${needle}`); }

async function main(){
  const now='2026-08-22T18:00:00.000Z';
  const base: CyborgMission={
    id:'mission-1',objective:'prove cyborg',state:'certifying',baseRevision:'sha-1',successCriteria:['all gates pass'],constraints:[],ownerGates:[],forbiddenActions:[],
    gates:[{id:'g1',description:'proof',required:true,status:'pass',evidenceIds:['test','assurance']}],
    evidence:[
      {id:'test',quality:'test',source:'suite',observedAt:now,expiresAt:'2099-01-01T00:00:00.000Z',revision:'sha-1',supports:['correct']},
      {id:'assurance',quality:'independent_assurance',source:'critic',observedAt:now,expiresAt:'2099-01-01T00:00:00.000Z',revision:'sha-1',supports:['certified']}
    ],hypotheses:[],skills:[],sideEffects:[],budget:{maxCycles:5,maxRepeatedFailure:2,maxNoProgressCycles:1},cycle:0,noProgressCycles:0,
    checkpoint:'cp-1',confidence:.99,lease:{holder:'agent-a',acquiredAt:now,expiresAt:'2099-01-01T00:00:00.000Z'}
  };
  assert(mayComplete(base).ok,'valid mission must complete');
  assert(!mayComplete({...base,evidence:base.evidence.map(e=>({...e,expiresAt:'2020-01-01T00:00:00.000Z'}))}).ok,'stale evidence must fail');
  assert(!mayComplete({...base,evidence:[...base.evidence,{id:'contradiction',quality:'production',source:'prod',observedAt:now,contradicts:['correct'],supports:[]}]}).ok,'contradiction must fail');
  let stagnant=nextCycle({...base,state:'executing'},'same'); stagnant=nextCycle(stagnant,'same'); assert(stagnant.state==='blocked','stagnation must block');
  throws(()=>resolveSkills(base,[{id:'a',version:'1',dependencies:['b'],applies:()=>true}]),'SKILL_DEPENDENCY_MISSING');
  assert(actionDisposition('owner_only','runtime_activation')==='owner_gate','runtime must owner-gate');
  assert(actionDisposition('forbidden','self_certification')==='deny','self certification must deny');
  assert(classifyToolFailure('429 rate limit')==='rate_limit','rate-limit classification');
  assert(blastRadius(['root'],{root:['child'],child:['leaf']}).map(x=>x.target).join(',')==='root,child,leaf','blast radius traversal');
  throws(()=>resumeMission(base,'agent-b',new Date('2026-08-22T18:01:00.000Z')),'MISSION_LEASE_HELD');
  const drift=reconcileTruth({revision:'r0',environment:'production',assertions:{a:1,untouched:true}},{revision:'r1',environment:'production',assertions:{a:2}},{revision:'r1',environment:'production',assertions:{a:2,untouched:false}}); assert(drift.includes('UNPLANNED_SIDE_EFFECT:untouched'),'truth reconciliation must detect drift');
  const rolled:string[]=[];
  await executeRollback([{id:'one',target:'x',action:'mutate',idempotencyKey:'i1',risk:'remote_mutation',rollback:'undo:x',evidenceIds:['test']}],async (plan)=>{rolled.push(plan)}); assert(rolled[0]==='undo:x','rollback executes');
  const first=JSON.stringify(mayComplete(base)); const second=JSON.stringify(mayComplete(structuredClone(base))); assert(first===second,'mission replay must be deterministic');
  console.log(JSON.stringify({status:'PASS',behaviorCases:12,replay:'PASS'}));
}

main().catch(error=>{console.error(error);process.exit(1)});
