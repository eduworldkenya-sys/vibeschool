import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { findEscapeHatches } from './cyborg-escape-hatch-detector.mjs'
const routing=JSON.parse(fs.readFileSync('docs/ai-governance/SKILL_ROUTING.json','utf8'))
const registry=JSON.parse(fs.readFileSync('docs/ai-governance/SKILL_REGISTRY.json','utf8'))
const base=process.env.CYBORG_BASE_SHA || process.env.GITHUB_BASE_SHA
const head=process.env.CYBORG_HEAD_SHA || process.env.GITHUB_SHA || 'HEAD'
if(!base) throw new Error('CYBORG_BASE_SHA/GITHUB_BASE_SHA is required; refusing stale/implicit evidence')
const files=execFileSync('git',['diff','--name-only',`${base}...${head}`],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
function globToRegex(glob){let s=glob.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*\*/g,'§§').replace(/\*/g,'[^/]*').replace(/§§/g,'.*'); return new RegExp(`^${s}$`)}
const selected=new Set(routing.defaultCore)
const reasons={}
for(const id of selected) reasons[id]=['universal-core']
for(const file of files) for(const route of routing.routes) if(route.patterns.some(p=>globToRegex(p).test(file))) for(const skill of route.skills){selected.add(skill); (reasons[skill]??=[]).push(file)}
const known=new Set([...(registry.core??[]),...(registry.vibeschoolDomains??[])].map(s=>s.id))
for(const skill of selected) if(!known.has(skill)) throw new Error(`Routing selected unknown skill: ${skill}`)
const escapes=[]
const textExt=/\.(ts|tsx|js|jsx|mjs|cjs)$/
for(const file of files.filter(f=>textExt.test(f)&&fs.existsSync(f))){
  const text=fs.readFileSync(file,'utf8')
  for(const token of findEscapeHatches(text)) escapes.push({file,token})
}
const manifest={schemaVersion:1,cyborg:'vibeschool-cyborg-executor',governance:{registryVersion:registry.version,routingVersion:routing.version},baseSha:base,headSha:head,changedFiles:files,selectedSkills:[...selected].sort().map(id=>({id,reasons:reasons[id]})),escapeHatchFindings:escapes,certificationState:'PREFLIGHT_GENERATED'}
fs.mkdirSync('.cyborg',{recursive:true}); fs.writeFileSync('.cyborg/mission-manifest.json',JSON.stringify(manifest,null,2)+'\n')
console.log(JSON.stringify(manifest,null,2))
if(escapes.length){console.error('Cyborg escape-hatch audit found prohibited/review-required patterns in changed files.'); process.exit(2)}
