import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const path=process.env.SCHOOL_URL_PGLITE_MODULE
if(!path)throw Error('Set SCHOOL_URL_PGLITE_MODULE to @electric-sql/pglite')
const {PGlite}=await import(pathToFileURL(path))
const db=new PGlite()
const rows=(q)=>db.query(q).then(r=>r.rows)
await db.exec([
"create role anon; create role authenticated; create schema auth;",
"create table auth.users(id uuid primary key);",
"create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
"insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');",
"create table public.schools(id uuid primary key,name text,status text,deleted_at timestamptz);",
"insert into schools values('c51ec2ae-5b70-4f69-887d-54eb9f312db7','Test school','active',null);",
"create table public.school_public_urls(slug text primary key,school_id uuid,directory_id uuid);",
"insert into school_public_urls values('test-school','c51ec2ae-5b70-4f69-887d-54eb9f312db7',null),('directory-only',null,'8d000000-0000-4000-8000-000000000000');",
"create function public.schools_resolve_url_public_v1(p_slug text,p_school_id uuid,p_directory_id uuid) returns table(slug text,school_name text) language sql stable security definer as $$ select u.slug,coalesce(s.name,'Directory school') from public.school_public_urls u left join public.schools s on s.id=u.school_id where u.slug=p_slug and (s.id is null or s.status='active') $$;",
"create table public.school_members(profile_id uuid,school_id uuid,role text);",
"insert into public.school_members values('22222222-2222-4222-8222-222222222222','c51ec2ae-5b70-4f69-887d-54eb9f312db7','admin');",
"create table public.students(id uuid primary key,profile_id uuid,deleted_at timestamptz);",
"create table public.student_schools(student_id uuid,school_id uuid);",
"create table public.parent_student_links(parent_id uuid,school_id uuid);",
"create table public.school_follows(school_slug text,follower_id uuid);",
"create function public.hq_profile_is_active(id uuid) returns boolean language sql stable as $$ select id is not null $$;",
"create function public.hq_human_has_permission(id uuid, permission text) returns boolean language sql stable as $$ select id='33333333-3333-4333-8333-333333333333'::uuid and permission='schools.publish' $$;",
"create function public.is_school_admin(id uuid) returns boolean language sql stable security definer as $$ select exists(select 1 from public.school_members sm where sm.school_id=id and sm.profile_id=auth.uid() and sm.role='admin') $$;",
].join('\n'))
await db.exec(readFileSync('supabase/migrations/20261115071000_school_public_home_publishing.sql','utf8'))
await db.exec("select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false); set role authenticated;")
assert.equal((await rows("select school_can_publish_public_v1('test-school') as allowed"))[0].allowed,false)
await assert.rejects(()=>rows("select school_publish_public_post_v1('test-school','announcement','Unverified title','Unverified body','{}'::jsonb)"),/Verified school publisher required/)
await db.exec('reset role')
await db.exec("select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false); set role authenticated;")
assert.equal((await rows("select school_can_publish_public_v1('test-school') as allowed"))[0].allowed,true)
assert.equal((await rows("select school_can_publish_public_v1('directory-only') as allowed"))[0].allowed,false)
const published=(await rows("select school_publish_public_post_v1('test-school','announcement','School announcement','Public information for all','{}'::jsonb) as id"))[0].id
assert.ok(published)
await assert.rejects(()=>rows("select school_publish_public_post_v1('test-school','fees','Fees','Term fees','{}'::jsonb)"),/Fees need verified year/)
await assert.rejects(()=>rows("insert into school_public_posts(school_slug,kind,title,body,publisher_kind,published_by) values('test-school','announcement','Fake','Not permitted','school','22222222-2222-4222-8222-222222222222')"),/permission denied/)
assert.equal((await rows("select * from school_followed_public_feed_v1(25)")).length,1,'linked school member sees public update')
await db.exec('reset role')
await db.exec('set role anon')
assert.equal((await rows('select id,title from public.school_public_posts')).length,1)
await assert.rejects(()=>rows('select published_by from public.school_public_posts'),/permission denied/)
await assert.rejects(()=>rows("select school_publish_public_post_v1('directory-only','announcement','Fake title','Fake body','{}'::jsonb)"),/permission denied/)
await db.exec('reset role')
await db.exec("select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false); set role authenticated;")
assert.equal((await rows("select * from school_followed_public_feed_v1(25)")).length,0)
await db.exec('reset role')
await db.exec("insert into public.school_follows values('test-school','11111111-1111-4111-8111-111111111111');")
await db.exec("select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false); set role authenticated;")
assert.equal((await rows("select * from school_followed_public_feed_v1(25)")).length,1)
await db.exec('reset role')
await db.exec("select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false); set role authenticated;")
assert.equal((await rows("select school_withdraw_public_post_v1('"+published+"') as ok"))[0].ok,true)
await db.exec('reset role')
await db.exec('set role anon')
assert.equal((await rows('select id,title from school_public_posts')).length,0)
await db.exec('reset role')
await db.exec("select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false); set role authenticated;")
assert.equal((await rows("select school_can_publish_public_v1('directory-only') as allowed"))[0].allowed,true)
assert.ok((await rows("select school_publish_public_post_v1('directory-only','admissions','Admissions title','Information about admissions','{}'::jsonb) as id"))[0].id)
await db.exec('reset role')
const audit=await rows('select action from school_public_post_audit order by id')
assert.deepEqual(audit.map(r=>r.action),['published','withdrawn','published'])
console.log('PASS: owner-only publishing, HQ-vs-school identity, public-only RLS, private linked-user feed, denial paths, withdrawal audit')
await db.close()
