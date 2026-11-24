import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createLiveFixture } from './live-classroom-test-fixture.mjs'

const migration = readFileSync(new URL(
  '../supabase/migrations/20261125000000_live_classroom_mesh_pilot.sql', import.meta.url,
), 'utf8')
const audio = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=fingerprint:sha-256 A1:B2\r\na=rtpmap:111 opus/48000/2\r\n'

test('real mesh SQL reuses Live admission, restricts private media and follows the room lifecycle', async () => {
  const { db, rpc, id, teacher, a, b, outsider, cls, otherCls, otherTeacher } = await createLiveFixture()
  try {
    await db.exec('create table auth.users(id uuid primary key); insert into auth.users select id from public.profiles')
    await db.exec(migration)

    let room = await rpc(teacher, 'start', null, null, { title: 'Adult pilot lesson' })
    const teacherClient = id(70), learnerClient = id(71), secondTab = id(72)
    const call = async (who, action, client, epoch = null, sdp = null, options = {}) => {
      const { role = 'authenticated', classId = cls, roomId = room.id } = options
      await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${who ?? ''}',false)`)
      try {
        return (await db.query(
          'select public.vibe_live_mesh($1,$2,$3,$4,$5,$6) as result',
          [roomId, classId, action, client, epoch, sdp],
        )).rows[0].result
      } finally {
        await db.exec('reset role')
      }
    }
    const provision = (roomId, host, learner) => db.query(
      `insert into vibe_live.mesh_pilot(room_id,teacher_user,learner_user,verified_adults_at,expires_at)
       values($1,$2,$3,clock_timestamp(),clock_timestamp()+interval '30 minutes')`,
      [roomId, host, learner],
    )
    await assert.rejects(call(teacher, 'join', teacherClient), /mesh_unavailable/)
    await provision(room.id, teacher, a)
    await assert.rejects(call(null, 'join', teacherClient, null, null, { role: 'anon' }), /permission denied/)
    await assert.rejects(call(teacher, 'join', teacherClient, null, null, { role: 'service_role' }), /permission denied/)
    await db.exec('set role authenticated')
    await assert.rejects(db.exec('select * from vibe_live.mesh_pilot'), /permission denied/)
    await assert.rejects(db.exec('update vibe_live.mesh_pilot set daily_fallback=true'), /permission denied/)
    await db.exec('reset role')

    const host = await call(teacher, 'join', teacherClient)
    assert.equal(host.role, 'teacher')
    assert.equal(host.peerPresent, false)
    assert.equal(host.fallback, false)
    await assert.rejects(call(teacher, 'join', secondTab), /mesh_device_busy/)
    await assert.rejects(call(a, 'join', learnerClient), /live_join_required|live_not_authorized|mesh_denied/)
    await rpc(a, 'join', room.id)
    await rpc(b, 'join', room.id)
    await assert.rejects(call(b, 'join', secondTab), /mesh_unavailable/)
    await assert.rejects(call(outsider, 'fallback', secondTab), /mesh_denied/)
    const other = await rpc(otherTeacher, 'start', null, null, { title: 'Other classroom' }, otherCls)
    await assert.rejects(call(teacher, 'join', teacherClient, null, null, { roomId: other.id, classId: otherCls }), /mesh_unavailable/)
    await assert.rejects(call(teacher, 'poll', teacherClient, null, null, { classId: otherCls }), /live_|mesh_denied/)

    const learner = await call(a, 'join', learnerClient)
    assert.equal(learner.role, 'learner')
    assert.equal(learner.peerPresent, true)
    assert.equal(learner.learnerStudentId, null)
    const { epoch } = learner
    await assert.rejects(call(a, 'offer', learnerClient, epoch, audio), /mesh_bad_signal/)
    await assert.rejects(call(a, 'allow', learnerClient, epoch), /mesh_denied/)
    await assert.rejects(call(teacher, 'offer', teacherClient, host.epoch, audio), /mesh_stale/)
    await assert.rejects(call(teacher, 'offer', teacherClient, epoch, audio + 'm=video 9 UDP/TLS/RTP/SAVPF 100\r\n'), /mesh_bad_sdp/)
    const offer = await call(teacher, 'offer', teacherClient, epoch, audio)
    assert.equal(offer.offer, null)
    assert.equal(offer.learnerStudentId, id(30))
    assert.equal((await call(a, 'poll', learnerClient)).offer, audio)
    await assert.rejects(call(teacher, 'offer', teacherClient, epoch, audio), /mesh_bad_signal/)
    assert.equal((await call(a, 'answer', learnerClient, epoch, audio)).answer, null)
    assert.equal((await call(teacher, 'poll', teacherClient)).answer, audio)

    await assert.rejects(call(teacher, 'allow', teacherClient, epoch), /mesh_no_hand/)
    await rpc(a, 'help', room.id)
    assert.equal((await call(teacher, 'allow', teacherClient, epoch)).speaking, true)
    assert.equal((await rpc(teacher, 'get', room.id)).participants.find(p => p.studentId === id(30)).needsHelp, false)
    assert.equal((await call(a, 'poll', learnerClient)).speaking, true)
    await assert.rejects(call(a, 'revoke', learnerClient, epoch), /mesh_denied/)
    await call(teacher, 'revoke', teacherClient, epoch)
    assert.equal((await call(a, 'poll', learnerClient)).speaking, false)

    await db.query('update public.student_classes set is_current=false where student_id=$1', [id(30)])
    await assert.rejects(call(a, 'poll', learnerClient), /live_|mesh_denied/)
    assert.equal((await call(teacher, 'poll', teacherClient)).peerPresent, false)
    await db.query('update public.student_classes set is_current=true where student_id=$1', [id(30)])
    const recovered = await call(a, 'join', learnerClient)
    assert.ok(recovered.epoch > epoch)
    assert.equal(recovered.offer, null)
    assert.equal(recovered.speaking, false)

    await db.query("update vibe_live.mesh_pilot set learner_seen=clock_timestamp()-interval '17 seconds' where room_id=$1", [room.id])
    assert.equal((await call(teacher, 'poll', teacherClient)).peerPresent, false)
    await assert.rejects(call(a, 'poll', learnerClient), /mesh_lease_lost/)
    await call(a, 'join', secondTab)
    await call(a, 'leave', secondTab)
    assert.equal((await call(teacher, 'poll', teacherClient)).peerPresent, false)

    await call(a, 'join', learnerClient)
    const fresh = await call(teacher, 'poll', teacherClient)
    await call(teacher, 'offer', teacherClient, fresh.epoch, audio)
    room = await rpc(teacher, 'get', room.id)
    room = await rpc(teacher, 'pause', room.id, room.version)
    await assert.rejects(call(teacher, 'poll', teacherClient), /live_|mesh_denied/)
    assert.equal((await db.query('select offer from vibe_live.mesh_pilot')).rows[0].offer, null)
    room = await rpc(teacher, 'resume', room.id, room.version)
    assert.equal((await call(teacher, 'join', teacherClient)).peerPresent, false)
    await call(a, 'join', learnerClient)

    const fallback = await call(a, 'fallback', learnerClient)
    assert.equal(fallback.fallback, true)
    assert.equal(fallback.peerPresent, false)
    assert.equal((await call(teacher, 'poll', teacherClient)).fallback, true)
    assert.equal((await call(teacher, 'offer', teacherClient, fresh.epoch, audio)).answer, null)
    assert.equal((await db.query('select offer, answer, speaking from vibe_live.mesh_pilot')).rows[0].offer, null)

    await db.query("update vibe_live.mesh_pilot set expires_at=clock_timestamp()-interval '1 second' where room_id=$1", [room.id])
    await assert.rejects(call(teacher, 'poll', teacherClient), /mesh_denied/)
    room = await rpc(teacher, 'end', room.id, room.version)
    assert.equal(room.status, 'ended')
    assert.equal((await db.query('select count(*)::int as count from vibe_live.mesh_pilot')).rows[0].count, 0)
    await assert.rejects(call(teacher, 'join', teacherClient), /mesh_unavailable/)

    const open = await rpc(teacher, 'start', null, null, { mode: 'open', title: 'Adult admission test' }, null)
    const openScope = { roomId: open.id, classId: null }
    await provision(open.id, teacher, a)
    assert.equal((await call(teacher, 'join', teacherClient, null, null, openScope)).peerPresent, false)
    await rpc(a, 'wait_request', open.id, null, {}, null)
    await assert.rejects(call(a, 'join', learnerClient, null, null, openScope), /live_join_required/)
    await rpc(teacher, 'wait_decide', open.id, null, { host: true, studentId: id(30), admit: true }, null)
    await assert.rejects(call(a, 'join', learnerClient, null, null, openScope), /live_join_required/)
    await rpc(a, 'join', open.id, null, {}, null)
    assert.equal((await call(a, 'join', learnerClient, null, null, openScope)).peerPresent, true)
  } finally {
    await db.close()
  }
})
