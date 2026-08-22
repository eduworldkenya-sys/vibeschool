import fs from 'node:fs'
import crypto from 'node:crypto'
const statePath=process.env.CYBORG_STATE_PATH||'.cyborg/engine-state.json'
const outPath=process.env.CYBORG_CERT_PATH||'.cyborg/certification.json'
const state=JSON.parse(fs.readFileSync(statePath,'utf8'))
const registry=JSON.parse(fs.readFileSync('docs/ai-governance/SKILL_REGISTRY.json','utf8'))
const routing=JSON.parse(fs.readFileSync('docs/ai-governance/SKILL_ROUTING.json','utf8'))
const engine=JSON.parse(fs.readFileSync('docs/ai-governance/CYBORG_ENGINE.json','utf8'))
const schema=JSON.parse(fs.readFileSync('docs/ai-governance/CYBORG_EVIDENCE_SCHEMA.json','utf8'))
const current=process.env.CYBORG_HEAD_SHA||process.env.GITHUB_SHA
if(!current||current!==state.headSha)throw new Error('Certification refused: exact head mismatch')
const blocking=state.selectedSkills.filter(s=>!['PASS','NOT_APPLICABLE'].includes(s.result))
if(blocking.length)throw new Error(`Certification refused: unresolved skills ${blocking.map(s=>s.id).join(', ')}`)
const ci=state.evidence.filter(e=>e.kind==='exact-head-ci'&&e.headSha===state.headSha&&e.result==='PASS')
if(!ci.length)throw new Error('Certification refused: exact-head CI PASS missing')
const independent=state.evidence.filter(e=>e.independent===true&&e.headSha===state.headSha&&e.result==='PASS')
if(!independent.length)throw new Error('Certification refused: independent assurance PASS missing')
const digest=crypto.createHash('sha256').update(JSON.stringify(state.evidence)).digest('hex')
const cert={schemaVersion:schema.version,headSha:state.headSha,baseSha:state.baseSha,cyborgVersion:'repo-native-v1',registryVersion:registry.version,routingVersion:routing.version,engineVersion:engine.version,evidenceDigest:digest,independentAssurance:independent.map(e=>e.id||e.kind),createdAt:new Date().toISOString(),valid:true}
fs.mkdirSync('.cyborg',{recursive:true});fs.writeFileSync(outPath,JSON.stringify(cert,null,2)+'\n');console.log(JSON.stringify(cert,null,2))
