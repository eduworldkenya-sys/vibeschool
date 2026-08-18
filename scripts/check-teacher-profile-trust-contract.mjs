import fs from 'node:fs';

const account = fs.readFileSync('app/teacher/profile/account/page.tsx','utf8');
const settings = fs.readFileSync('app/teacher/settings/page.tsx','utf8');
const migration = fs.readFileSync('supabase/migrations/20260818172000_teacher_profile_trust_privacy.sql','utf8');

const required = [
  [account, 'teacher_profile_privacy'],
  [account, 'teacher_profile_verifications'],
  [account, 'scope: "global"'],
  [account, 'removeAvatar'],
  [account, 'updateUser({ password })'],
  [settings, '/teacher/profile/account'],
  [migration, 'enable row level security'],
  [migration, 'teacher_profile_privacy_select_own'],
  [migration, 'teacher_profile_verifications_select_own'],
  [migration, 'revoke all on public.teacher_profile_verifications from authenticated'],
];

for (const [source, needle] of required) {
  if (!source.includes(needle)) throw new Error(`Teacher Profile trust contract missing: ${needle}`);
}

for (const forbidden of ['Delete Account</Btn>', 'Export My Data</Btn>']) {
  if (settings.includes(forbidden)) throw new Error(`Non-functional destructive affordance returned: ${forbidden}`);
}

console.log('Teacher Profile trust/security contract PASS');
