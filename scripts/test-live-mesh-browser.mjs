import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { createLiveFixture } from './live-classroom-test-fixture.mjs'

const require = createRequire(import.meta.url)
const modules = '/tmp/live-test/node_modules'
const { build } = require(modules + '/esbuild')
const { chromium } = require(modules + '/playwright')
const { db, rpc, teacher, a, b, id, cls } = await createLiveFixture()
const raisedId = id(30)
const listenerId = id(31)
const openClassrooms = process.env.MESH_OPEN_CLASSROOMS === '1'
const learnerCount = Number(process.env.MESH_BROWSER_LEARNERS ?? 2)
assert.ok(Number.isInteger(learnerCount) && learnerCount >= 2 && learnerCount <= 8)
const seats = [
  { path: '/learner', user: a, student: raisedId },
  { path: '/listener', user: b, student: listenerId },
]
for (let i = 2; i < learnerCount; i++) {
  seats.push({ path: '/listener-' + i, user: id(100 + i), student: id(200 + i) })
}
const migration = readFileSync(new URL('../supabase/migrations/20261124192341_live_classroom_mesh_pilot.sql', import.meta.url), 'utf8')
await db.exec('create table auth.users(id uuid primary key); insert into auth.users select id from public.profiles')
await db.exec(migration)
if (openClassrooms) await db.exec(readFileSync(new URL(
  '../supabase/migrations/20261124221323_live_classroom_mesh_classroom_admission.sql', import.meta.url,
), 'utf8'))
const room = await rpc(teacher, 'start', null, null, { title: 'VibeMesh browser fixture' })
for (const seat of seats.slice(2)) {
  await db.query('insert into auth.users(id) values($1)', [seat.user])
  await db.query("insert into public.profiles(id,account_status) values($1,'active')", [seat.user])
  await db.query("insert into public.students values($1,$2,null,'Adult fixture')", [seat.student, seat.user])
  await db.query('insert into public.student_classes values($1,$2,(select school_id from public.classes where id=$2),true)',
    [seat.student, cls])
}
if (!openClassrooms) {
  await db.query(`insert into vibe_live.mesh_pilot(room_id,teacher_user,verified_adults_at,expires_at)
    values($1,$2,now(),now()+interval '30 minutes')`, [room.id, teacher])
  for (const [index, seat] of seats.entries()) {
    await db.query('insert into vibe_live.mesh_pilot_seats(room_id,seat,learner_user,student_id) values($1,$2,$3,$4)',
      [room.id, index + 1, seat.user, seat.student])
  }
}
const fixtureUsers = new Map([['/teacher', teacher], ...seats.map(seat => [seat.path, seat.user])])

