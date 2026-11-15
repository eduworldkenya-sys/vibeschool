import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const modulePath = process.env.SCHOOL_URL_PGLITE_MODULE
if (!modulePath) throw new Error('Set SCHOOL_URL_PGLITE_MODULE to the @electric-sql/pglite module')
const { PGlite } = await import(pathToFileURL(modulePath))
const db = new PGlite()
const owner = '11111111-1111-4111-8111-111111111111'
const admin = '22222222-2222-4222-8222-222222222222'
const visitor = '33333333-3333-4333-8333-333333333333'
const school = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const school2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const rows = async(sql, args = []) => (await db.query(sql,args)).rows
async function as(role, id) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || ''])
  await db.exec('set role ' + role)
}
await db.exec(`
create role anon; create role authenticated;
create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users(id uuid primary key);
create or replace function auth.uid() returns uuid
language sql stable security invoker as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;
create table public.school_public_urls (slug text primary key,school_id uuid,directory_id uuid);
insert into auth.users(id) values ('${owner}'),('${admin}'),('${visitor}');
insert into public.school_public_urls (slug,school_id) values
 ('gilgiltownship','${school}'),('other-school','${school2}');
insert into public.school_public_urls(slug,directory_id) values
 ('directory-school','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
create or replace function public.schools_resolve_url_public_v1(p_slug text,p_school_id uuid,p_directory_id uuid)
returns table(slug text,source_kind text,source_id uuid)
language sql stable security definer set search_path=public as $$
  select u.slug,case when u.school_id is not null then 'canonical' else 'directory' end,
   coalesce(u.school_id,u.directory_id)
  from public.school_public_urls u
  where p_slug=u.slug and p_school_id is null and p_directory_id is null
$$;
create or replace function public.is_platform_owner() returns boolean
language sql stable security definer set search_path=public as $$
  select auth.uid() = '${owner}'::uuid
$$;
create or replace function public.is_school_admin(p_school_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select auth.uid() = '${admin}'::uuid and p_school_id = '${school}'::uuid
$$;
grant execute on function public.schools_resolve_url_public_v1(text,uuid,uuid) to anon,authenticated;
grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.is_school_admin(uuid) to authenticated;
`)
await db.exec(readFileSync('supabase/migrations/20261115032400_school_public_content_foundation.sql','utf8'))

await as('anon')
assert.equal((await rows('select id from public.school_public_content')).length,0)
await assert.rejects(() => db.exec("insert into public.school_public_content(school_slug,author_id,publisher_kind,content_kind,title,body,status) values ('gilgiltownship','33333333-3333-4333-8333-333333333333','school','announcement','Fake','Fake public announcement','published')"), /permission denied/)
await assert.rejects(() => rows('select * from public.school_public_content_audit'), /permission denied/)

await as('authenticated',visitor)
await assert.rejects(() => db.exec(`insert into public.school_public_content(school_slug,author_id,publisher_kind,content_kind,title,body,status) values ('gilgiltownship','${visitor}','school','announcement','Fake','This should not be public','published')`), /row-level security/)
await as('authenticated',admin)
await db.exec(`insert into public.school_public_content(school_slug,author_id,publisher_kind,content_kind,title,body,status)
 values ('gilgiltownship','${admin}','school','announcement','School library','The library opens on Monday.','published')`)
assert.equal((await rows("select * from public.school_public_content")).length,1)
assert.equal((await rows("select * from public.school_public_content_audit")).length,1)

await assert.rejects(() => db.exec(`insert into public.school_public_content(school_slug,author_id,publisher_kind,content_kind,title,body,status)
 values ('other-school','${admin}','school','announcement','Intrusion','Wrong school announcement.','published')`), /row-level security/)
await assert.rejects(() => db.exec(`insert into public.school_public_content(school_slug,author_id,publisher_kind,content_kind,title,body,status)
 values ('directory-school','${admin}','school','announcement','Intrusion','Wrong directory publication.','published')`), /row-level security/)
await assert.rejects(() => db.exec(`insert into public.school_public_content(school_slug,author_id,publisher_kind,content_kind,title,body,status,academic_year,amount_kes,source_note)
 values ('gilgiltownship','${admin}','school','fees','Tuition','School fees for term one','published',2026,4000,'Verified school source')`), /row-level security|fees_require_hq_verification/)
await db.exec(`insert into public.school_public_content(school_slug,author_id,publisher_kind,content_kind,title,body,status)
 values ('gilgiltownship','${admin}','school','fees','Tuition','Term one fee information','draft')`)
assert.equal((await rows("select status from public.school_public_content where content_kind='fees'"))[0].status,'draft')

await as('authenticated',visitor)
assert.equal((await rows('select * from public.school_public_content')).length,1,'Visitors see only published posts')
assert.equal((await rows('select * from public.school_public_content_audit')).length,0,'Visitors cannot see audit trail')
await assert.rejects(() => db.exec("delete from public.school_public_content"), /permission denied/)

await as('authenticated',owner)
await db.exec(`update public.school_public_content set
 amount_kes=4000,academic_year=2026,term='Term 1',source_note='School-issued official fee schedule',
 status='published' where content_kind='fees'`)
const fee=(await rows("select * from public.school_public_content where content_kind='fees'"))[0]
assert.equal(Number(fee.amount_kes),4000)
assert.equal(fee.reviewed_by,owner)
assert.ok(fee.reviewed_at)
await db.exec(`insert into public.school_public_content(school_slug,author_id,publisher_kind,content_kind,title,body,status)
 values ('directory-school','${owner}','hq','announcement','VibeSchool note','An editorial update from HQ.','published')`)
await as('authenticated',admin)
assert.equal((await rows("select * from public.school_public_content where school_slug='gilgiltownship'")).length,2)
await assert.rejects(() => db.exec("update public.school_public_content set body='Unauthorized fee edit' where content_kind='fees'"),/row-level security|policy/)
await assert.rejects(() => db.exec(`update public.school_public_content set school_slug='other-school' where content_kind='announcement'`), /immutable_school_publication_identity/)
assert.equal((await rows("select * from public.school_public_content_audit where school_slug='gilgiltownship'")).length,3)
await as('anon')
assert.equal((await rows('select * from public.school_public_content')).length,3)
await assert.rejects(() => rows('select * from public.school_public_content_audit'),/permission denied/)
await db.exec('reset role')
console.log('PASS: public published-only reads, visitor isolation, cross-school rejection, directory HQ-only posting, fee owner approval, audit and immutable content identity')
await db.close()
