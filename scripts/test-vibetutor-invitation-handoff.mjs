import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { AuthSessionMissingError, isAuthSessionMissingError } from '@supabase/supabase-js';

const source = readFileSync('app/student/tutoring/page.tsx', 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const token = 'a630dfc1-e57e-44f5-bbe8-f214862d8d4e';

async function run(authResult) {
  const effects = [], redirects = [], calls = [], state = [];
  const exports = {};
  const db = {
    auth: { getUser: async () => authResult },
    rpc: async (name) => {
      calls.push(name);
      return { data: name.includes('preview') ? { available: true, tutor: 'Mumbi 2' } : [], error: null };
    },
  };
  const react = {
    useState(initial) { const index = state.length; state.push(initial); return [initial, value => { state[index] = value; }]; },
    useCallback: callback => callback,
    useEffect: callback => effects.push(callback),
  };
  vm.runInNewContext(javascript, {
    exports, URLSearchParams,
    window: { location: { search: '?invite=' + token, assign: url => redirects.push(url) } },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
      if (name === 'next/link') return { default: () => null };
      if (name === '@supabase/supabase-js') return { isAuthSessionMissingError };
      if (name === '@/lib/supabase') return { getSupabaseClient: () => db };
      throw new Error('Unexpected import: ' + name);
    },
  });
  exports.default();
  effects.forEach(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
  return { redirects, calls, state };
}

// Supabase's actual missing-session error must enter sign-in with the link intact.
for (const error of [new AuthSessionMissingError(), null]) {
  const result = await run({ data: { user: null }, error });
  assert.equal(result.redirects.length, 1);
  const login = new URL(result.redirects[0], 'https://example.test');
  assert.equal(login.pathname, '/login/student');
  assert.equal(login.searchParams.get('redirect'), '/student/tutoring?invite=' + token);
  assert.deepEqual(result.calls, []);
}
// Network or invalid-token failures must not create a sign-in redirect loop.
const outage = await run({ data: { user: null }, error: new Error('Network failure') });
assert.equal(outage.redirects.length, 0);
assert(outage.state.includes('Could not verify your account. Try again.'));
const signedIn = await run({ data: { user: { id: 'student' } }, error: null });
assert.equal(signedIn.redirects.length, 0);
assert.deepEqual(signedIn.calls.sort(), ['vibetutor_preview_student_invite', 'vibetutor_student_inbox']);
assert.equal(signedIn.calls.includes('vibetutor_claim_student_invite'), false, 'Viewing a link must not accept it');
const tutor = readFileSync('app/teacher/tutoring/students/page.tsx', 'utf8');
assert.equal(tutor.split('Create invitation link').length - 1, 1);
console.log('VibeTutor invitation handoff: PASS (missing session, no session, network error, signed-in preview, no automatic acceptance, single create action)');