const bundled = await build({
  stdin: {
    loader: 'tsx', resolveDir: process.cwd(), contents: `
      import { createRoot } from 'react-dom/client';
      import { LiveVoice } from './components/live-classroom/LiveVoice';
      const teacher = location.pathname === '/teacher';
      createRoot(document.getElementById('root')).render(<LiveVoice
        roomId="${room.id}" classId="${cls}" teacher={teacher} enabled status="active"
        learners={teacher ? [{studentId:"${raisedId}",name:"Learner A",needsHelp:true}] : []}
        onAcknowledge={async () => { throw Error("Mesh must acknowledge via guarded SQL"); }}
      />);`,
  },
  bundle: true, write: false, outdir: 'out', entryNames: 'app', jsx: 'automatic', platform: 'browser',
  nodePaths: [modules],
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.NEXT_PUBLIC_VIBE_LIVE_MESH_PILOT_ENABLED': 'undefined',
    'process.env.NEXT_PUBLIC_VIBE_LIVE_DAILY_ENABLED': openClassrooms ? 'undefined' : '"true"',
  },
  plugins: [{
    name: 'isolated-supabase-rpc',
    setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: 'fixture', namespace: 'test' }))
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `
        export const supabase = {
          auth: {
            getSession: async () => ({data:{session:{user:{id:location.pathname}}}}),
            onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}}),
          },
          rpc(name, payload) {
            return { abortSignal: async signal => {
              if (name !== 'vibe_live_mesh') throw Error('Unexpected fixture RPC');
              const response = await fetch(location.pathname + '/signal', {
                method:'POST', body:JSON.stringify(payload), signal,
              });
              return response.json();
            }};
          },
        };` }))
    },
  }],
})
const files = new Map(bundled.outputFiles.map(file => ['/' + file.path.split('/').at(-1), file.contents]))
let queue = Promise.resolve()
const serial = callback => {
  const operation = queue.then(callback)
  queue = operation.catch(() => {})
  return operation
}
const server = createServer(async (req, res) => {
  if (files.has(req.url)) {
    res.writeHead(200, { 'Content-Type': req.url.endsWith('.js') ? 'text/javascript' : 'text/css' })
    res.end(files.get(req.url))
    return
  }
  if (fixtureUsers.has(req.url)) {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<!doctype html><html><div id="root"></div><script src="/app.js"></script></html>')
    return
  }
  if (req.url === '/unavailable') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<!doctype html><html><div id="root"></div><script src="/app.js"></script></html>')
    return
  }
  if (req.url === '/unavailable/signal') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: { code: 'PGRST202' } }))
    return
  }
  const endpoint = req.url.endsWith('/signal') && fixtureUsers.get(req.url.slice(0, -'/signal'.length))
  if (!endpoint || req.method !== 'POST') {
    res.writeHead(404).end()
    return
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const { p_room, p_class, p_action, p_client, p_epoch, p_sdp, p_target } = JSON.parse(Buffer.concat(chunks).toString())
  const reply = await serial(async () => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [endpoint])
    await db.exec('set role authenticated')
    try {
      const { rows } = await db.query('select public.vibe_live_mesh($1,$2,$3,$4,$5,$6,$7) as data',
        [p_room, p_class, p_action, p_client, p_epoch, p_sdp, p_target])
      return rows[0]
    } catch (error) {
      return { error: { code: error.code } }
    } finally {
      await db.exec('reset role')
    }
  })
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(reply))
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))

