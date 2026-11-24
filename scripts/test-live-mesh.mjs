import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createLiveFixture } from './live-classroom-test-fixture.mjs'

const migration = readFileSync(new URL(
  '../supabase/migrations/20261124192341_live_classroom_mesh_pilot.sql', import.meta.url,
), 'utf8')
const audio = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=fingerprint:sha-256 A1:B2\r\na=rtpmap:111 opus/48000/2\r\n'
const secondAudio = audio.replace('A1:B2', 'B3:C4')

test('real group SQL enforces role, recipient, lease, roster, speaking turn and room lifecycle', async () => {
  const { db, rpc, id, teacher, a, b, outsider, cls, otherCls, otherTeacher } = await createLiveFixture()
  try {
    await db.exec('create table auth.users(id uuid primary key); insert into auth.users select id from public.profiles')
    await db.exec(migration)
    let room = await rpc(teacher, 'start', null, null, { title: 'Adult group pilot' })
    const teacherClient = id(70), clientA = id(71), clientB = id(72), secondTab = id(73)
    const studentA = id(30), studentB = id(31)
    const call = async (who, action, client, { epoch = null, sdp = null, target = null,
      role = 'authenticated', classId = cls, roomId = room.id } = {}) => {
      await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${who ?? ''}',false)`)
      try {
        return (await db.query('select public.vibe_live_mesh($1,$2,$3,$4,$5,$6,$7) as result',
          [roomId, classId, action, client, epoch, sdp, target])).rows[0].result
      } finally {
        await db.exec('reset role')
      }
    }
    const provision = async (roomId, seats) => {
      await db.query(`insert into vibe_live.mesh_pilot(room_id,teacher_user,verified_adults_at,expires_at)
        values($1,$2,clock_timestamp(),clock_timestamp()+interval '30 minutes')`, [roomId, teacher])
      for (const [seat, user, student] of seats) await db.query(
        'insert into vibe_live.mesh_pilot_seats(room_id,seat,learner_user,student_id) values($1,$2,$3,$4)',
        [roomId, seat, user, student])
    }

    await assert.rejects(call(teacher, 'join', teacherClient), /mesh_unavailable/)
    await provision(room.id, [[1, a, studentA], [2, b, studentB]])
    await assert.rejects(db.query(
      'insert into vibe_live.mesh_pilot_seats(room_id,seat,learner_user,student_id) values($1,9,$2,$3)',
      [room.id, outsider, id(32)]), /check constraint/)
    await assert.rejects(call(null, 'join', teacherClient, { role: 'anon' }), /permission denied/)
    await assert.rejects(call(teacher, 'join', teacherClient, { role: 'service_role' }), /permission denied/)
    await db.exec('set role authenticated')
    try {
      await assert.rejects(db.exec('select * from vibe_live.mesh_pilot'), /permission denied/)
      await assert.rejects(db.exec('select * from vibe_live.mesh_pilot_seats'), /permission denied/)
      await assert.rejects(db.exec('update vibe_live.mesh_pilot_seats set speaking=true'), /permission denied/)
    } finally {
      await db.exec('reset role')
    }

    assert.deepEqual((await call(teacher, 'join', teacherClient)).peers, [])
    await assert.rejects(call(teacher, 'join', secondTab), /mesh_device_busy/)
    await assert.rejects(call(a, 'join', clientA), /live_join_required/)
    await rpc(a, 'join', room.id)
    await rpc(b, 'join', room.id)
    const otherRoom = await rpc(otherTeacher, 'start', null, null, { title: 'Other classroom' }, otherCls)
    await assert.rejects(call(teacher, 'join', teacherClient, { roomId: otherRoom.id, classId: otherCls }), /mesh_unavailable/)
    await assert.rejects(call(teacher, 'poll', teacherClient, { classId: otherCls }), /live_|mesh_denied/)
    await assert.rejects(call(outsider, 'join', secondTab), /mesh_unavailable/)

    const [edgeA] = (await call(a, 'join', clientA)).peers
    const [edgeB] = (await call(b, 'join', clientB)).peers
    assert.equal(edgeA.studentId, studentA)
    assert.equal(edgeB.studentId, studentB)
    assert.deepEqual((await call(teacher, 'poll', teacherClient)).peers.map(peer => peer.studentId), [studentA, studentB])
    await assert.rejects(call(b, 'join', secondTab), /mesh_device_busy/)
    await assert.rejects(call(a, 'offer', clientA, { epoch: edgeA.epoch, sdp: audio }), /mesh_denied/)
    await assert.rejects(call(a, 'fallback', clientA), /mesh_denied/)
    await assert.rejects(call(teacher, 'offer', teacherClient, { target: studentA, epoch: edgeA.epoch - 1, sdp: audio }), /mesh_stale/)
    await assert.rejects(call(teacher, 'offer', teacherClient, { target: studentA, epoch: edgeA.epoch,
      sdp: audio + 'm=video 9 UDP/TLS/RTP/SAVPF 100\r\n' }), /mesh_bad_sdp/)
    await call(teacher, 'offer', teacherClient, { target: studentA, epoch: edgeA.epoch, sdp: audio })
    await call(teacher, 'offer', teacherClient, { target: studentB, epoch: edgeB.epoch, sdp: secondAudio })
    assert.deepEqual((await call(a, 'poll', clientA)).peers.map(peer => peer.offer), [audio])
    assert.deepEqual((await call(b, 'poll', clientB)).peers.map(peer => peer.offer), [secondAudio])
    await assert.rejects(call(a, 'answer', clientA, { target: studentB, epoch: edgeB.epoch, sdp: audio }), /mesh_denied/)
    await call(a, 'answer', clientA, { epoch: edgeA.epoch, sdp: secondAudio })
    await call(b, 'answer', clientB, { epoch: edgeB.epoch, sdp: audio })
    const activeEdges = (await call(teacher, 'poll', teacherClient)).peers
    assert.deepEqual(activeEdges.map(peer => peer.offer), [null, null])
    assert.deepEqual(activeEdges.map(peer => peer.answer), [secondAudio, audio])

    await assert.rejects(call(teacher, 'allow', teacherClient, { target: studentA, epoch: edgeA.epoch }), /mesh_no_hand/)
    await rpc(a, 'help', room.id)
    await call(teacher, 'allow', teacherClient, { target: studentA, epoch: edgeA.epoch })
    assert.equal((await call(a, 'poll', clientA)).peers[0].speaking, true)
    assert.equal((await call(b, 'poll', clientB)).peers[0].speaking, false)
    assert.equal((await rpc(teacher, 'get', room.id)).participants.find(p => p.studentId === studentA).needsHelp, false)
    await rpc(b, 'help', room.id)
    const swapped = await call(teacher, 'allow', teacherClient, { target: studentB, epoch: edgeB.epoch })
    assert.deepEqual(swapped.peers.map(peer => peer.speaking), [false, true])
    await assert.rejects(call(a, 'revoke', clientA, { target: studentB, epoch: edgeB.epoch }), /mesh_denied/)
    await call(teacher, 'revoke', teacherClient, { target: studentB, epoch: edgeB.epoch })
    assert.equal((await call(b, 'poll', clientB)).peers[0].speaking, false)

    await db.query('update public.student_classes set is_current=false where student_id=$1', [studentA])
    await assert.rejects(call(a, 'poll', clientA), /live_|mesh_denied/)
    assert.deepEqual((await call(teacher, 'poll', teacherClient)).peers.map(peer => peer.studentId), [studentB])
    await db.query('update public.student_classes set is_current=true where student_id=$1', [studentA])
    const [newEdgeA] = (await call(a, 'join', clientA)).peers
    assert.ok(newEdgeA.epoch > edgeA.epoch)
    assert.equal(newEdgeA.offer, null)
    await db.query("update vibe_live.mesh_pilot_seats set learner_seen=clock_timestamp()-interval '17 seconds' where student_id=$1", [studentA])
    assert.deepEqual((await call(teacher, 'poll', teacherClient)).peers.map(peer => peer.studentId), [studentB])
    await assert.rejects(call(a, 'poll', clientA), /mesh_lease_lost/)
    await call(a, 'join', secondTab)
    await call(a, 'leave', secondTab)
    assert.deepEqual((await call(teacher, 'poll', teacherClient)).peers.map(peer => peer.studentId), [studentB])

    room = await rpc(teacher, 'get', room.id)
    room = await rpc(teacher, 'pause', room.id, room.version)
    await assert.rejects(call(teacher, 'poll', teacherClient), /live_|mesh_denied/)
    assert.equal((await db.query('select count(*)::int as count from vibe_live.mesh_pilot_seats where offer is not null')).rows[0].count, 0)
    room = await rpc(teacher, 'resume', room.id, room.version)
    await call(teacher, 'join', teacherClient)
    await call(b, 'join', clientB)
    const fallback = await call(teacher, 'fallback', teacherClient)
    assert.equal(fallback.fallback, true)
    assert.deepEqual(fallback.peers, [])
    assert.equal((await call(b, 'poll', clientB)).fallback, true)

    await db.query(`update vibe_live.mesh_pilot set verified_adults_at=now()-interval '1 hour',
      expires_at=now()-interval '1 second' where room_id=$1`, [room.id])
    await assert.rejects(call(teacher, 'poll', teacherClient), /mesh_denied/)
    room = await rpc(teacher, 'end', room.id, room.version)
    assert.equal(room.status, 'ended')
    assert.equal((await db.query('select count(*)::int as count from vibe_live.mesh_pilot_seats')).rows[0].count, 0)
    await assert.rejects(call(teacher, 'join', teacherClient), /mesh_unavailable/)

    const open = await rpc(teacher, 'start', null, null, { mode: 'open', title: 'Adult admission test' }, null)
    const openScope = { roomId: open.id, classId: null }
    await provision(open.id, [[1, a, studentA]])
    assert.deepEqual((await call(teacher, 'join', teacherClient, openScope)).peers, [])
    await rpc(a, 'wait_request', open.id, null, {}, null)
    await assert.rejects(call(a, 'join', clientA, openScope), /live_join_required/)
    await rpc(teacher, 'wait_decide', open.id, null, { host: true, studentId: studentA, admit: true }, null)
    await assert.rejects(call(a, 'join', clientA, openScope), /live_join_required/)
    await rpc(a, 'join', open.id, null, {}, null)
    assert.equal((await call(a, 'join', clientA, openScope)).peers.length, 1)
    await rpc(b, 'wait_request', open.id, null, {}, null)
    await rpc(teacher, 'wait_decide', open.id, null, { host: true, studentId: studentB, admit: true }, null)
    await rpc(b, 'join', open.id, null, {}, null)
    await assert.rejects(call(b, 'join', clientB, openScope), /mesh_unavailable/)
    assert.equal((await call(teacher, 'poll', teacherClient, openScope)).fallback, true)
    assert.equal((await call(a, 'poll', clientA, openScope)).fallback, true)
  } finally {
    await db.close()
  }
})

