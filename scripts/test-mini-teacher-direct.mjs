import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { NextRequest } from 'next/server.js'
import test from 'node:test'
import sharp from 'sharp'
import { validTeacherMiniPhoto } from '../lib/minis/teacher-photo.ts'

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8')
const route = read('app/api/minis/safety/route.ts')
const sql = read('supabase/migrations/20261125190000_mini_teacher_direct_photo.sql')

test('direct teacher release is authenticated, owner-bound, and bypasses external screening only for direct drafts', () => {
  const direct = route.slice(route.indexOf('async function releaseTeacherPhoto'), route.indexOf('export async function POST'))
  assert.match(direct, /MINI_TEACHER_PHOTO_POSTING_ENABLED !== 'true'/)
  assert.match(direct, /item.slide_deck != null \|\| item.audio_path \|\| item.request_id/)
  assert.match(direct, /await validTeacherMiniPhoto/)
  assert.doesNotMatch(direct, /moderate\(|MINI_GOOGLE|mini_safety_claim|fetch\(/)
  assert.match(route, /getUser\(bearer\)[\s\S]+!==actor[\s\S]+target==='mini' && item.publication_method==='teacher_direct_photo'[\s\S]+releaseTeacherPhoto\(db,item,actor\)[\s\S]+MINI_GOOGLE_SAFETY_API_KEY/)
})

test('spoofed teachers, known minors and legacy drafts cannot acquire direct publishing authority', () => {
  assert.match(sql, /p.role::text='teacher'/)
  assert.match(sql, /p.parental_consent_at is null and p.parental_consent_by is null/)
  assert.match(sql, /date_of_birth <= \(current_date - interval '18 years'\)::date/)
  assert.match(sql, /mini_verified_adult\(p.id\) or exists/)
  assert.match(sql, /v.tsc_status='verified'[\s\S]+v.verified_by <> p.id/)
  assert.doesNotMatch(sql, /school_members|user_metadata|vibetutor_tutors/)
  assert.match(sql, /publication_method is distinct from 'teacher_direct_photo'/)
  assert.match(sql, /revoke all on function public.mini_release_teacher_photo[^\n]+ from public,anon,authenticated/)
  assert.match(sql, /grant execute on function public.mini_release_teacher_photo[^\n]+ to service_role/)
})

test('consent, exact version, retry, public visibility and reporting remain guarded', () => {
  assert.match(sql, /p_consent->'accepted' is distinct from 'true'::jsonb/)
  assert.match(sql, /v_existing.creator_id=v_user[\s\S]+is not distinct from \(p_title,p_body/)
  assert.match(sql, /where id=p_id and creator_id=p_actor for update/)
  assert.match(sql, /v_item.status='approved' then return true/)
  assert.match(sql, /v_item.updated_at is distinct from p_version/)
  assert.match(sql, /status='approved' and public.mini_public_version\(creator_id,publication_method\)/)
  assert.match(sql, /alter policy mini_reports_create_own[\s\S]+reporter_id=\(select auth.uid\(\)\)[\s\S]+m.status='approved'/)
  assert.doesNotMatch(sql, /mini_safety_scans|insert into public.mini_creator_clearances/)
  const action = read('lib/minis/actions.ts')
  assert.match(action, /upsert: false/)
  assert.match(action, /byte === storedBytes\[index\]/)
  assert.match(action, /await uploadMiniTeacherPhoto[\s\S]+await postMiniTeacherPhoto\(direct.id\)/)
})

test('real image decoding rejects forged MIME, truncated images, metadata and oversized input', async () => {
  const image = sharp({create:{width:120,height:90,channels:3,background:'#324561'}})
  const jpeg = await image.clone().jpeg().toBuffer()
  const png = await image.clone().png().toBuffer()
  const pixels = Buffer.from(Array.from({length:120*90*3}, (_, i) => (i*37 + Math.floor(i/21)*13)%256))
  const webp = await sharp(pixels,{raw:{width:120,height:90,channels:3}}).webp().toBuffer()
  const cover = (bytes, type='image/jpeg') => new Blob([bytes], {type})
  assert.equal(await validTeacherMiniPhoto(cover(jpeg),'jpg'), true)
  assert.equal(await validTeacherMiniPhoto(cover(png,'image/png'),'png'), true)
  assert.equal(await validTeacherMiniPhoto(cover(webp,'image/webp'),'webp'), true)
  assert.equal(await validTeacherMiniPhoto(cover(png),'jpg'), false)
  assert.equal(await validTeacherMiniPhoto(cover(Buffer.alloc(1200)),'jpg'), false)
  assert.equal(await validTeacherMiniPhoto(cover(jpeg.subarray(0,jpeg.length-20)),'jpg'), false)
  assert.equal(await validTeacherMiniPhoto(cover(await image.clone().withExif({IFD0:{Artist:'Test'}}).jpeg().toBuffer()),'jpg'), false)
  assert.equal(await validTeacherMiniPhoto(cover(Buffer.alloc(5*1024*1024+1)),'jpg'), false)
})

test('the real release handler posts a teacher photo with no Google key and refuses other owners', async t => {
  // Next normally resolves server-only at build time. Load the same route under Node.
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'server-only') return {url:'data:text/javascript,export%20%7B%7D',shortCircuit:true}
      return nextResolve(specifier === 'next/server' ? 'next/server.js' : specifier,context)
    },
  })
  t.after(() => hook.deregister())
  const previous = {}
  const config = {
    MINI_TEACHER_PHOTO_POSTING_ENABLED:'true', MINI_LESSONS_OPEN_PUBLISHING_ENABLED:undefined,
    MINI_GOOGLE_SAFETY_API_KEY:undefined, NEXT_PUBLIC_SUPABASE_URL:'https://mini-fixture.invalid',
    SUPABASE_SERVICE_ROLE_KEY:'test-only-service-key',
  }
  t.after(() => {
    for (const [key,value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  for (const [key,value] of Object.entries(config)) {
    previous[key] = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  const id = '10000000-0000-0000-0000-000000000001'
  const actor = '20000000-0000-0000-0000-000000000001'
  const version = '2026-11-25T15:00:00.000Z'
  const cover = actor+'/'+id+'.jpg'
  const image = await sharp({create:{width:120,height:90,channels:3,background:'#324561'}}).jpeg().toBuffer()
  const seen = []
  t.mock.method(globalThis,'fetch',async (input,init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    assert.equal(url.host,'mini-fixture.invalid')
    seen.push(url.pathname)
    if (url.pathname.endsWith('/auth/v1/user')) {
      const bearer = new Headers(init?.headers).get('authorization')
      assert.ok(['Bearer signed-in-teacher','Bearer different-user'].includes(bearer))
      return Response.json({id:bearer === 'Bearer signed-in-teacher' ? actor : '20000000-0000-0000-0000-000000000002'})
    }
    if (url.pathname.endsWith('/mini_lessons')) return Response.json([{
      id,creator_id:actor,status:'draft',cover_path:cover,updated_at:version,publication_method:'teacher_direct_photo',
    }])
    if (url.pathname.endsWith('/mini_teacher_photo_public')) return Response.json(true)
    if (url.pathname.includes('/storage/v1/object/') && url.pathname.endsWith(cover))
      return new Response(image,{headers:{'content-type':'image/jpeg'}})
    if (url.pathname.endsWith('/mini_release_teacher_photo')) {
      assert.deepEqual(JSON.parse(init.body),{p_actor:actor,p_id:id,p_version:version,p_cover:cover})
      return Response.json(true)
    }
    throw Error('Unexpected request to '+url.pathname)
  })

  const {POST} = await import('../app/api/minis/safety/route.ts')
  const request = token => new NextRequest('https://vibeschool.test/api/minis/safety',{
    method:'POST',headers:{'content-type':'application/json',...(token ? {authorization:'Bearer '+token} : {})},
    body:JSON.stringify({target:'mini',id}),
  })
  assert.equal((await POST(request())).status,401)
  const forbidden = await POST(request('different-user'))
  assert.equal(forbidden.status,403,await forbidden.text())
  assert.equal(seen.some(path => path.endsWith('/mini_release_teacher_photo')),false)
  const published = await POST(request('signed-in-teacher'))
  assert.equal(published.status,200)
  assert.deepEqual(await published.json(),{ok:true,published:true})
  assert.equal(seen.filter(path => path.endsWith('/mini_release_teacher_photo')).length,1)
})
