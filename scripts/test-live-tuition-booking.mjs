import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createLiveFixture} from './live-classroom-test-fixture.mjs'

const {db,rpc,id,teacher,a,b,solo,outsider,otherTeacher}=await createLiveFixture({learning:true})
try{
  await db.exec('alter table public.vibetutor_private_groups alter column id set default gen_random_uuid()')
  await db.exec(readFileSync(new URL('../supabase/migrations/20261106123211_vibetutor_private_lessons.sql',import.meta.url),'utf8'))
  await db.exec(readFileSync(new URL('../supabase/migrations/20261128070000_live_tuition_booking.sql',import.meta.url),'utf8'))
  const booking=id(110),future=id(111),other=id(112),expired=id(113)
  await db.query(`insert into public.vibetutor_lessons(id,invitation_id,tutor_id,student_id,title,starts_at,ends_at)
    values ($1,$5,$6,$7,'Booked fractions',now()+interval '2 minutes',now()+interval '42 minutes'),
    ($2,$5,$6,$7,'Later lesson',now()+interval '1 day',now()+interval '1 day 40 minutes'),
    ($3,$8,$6,$9,'Different learner',now()+interval '2 minutes',now()+interval '42 minutes'),
    ($4,$5,$6,$7,'Expired lesson',now()-interval '1 hour',now()-interval '20 minutes')`,
    [booking,future,other,expired,id(40),teacher,id(30),id(41),id(33)])
  async function as(who,query,params=[],role='authenticated'){
    await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${who||''}',false)`)
    try{return (await db.query(query,params)).rows}
    finally{await db.exec('reset role')}
  }
  async function book(who,bookingId,action='context',role='authenticated'){
    return (await as(who,'select public.vibe_live_tuition_booking($1,$2) as result',[bookingId,action],role))[0].result
  }
  assert.equal((await book(teacher,future)).state,'upcoming')
  assert.equal((await book(teacher,expired)).state,'ended')
  await assert.rejects(book(teacher,future,'start'),/live_booking_unavailable/)
  await assert.rejects(book(teacher,expired,'start'),/live_booking_unavailable/)
  for(const user of [b,solo,outsider,otherTeacher])await assert.rejects(book(user,booking),/live_not_authorized/)
  await assert.rejects(book(a,booking,'start'),/live_not_authorized/)
  await assert.rejects(book(a,booking,'join'),/live_booking_not_started/)
  await assert.rejects(book(null,booking,'context','anon'),/permission denied/)
  for(const role of ['anon','authenticated','service_role'])
    await assert.rejects(as(teacher,'select * from vibe_live.tuition_booking_rooms',[],role),/permission denied/)
  const room=await book(teacher,booking,'start')
  assert.equal(room.title,'Booked fractions')
  assert.equal(room.mode,'tuition')
  assert.equal(room.teacher,true)
  assert.equal((await book(teacher,booking,'start')).id,room.id,'Retries must reuse the same room')
  assert.equal((await book(a,booking)).roomId,room.id)
  const [{group_id:scope,expires_at:expiry,ends_at:end}]=
    (await db.query('select s.group_id,s.expires_at,l.ends_at from vibe_live.sessions s join vibe_live.tuition_booking_rooms b on b.room_id=s.id join public.vibetutor_lessons l on l.id=b.booking_id where s.id=$1',[room.id])).rows
  assert.equal(new Date(expiry).getTime(),new Date(end).getTime())
  await assert.rejects(db.query('insert into public.vibetutor_private_group_members(group_id,invitation_id) values($1,$2)',[scope,id(41)]),/live_booking_audience_fixed/)
  for(const user of [b,solo,outsider,otherTeacher]){
    await assert.rejects(rpc(user,'join',room.id,null,{},null),/live_not_authorized/)
    await assert.rejects(book(user,booking,'join'),/live_not_authorized/)
  }
  assert.equal((await book(a,booking,'join')).id,room.id)
  await assert.rejects(book(teacher,other,'start'),/live_end_previous_session/)
  assert.equal((await db.query('select count(*)::int n from vibe_live.tuition_booking_rooms')).rows[0].n,1,'Rejected starts cannot create an orphan room binding')
  await as(teacher,'select public.vibetutor_cancel_lesson($1)',[booking])
  assert.equal((await book(teacher,booking)).state,'cancelled')
  assert.equal((await book(a,booking)).roomId,null)
  assert.equal((await rpc(teacher,'get',room.id,null,{host:true},null)).status,'ended')
  await assert.rejects(rpc(a,'get',room.id,null,{},null),/live_not_authorized/)
  await assert.rejects(book(a,booking,'join'),/live_booking_unavailable/)
  await assert.rejects(rpc(teacher,'start',null,null,{host:true,title:'Reuse old booking',mode:'tuition',groupId:scope},null),/live_booking_unavailable|live_try_again/)
  await db.query("update vibe_live.sessions set created_at=now()-interval '20 seconds' where id=$1",[room.id])
  const otherRoom=await book(teacher,other,'start')
  assert.notEqual(otherRoom.id,room.id)
  assert.equal((await book(solo,other,'join')).id,otherRoom.id)
  await assert.rejects(rpc(a,'join',otherRoom.id,null,{},null),/live_not_authorized/)
  await db.query("update public.vibetutor_student_invitations set status='revoked' where id=$1",[id(41)])
  await assert.rejects(book(solo,other),/live_not_authorized/)
  await assert.rejects(rpc(solo,'get',otherRoom.id,null,{},null),/live_not_authorized/)
  console.log('PASS: private booked-room identity, fixed audience, timing, idempotency, cancellation, revoked connections, cross-booking isolation and direct table denial')
}finally{await db.close()}