let browser
try {
  browser = await chromium.launch({
    args: [
      '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
      '--allow-loopback-in-peer-connection', '--disable-features=WebRtcHideLocalIpsWithMdns',
    ],
  })
  const open = async role => {
    const context = await browser.newContext({ viewport: { width: 390, height: 760 }, permissions: ['microphone'] })
    await context.addInitScript(() => {
      // Deterministic local ICE. The browser still performs real SDP, DTLS and audio transport.
      const NativePeer = window.RTCPeerConnection
      window.peerConnections = []
      window.micTracks = []
      window.RTCPeerConnection = class extends NativePeer {
        constructor() {
          super({ iceServers: [] })
          window.peerConnections.push(this)
        }
      }
      const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = async constraints => {
        if (constraints.video !== false) throw Error('VibeMesh must be audio-only')
        const stream = await capture(constraints)
        window.micTracks.push(...stream.getAudioTracks())
        return stream
      }
    })
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:${server.address().port}/${role}`)
    return page
  }
  const unavailable = await open('unavailable')
  if (openClassrooms) {
    await unavailable.getByRole('alert').getByText('VibeMesh audio unavailable.').waitFor()
    assert.equal(await unavailable.getByRole('button', { name: 'Join audio' }).count(), 0)
  } else {
    await unavailable.getByRole('button', { name: 'Join audio' }).waitFor()
  }
  assert.equal(await unavailable.evaluate(() => window.peerConnections.length), 0)
  await unavailable.context().close()

  const host = await open('teacher')
  await host.getByRole('status').getByText('Waiting for learners').waitFor()
  assert.equal(await host.evaluate(() => window.micTracks.length), 0)
  for (const seat of seats) await serial(() => rpc(seat.user, 'join', room.id))
  const learnerPages = await Promise.all(seats.map(seat => open(seat.path.slice(1))))
  const [learner, listener] = learnerPages
  const group = [host, ...learnerPages]
  await Promise.all(group.map(page => page.getByRole('status').getByText('Connected').waitFor()))
  await host.getByText('Learners on audio: ' + learnerCount).waitFor()
  for (const page of learnerPages) {
    assert.equal(await page.getByRole('button', { name: 'Unmute' }).isDisabled(), true)
    assert.equal(await page.evaluate(() => window.micTracks.length), 0)
    assert.equal(await page.evaluate(() => window.peerConnections.length), 1)
  }

  const hearsAudio = page => page.waitForFunction(async () => {
    for (const peer of window.peerConnections) {
      for (const row of (await peer.getStats()).values()) {
        if (row.type === 'inbound-rtp' && row.kind === 'audio' && row.audioLevel > 0.01) return true
      }
    }
    return false
  })

  await host.getByRole('button', { name: 'Unmute' }).click()
  await host.getByRole('button', { name: 'Mute', exact: true }).waitFor()
  await Promise.all(learnerPages.map(hearsAudio))
  await host.getByRole('button', { name: 'Mute', exact: true }).click()
  await host.waitForFunction(() => window.micTracks[0]?.enabled === false)
  await host.getByRole('button', { name: 'Unmute' }).click()
  assert.deepEqual(await host.evaluate(() => [window.micTracks.length, window.peerConnections.length]), [1, learnerCount])
  await host.getByRole('button', { name: 'Mute', exact: true }).click()

  await serial(() => rpc(a, 'help', room.id))
  await host.getByRole('button', { name: 'Allow Learner A to speak' }).click()
  await learner.getByRole('button', { name: 'Unmute' }).click()
  await learner.getByRole('button', { name: 'Mute', exact: true }).waitFor()
  await Promise.all([host, ...learnerPages.slice(1)].map(hearsAudio))
  assert.equal(await listener.getByRole('button', { name: 'Unmute' }).isDisabled(), true)
  await host.getByRole('button', { name: 'End speaking turn' }).click()
  await learner.waitForFunction(() => window.micTracks[0]?.readyState === 'ended')
  await listener.waitForFunction(async () => {
    const stats = await window.peerConnections[0].getStats()
    return Array.from(stats.values()).some(row => row.type === 'inbound-rtp' && row.kind === 'audio' && row.audioLevel < 0.001)
  })

  if (openClassrooms) {
    assert.equal(await host.getByRole('button', { name: 'Use Daily audio' }).count(), 0)
  } else {
    await host.getByRole('button', { name: 'Use Daily audio' }).click()
    await Promise.all(group.map(page => page.getByRole('button', { name: 'Join audio' }).waitFor()))
    assert.equal(await host.evaluate(() => window.micTracks[0].readyState), 'ended')
    await Promise.all(group.map(page => page.waitForFunction(() =>
      window.peerConnections.every(peer => peer.connectionState === 'closed'))))

    // Fresh direct connections exercise database-driven end before the UI state updates.
    await serial(() => db.query('update vibe_live.mesh_pilot set daily_fallback=false where room_id=$1', [room.id]))
    await Promise.all(group.map(page => page.reload()))
    await host.getByText('Learners on audio: ' + learnerCount).waitFor()
  }
  await host.getByRole('button', { name: 'Unmute' }).click()
  await host.getByRole('button', { name: 'Mute', exact: true }).waitFor()
  await serial(async () => {
    const current = await rpc(teacher, 'get', room.id)
    await rpc(teacher, 'end', room.id, current.version)
  })
  await Promise.all(group.map(page => page.waitForFunction(() =>
    window.peerConnections.length > 0 && window.peerConnections.every(peer => peer.connectionState === 'closed'))))
  assert.equal(await host.evaluate(() => window.micTracks[0].readyState), 'ended')
  console.log('PASS: teacher and ' + learnerCount + ' learners exchanged real audio; consent, relay, revoke, provider selection and lesson end verified')
} finally {
  await browser?.close()
  await queue
  await db.close()
  server.close()
}
