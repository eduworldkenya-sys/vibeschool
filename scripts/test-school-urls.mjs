import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const modulePath=process.env.SCHOOL_URL_PGLITE_MODULE
if(!modulePath)throw new Error('Set SCHOOL_URL_PGLITE_MODULE to the installed @electric-sql/pglite module')
const {PGlite}=await import(pathToFileURL(modulePath))
const db=new PGlite()
await db.exec(`create role anon; create role authenticated;
create table schools(id uuid primary key,name text,county text,sub_county text,school_category text,ownership_type text,knec_code text,status text,deleted_at timestamptz);
create table schools_directory(id uuid primary key,name text,county text,sub_county text,type text,status text,knec_code text,is_verified boolean,latitude float,longitude float);
insert into schools values('c51ec2ae-5b70-4f69-887d-54eb9f312db7','Gilgil Township','Nakuru','Gilgil','primary','public',null,'active',null);
insert into schools_directory(id,name,county,sub_county,type,status) values
('88d921f6-2be1-4abb-ab1b-af82283f07a9','Gilgil Township','Nakuru','Gilgil','Primary','Public'),
('3bdac02b-99cb-4342-a969-3a060300858e','2005 Municipality Mariakani Pri Sch','Laikipia','','Primary',null),
('5290ae37-ed1b-4055-b5f7-6f4d81b1d80d','Mariakani','Kilifi','Kaloleni','Primary','Public'),
('00000000-0000-0000-0000-000000000001','St Mary','Nakuru','','Primary','Public'),
('00000000-0000-0000-0000-000000000002','St Mary','Nakuru','','Primary','Public'),
('00000000-0000-0000-0000-000000000003','St Mary','Nakuru','','Primary','Public');`)
const sql=readFileSync('supabase/migrations/20261105121605_school_public_urls.sql','utf8')
await db.exec(sql)
await db.exec(readFileSync('supabase/migrations/20261105122327_school_public_url_lookup_performance.sql','utf8'))
await db.exec(readFileSync('supabase/migrations/20261105122430_school_public_url_indexed_resolution.sql','utf8'))
const rows=async(q,args=[]) => (await db.query(q,args)).rows
const resolve=async(slug)=>(await rows('select * from schools_resolve_url_public_v1($1)',[slug]))[0]
assert.equal((await resolve('gilgiltownship')).source_id,'c51ec2ae-5b70-4f69-887d-54eb9f312db7')
assert.equal((await resolve('municipality-mariakani-primary')).county,'Laikipia')
assert.equal((await resolve('mariakani')).county,'Kilifi')
assert.equal((await resolve('municipality-mariakani-primary')).is_verified,false)
assert.equal((await rows("select * from schools_resolve_url_public_v1(p_directory_id=>'88d921f6-2be1-4abb-ab1b-af82283f07a9')"))[0].slug,'gilgiltownship')
assert.equal((await rows("select * from schools_search_urls_public_v1('Gilgil Township')")).length,1)
const dup=await rows("select slug from schools_search_urls_public_v1('St Mary')")
assert.equal(new Set(dup.map(r=>r.slug)).size,3)
assert.equal(await resolve('missing-school'),undefined)
assert.equal((await rows("select * from schools_resolve_url_public_v1('gilgiltownship','c51ec2ae-5b70-4f69-887d-54eb9f312db7')")).length,0)
await db.exec("update schools_directory set name='New official name' where id='5290ae37-ed1b-4055-b5f7-6f4d81b1d80d'")
assert.equal((await resolve('mariakani')).school_name,'New official name')
await db.exec("insert into schools_directory(id,name,county,type,status) values('00000000-0000-0000-0000-000000000004','New School','Nakuru','Primary','Public')")
assert.equal((await resolve('new-school')).school_name,'New School')
await db.exec("update schools_directory set status='closed' where id='00000000-0000-0000-0000-000000000004'")
assert.equal(await resolve('new-school'),undefined)
await db.exec("update schools set deleted_at=now() where id='c51ec2ae-5b70-4f69-887d-54eb9f312db7'")
assert.equal(await resolve('gilgiltownship'),undefined)
await db.exec('set role anon')
assert.equal((await rows("select * from schools_search_urls_public_v1('Mariakani')")).length,1)
for(const q of ['select * from school_public_urls',"select school_url_allocate('00000000-0000-0000-0000-000000000005','directory','Hijack','X')","update school_public_urls set slug='hijack'",'select * from school_url_public_rows()']){
 await assert.rejects(()=>db.query(q),/permission denied/)
}
await db.exec('reset role')
// Negative control: a permissive registry would fail the write-protection test.
await db.exec('grant select on school_public_urls to anon; create policy insecure_test_control on school_public_urls for select to anon using (true); set role anon')
assert.ok((await rows('select * from school_public_urls')).length>0)
console.log('PASS: source identity, aliases, collisions, stable renames, automatic allocation, inactive/unknown/multi-selector denial, anonymous RPC and write isolation; negative control detected')
await db.close()
