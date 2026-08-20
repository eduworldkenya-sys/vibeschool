import fs from 'node:fs'
const path='app/hq/intelligence/page.tsx'
const src=fs.readFileSync(path,'utf8')
const failures=[]
if(/function Brief[\s\S]{0,800}JSON\.stringify\(value/.test(src)) failures.push('Brief primary rendering must not stringify arbitrary values')
if(/<pre[^>]*>\s*\{JSON\.stringify\((control|goals)/.test(src)) failures.push('Governance/goals must use progressive disclosure')
for(const required of ['View technical evidence','Nothing broke','Not enough data yet','New-user activation','Company intelligence could not be refreshed']) if(!src.includes(required)) failures.push(`Missing Founder-language contract: ${required}`)
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('HQ Founder language contract PASS')
