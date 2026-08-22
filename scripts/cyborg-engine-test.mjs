import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
const tmp=path.join(os.tmpdir(),`cyborg-${process.pid}.json`), env={...process.env,CYBORG_STATE_PATH:tmp,CYBORG_BASE_SHA:'base123',CYBORG_HEAD_SHA:'head123'}
function run(args,ok=true){const r=spawnSync(process.execPath,['scripts/cyborg-engine.mjs',...args],{encoding:'utf8',env});if(ok&&r.status!==0)throw new Error(r.stderr||r.stdout);if(!ok&&r.status===0)throw new Error(`Expected failure: ${args.join(' ')}`);return r}
run(['init','adversarial-proof'])
run(['transition','CERTIFY'],false)
run(['transition','INVESTIGATE']);run(['transition','PLAN']);run(['transition','EXECUTE']);run(['transition','PREFLIGHT']);run(['transition','VERIFY'])
run(['skills',JSON.stringify([{id:'repo-truth-first',result:'PASS'},{id:'contract-integrity',result:'PASS'}])])
run(['evidence',JSON.stringify({kind:'exact-head-ci',result:'PASS',source:'test'})])
run(['transition','CERTIFY']);run(['transition','MERGE_GATE']);run(['transition','MERGE']);run(['transition','POST_MERGE_VERIFY'])
run(['evidence',JSON.stringify({kind:'post-merge',result:'FAIL',source:'test'})]);run(['transition','REPAIR']);run(['transition','REVERIFY']);run(['transition','CERTIFY'],false)
const stale={...env,CYBORG_HEAD_SHA:'different-head'};const r=spawnSync(process.execPath,['scripts/cyborg-engine.mjs','transition','CERTIFY'],{encoding:'utf8',env:stale});if(r.status===0)throw new Error('Expected stale-head rejection')
fs.rmSync(tmp,{force:true});console.log('Cyborg engine adversarial tests PASSED')
