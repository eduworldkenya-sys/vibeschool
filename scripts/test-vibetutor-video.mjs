import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
// Works on the canonical Node 20 build host as well as newer local runtimes.
const source = ts.transpileModule(readFileSync('lib/vibetutor/video.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { availableLesson, videoRole, createVideoSession, sameVideoOrigin } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
assert.equal(sameVideoOrigin('https://vibeschool.co.ke', 'vibeschool.co.ke'), true);
assert.equal(sameVideoOrigin('http://127.0.0.1:4190', '127.0.0.1:4190'), true);
for (const origin of [null, 'null', 'https://attacker.example', 'https://vibeschool.co.ke.attacker.example', 'https://vibeschool.co.ke/path', 'invalid']) assert.equal(sameVideoOrigin(origin, 'vibeschool.co.ke'), false);
const now = Date.parse('2026-11-06T12:00:00Z');
const id = '11111111-1111-4111-8111-111111111111';
const lesson = { id, title: 'Fractions', starts_at: new Date(now).toISOString(), ends_at: new Date(now + 3600000).toISOString(), status: 'scheduled' };
assert.equal(availableLesson([lesson], id, now).title, 'Fractions');
for (const rows of [[], null, {}, [{ ...lesson, id: 'another-lesson' }]]) assert.throws(() => availableLesson(rows, id, now));
for (const status of ['cancelled', 'completed', 'pending_guardian', null]) assert.throws(() => availableLesson([{ ...lesson, status }], id, now));
for (const bad of ['bad', '../rooms', '', '11111111-1111-1111']) assert.throws(() => availableLesson([lesson], bad, now));
assert.throws(() => availableLesson([lesson], id, now - 900001), /15 minutes/);
assert.equal(availableLesson([lesson], id, now - 900000).id, id);
assert.throws(() => availableLesson([lesson], id, now + 4500000), /ended/);
for (const ends_at of ['invalid', lesson.starts_at, new Date(now + 4 * 3600000).toISOString()]) assert.throws(() => availableLesson([{ ...lesson, ends_at }], id, now));
const authority = { role: 'teacher', account_status: 'active', is_anonymized: false };
assert.equal(videoRole(authority), 'teacher');
assert.equal(videoRole({ ...authority, role: 'student' }), 'student');
for (const a of [null, {}, { ...authority, role: 'parent' }, { ...authority, role: 'admin' }, { ...authority, account_status: 'restricted' }, { ...authority, is_anonymized: true }, { role: 'student' }]) assert.throws(() => videoRole(a));
const name = 'vs-' + id;
const safeRoom = { name, url: 'https://example.daily.co/' + name, privacy: 'private', config: { exp: now / 1000 + 4500, max_participants: 2, eject_at_room_exp: true, enable_knocking: false, enable_recording: '', enforce_unique_user_ids: true } };
const requests = [];
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
const mock = async (url, options) => {
  requests.push({ url, options });
  return url.endsWith('/meeting-tokens') ? reply({ token: 'test-only-token' }) : reply(safeRoom);
};
const session = await createVideoSession(lesson, 'actor-id', 'student', 'test-only-key', mock, now);
assert.equal(session.url, safeRoom.url);
assert.equal(session.token, 'test-only-token');
const token = JSON.parse(requests[1].options.body).properties;
assert.equal(token.room_name, name);
assert.equal(token.user_id, 'actor-id');
assert.equal(token.is_owner, false);
assert.equal(token.enable_recording, false);
assert.equal(token.start_cloud_recording, false);
assert.equal(token.exp, now / 1000 + 120);
assert.equal('eject_at_token_exp' in token, false, 'do not override hard room expiry');
assert.equal(requests[0].options.redirect, 'error');
assert.equal(requests[0].options.cache, 'no-store');
for (const room of [ { ...safeRoom, privacy: 'public' }, { ...safeRoom, name: 'wrong' }, { ...safeRoom, url: 'https://attacker.example/room' }, ...['exp', 'max_participants', 'eject_at_room_exp', 'enable_knocking', 'enable_recording', 'enforce_unique_user_ids'].map(key => ({ ...safeRoom, config: { ...safeRoom.config, [key]: 'unsafe' } })) ]) {
  let tokenCalls = 0;
  await assert.rejects(() => createVideoSession(lesson, 'actor', 'teacher', 'test-key', async url => { if (url.endsWith('/meeting-tokens')) tokenCalls++; return reply(room); }, now), /privacy/);
  assert.equal(tokenCalls, 0, 'unsafe rooms must never issue tokens');
}
let calls = 0;
await createVideoSession(lesson, 'actor', 'teacher', 'test-key', async (url, options) => {
  calls++;
  if (calls === 1) return reply({}, 404);
  if (calls === 2) {
    const created = JSON.parse(options.body);
    assert.equal(created.privacy, 'private'); assert.equal(created.properties.enable_recording, false);
    assert.equal(created.properties.exp, safeRoom.config.exp);
    return reply({}, 400); // concurrent join created the room first
  }
  return url.endsWith('/meeting-tokens') ? reply({ token: 'test-only-token' }) : reply(safeRoom);
}, now);
assert.equal(calls, 4);
for (const failure of [401, 429, 500]) await assert.rejects(() => createVideoSession(lesson, 'actor', 'teacher', 'test-key', async () => reply({}, failure), now), /Could not open/);
await assert.rejects(() => createVideoSession(lesson, 'actor', 'teacher', '', mock, now), /not available/);
await assert.rejects(() => createVideoSession(lesson, 'actor', 'teacher', 'test-key', async url => reply(url.endsWith('/meeting-tokens') ? {} : safeRoom), now), /Could not join/);
console.log('PASS: video access/time/role policy; private room and token restrictions; concurrent join; unsafe rooms; provider failure paths');
