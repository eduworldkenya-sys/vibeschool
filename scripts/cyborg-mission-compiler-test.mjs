import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'

const root=fs.mkdtempSync(path.join(os.tmpdir(),'cyborg-compiler-'))
const env={...process.env,CYBORG_ROOT:root,CYBORG_BASE_SHA:'base',CYBORG_HEAD_SHA:'head'}
function compile(intent,type){const r=spawnSync(process.execPath,['scripts/cyborg-mission-compiler.mjs',intent,type],{encoding:'utf8',env});if(r.status!==0)throw new Error(r.stderr||r.stdout);return JSON.parse(r.stdout)}
const readiness=compile('Is signup ready?','READINESS')
const incident=compile('Signup is failing in production','INCIDENT')
const security=compile('Audit signup tenant isolation','SECURITY')
if(readiness.templateId!=='READINESS'||!readiness.requirements.some(r=>r.id.includes('authorization_and_tenant_isolation'))||!readiness.requirements.some(r=>r.minimumEvidenceGrade==='E7'))throw new Error('READINESS template not applied')
if(incident.templateId!=='INCIDENT'||!incident.requirements.some(r=>r.id.includes('containment'))||incident.requirements.map(r=>r.description).join('|')===readiness.requirements.map(r=>r.description).join('|'))throw new Error('INCIDENT template not distinct')
if(security.templateId!=='SECURITY'||!security.requirements.some(r=>r.id.includes('threat_model'))||!security.requirements.some(r=>r.minimumEvidenceGrade==='E6'))throw new Error('SECURITY template not applied')
for(const m of [readiness,incident,security]){const j=fs.readFileSync(`${root}/journal/${m.missionId}.ndjson`,'utf8');if(!j.includes('MISSION_TEMPLATE_APPLIED'))throw new Error('Template application not journaled')}
console.log('Cyborg mission compiler tests PASSED')