test('ordinary Live rooms open audio automatically, with no pilot provisioning or Daily', async () => {
  const { db, rpc, id, teacher, a, b, outsider, cls } = await createLiveFixture()
  try {
    await db.exec('create table auth.users(id uuid primary key); insert into auth.users select id from public.profiles')
    await db.exec(migration)
    await db.exec(readFileSync(new URL(
      '../supabase/migrations/20261124222141_live_classroom_mesh_classroom_admission.sql', import.meta.url,
    ), 'utf8'))
    const room = await rpc(teacher, 'start', null, null, { title: 'Ordinary classroom' })
    const call = async (user, action, client, { target = null, epoch = null, sdp = null } = {}) => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user])
      await db.exec('set role authenticated')
      try {
        return (await db.query('select public.vibe_live_mesh($1,$2,$3,$4,$5,$6,$7) as result',
          [room.id, cls, action, client, epoch, sdp, target])).rows[0].result
      } finally {
        await db.exec('reset role')
      }
    }
    const host = id(70)
    const clients = [{ user: a, student: id(30), device: id(71) }, { user: b, student: id(31), device: id(72) }]
    for (let n = 2; n < 9; n++) {
      const seat = { user: id(100 + n), student: id(200 + n), device: id(300 + n) }
      await db.query('insert into auth.users values($1)', [seat.user])
      await db.query("insert into public.profiles(id,account_status) values($1,'active')", [seat.user])
      await db.query("insert into public.students values($1,$2,null,'Fixture')", [seat.student, seat.user])
      await db.query('insert into public.student_classes values($1,$2,(select school_id from public.classes where id=$2),true)',
        [seat.student, cls])
      clients.push(seat)
    }

    await assert.rejects(call(outsider, 'join', id(99)), /live_|mesh_denied/)
    await assert.rejects(call(a, 'join', id(71)), /live_join_required/)
    assert.equal((await db.query('select count(*)::int as n from vibe_live.mesh_pilot')).rows[0].n, 0)
    assert.deepEqual((await call(teacher, 'join', host)).peers, [])
    for (const c of clients) await rpc(c.user, 'join', room.id)
    for (const c of clients.slice(0, 8)) {
      assert.deepEqual((await call(c.user, 'join', c.device)).peers.map(peer => peer.studentId), [c.student])
    }
    const ninth = clients[8]
    await assert.rejects(call(ninth.user, 'join', ninth.device), /mesh_full/)
    assert.equal((await call(teacher, 'poll', host)).peers.length, 8)
    await assert.rejects(call(teacher, 'fallback', host), /mesh_denied/)
    const first = clients[0]
    const [oldEdge] = (await call(first.user, 'poll', first.device)).peers
    await call(first.user, 'leave', first.device)
    await call(ninth.user, 'join', ninth.device)
    await db.query('update public.student_classes set is_current=false where student_id=$1', [ninth.student])
    await assert.rejects(call(ninth.user, 'poll', ninth.device), /live_|mesh_denied/)
    const [newEdge] = (await call(first.user, 'join', first.device)).peers
    assert.ok(newEdge.epoch > oldEdge.epoch)
    await assert.rejects(call(teacher, 'offer', host, { target: first.student, epoch: oldEdge.epoch, sdp: audio }), /mesh_stale/)
    assert.equal((await call(teacher, 'poll', host)).peers.length, 8)
    const current = await rpc(teacher, 'get', room.id)
    await rpc(teacher, 'end', room.id, current.version)
    assert.equal((await db.query('select count(*)::int as n from vibe_live.mesh_pilot_seats')).rows[0].n, 0)
  } finally {
    await db.close()
  }
})
