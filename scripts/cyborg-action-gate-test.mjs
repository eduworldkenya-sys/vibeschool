import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'

const root=fs.mkdtempSync(path.join(os.tmpdir(),'cyborg-action-gate-'))
const env={...process.env,CYBORG_ROOT:root,CYBORG_BASE_SHA:'base',CYBORG_HEAD_SHA:'head'}
function run(script,args,ok=true,extra={}){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...env,...extra}});if(ok&&r.status!==0)throw new Error(`${script} expected success\n${r.stderr}`);if(!ok&&r.status===0)throw new Error(`${script} expected failure`);return r}
const mission=JSON.parse(run('scripts/cyborg-supervisor.mjs',['compile','Update dependency safely','IMPLEMENTATION']).stdout)
run('scripts/cyborg-supervisor.mjs',['lease',mission.missionId,JSON.stringify(['package.json','package-lock.json'])])
const dep={missionId:mission.missionId,type:'DEPENDENCY_CHANGE',mutates:true,evidence:['package_provenance','lockfile_review','install_script_review','vulnerability_review','dependency_confusion_review','license_review_when_applicable']}
const allowed=JSON.parse(run('scripts/cyborg-action-gate.mjs',[JSON.stringify(dep)]).stdout)
if(!allowed.allowed)throw new Error('Dependency action should pass complete gate')
const secret={missionId:mission.missionId,type:'SECRET_USE',plaintextSecret:true,evidence:['secret_reference_not_plaintext','least_privilege','no_log_or_model_exposure']}
run('scripts/cyborg-action-gate.mjs',[JSON.stringify(secret)],false)
const db={missionId:mission.missionId,type:'DATABASE_MUTATION',mutates:true,evidence:['schema_impact','rls_grant_impact','backward_compatibility','data_migration_plan','rollback_or_recovery','dry_or_read_only_verification','security_gate']}
run('scripts/cyborg-action-gate.mjs',[JSON.stringify(db)],false,{CYBORG_OWNER_AUTHORIZED:'true'})
console.log('Cyborg action-gate adversarial tests PASSED')
