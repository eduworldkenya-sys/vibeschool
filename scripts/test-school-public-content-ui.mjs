import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=p=>readFileSync(p,'utf8')
const board=read('app/schools/components/SchoolPublicBoard.tsx')
const dir=read('app/schools/components/DirectorySchool.tsx')
const profile=read('app/schools/components/SchoolProfile.tsx')
const news=read('app/schools/components/SchoolSection.tsx')
const hq=read('app/hq/schools/publications/page.tsx')
const sql=read('supabase/migrations/20261115032400_school_public_content_foundation.sql')
for(const k of ['Overview','Updates','Fees','Uniform','Admissions',"from('school_public_content')",
 "is_platform_owner","is_school_admin","save('published')","save('draft')","save('withdrawn')"]){
 assert.ok(board.includes(k),'School board missing '+k)
}
assert.match(dir,/SchoolPublicBoard slug=\{school\.slug\}/)
assert.match(profile,/SchoolPublicBoard slug=\{decodeURIComponent/)
assert.match(news,/SchoolPublicBoard slug=\{decodeURIComponent/)
assert.match(hq,/SchoolPublicBoard slug=\{school\.slug\}/)
assert.ok(!hq.includes('service_role'),'HQ page must use normal isolated session')
assert.match(sql,/for select to anon, authenticated using \(\s*status = 'published'/)
assert.match(sql,/public\.is_school_admin\(r\.source_id\)/)
assert.match(sql,/new\.content_kind = 'fees'/)
assert.match(sql,/school_public_content_audit/)
assert.ok(!sql.includes('grant all on public.school_public_content'))
const weakened=sql.replace(/status = 'published'\s+and exists/, "status IN ('published','draft') and exists")
assert.notEqual(sql,weakened,'Negative control must change the contract')
assert.doesNotMatch(sql,/grant select on public\.school_public_content_audit to anon/)
console.log('PASS: canonical school pages and HQ connect to real public content, restricted publishing and audit')
