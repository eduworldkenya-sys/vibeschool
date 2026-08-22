import fs from 'node:fs'
import crypto from 'node:crypto'

const contractPath='docs/ai-governance/CYBORG_ENGINE.json'
const statePath=process.env.CYBORG_STATE_PATH||'.cyborg/engine-state.json'
const contract=JSON.parse(fs.readFileSync(contractPath,'utf8'))
const command=process.argv[2]||'status'
const arg=process.argv[3]

function hash(v){return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex')}
function load(){if(!fs.existsSync(statePath))return null;return JSON.parse(fs.readFileSync(statePath,'utf8'))}
function save(s){fs.mkdirSync('.cyborg',{recursive:true});fs.writeFileSync(statePath,JSON.stringify(s,null,2)+'\n');return s}
function assertExactHead(s){const current=process.env.CYBORG_HEAD_SHA||process.env.GITHUB_SHA;if(current&&s.headSha&&current!==s.headSha)throw new Error(`STALE_EVIDENCE: mission head ${s.headSha} != current head ${current}`)}
function init(){const mission=arg||process.env.CYBORG_MISSION;if(!mission)throw new Error('Mission is required');const baseSha=process.env.CYBORG_BASE_SHA;const headSha=process.env.CYBORG_HEAD_SHA||process.env.GITHUB_SHA;if(!baseSha||!headSha)throw new Error('Exact base/head SHA required');return save({schemaVersion:1,engine:contract.id,contractVersion:contract.version,mission,baseSha,headSha,state:contract.initialState,lastValidCheckpoint:contract.initialState,selectedSkills:[],evidence:[],history:[{from:null,to:contract.initialState,reason:'mission initialized'}],certification:null,activation:{runtime:false,schedulers:false,publishing:false,payments:false,consequentialAuthority:false}})}
function transition(next,reason=''){const s=load();if(!s)throw new Error('Initialize mission first');assertExactHead(s);const allowed=contract.transitions[s.state]||[];if(!allowed.includes(next))throw new Error(`Illegal Cyborg transition ${s.state} -> ${next}`);if(['CERTIFY','MERGE_GATE','MERGE','COMPLETE'].includes(next)){const failed=s.selectedSkills.filter(x=>['FAIL','BLOCKED','PENDING'].includes(x.result));if(failed.length)throw new Error(`Blocked by skills: ${failed.map(x=>x.id).join(', ')}`)}if(next==='CERTIFY'&&!s.evidence.some(e=>e.headSha===s.headSha&&e.kind==='exact-head-ci'&&e.result==='PASS'))throw new Error('CERTIFY requires PASS exact-head-ci evidence');if(next==='MERGE'&&!s.certification?.valid)throw new Error('MERGE requires valid certification');s.history.push({from:s.state,to:next,reason});s.state=next;if(!['REPAIR','BLOCKED'].includes(next))s.lastValidCheckpoint=next;if(next==='CERTIFY')s.certification={valid:true,headSha:s.headSha,evidenceDigest:hash(s.evidence)};return save(s)}
function addEvidence(){const s=load();if(!s)throw new Error('Initialize mission first');assertExactHead(s);const evidence=JSON.parse(arg||'{}');if(!evidence.kind||!evidence.result)throw new Error('Evidence needs kind and result');evidence.headSha=s.headSha;s.evidence.push(evidence);if(evidence.result==='FAIL'&&s.certification)s.certification={...s.certification,valid:false,invalidatedBy:evidence.kind};return save(s)}
function setSkills(){const s=load();if(!s)throw new Error('Initialize mission first');const items=JSON.parse(arg||'[]');s.selectedSkills=items;return save(s)}
let out
if(command==='init')out=init();else if(command==='transition')out=transition(arg,process.argv.slice(4).join(' '));else if(command==='evidence')out=addEvidence();else if(command==='skills')out=setSkills();else if(command==='status')out=load();else throw new Error(`Unknown command: ${command}`)
console.log(JSON.stringify(out,null,2))
