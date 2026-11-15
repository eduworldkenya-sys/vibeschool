import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const modulePath=process.env.SCHOOL_URL_PGLITE_MODULE
if(!modulePath)throw new Error('Set SCHOOL_URL_PGLITE_MODULE to the installed @electric-sql/pglite module')
const {PGlite}=await import(pathToFileURL(modulePath))
const db=new PGlite()
const read=async(sql,args=[]) => (await db.query(sql,args)).rows

await db.exec(`
create role anon;
create role authenticated;
create schema auth;
grant usage on schema auth to authenticated;
create table auth.users(id uuid primary key);
create or replace function auth.uid() returns uuid
language sql stable security invoker as $$
select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant execute on function auth.uid() to authenticated;

create table public.schools(id uuid primary key,name text,county text,sub_county text,school_category text,ownership_type text,knec_code text,status text,deleted_at timestamptz);
create table public.schools_directory(id uuid primary key,name text,county text,sub_county text,type text,status text,knec_code text,is_verified boolean,latitude float,longitude float);
insert into auth.users(id) values
('11111111-1111-4111-8111-111111111111'),
('22222222-2222-4222-8222-222222222222');
insert into public.schools values
('c51ec2ae-5b70-4f69-887d-54eb9f312db7','Gilgil Township','Nakuru','Gilgil','primary','public',null,'active',null);
insert into public.schools_directory(id,name,county,sub_county,type,status) values
('88d921f6-2be1-4abb-ab1b-af82283f07a9','Gilgil Township','Nakuru','Gilgil','Primary','Public'),
('3bdac02b-99cb-4342-a969-3a060300858e','2005 Municipality Mariakani Pri Sch','Laikipia','','Primary',null),
('00000000-0000-0000-0000-000000000003','Dormant School','Nairobi','','Secondary','closed');
`)
for(const migration of [
 'supabase/migrations/20261105122128_school_public_urls.sql',
 'supabase/migrations/20261105122401_school_public_url_lookup_performance.sql',
 'supabase/migrations/20261105122509_school_public_url_indexed_resolution.sql',
 'supabase/migrations/20261115011500_school_follows_foundation.sql',
])await db.exec(readFileSync(migration,'utf8'))

const one='11111111-1111-4111-8111-111111111111'
const two='22222222-2222-4222-8222-222222222222'
await db.exec('set role anon')
await assert.rejects(()=>read('select * from public.school_follows'),/permission denied/)
await assert.rejects(()=>db.exec(`insert into public.school_follows(school_slug,follower_id) values ('gilgiltownship','${one}')`),/permission denied/)
await db.exec('reset role')

await db.exec(`select set_config('request.jwt.claim.sub','${one}',false)`)
await db.exec('set role authenticated')
await db.exec(`insert into public.school_follows(school_slug,follower_id) values ('gilgiltownship','${one}')`)
assert.equal((await read('select * from public.school_follows')).length,1)
await assert.rejects(()=>db.exec(`insert into public.school_follows(school_slug,follower_id) values ('gilgiltownship','${one}')`),/duplicate key/)
await assert.rejects(()=>db.exec(`insert into public.school_follows(school_slug,follower_id) values ('gilgiltownship','${two}')`),/row-level security/)
await assert.rejects(()=>db.exec(`insert into public.school_follows(school_slug,follower_id) values ('unknown-school','${one}')`),/row-level security|foreign key/)
await assert.rejects(()=>db.exec(`update public.school_follows set follower_id='${two}'`),/permission denied/)
await db.exec('reset role')

await db.exec(`select set_config('request.jwt.claim.sub','${two}',false)`)
await db.exec('set role authenticated')
assert.equal((await read('select * from public.school_follows')).length,0)
await db.exec(`delete from public.school_follows where school_slug='gilgiltownship'`)
assert.equal((await read('select * from public.school_follows')).length,0)
await db.exec('reset role')
assert.equal((await read('select count(*)::integer as count from public.school_follows'))[0].count,1)

await db.exec(`select set_config('request.jwt.claim.sub','${one}',false)`)
await db.exec('set role authenticated')
await db.exec(`delete from public.school_follows where school_slug='gilgiltownship'`)
assert.equal((await read('select * from public.school_follows')).length,0)
await db.exec('reset role')
assert.equal((await read('select count(*)::integer as count from public.school_follows'))[0].count,0)

// Negative control: a publicly readable roster would be exposed by this test.
await db.exec('grant select on public.school_follows to anon')
await db.exec('set role anon')
assert.equal((await read('select * from public.school_follows')).length,0)
await db.exec('reset role')
console.log('PASS: school follow ACL, own-only RLS, nonmembership, no cross-user writes/deletes, unknown-slug rejection and duplicate safety')
await db.close()
