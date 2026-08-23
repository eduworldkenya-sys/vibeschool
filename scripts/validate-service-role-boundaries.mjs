import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const manifestPath=path.join(root,'config/service-role-boundaries.json')
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'))
if(manifest.principle!=='service_role_never_implies_caller_authority')throw new Error('Service-role boundary principle changed')

function walk(dir,out=[]){
  if(!fs.existsSync(dir))return out
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name)
    if(entry.isDirectory())walk(full,out)
    else if(entry.isFile()&&entry.name==='route.ts')out.push(full)
  }
  return out
}

const routeRoot=path.join(root,'app','api')
const privileged=walk(routeRoot)
  .filter(file=>fs.readFileSync(file,'utf8').includes('SUPABASE_SERVICE_ROLE_KEY'))
  .map(file=>path.relative(root,file).replaceAll(path.sep,'/'))
  .sort()
const declared=Object.keys(manifest.routes||{}).sort()

const missing=privileged.filter(file=>!declared.includes(file))
const stale=declared.filter(file=>!privileged.includes(file))
if(missing.length)throw new Error(`Undeclared service-role API route(s): ${missing.join(', ')}`)
if(stale.length)throw new Error(`Stale service-role boundary declaration(s): ${stale.join(', ')}`)

for(const file of privileged){
  const source=fs.readFileSync(path.join(root,file),'utf8')
  const rule=manifest.routes[file]
  if(!rule.authority||!Array.isArray(rule.requiredEvidence)||rule.requiredEvidence.length<2){
    throw new Error(`${file}: incomplete service-role authority declaration`)
  }
  if(/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/.test(source)){
    throw new Error(`${file}: service-role secret must never be exposed as NEXT_PUBLIC`)
  }
  for(const evidence of rule.requiredEvidence){
    if(!source.includes(evidence))throw new Error(`${file}: required authority evidence missing: ${evidence}`)
  }
  const mutating=/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/.test(source)
  if(mutating&&!/(401|403|Unauthorized|Forbidden|authority|claim|CRON_SECRET|fn_invitation_attempt)/i.test(source)){
    throw new Error(`${file}: privileged mutation has no fail-closed denial evidence`)
  }
}

console.log(`Service-role authorization boundaries: PASS (${privileged.length} privileged API routes declared and verified)`)
