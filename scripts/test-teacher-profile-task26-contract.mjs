import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const profile = read("app/teacher/profile/page.tsx");
const account = read("app/teacher/profile/account/page.tsx");
const settings = read("app/teacher/settings/page.tsx");
const migration = read("supabase/migrations/20260819083000_task26_teacher_profile_identity_authority.sql");
const contextHardening = read("supabase/migrations/20260819083500_task26_teacher_context_active_school_hardening.sql");

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const reject = (text, pattern, message) => expect(!pattern.test(text), message);

expect(profile.includes('teacher_get_operating_context'), "Profile must resolve school/class/subject context through canonical teacher operating context.");
expect(profile.includes('teacher_set_active_school'), "Multi-school selection must use the membership-checked active-school RPC.");
expect(profile.includes('teacher_update_my_profile'), "Profile writes must use the bounded atomic self-service RPC.");
expect(profile.includes('needs_school') && profile.includes('needs_class'), "Profile must explain missing membership and missing assignment states.");
expect(profile.includes('/teacher/profile/account') && profile.includes('/teacher/settings') && profile.includes('/teacher/help') && profile.includes('href="/teacher"'), "Profile must provide account, settings, support and Teacher Home return routes.");
expect(profile.includes('Managed by your school'), "Institution-controlled professional fields must be visibly school-managed.");
expect(profile.includes('School membership, classes and subjects are authoritative school records'), "Assignment authority boundary must be explicit.");
reject(profile, /from\(["']teacher_classes["']\)\.(insert|update|upsert|delete)/, "Profile must never mutate teacher_classes.");
reject(profile, /teacher_profiles[\s\S]{0,240}school_id\s*:/, "Profile must not write active school context into teacher_profiles.school_id.");
reject(profile, /school_announcements|homework_submissions|attendance_updates/, "Profile must not expose notification toggles outside the canonical Settings contract.");

expect(account.includes('supabase.auth.updateUser({ password })'), "Account security must use Supabase Auth for password changes.");
expect(account.includes('supabase.auth.signOut({ scope: "global" })'), "Account security must provide global sign-out.");
expect(account.includes('window.location.assign("/login")'), "Sign-out must return to anonymous login state.");
expect(account.includes('teacher_profile_privacy') && account.includes('teacher_profile_verifications'), "Account must keep privacy self-service separate from authoritative verification evidence.");

for (const key of ["attendance", "flags", "messages", "lessonPlans", "schoolNotices", "news"]) {
  expect(settings.includes(key), `Settings must preserve supported notification preference ${key}.`);
}
expect(settings.includes('/teacher/profile/account'), "Settings must expose governed account security entry point.");

expect(migration.includes('guard_teacher_profile_self_service'), "Database must guard direct teacher_profiles self-service writes.");
for (const protectedField of ["school_id", "employment_type", "subjects_taught", "designation", "leave_balance", "appraisal_score", "appraisal_notes", "finance_ref", "documents", "created_at"]) {
  expect(migration.includes(protectedField), `Self-service guard must protect ${protectedField}.`);
}
expect(migration.includes('teacher_profile_identity_reassignment_denied'), "Teacher must not reassign the identity key of their professional-profile row.");
expect(migration.includes('teacher_profile_authoritative_fields_school_managed'), "Protected field mutation must fail with a stable authority error.");
expect(migration.includes('create or replace function public.teacher_update_my_profile'), "Atomic teacher self-profile RPC must exist.");
expect(migration.includes("p.role = 'teacher'") && migration.includes("p.account_status::text = 'active'"), "Self-profile writes must fail closed for non-teacher/inactive accounts.");
reject(migration, /teacher_update_my_profile[\s\S]*update public\.teacher_profiles[\s\S]*school_id\s*=/, "Self-profile RPC must not change teacher_profiles.school_id.");
reject(migration, /teacher_update_my_profile[\s\S]*update public\.teacher_profiles[\s\S]*employment_type\s*=/, "Self-profile RPC must not change employment authority.");
expect(migration.includes('revoke all on function public.teacher_update_my_profile') && migration.includes('grant execute on function public.teacher_update_my_profile'), "Self-profile RPC execute grants must be explicit.");

expect(contextHardening.includes("s.status::text = 'active'"), "Teacher operating context must exclude inactive schools.");
expect(contextHardening.includes("p.role = 'teacher'") && contextHardening.includes("p.account_status::text = 'active'"), "Teacher operating context must require an active teacher account.");
expect(contextHardening.includes('teacher_school_scope_not_authorized'), "Unauthorized/inactive school selection must fail closed.");
expect(contextHardening.includes("'state', 'needs_school'"), "No valid active school membership must resolve to needs_school.");
expect(contextHardening.includes('revoke all on function public.teacher_get_operating_context') && contextHardening.includes('grant execute on function public.teacher_get_operating_context'), "Context resolver execute grants must remain explicit.");

if (failures.length) {
  console.error("Teacher Profile Task 26 contract FAILED:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Teacher Profile Task 26 contract PASS");
