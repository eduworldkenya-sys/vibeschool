import fs from 'node:fs'
const registry=JSON.parse(fs.readFileSync('docs/ai-governance/SKILL_REGISTRY.json','utf8'))
const routing=JSON.parse(fs.readFileSync('docs/ai-governance/SKILL_ROUTING.json','utf8'))
const failures=[]
const all=[...(registry.core??[]),...(registry.vibeschoolDomains??[])]
const ids=new Set(all.map(s=>s.id))
for(const s of all){if(s.owner!=='vibeschool-cyborg-executor') failures.push(`${s.id}: owner bypass`); if(!s.activation) failures.push(`${s.id}: missing activation`)}
const securityRoute=routing.routes.find(r=>r.patterns.includes('supabase/**'))
for(const id of ['supabase-rls-security','security-authority-gate','production-readiness']) if(!securityRoute?.skills.includes(id)) failures.push(`supabase route can bypass ${id}`)
const workerRoute=routing.routes.find(r=>r.patterns.includes('lib/hq/workforce/**'))
for(const id of ['worker-engine-governance','observability-watchdog-reliability','security-authority-gate']) if(!workerRoute?.skills.includes(id)) failures.push(`worker route can bypass ${id}`)
for(const id of routing.defaultCore) if(!ids.has(id)) failures.push(`default core unknown: ${id}`)
if(!routing.failureTriggers?.requiredCiFailure?.includes('ci-failure-repair-loop')) failures.push('CI failure can bypass repair loop')
if(failures.length){console.error('Cyborg adversarial governance FAILED'); failures.forEach(x=>console.error(`- ${x}`)); process.exit(1)}
console.log('Cyborg adversarial governance PASSED')
console.log('Proved ownership, security routing, Worker Engine routing, default-core integrity and CI-failure repair trigger.')
