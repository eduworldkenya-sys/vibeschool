import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createLiveFixture} from './live-classroom-test-fixture.mjs'

// Real migration in PGlite with synthetic canonical identities. No production writes.
const fixture=await createLiveFixture()
const {db,rpc,teacher,a,b,outsider}=fixture
try {
  await db.exec("create schema storage; create table storage.buckets(id text primary key,name text,public boolean not null,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb); alter table storage.objects enable row level security; grant usage on schema storage to authenticated,anon; grant select,insert,delete on storage.objects to authenticated; grant select on storage.buckets to authenticated;")
  await db.exec(readFileSync(new URL('../supabase/migrations/20261121073938_live_private_session_assets.sql',import.meta.url),'utf8'))
  await db.exec('revoke select on public.profiles from authenticated,anon')
  await db.exec(readFileSync(new URL('../supabase/migrations/20261127152039_20261124220843_live_studio_private_files.sql',import.meta.url),'utf8'))
  const room=await rpc(teacher,'start',null,null,{title:'Grade 4 Private PDF'})
  const sid=room.id
  await rpc(a,'join',sid)
  const fid=fixture.id(870),assetId=fixture.id(871)
  async function as(who,job,role='authenticated') {
    await db.exec("set role "+role+"; select set_config('request.jwt.claim.sub','"+(who||"")+"',false);")
    try{return await job()} finally{await db.exec('reset role;')}
  }
  async function rows(who,sql,values=[],role='authenticated') {return as(who,()=>db.query(sql,values),role)}
  const bucket=(await db.query("select public,file_size_limit from storage.buckets where id='vibe-live-private'")).rows[0]
  assert.equal(bucket.public,false)
  assert.equal(Number(bucket.file_size_limit),8388608)
  const insert="insert into public.live_classroom_assets(id,session_id,title,mime_type,byte_size) values($1,$2,'Fractions worksheet','application/pdf',2048) returning object_path"
  await assert.rejects(rows(outsider,insert,[assetId,sid]),/policy|permission|denied/i)
  await assert.rejects(rows(a,insert,[assetId,sid]),/policy|permission|denied/i)
  const data=(await rows(teacher,insert,[assetId,sid])).rows[0]
  assert.equal(data.object_path,sid+'/'+assetId+'.pdf')
  assert.equal((await rows(a,'select id from public.live_classroom_assets')).rows.length,0)
  assert.equal((await rows(b,'select id from public.live_classroom_assets')).rows.length,0)
  await assert.rejects(rows(teacher,'update public.live_classroom_assets set shared_at=now() where id=$1',[assetId]),/live_asset_unavailable/i)
  await assert.rejects(rows(outsider,"insert into storage.objects(bucket_id,name) values('vibe-live-private',$1)",[data.object_path]),/policy|denied|permission/i)
  await rows(teacher,"insert into storage.objects(bucket_id,name,metadata) values('vibe-live-private',$1,'{}'::jsonb)",[data.object_path])
  assert.equal((await rows(a,"select name from storage.objects where bucket_id='vibe-live-private'")).rows.length,0)
  await rows(teacher,'update public.live_classroom_assets set shared_at=now() where id=$1',[assetId])
  assert.equal((await rows(a,'select id from public.live_classroom_assets')).rows.length,1)
  assert.equal((await rows(a,"select name from storage.objects where bucket_id='vibe-live-private'")).rows.length,1)
  assert.equal((await rows(b,'select id from public.live_classroom_assets')).rows.length,0)
  assert.equal((await rows(outsider,'select id from public.live_classroom_assets')).rows.length,0)
  const failedUpdate=await rows(a,'update public.live_classroom_assets set shared_at=null where id=$1 returning id',[assetId])
  assert.equal(failedUpdate.rows.length,0)
  await db.query('update student_classes set is_current=false where student_id=$1',[fixture.id(30)])
  assert.equal((await rows(a,'select id from public.live_classroom_assets')).rows.length,0)
  await db.query('update student_classes set is_current=true where student_id=$1',[fixture.id(30)])
  assert.equal((await rows(a,'select id from public.live_classroom_assets')).rows.length,1)
  const latest=await rpc(teacher,'get',sid)
  await rpc(teacher,'end',sid,latest.version)
  assert.equal((await rows(a,'select id from public.live_classroom_assets')).rows.length,1)
  await rows(teacher,'update public.live_classroom_assets set shared_at=null where id=$1',[assetId])
  assert.equal((await rows(a,'select id from public.live_classroom_assets')).rows.length,0)
  assert.equal((await rows(a,"select name from storage.objects where bucket_id='vibe-live-private'")).rows.length,0)
  await assert.rejects(rows(teacher,"insert into public.live_classroom_assets(id,session_id,title,mime_type,byte_size) values($1,$2,'Late upload','image/png',200)",[fid,sid]),/policy|permission|denied/i)
  await assert.rejects(rows(outsider,'select public.live_asset_room_access($1,false)',[sid],'anon'),/permission|denied/i)
  const studioBucket=(await db.query("select public,file_size_limit from storage.buckets where id='vibe-live-studio-private'")).rows[0]
  assert.equal(studioBucket.public,false);assert.equal(Number(studioBucket.file_size_limit),8388608)
  const source=teacher+'/'+'a'.repeat(64)+'.pdf', otherSource=fixture.otherTeacher+'/'+'b'.repeat(64)+'.png'
  const uploadStudio="insert into storage.objects(bucket_id,name) values('vibe-live-studio-private',$1)"
  await rows(teacher,uploadStudio,[source]);await rows(fixture.otherTeacher,uploadStudio,[otherSource])
  await assert.rejects(rows(a,uploadStudio,[a+'/'+'c'.repeat(64)+'.pdf']),/policy|denied|permission/i)
  await assert.rejects(rows(fixture.otherTeacher,uploadStudio,[teacher+'/'+'c'.repeat(64)+'.pdf']),/policy|denied|permission/i)
  await assert.rejects(rows(teacher,uploadStudio,[teacher+'/bad.html']),/policy|denied|permission/i)
  const studioRead="select name from storage.objects where bucket_id='vibe-live-studio-private'"
  assert.deepEqual((await rows(teacher,studioRead)).rows.map(x=>x.name),[source])
  assert.deepEqual((await rows(fixture.otherTeacher,studioRead)).rows.map(x=>x.name),[otherSource])
  assert.equal((await rows(a,studioRead)).rows.length,0)
  assert.equal((await rows(outsider,studioRead)).rows.length,0)
  assert.equal((await rows(fixture.otherTeacher,"delete from storage.objects where bucket_id='vibe-live-studio-private' and name=$1 returning id",[source])).rows.length,0)
  await db.query("update public.profiles set account_status='suspended' where id=$1",[teacher])
  assert.equal((await rows(teacher,studioRead)).rows.length,0)
  await db.query("update public.profiles set account_status='active' where id=$1",[teacher])
  assert.equal((await rows(teacher,"delete from storage.objects where bucket_id='vibe-live-studio-private' and name=$1 returning id",[source])).rows.length,1)
  const policies=(await db.query("select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'live_file_%'")).rows
  assert.equal(policies.length,3)
  console.log('PASS: private PDF/photo bucket, sharing, joined-only learners, revocation, ended read and storage RLS')
} finally {await db.close()}
