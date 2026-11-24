import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { createLiveFixture } from './live-classroom-test-fixture.mjs'

const require = createRequire(import.meta.url)
const modules = '/tmp/live-test/node_modules'
const { build } = require(modules + '/esbuild')
const { chromium } = require(modules + '/playwright')
const { db, rpc, teacher, a, id, cls } = await createLiveFixture()
const raisedId = id(30)
const migration = readFileSync(new URL('../supabase/migrations/20261125000000_live_classroom_mesh_pilot.sql', import.meta.url), 'utf8')
await db.exec('create table auth.users(id uuid primary key); insert into auth.users select id from public.profiles')
await db.exec(migration)
const room = await rpc(teacher, 'start', null, null, { title: 'VibeMesh browser fixture' })
await db.query(`insert into vibe_live.mesh_pilot(room_id,teacher_user,learner_user,verified_adults_at,expires_at)
  values($1,$2,$3,now(),now()+interval '30 minutes')`, [room.id, teacher, a])

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
    'process.env.NEXT_PUBLIC_VIBE_LIVE_MESH_PILOT_ENABLED': '"true"',
    'process.env.NEXT_PUBLIC_VIBE_LIVE_MESH_PILOT_ROOM_ID': JSON.stringify(room.id),
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
  if (req.url === '/teacher' || req.url === '/learner') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<!doctype html><html><div id="root"></div><script src="/app.js"></script></html>')
    return
  }
  if (!['/teacher/signal', '/learner/signal'].includes(req.url) || req.method !== 'POST') {
    res.writeHead(404).end()
    return
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const { p_room, p_class, p_action, p_client, p_epoch, p_sdp } = JSON.parse(Buffer.concat(chunks).toString())
  const who = req.url === '/teacher/signal' ? teacher : a
  const reply = await serial(async () => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [who])
    await db.exec('set role authenticated')
    try {
      const { rows } = await db.query('select public.vibe_live_mesh($1,$2,$3,$4,$5,$6) as data',
        [p_room, p_class, p_action, p_client, p_epoch, p_sdp])
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
  const host = await open('teacher')
  await host.getByRole('status').getByText('Waiting for learner').waitFor()
  assert.equal(await host.evaluate(() => window.micTracks.length), 0)
  await serial(() => rpc(a, 'join', room.id))
  const learner = await open('learner')
  await Promise.all([host, learner].map(page => page.getByRole('status').getByText('Connected').waitFor()))
  assert.equal(await learner.getByRole('button', { name: 'Unmute' }).isDisabled(), true)
  assert.equal(await learner.evaluate(() => window.micTracks.length), 0)

  await host.getByRole('button', { name: 'Unmute' }).click()
  await host.getByRole('button', { name: 'Mute', exact: true }).waitFor()
  await learner.waitForFunction(async () => {
    const stats = await window.peerConnections[0].getStats()
    return Array.from(stats.values()).some(row => row.type === 'inbound-rtp' && row.kind === 'audio' && row.packetsReceived > 0)
  })
  await host.getByRole('button', { name: 'Mute', exact: true }).click()
  assert.equal(await host.evaluate(() => window.micTracks[0].enabled), false)
  await host.getByRole('button', { name: 'Unmute' }).click()
  assert.deepEqual(await host.evaluate(() => [window.micTracks.length, window.peerConnections.length]), [1, 1])

  await serial(() => rpc(a, 'help', room.id))
  await host.getByRole('button', { name: 'Allow Learner A to speak' }).click()
  await learner.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Unmute' && !button.disabled))
  await learner.getByRole('button', { name: 'Unmute' }).click()
  await learner.getByRole('button', { name: 'Mute', exact: true }).waitFor()
  await host.waitForFunction(async () => {
    const stats = await window.peerConnections[0].getStats()
    return Array.from(stats.values()).some(row => row.type === 'inbound-rtp' && row.kind === 'audio' && row.packetsReceived > 0)
  })
  await host.getByRole('button', { name: 'End speaking turn' }).click()
  await learner.waitForFunction(() => window.micTracks[0]?.readyState === 'ended')
  await host.getByRole('button', { name: 'Use Daily audio' }).click()
  await Promise.all([host, learner].map(page => page.getByRole('button', { name: 'Join audio' }).waitFor()))
  assert.equal(await host.evaluate(() => window.micTracks[0].readyState), 'ended')
  assert.equal(await host.evaluate(() => window.peerConnections[0].connectionState), 'closed')
  assert.equal(await learner.evaluate(() => window.peerConnections[0].connectionState), 'closed')
  // Start a new direct connection in the same isolated fixture to verify end
  // closes media even when the classroom status prop has yet to refresh.
  await serial(() => db.query('update vibe_live.mesh_pilot set daily_fallback=false where room_id=$1', [room.id]))
  await Promise.all([host.reload(), learner.reload()])
  await Promise.all([host, learner].map(page => page.getByRole('status').getByText('Connected').waitFor()))
  await host.getByRole('button', { name: 'Unmute' }).click()
  await host.getByRole('button', { name: 'Mute', exact: true }).waitFor()
  await serial(async () => {
    const current = await rpc(teacher, 'get', room.id)
    await rpc(teacher, 'end', room.id, current.version)
  })
  await Promise.all([host, learner].map(page =>
    page.waitForFunction(() => window.peerConnections[0]?.connectionState === 'closed')))
  assert.equal(await host.evaluate(() => window.micTracks[0].readyState), 'ended')
  console.log('PASS: two browsers exchange WebRTC audio through private SQL; consent, mute, revoke, Daily fallback and lesson end verified')
} finally {
  await browser?.close()
  await queue
  await db.close()
  server.close()
}
