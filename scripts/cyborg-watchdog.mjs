import fs from 'node:fs'
import crypto from 'node:crypto'

const root=process.env.CYBORG_ROOT||'.cyborg'
const missionsDir=`${root}/missions`, journalDir=`${root}/journal`
const issues=[]
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex')
function verifyJournal(id){const p=`${journalDir}/${id}.ndjson`;if(!fs.existsSync(p)){issues.push({missionId:id,code:'JOURNAL_MISSING'});return}let prev='GENESIS',i=0;for(const line of fs.readFileSync(p,'utf8').split('\n').filter(Boolean)){const row=JSON.parse(line);if(row.prevHash!==prev){issues.push({missionId:id,code:'JOURNAL_CHAIN_BROKEN',event:i});break}const {eventHash,...core}=row;if(hash(core)!==eventHash){issues.push({missionId:id,code:'JOURNAL_HASH_INVALID',event:i});break}prev=eventHash;i++}}
if(fs.existsSync(missionsDir))for(const f of fs.readdirSync(missionsDir).filter(x=>x.endsWith('.json'))){const m=JSON.parse(fs.readFileSync(`${missionsDir}/${f}`,'utf8'));verifyJournal(m.missionId);if(Object.values(m.activation||{}).some(Boolean))issues.push({missionId:m.missionId,code:'UNEXPECTED_CONSEQUENTIAL_ACTIVATION'});if(m.state==='COMPLETE'){const unresolved=(m.requirements||[]).filter(r=>r.mandatory&&!['PASS','NOT_APPLICABLE'].includes(r.state));const skills=(m.selectedSkills||[]).filter(s=>s.required&&s.result!=='PASS');const contradictions=(m.contradictions||[]).filter(c=>!c.resolvedAt);if(unresolved.length||skills.length||contradictions.length||!m.learningClosure)issues.push({missionId:m.missionId,code:'INVALID_COMPLETE_STATE',unresolved:unresolved.length,skills:skills.length,contradictions:contradictions.length,learningClosure:m.learningClosure})}for(const [fingerprint,a] of Object.entries(m.attempts||{}))if(a.count>=3&&!['dependency_root_cause','independent_diagnosis','typed_boundary'].includes(a.strategy))issues.push({missionId:m.missionId,code:'STAGNATION_NOT_ESCALATED',fingerprint,count:a.count,strategy:a.strategy})}
const report={healthy:issues.length===0,issues,activation:{runtime:false,schedulers:false,publishing:false,payments:false,consequentialAuthority:false}}
console.log(JSON.stringify(report,null,2));if(!report.healthy)process.exit(1)
